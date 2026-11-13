import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";

// Accounts live in their own database so they survive on Vercel, where the main
// SQLite file is temporary. Locally this is a file; in production a Turso database.
let client;
let ready;

function resolveUrl() {
  if (process.env.ACCOUNTS_DB_URL) return process.env.ACCOUNTS_DB_URL;
  if (process.env.VERCEL) {
    throw new Error("ACCOUNTS_DB_URL is not set. Accounts need a hosted database on Vercel (see README).");
  }
  return "file:./data/accounts.db";
}

export async function accountDb() {
  if (!client) {
    const url = resolveUrl();
    if (url.startsWith("file:")) {
      fs.mkdirSync(path.dirname(path.resolve(url.slice(5))), { recursive: true });
    }
    client = createClient({ url, authToken: process.env.ACCOUNTS_DB_TOKEN || undefined });
  }
  if (!ready) {
    ready = client.batch([
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
        user_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose)`,
      `CREATE TABLE IF NOT EXISTS auth_attempts (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        window_start INTEGER NOT NULL
      )`
    ], "write").catch((error) => {
      ready = null;
      throw error;
    });
  }
  await ready;
  return client;
}
