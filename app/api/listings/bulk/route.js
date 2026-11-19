import { NextResponse } from "next/server";
import { getAdminSession, requireAdminApi } from "@/lib/auth";
import { binLandListings, purgeLandListings, restoreLandListings, updateLandListings } from "@/lib/listingStore";

export const dynamic = "force-dynamic";

const MOST = 1000;

// One change to many listings: { ids, patch } saves the same values on each,
// { ids, action } moves them to the bin, brings them back, or removes them for good.
export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const admin = await getAdminSession();
  const actor = admin?.email || "Admin";
  try {
    const { ids, patch, action } = await request.json();
    const list = Array.isArray(ids) ? ids.map(String).slice(0, MOST) : [];
    if (!list.length) return NextResponse.json({ error: "Choose at least one listing" }, { status: 400 });
    if (action === "bin") return NextResponse.json({ listings: await binLandListings(list, actor) });
    if (action === "restore") return NextResponse.json({ listings: await restoreLandListings(list, actor) });
    if (action === "purge") return NextResponse.json({ removed: await purgeLandListings(list) });
    if (!patch || typeof patch !== "object") return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    return NextResponse.json({ listings: await updateLandListings(list, patch, actor) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save the change" }, { status: 400 });
  }
}
