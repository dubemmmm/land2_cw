import { NextResponse } from "next/server";
import {
  createClient,
  createDashboardSignal,
  createDashboardTask,
  createTeamActivity,
  getDashboardData
} from "@/lib/dashboardStore";

export async function GET() {
  return NextResponse.json(await getDashboardData());
}

export async function POST(request) {
  try {
    const body = await request.json();
    const type = body.type || "task";
    const payload = body.payload || body;
    if (type === "signal") return NextResponse.json(await createDashboardSignal(payload), { status: 201 });
    if (type === "activity") return NextResponse.json(await createTeamActivity(payload), { status: 201 });
    if (type === "client") return NextResponse.json(await createClient(payload), { status: 201 });
    return NextResponse.json(await createDashboardTask(payload), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unable to save dashboard item" }, { status: 400 });
  }
}
