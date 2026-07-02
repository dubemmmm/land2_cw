import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createPricePoint, getPricePoints } from "@/lib/marketDataStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(await getPricePoints({
    targetType: searchParams.get("targetType") || undefined,
    targetId: searchParams.get("targetId") || undefined
  }));
}

export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    return NextResponse.json(await createPricePoint(body), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save price point" }, { status: 400 });
  }
}
