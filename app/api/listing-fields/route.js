import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createListingField, getListingFields } from "@/lib/listingFieldStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json(await getListingFields({ includeArchived: true }));
}

export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json(await createListingField(await request.json()), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not add the field" }, { status: 400 });
  }
}
