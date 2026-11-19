import { NextResponse } from "next/server";
import { getAdminSession, requireAdminApi, requirePortalApi } from "@/lib/auth";
import { getListingFields } from "@/lib/listingFieldStore";
import { buyerView, createLandListing, getLandListings } from "@/lib/listingStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, refused } = await requirePortalApi();
  if (refused) return refused;
  const listings = await getLandListings({ includeDrafts: Boolean(session.admin), summary: true });
  if (session.admin) return NextResponse.json(listings);
  const fields = await getListingFields();
  return NextResponse.json(listings.map((listing) => buyerView(listing, fields)));
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
