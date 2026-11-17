import AppShell from "@/components/AppShell";
import { getAdminSession, requirePortalPage } from "@/lib/auth";
import { getListingStats } from "@/lib/listingStats";
import { getLandListings } from "@/lib/listingStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import ExploreClient from "./ExploreClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore plots — Squaremeter by CW" };

export default async function ListingsPage({ searchParams }) {
  const params = (await searchParams) || {};
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => typeof value === "string")).toString();
  await requirePortalPage(query ? `/listings?${query}` : "/listings");
  const admin = await getAdminSession();
  const [listings, stats, neighborhoods] = await Promise.all([
    getLandListings({ includeDrafts: Boolean(admin), summary: true }),
    getListingStats(),
    getNeighborhoods()
  ]);

  // One entry per area for the map, the chart and each row's gauge, plus the
  // figures for Lagos as a whole under the id "all-lagos".
  const areas = neighborhoods.map((neighborhood) => {
    const area = stats.areas[neighborhood.id];
    const center = neighborhood.geometry?.center;
    return {
      id: neighborhood.id,
      name: neighborhood.name,
      center: Array.isArray(center) && center.length === 2 ? center.map(Number) : null,
      count: area?.count || 0,
      median: area?.median || null,
      q1: area?.lowerQuartile || null,
      q3: area?.upperQuartile || null
    };
  }).concat({ id: "all-lagos", name: "Lagos", center: null, count: stats.all.count, median: stats.all.median, q1: stats.all.lowerQuartile, q3: stats.all.upperQuartile });

  return (
    <AppShell active="listings" bleed>
      <ExploreClient
        listings={listings.map(forList)}
        areas={areas}
        fx={stats.fx}
        initialArea={typeof params.location === "string" ? params.location : "all"}
        isAdmin={Boolean(admin)}
      />
    </AppShell>
  );
}

// Only what a row or a chart mark shows: several hundred listings are sent to the browser at once.
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
    sourceId: listing.sourceId,
    listedAt: listing.listedAt
  };
}
