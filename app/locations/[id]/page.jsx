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
  // Naira price per m² for every neighbourhood, so the budget drawing can compare this one with the rest.
  const pricedLocations = neighborhoods
    .map((item) => ({ item, profile: item.id === id ? market : getLandMarketProfile(item.id) }))
    .filter(({ profile }) => profile && Number(profile.priceValue) > 0 && profile.trendCurrency !== "USD")
    .map(({ item, profile }) => ({
      id: item.id,
      name: item.name,
      href: `/locations/${item.id}`,
      priceValue: profile.priceValue
    }));

  return (
    <AppShell active="map">
      <LocationDetailClient
        neighborhood={neighborhood}
        neighborhoods={neighborhoods}
        market={market}
        resources={resources}
        locationListings={locationListings}
        pricedLocations={pricedLocations}
        isAdmin={Boolean(admin)}
      />
    </AppShell>
  );
}
