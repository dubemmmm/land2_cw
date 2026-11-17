import crypto from "crypto";

// Listing photos live in an S3 bucket. The browser uploads each file straight
// to S3 with a short-lived signed address made here, and the database keeps
// only the photo's public address.
//
// Settings: S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
// (Vercel reserves the AWS_* names, so the app uses its own.)
// Signing is AWS Signature Version 4, done here to avoid pulling in the AWS SDK.

const UPLOAD_SECONDS = 300;

export function s3Config() {
  const bucket = String(process.env.S3_BUCKET || "").trim();
  const region = String(process.env.S3_REGION || "").trim();
  const accessKeyId = String(process.env.S3_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.S3_SECRET_ACCESS_KEY || "").trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, accessKeyId, secretAccessKey, host: `${bucket}.s3.${region}.amazonaws.com` };
}

// The address a stored object is read from. Objects under listings/ are public.
export function publicUrl(key, config = s3Config()) {
  return config ? `https://${config.host}/${encodePath(key)}` : null;
}

// Whether `url` is an object in our bucket, and if so its key.
export function keyFromUrl(url, config = s3Config()) {
  if (!config) return null;
  const prefix = `https://${config.host}/`;
  return String(url || "").startsWith(prefix) ? decodeURIComponent(String(url).slice(prefix.length).split("?")[0]) : null;
}

// A signed address the browser can PUT one file to. The upload must send
// exactly this Content-Type, so an image address cannot be used for anything else.
export function signedUploadUrl(key, contentType, config = s3Config()) {
  return signedUrl("PUT", key, config, UPLOAD_SECONDS, { "content-type": contentType });
}

export function signedDeleteUrl(key, config = s3Config()) {
  return signedUrl("DELETE", key, config, 60);
}

export async function deleteObject(key, config = s3Config()) {
  if (!config) return false;
  const response = await fetch(signedDeleteUrl(key, config), { method: "DELETE" });
  return response.ok;
}

function signedUrl(method, key, config, expires, headers = {}) {
  if (!config) throw new Error("Photo storage is not set up (S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)");
  const now = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = now.slice(0, 8);
  const scope = `${date}/${config.region}/s3/aws4_request`;
  const signed = { host: config.host, ...headers };
  const names = Object.keys(signed).sort();
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${scope}`,
    "X-Amz-Date": now,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": names.join(";")
  });
  query.sort();
  const canonicalQuery = [...query].map(([name, value]) => `${rfc3986(name)}=${rfc3986(value)}`).join("&");
  const path = `/${encodePath(key)}`;
  const canonical = [
    method,
    path,
    canonicalQuery,
    ...names.map((name) => `${name}:${String(signed[name]).trim()}`),
    "",
    names.join(";"),
    "UNSIGNED-PAYLOAD"
  ].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", now, scope, sha256(canonical)].join("\n");
  const signingKey = ["aws4_request"].reduce(
    (key, part) => hmac(key, part),
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, date), config.region), "s3")
  );
  return `https://${config.host}${path}?${canonicalQuery}&X-Amz-Signature=${hmac(signingKey, toSign).toString("hex")}`;
}

function encodePath(key) {
  return String(key).split("/").map(rfc3986).join("/");
}

function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value).digest();
}
