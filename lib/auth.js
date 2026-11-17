import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { findUserById, publicUser } from "@/lib/userStore";

export const ADMIN_COOKIE = "cw_admin_session";
export const USER_COOKIE = "sq_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const USER_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_SECRET = "cw-real-estate-local-secret";
const LOCAL_ADMIN = { email: "admin@cwrealestate.local", password: "admin123" };
const isProduction = () => process.env.NODE_ENV === "production";

/* ---------- Admin (single account from environment variables) ---------- */

// The built-in development account only exists outside production. In production
// both values must be set, otherwise there is no admin account at all.
export function adminCredentials() {
  const email = String(process.env.ADMIN_EMAIL || "").trim();
  const password = String(process.env.ADMIN_PASSWORD || "").trim();
  if (email && password) return { email, password };
  if (isProduction()) return null;
  return { email: email || LOCAL_ADMIN.email, password: password || LOCAL_ADMIN.password };
}

export function hasConfiguredAdminCredentials() {
  return Boolean(process.env.ADMIN_EMAIL || process.env.ADMIN_PASSWORD);
}

export async function getAdminSession() {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdminPage(next = "/data") {
  const session = await getAdminSession();
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  return session;
}

export async function requireAdminApi() {
  const session = await getAdminSession();
  if (session) return null;
  return NextResponse.json({ error: "Admin login required" }, { status: 401 });
}

export function createAdminToken(email) {
  return signPayload({ email, role: "admin", exp: Date.now() + SESSION_TTL_MS });
}

export function verifyAdminToken(token) {
  const payload = readPayload(token);
  return payload && payload.role === "admin" ? payload : null;
}

export function adminCookieOptions() {
  return cookieOptions(SESSION_TTL_MS);
}

/* ---------- Customers and agents ---------- */

export function createUserToken(user) {
  return signPayload({ uid: user.id, sv: Number(user.session_version), exp: Date.now() + USER_SESSION_TTL_MS });
}

export function userCookieOptions() {
  return cookieOptions(USER_SESSION_TTL_MS);
}

export function setUserCookie(response, user) {
  response.cookies.set(USER_COOKIE, createUserToken(user), userCookieOptions());
  return response;
}

export function clearUserCookie(response) {
  response.cookies.set(USER_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}

// The signed cookie only names the user. The account is looked up every time, so a
// suspension or password change (which bumps session_version) ends open sessions.
export async function getUserRow() {
  const store = await cookies();
  const payload = readPayload(store.get(USER_COOKIE)?.value);
  if (!payload?.uid) return null;
  const user = await findUserById(payload.uid);
  if (!user || user.status !== "active" || Number(user.session_version) !== Number(payload.sv)) return null;
  return user;
}

export async function getUserSession() {
  return publicUser(await getUserRow());
}

export async function requireUserPage(next = "/account") {
  const user = await getUserSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/* ---------- The intelligence portal ---------- */

// The portal (dashboard, listings, map, locations, estates, reports, signals)
// is for people with an account: a signed-in buyer or agent, or the CW admin.
// Returns { admin, user } (either may be null), or null when nobody is signed in.
export async function getPortalSession() {
  const [admin, user] = await Promise.all([getAdminSession(), getUserSession()]);
  return admin || user ? { admin, user } : null;
}

// For pages: sends a signed-out visitor to sign in, and back to `next` afterwards.
export async function requirePortalPage(next = "/dashboard") {
  const session = await getPortalSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}`);
  return session;
}

// For API routes: { session } when signed in, otherwise { refused } to return as the response.
export async function requirePortalApi() {
  const session = await getPortalSession();
  if (session) return { session };
  return { refused: NextResponse.json({ error: "Sign in to continue" }, { status: 401 }) };
}

/* ---------- Request checks ---------- */

// Only allow redirects to paths inside this site.
export function safeNext(value, fallback = "/") {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}

// Browsers send Origin on cross-site POSTs. Refuse when it names another site.
export function crossSiteResponse(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = "";
  }
  if (originHost && originHost === host) return null;
  return NextResponse.json({ error: "Request refused" }, { status: 403 });
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip") || "local").trim();
}

/* ---------- Signing ---------- */

function cookieOptions(ttlMs) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
    path: "/",
    maxAge: Math.floor(ttlMs / 1000)
  };
}

function signPayload(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function readPayload(token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  try {
    if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return Number(payload.exp) > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

// In production a session can only be signed with a real secret. The fallback
// is public in the repository, so it is for local development only.
function secret() {
  const value = process.env.AUTH_SECRET;
  if (value) return value;
  if (isProduction()) throw new Error("AUTH_SECRET is not set");
  return LOCAL_SECRET;
}

function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
