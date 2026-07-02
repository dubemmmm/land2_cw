import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "cw_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function adminCredentials() {
  return {
    email: String(process.env.ADMIN_EMAIL || "admin@cwrealestate.local").trim(),
    password: String(process.env.ADMIN_PASSWORD || "admin123").trim()
  };
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
  const payload = {
    email,
    role: "admin",
    exp: Date.now() + SESSION_TTL_MS
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminToken(token) {
  if (!token || !token.includes(".")) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.role !== "admin" || Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000)
  };
}

function sign(value) {
  return crypto
    .createHmac("sha256", process.env.AUTH_SECRET || "cw-real-estate-local-secret")
    .update(value)
    .digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}
