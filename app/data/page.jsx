import AppShell from "@/components/AppShell";
import { requireAdminPage } from "@/lib/auth";
import { getLandBibleInventory, toEstateSlug } from "@/lib/landBible";
import { getLandListings } from "@/lib/listingStore";
import { getMarketEstates, getPricePoints } from "@/lib/marketDataStore";
import { getDataEvents, getNeighborhoods } from "@/lib/neighborhoodStore";
import { getResources } from "@/lib/resourceStore";
import DataAdminClient from "./DataAdminClient";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const admin = await requireAdminPage("/data");
  const [neighborhoods, events, resources, marketEstates, pricePoints, listings] = await Promise.all([
    getNeighborhoods(),
    getDataEvents(12),
    getResources(),
    getMarketEstates(),
    getPricePoints(),
    getLandListings({ includeDrafts: true, summary: true })
  ]);
  const inventory = await getLandBibleInventory();
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
        initialListings={listings.map(forAdminTable)}
        estates={estates}
        adminEmail={admin.email}
      />
    </AppShell>
  );
}

// What the listings table on this page shows and edits, without descriptions or photo data.
function forAdminTable(listing) {
  return {
    id: listing.id,
    title: listing.title,
    neighborhoodId: listing.neighborhoodId,
    estate: listing.estate,
    sizeSqm: listing.sizeSqm,
    offerType: listing.offerType,
    pricePerSqm: listing.pricePerSqm,
    priceAmount: listing.priceAmount,
    priceCurrency: listing.priceCurrency,
    priceBasis: listing.priceBasis,
    titleDocument: listing.titleDocument,
    listingStatus: listing.listingStatus,
    workflowStatus: listing.workflowStatus,
    photoCount: listing.photos.length,
    agentName: listing.agentName,
    sourceId: listing.sourceId
  };
}
