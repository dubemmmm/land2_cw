import AppShell from "@/components/AppShell";
import { requireAdminPage } from "@/lib/auth";
import { getLandBibleInventory, toEstateSlug } from "@/lib/landBible";
import { getLandListing, getLandListings } from "@/lib/listingStore";
import { getMarketEstates } from "@/lib/marketDataStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import NewListingClient from "./NewListingClient";

export const dynamic = "force-dynamic";

export default async function NewListingPage({ searchParams }) {
  await requireAdminPage("/listings/new");
  const params = await searchParams;
  const [neighborhoods, marketEstates, listings] = await Promise.all([
    getNeighborhoods(),
    getMarketEstates(),
    getLandListings({ includeDrafts: true })
  ]);
  const initialListing = params?.id ? await getLandListing(params.id, { includeDrafts: true }) : null;
  return (
    <AppShell active="listings">
      <NewListingClient
        neighborhoods={neighborhoods}
        estates={withLandBibleEstates(marketEstates)}
        listingsCount={listings.length}
        initialListing={initialListing}
      />
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
