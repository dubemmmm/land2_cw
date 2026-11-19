import { NextResponse } from "next/server";
import { getAdminSession, requireAdminApi } from "@/lib/auth";
import { restoreListingChange } from "@/lib/listingStore";

export const dynamic = "force-dynamic";

// Puts the field back to what it was before this change.
export async function POST(_request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  const { id, changeId } = await params;
  try {
    const listing = await restoreListingChange(id, changeId, admin?.email || "Admin");
    if (!listing) return NextResponse.json({ error: "That change was not found" }, { status: 404 });
    return NextResponse.json(listing);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not put the change back" }, { status: 400 });
  }
}
