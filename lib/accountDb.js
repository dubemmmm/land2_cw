import fs from "fs";
import path from "path";

// Accounts live in their own database so they survive on Vercel, where the main
// SQLite file is temporary.
//   Production: PostgreSQL (AWS RDS). ACCOUNTS_DB_URL=postgres://user:pass@host:5432/dbname
//   Local work: a SQLite file, when ACCOUNTS_DB_URL is unset or starts with "file:".
// Both are driven through the same small interface, with "?" placeholders:
//   execute(sql | { sql, args }) -> { rows, rowsAffected }
//   batch([...statements])       -> runs them in one transaction
let store;
let ready;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'customer',
    company TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    email_verified_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending_email',
    session_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose)`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start BIGINT NOT NULL
  )`
];

function resolveUrl() {
  const url = String(process.env.ACCOUNTS_DB_URL || "").trim();
  if (url) return url;
  if (process.env.VERCEL) {
    throw new Error("ACCOUNTS_DB_URL is not set. On Vercel, accounts need the PostgreSQL database (see README).");
  }
  return "file:./data/accounts.db";
}

function normalize(input) {
  return typeof input === "string" ? { sql: input, args: [] } : { sql: input.sql, args: input.args || [] };
}

/* ---------- PostgreSQL ---------- */

function isLocalHost(url) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

// RDS requires TLS. With ACCOUNTS_DB_CA (the RDS certificate bundle, PEM text) the
// server certificate is verified; without it the connection is encrypted but unverified.
function sslOptions(url) {
  if (process.env.ACCOUNTS_DB_SSL === "disable" || isLocalHost(url)) return false;
  const ca = String(process.env.ACCOUNTS_DB_CA || "").split("\\n").join("\n").trim();
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

// "?" placeholders become $1, $2, ... for PostgreSQL.
function toPg(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function openPostgres(url) {
  const { default: pg } = await import("pg");
  // Each serverless instance keeps a small pool, so many instances do not exhaust RDS connections.
  const pool = new pg.Pool({ connectionString: url, ssl: sslOptions(url), max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000 });
  pool.on("error", (error) => console.error("[accounts db] idle connection error:", error.message));
  const run = async (runner, input) => {
    const { sql, args } = normalize(input);
    const result = await runner.query(toPg(sql), args);
    return { rows: result.rows, rowsAffected: result.rowCount || 0 };
  };
  return {
    execute: (input) => run(pool, input),
    async batch(statements) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const statement of statements) await run(client, statement);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

/* ---------- SQLite (local work) ---------- */

async function openSqlite(url) {
  const { default: Database } = await import("better-sqlite3");
  const file = path.resolve(url.startsWith("file:") ? url.slice(5) : url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const run = (input) => {
    const { sql, args } = normalize(input);
    const statement = db.prepare(sql);
    if (statement.reader) return { rows: statement.all(...args), rowsAffected: 0 };
    return { rows: [], rowsAffected: statement.run(...args).changes };
  };
  return {
    execute: async (input) => run(input),
    batch: async (statements) => db.transaction(() => statements.forEach(run))()
  };
}

export async function accountDb() {
  if (!ready) {
    ready = (async () => {
      const url = resolveUrl();
      store = url.startsWith("postgres://") || url.startsWith("postgresql://") ? await openPostgres(url) : await openSqlite(url);
      for (const statement of SCHEMA) await store.execute(statement);
      return store;
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
