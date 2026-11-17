import AppShell from "@/components/AppShell";
import { loadMarket } from "@/lib/landBible";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import MapClient from "./MapClient";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const [neighborhoods, marketData] = await Promise.all([getNeighborhoods(), loadMarket()]);
  return (
    <AppShell active="map">
      <MapClient initialNeighborhoods={neighborhoods} prices={buildPrices(neighborhoods, marketData)} />
    </AppShell>
  );
}

// Naira price per m² for each neighbourhood that has one, keyed by id.
function buildPrices(neighborhoods, marketData) {
  const prices = {};
  neighborhoods.forEach((neighborhood) => {
    const market = marketData.profile(neighborhood.id);
    const value = Number(market?.priceValue) || 0;
    if (value > 0 && market.trendCurrency !== "USD") prices[neighborhood.id] = value;
  });
  return prices;
}
