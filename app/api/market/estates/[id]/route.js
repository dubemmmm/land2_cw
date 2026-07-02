import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { deleteMarketEstate, updateMarketEstate } from "@/lib/marketDataStore";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    const estate = await updateMarketEstate(id, await request.json());
    if (!estate) return NextResponse.json({ error: "Estate not found" }, { status: 404 });
    return NextResponse.json(estate);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update estate" }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const estate = await deleteMarketEstate(id);
  if (!estate) return NextResponse.json({ error: "Estate not found" }, { status: 404 });
  return NextResponse.json(estate);
}
