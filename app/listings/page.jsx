import AppShell from "@/components/AppShell";
import { getAdminSession, requirePortalPage } from "@/lib/auth";
import { loadMarket, toEstateSlug } from "@/lib/landBible";
import { getListingStats } from "@/lib/listingStats";
import { getLandListings } from "@/lib/listingStore";
import { getMarketEstates } from "@/lib/marketDataStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import ListingsClient from "./ListingsClient";

export const dynamic = "force-dynamic";

export default async function ListingsPage({ searchParams }) {
  const query = new URLSearchParams(Object.entries((await searchParams) || {}).filter(([, value]) => typeof value === "string")).toString();
  await requirePortalPage(query ? `/listings?${query}` : "/listings");
  const [admin, neighborhoods, marketEstates] = await Promise.all([getAdminSession(), getNeighborhoods(), getMarketEstates()]);
  const [listings, stats, marketData] = await Promise.all([
    getLandListings({ includeDrafts: Boolean(admin), summary: true }),
    getListingStats(),
    loadMarket()
  ]);
  const areaMedians = Object.fromEntries(
    Object.entries(stats.areas).filter(([, area]) => area.median).map(([id, area]) => [id, area.median])
  );
  const params = await searchParams;
  return (
    <AppShell active="listings">
      <ListingsClient
        initialListings={listings.map(forList)}
        areaMedians={areaMedians}
        fx={stats.fx}
        neighborhoods={neighborhoods}
        estates={withLandBibleEstates(marketEstates, marketData.inventory())}
        initialView={params?.view === "ledger" ? "ledger" : "cards"}
        initialLocation={params?.location || "all"}
        isAdmin={Boolean(admin)}
      />
    </AppShell>
  );
}

function withLandBibleEstates(estates, inventory) {
  const byId = new Map();
  inventory.estates.forEach((estate) => {
    byId.set(toEstateSlug(estate.id), {
      id: toEstateSlug(estate.id),
      neighborhoodId: String(estate.neighborhood_id || "").replaceAll("_", "-"),
      name: estate.name
    });
  });
  estates.forEach((estate) => byId.set(estate.id, estate));
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Only what a card or table row shows: several hundred listings are sent to the browser at once.
function forList(listing) {
  return {
    id: listing.id,
    title: listing.title,
    neighborhoodId: listing.neighborhoodId,
    neighborhoodName: listing.neighborhoodName,
    estate: listing.estate,
    sizeSqm: listing.sizeSqm,
    landUse: listing.landUse,
    offerType: listing.offerType,
    askingPrice: listing.askingPrice,
    pricePerSqm: listing.pricePerSqm,
    priceAmount: listing.priceAmount,
    priceCurrency: listing.priceCurrency,
    priceBasis: listing.priceBasis,
    quotedNaira: listing.quotedNaira,
    converted: listing.converted,
    titleDocument: listing.titleDocument,
    listingStatus: listing.listingStatus,
    workflowStatus: listing.workflowStatus,
    photos: listing.photos.slice(0, 1),
    listedAt: listing.listedAt
  };
}
