import AppShell from "@/components/AppShell";
import { getAdminSession } from "@/lib/auth";
import { getLandBibleInventory, toEstateSlug } from "@/lib/landBible";
import { getLandListings } from "@/lib/listingStore";
import { getMarketEstates } from "@/lib/marketDataStore";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import ListingsClient from "./ListingsClient";

export const dynamic = "force-dynamic";

export default async function ListingsPage({ searchParams }) {
  const [admin, neighborhoods, marketEstates] = await Promise.all([getAdminSession(), getNeighborhoods(), getMarketEstates()]);
  const listings = await getLandListings({ includeDrafts: Boolean(admin) });
  const params = await searchParams;
  return (
    <AppShell active="listings">
      <ListingsClient
        initialListings={listings}
        neighborhoods={neighborhoods}
        estates={withLandBibleEstates(marketEstates)}
        initialView={params?.view === "ledger" ? "ledger" : "cards"}
        initialLocation={params?.location || "all"}
        isAdmin={Boolean(admin)}
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
