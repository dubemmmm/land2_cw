import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getResourceFile } from "@/lib/resourceStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const file = await getResourceFile(id);
  if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });

  if (file.visibility !== "Client") {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Admin login required" }, { status: 401 });
  }

  const bytes = file.fileData instanceof Uint8Array ? file.fileData : Buffer.from(file.fileData);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(file.fileSize || bytes.length),
      "Content-Disposition": `inline; filename="${safeFilename(file.fileName || file.title || "attachment")}"`
    }
  });
}

function safeFilename(value) {
  return String(value).replace(/["\r\n]/g, "").slice(0, 160) || "attachment";
}
