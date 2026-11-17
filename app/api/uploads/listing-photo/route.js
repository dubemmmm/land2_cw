import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { publicUrl, s3Config, signedUploadUrl } from "@/lib/s3";

export const dynamic = "force-dynamic";

const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Hands a signed-in admin a short-lived address to upload one listing photo to,
// and the public address the photo will have once it is there.
export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const config = s3Config();
  if (!config) return NextResponse.json({ error: "Photo storage is not set up" }, { status: 503 });
  const { contentType } = await request.json().catch(() => ({}));
  const extension = extensions[contentType];
  if (!extension) return NextResponse.json({ error: "Photos must be JPG, PNG or WebP" }, { status: 400 });
  const key = `listings/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
  return NextResponse.json({ uploadUrl: signedUploadUrl(key, contentType, config), url: publicUrl(key, config) });
}
