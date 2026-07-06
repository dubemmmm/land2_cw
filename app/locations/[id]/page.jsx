import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getAdminSession } from "@/lib/auth";
import { getLandMarketProfile } from "@/lib/landBible";
import { getLandListings } from "@/lib/listingStore";
import { getNeighborhood, getNeighborhoods } from "@/lib/neighborhoodStore";
import { getClientResources } from "@/lib/resourceStore";
import LocationDetailClient from "./LocationDetailClient";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({ params }) {
  const { id } = await params;
  const neighborhood = await getNeighborhood(id);
  if (!neighborhood) notFound();
  const [market, admin, resources, neighborhoods, listings] = await Promise.all([
    getLandMarketProfile(id),
    getAdminSession(),
    getClientResources({ targetType: "neighborhood", targetId: id }),
    getNeighborhoods(),
    getLandListings()
  ]);
  const locationListings = listings.filter((listing) => listing.neighborhoodId === id);

  return (
    <AppShell active="map">
      <LocationDetailClient
        neighborhood={neighborhood}
        neighborhoods={neighborhoods}
        market={market}
        resources={resources}
        locationListings={locationListings}
        isAdmin={Boolean(admin)}
      />
    </AppShell>
  );
}
