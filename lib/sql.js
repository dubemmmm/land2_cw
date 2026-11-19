import fs from "fs";
import path from "path";

// One small interface over the two databases the app runs on:
//   PostgreSQL (AWS RDS) in production, a SQLite file for local work.
//
//   store.all(sql, ...args)  -> rows
//   store.get(sql, ...args)  -> first row or undefined
//   store.run(sql, ...args)  -> { changes }
//   store.exec(sql)          -> runs statements that take no parameters
//   store.transaction(fn)    -> fn(tx) with the same methods, committed or rolled back as one
//
// SQL is written once, in the SQLite style ("?" placeholders, camelCase column
// aliases, rowid); toPostgres() adapts it. store.dialect says which one is live.

const pools = new Map();

export function isPostgresUrl(url) {
  return /^postgres(ql)?:\/\//.test(String(url || ""));
}

export async function openStore(url) {
  return isPostgresUrl(url) ? openPostgres(url) : openSqlite(url);
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

// One pool per connection string, shared by everything that talks to that
// database, so a serverless instance holds a handful of connections at most.
export async function getPgPool(url) {
  if (pools.has(url)) return pools.get(url);
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: url,
    ssl: sslOptions(url),
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    // Keeps idle connections from being dropped silently by routers in between.
    keepAlive: true,
    // COUNT(*) and BIGINT columns arrive as numbers, as they do from SQLite.
    types: { getTypeParser: (oid, format) => (oid === 20 ? Number : pg.types.getTypeParser(oid, format)) }
  });
  pool.on("error", (error) => console.error("[db] idle connection error:", error.message));
  pools.set(url, pool);
  return pool;
}

// SQLite-style SQL to PostgreSQL:
//   ?                 -> $1, $2, ...
//   AS camelCase      -> AS "camelCase"   (PostgreSQL lowercases unquoted names)
//   rowid             -> seq              (the insertion-order column in the PostgreSQL schema)
export function toPostgres(sql) {
  let index = 0;
  return sql
    .replace(/\?/g, () => `$${++index}`)
    .replace(/\bAS\s+([a-z]+[A-Z]\w*)/g, 'AS "$1"')
    .replace(/\browid\b/g, "seq");
}

// Failures that happen before a statement is sent, so trying again cannot
// run anything twice: the network blinked or the database was slow to answer.
const NOT_CONNECTED = /connection timeout|timeout exceeded when trying to connect|ECONNREFUSED|ECONNRESET|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/i;

function couldNotConnect(error) {
  return NOT_CONNECTED.test(`${error?.code || ""} ${error?.message || ""}`);
}

async function retryConnect(attempt) {
  try {
    return await attempt();
  } catch (error) {
    if (!couldNotConnect(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return attempt();
  }
}

// A plain message for the error page instead of the driver's wording.
function explain(error) {
  if (!couldNotConnect(error)) return error;
  const plain = new Error("Could not reach the database. Check the internet connection and try again.", { cause: error });
  plain.code = "DB_UNREACHABLE";
  return plain;
}

async function openPostgres(url) {
  const pool = await getPgPool(url);
  // Pool statements open their own connection, so a failed connect is retried once.
  const pooled = {
    query: (sql, args) => retryConnect(() => pool.query(sql, args)).catch((error) => { throw explain(error); })
  };
  const methods = (runner) => ({
    dialect: "postgres",
    async all(sql, ...args) {
      return (await runner.query(toPostgres(sql), args)).rows;
    },
    async get(sql, ...args) {
      return (await runner.query(toPostgres(sql), args)).rows[0];
    },
    async run(sql, ...args) {
      return { changes: (await runner.query(toPostgres(sql), args)).rowCount || 0 };
    },
    async exec(sql) {
      await runner.query(sql);
    }
  });
  return {
    ...methods(pooled),
    async transaction(fn) {
      const client = await retryConnect(() => pool.connect()).catch((error) => { throw explain(error); });
      try {
        await client.query("BEGIN");
        const result = await fn(methods(client));
        await client.query("COMMIT");
        return result;
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
  const file = path.resolve(String(url).startsWith("file:") ? String(url).slice(5) : String(url));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const store = {
    dialect: "sqlite",
    async all(sql, ...args) {
      return db.prepare(sql).all(...args);
    },
    async get(sql, ...args) {
      return db.prepare(sql).get(...args);
    },
    async run(sql, ...args) {
      return { changes: db.prepare(sql).run(...args).changes };
    },
    async exec(sql) {
      db.exec(sql);
    },
    async transaction(fn) {
      db.exec("BEGIN");
      try {
        const result = await fn(store);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    }
  };
  return store;
}
