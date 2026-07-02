import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { createNeighborhood, getNeighborhoods } from "@/lib/neighborhoodStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getNeighborhoods());
}

export async function POST(request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    const record = await createNeighborhood(body);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create neighborhood" }, { status: 400 });
  }
}
