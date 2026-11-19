import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getListingViews, saveListingViews } from "@/lib/listingFieldStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json(await getListingViews());
}

export async function PUT(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  try {
    const { views } = await request.json();
    return NextResponse.json(await saveListingViews(views));
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save the views" }, { status: 400 });
  }
}
