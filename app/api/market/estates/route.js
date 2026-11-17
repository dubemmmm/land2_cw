import { NextResponse } from "next/server";
import { requireAdminApi, requirePortalApi } from "@/lib/auth";
import { createMarketEstate, getMarketEstates } from "@/lib/marketDataStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { refused } = await requirePortalApi();
  if (refused) return refused;
  return NextResponse.json(await getMarketEstates());
}

export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    return NextResponse.json(await createMarketEstate(body), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create estate" }, { status: 400 });
  }
}
