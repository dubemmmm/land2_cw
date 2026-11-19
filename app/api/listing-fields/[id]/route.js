import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { updateListingField } from "@/lib/listingFieldStore";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    const field = await updateListingField(id, await request.json());
    if (!field) return NextResponse.json({ error: "Field not found" }, { status: 404 });
    return NextResponse.json(field);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not save the field" }, { status: 400 });
  }
}
