import AppShell from "@/components/AppShell";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import MapClient from "./MapClient";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const neighborhoods = await getNeighborhoods();
  return (
    <AppShell active="map">
      <MapClient initialNeighborhoods={neighborhoods} />
    </AppShell>
  );
}
