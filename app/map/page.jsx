import AppShell from "@/components/AppShell";
import { getLandMarketProfile } from "@/lib/landBible";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import MapClient from "./MapClient";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const neighborhoods = await getNeighborhoods();
  return (
    <AppShell active="map">
      <MapClient initialNeighborhoods={neighborhoods} prices={buildPrices(neighborhoods)} />
    </AppShell>
  );
}

// Naira price per m² for each neighbourhood that has one, keyed by id.
function buildPrices(neighborhoods) {
  const prices = {};
  neighborhoods.forEach((neighborhood) => {
    const market = getLandMarketProfile(String(neighborhood.id));
    const value = Number(market?.priceValue) || 0;
    if (value > 0 && market.trendCurrency !== "USD") prices[neighborhood.id] = value;
  });
  return prices;
}
