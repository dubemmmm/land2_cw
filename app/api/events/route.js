import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { getDataEvents } from "@/lib/neighborhoodStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json(await getDataEvents(75));
}
