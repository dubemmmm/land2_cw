import { NextResponse } from "next/server";
import { getAdminSession, requireAdminApi } from "@/lib/auth";
import { deleteResource, getResource, updateResource } from "@/lib/resourceStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const resource = await getResource(id);
  if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  return NextResponse.json(resource);
}

export async function PATCH(request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  const { id } = await params;
  try {
    const patch = await request.json();
    const resource = await updateResource(id, patch, admin?.email || "Admin");
    if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    return NextResponse.json(resource);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update resource" }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  const { id } = await params;
  const resource = await deleteResource(id, admin?.email || "Admin");
  if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  return NextResponse.json(resource);
}
