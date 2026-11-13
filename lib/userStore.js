import crypto from "crypto";
import { accountDb } from "@/lib/accountDb";
import { hashPassword } from "@/lib/passwords";

export const ROLES = ["customer", "agent"];
const TOKEN_TTL_MS = { verify: 24 * 60 * 60 * 1000, reset: 60 * 60 * 1000 };

const now = () => new Date().toISOString();
const hashToken = (raw) => crypto.createHash("sha256").update(String(raw)).digest("hex");

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

// What is safe to hand to pages and API responses.
export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    company: row.company,
    status: row.status,
    emailVerified: Boolean(row.email_verified_at),
    createdAt: row.created_at
  };
}

export async function findUserByEmail(email) {
  const db = await accountDb();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ?", args: [normalizeEmail(email)] });
  return result.rows[0] || null;
}

export async function findUserById(id) {
  if (!id) return null;
  const db = await accountDb();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE id = ?", args: [String(id)] });
  return result.rows[0] || null;
}

export async function createUser({ name, email, phone = "", role = "customer", company = "", password }) {
  const db = await accountDb();
  const id = crypto.randomUUID();
  const stamp = now();
  await db.execute({
    sql: `INSERT INTO users (id, email, name, phone, role, company, password_hash, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_email', ?, ?)`,
    args: [id, normalizeEmail(email), name, phone, ROLES.includes(role) ? role : "customer", company, await hashPassword(password), stamp, stamp]
  });
  return findUserById(id);
}

// Confirming an email activates a customer and queues an agent for approval.
export async function markEmailVerified(user) {
  const db = await accountDb();
  const status = user.status === "pending_email" ? (user.role === "agent" ? "pending_approval" : "active") : user.status;
  await db.execute({
    sql: "UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), status = ?, updated_at = ? WHERE id = ?",
    args: [now(), status, now(), user.id]
  });
  return findUserById(user.id);
}

// Changing the password bumps session_version, which signs out every open session.
export async function setPassword(userId, password) {
  const db = await accountDb();
  await db.execute({
    sql: "UPDATE users SET password_hash = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?",
    args: [await hashPassword(password), now(), userId]
  });
  return findUserById(userId);
}

export async function updateProfile(userId, { name, phone, company }) {
  const db = await accountDb();
  await db.execute({
    sql: "UPDATE users SET name = ?, phone = ?, company = ?, updated_at = ? WHERE id = ?",
    args: [name, phone, company, now(), userId]
  });
  return findUserById(userId);
}

export async function setStatus(userId, status) {
  const db = await accountDb();
  await db.execute({
    sql: "UPDATE users SET status = ?, session_version = session_version + 1, updated_at = ? WHERE id = ?",
    args: [status, now(), userId]
  });
  return findUserById(userId);
}

export async function listUsers() {
  const db = await accountDb();
  const result = await db.execute("SELECT * FROM users ORDER BY created_at DESC");
  return result.rows.map(publicUser);
}

/* ---------- One-time email links ---------- */

// Returns the raw token for the link. Only its hash is stored, and any earlier
// unused link of the same kind stops working.
export async function issueToken(userId, purpose) {
  const db = await accountDb();
  const raw = crypto.randomBytes(32).toString("base64url");
  const stamp = now();
  await db.batch([
    { sql: "DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL", args: [userId, purpose] },
    {
      sql: "INSERT INTO auth_tokens (id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), userId, purpose, hashToken(raw), new Date(Date.now() + TOKEN_TTL_MS[purpose]).toISOString(), stamp]
    }
  ]);
  return raw;
}

async function findLiveToken(raw, purpose) {
  if (!raw) return null;
  const db = await accountDb();
  const result = await db.execute({
    sql: "SELECT * FROM auth_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?",
    args: [hashToken(raw), purpose, now()]
  });
  return result.rows[0] || null;
}

export async function tokenIsLive(raw, purpose) {
  return Boolean(await findLiveToken(raw, purpose));
}

// Marks the link used and returns its user, or null if it is unknown, expired or already used.
export async function consumeToken(raw, purpose) {
  const token = await findLiveToken(raw, purpose);
  if (!token) return null;
  const db = await accountDb();
  const result = await db.execute({
    sql: "UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL",
    args: [now(), token.id]
  });
  if (!result.rowsAffected) return null;
  return findUserById(token.user_id);
}

/* ---------- Rate limits ---------- */

export async function isLimited(key, max, windowMs) {
  const db = await accountDb();
  const result = await db.execute({ sql: "SELECT count, window_start FROM auth_attempts WHERE key = ?", args: [key] });
  const row = result.rows[0];
  if (!row) return false;
  if (Date.now() - Number(row.window_start) > windowMs) return false;
  return Number(row.count) >= max;
}

export async function recordAttempt(key, windowMs) {
  const db = await accountDb();
  const cutoff = Date.now() - windowMs;
  await db.execute({
    sql: `INSERT INTO auth_attempts (key, count, window_start) VALUES (?, 1, ?)
          ON CONFLICT(key) DO UPDATE SET
            count = CASE WHEN auth_attempts.window_start < ? THEN 1 ELSE auth_attempts.count + 1 END,
            window_start = CASE WHEN auth_attempts.window_start < ? THEN excluded.window_start ELSE auth_attempts.window_start END`,
    args: [key, Date.now(), cutoff, cutoff]
  });
}

// Count one attempt and say whether it is still within the allowance.
export async function allowAttempt(key, max, windowMs) {
  if (await isLimited(key, max, windowMs)) return false;
  await recordAttempt(key, windowMs);
  return true;
}

export async function clearAttempts(key) {
  const db = await accountDb();
  await db.execute({ sql: "DELETE FROM auth_attempts WHERE key = ?", args: [key] });
}
