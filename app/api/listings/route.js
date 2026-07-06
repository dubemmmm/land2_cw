import { NextResponse } from "next/server";
import { getAdminSession, requireAdminApi } from "@/lib/auth";
import { createLandListing, getLandListings } from "@/lib/listingStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminSession();
  return NextResponse.json(await getLandListings({ includeDrafts: Boolean(admin) }));
}

export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  try {
    const body = await request.json();
    const listing = await createLandListing(body, admin?.email || "Admin");
    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create listing" }, { status: 400 });
  }
}
