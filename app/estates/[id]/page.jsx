import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { loadMarket } from "@/lib/landBible";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { getClientResources } from "@/lib/resourceStore";
import EstateDetailClient from "./EstateDetailClient";

export const dynamic = "force-dynamic";

export default async function EstateDetailPage({ params }) {
  const { id } = await params;
  const marketData = await loadMarket();
  const estate = marketData.estateProfile(id);
  if (!estate) notFound();
  const [resources, neighborhoods] = await Promise.all([
    getClientResources({ targetType: "estate", targetId: id }),
    getNeighborhoods()
  ]);
  // Naira price per m² for every neighbourhood, so the budget drawing can set this estate beside them.
  const pricedLocations = neighborhoods
    .map((item) => ({ item, profile: marketData.profile(item.id) }))
    .filter(({ profile }) => profile && Number(profile.priceValue) > 0 && profile.trendCurrency !== "USD")
    .map(({ item, profile }) => ({
      id: item.id,
      name: item.name,
      href: `/locations/${item.id}`,
      priceValue: profile.priceValue
    }));

  return (
    <AppShell active="map">
      <EstateDetailClient estate={estate} resources={resources} pricedLocations={pricedLocations} />
    </AppShell>
  );
}
