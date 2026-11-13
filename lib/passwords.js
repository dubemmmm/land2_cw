import crypto from "crypto";
import { promisify } from "util";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

export function passwordProblem(password) {
  const value = String(password || "");
  if (value.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (value.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  return "";
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored || "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(String(password), Buffer.from(salt, "base64url"), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// Spend the same time as a real check when the account does not exist,
// so response time does not reveal which emails are registered.
let dummy;
export async function burnPasswordCheck(password) {
  dummy = dummy || (await hashPassword("not-a-real-password"));
  await verifyPassword(password, dummy);
}
