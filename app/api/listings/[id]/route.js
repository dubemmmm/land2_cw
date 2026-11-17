import { NextResponse } from "next/server";
import { getAdminSession, requireAdminApi, requirePortalApi } from "@/lib/auth";
import { deleteLandListing, getLandListing, updateLandListing } from "@/lib/listingStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { session, refused } = await requirePortalApi();
  if (refused) return refused;
  const { id } = await params;
  const listing = await getLandListing(id, { includeDrafts: Boolean(session.admin) });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  return NextResponse.json(listing);
}

export async function PATCH(request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  const { id } = await params;
  try {
    const patch = await request.json();
    const listing = await updateLandListing(id, patch, admin?.email || "Admin");
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    return NextResponse.json(listing);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update listing" }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  const { id } = await params;
  const listing = await deleteLandListing(id, admin?.email || "Admin");
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  return NextResponse.json(listing);
}
