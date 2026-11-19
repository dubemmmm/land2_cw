import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getListingHistory } from "@/lib/listingStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  return NextResponse.json(await getListingHistory(id));
}
