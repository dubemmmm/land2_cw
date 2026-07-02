import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireAdminPage } from "@/lib/auth";
import { getLandBibleInventory, toEstateSlug } from "@/lib/landBible";
import { getMarketEstates } from "@/lib/marketDataStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { getReport } from "@/lib/reportStore";
import NewReportClient from "../../new/NewReportClient";

export const dynamic = "force-dynamic";

export default async function EditReportPage({ params }) {
  await requireAdminPage("/reports");
  const { id } = await params;
  const [report, neighborhoods, estates] = await Promise.all([
    getReport(id),
    getNeighborhoods(),
    getMarketEstates()
  ]);
  if (!report) notFound();

  return (
    <AppShell active="reports">
      <NewReportClient estates={withLandBibleEstates(estates)} initialReport={report} mode="edit" neighborhoods={neighborhoods} />
    </AppShell>
  );
}

function withLandBibleEstates(estates) {
  const byId = new Map();
  getLandBibleInventory().estates.forEach((estate) => {
    byId.set(toEstateSlug(estate.id), {
      id: toEstateSlug(estate.id),
      neighborhoodId: String(estate.neighborhood_id || "").replaceAll("_", "-"),
      name: estate.name
    });
  });
  estates.forEach((estate) => byId.set(estate.id, estate));
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}
