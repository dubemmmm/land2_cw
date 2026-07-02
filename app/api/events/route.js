import { NextResponse } from "next/server";
import { getDataEvents } from "@/lib/neighborhoodStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getDataEvents(75));
}
