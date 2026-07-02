import AppShell from "@/components/AppShell";
import { requireAdminPage } from "@/lib/auth";
import { getLandBibleInventory, toEstateSlug } from "@/lib/landBible";
import { getMarketEstates, getPricePoints } from "@/lib/marketDataStore";
import { getDataEvents, getNeighborhoods } from "@/lib/neighborhoodStore";
import { getResources } from "@/lib/resourceStore";
import DataAdminClient from "./DataAdminClient";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const admin = await requireAdminPage("/data");
  const [neighborhoods, events, resources, marketEstates, pricePoints] = await Promise.all([
    getNeighborhoods(),
    getDataEvents(12),
    getResources(),
    getMarketEstates(),
    getPricePoints()
  ]);
  const inventory = getLandBibleInventory();
  const estates = inventory.estates.map((estate) => ({
    id: toEstateSlug(estate.id),
    name: estate.name,
    parentId: toEstateSlug(estate.neighborhood_id || ""),
    parentName: estate.location_label || estate.neighborhood_id || "Estate"
  }));
  return (
    <AppShell active="data">
      <DataAdminClient
        initialRecords={neighborhoods}
        initialEvents={events}
        initialResources={resources}
        initialMarketEstates={marketEstates}
        initialPricePoints={pricePoints}
        estates={estates}
        adminEmail={admin.email}
      />
    </AppShell>
  );
}
