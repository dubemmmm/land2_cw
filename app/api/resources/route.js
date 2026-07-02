import { NextResponse } from "next/server";
import { getAdminSession, requireAdminApi } from "@/lib/auth";
import { createResource, getResources } from "@/lib/resourceStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(await getResources({
    targetType: searchParams.get("targetType") || undefined,
    targetId: searchParams.get("targetId") || undefined,
    visibility: searchParams.get("visibility") || undefined
  }));
}

export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  try {
    const body = await parseResourceBody(request);
    const resource = await createResource(body, admin?.email || "Admin");
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create resource" }, { status: 400 });
  }
}

async function parseResourceBody(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) return request.json();

  const form = await request.formData();
  const file = form.get("file");
  const body = {
    targetType: form.get("targetType"),
    targetId: form.get("targetId"),
    resourceType: form.get("resourceType"),
    title: form.get("title"),
    summary: form.get("summary"),
    url: form.get("url"),
    source: form.get("source"),
    visibility: form.get("visibility")
  };

  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > 15 * 1024 * 1024) throw new Error("Document must be 15MB or smaller");
    const bytes = Buffer.from(await file.arrayBuffer());
    body.fileName = file.name || "attachment";
    body.mimeType = file.type || "application/octet-stream";
    body.fileSize = file.size;
    body.fileData = bytes;
    body.resourceType = body.resourceType || "Attachment";
    body.title = body.title || body.fileName;
  }
  return body;
}
