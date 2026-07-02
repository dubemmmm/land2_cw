import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { deleteNeighborhood, getNeighborhood, updateNeighborhood } from "@/lib/neighborhoodStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const record = await getNeighborhood(id);
  if (!record) return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
  return NextResponse.json(record);
}

export async function PATCH(request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    const patch = await request.json();
    const record = await updateNeighborhood(id, patch);
    if (!record) return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
    return NextResponse.json(record);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update neighborhood" }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const record = await deleteNeighborhood(id);
  if (!record) return NextResponse.json({ error: "Neighborhood not found" }, { status: 404 });
  return NextResponse.json(record);
}
