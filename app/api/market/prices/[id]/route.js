import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { deletePricePoint } from "@/lib/marketDataStore";

export const dynamic = "force-dynamic";

export async function DELETE(_request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const point = await deletePricePoint(id);
  if (!point) return NextResponse.json({ error: "Price point not found" }, { status: 404 });
  return NextResponse.json(point);
}
