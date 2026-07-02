import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getNeighborhood } from "@/lib/neighborhoodStore";
import LocationDetailClient from "./LocationDetailClient";

export const dynamic = "force-dynamic";

export default async function LocationDetailPage({ params }) {
  const { id } = await params;
  const neighborhood = await getNeighborhood(id);
  if (!neighborhood) notFound();

  return (
    <AppShell active="map">
      <LocationDetailClient neighborhood={neighborhood} />
    </AppShell>
  );
}
