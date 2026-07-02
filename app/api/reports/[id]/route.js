import { NextResponse } from "next/server";
import { deleteReport, getReport, updateReport } from "@/lib/reportStore";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(report);
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const patch = await request.json();
    const report = await updateReport(id, patch);
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not update report" }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const report = await deleteReport(id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(report);
}
