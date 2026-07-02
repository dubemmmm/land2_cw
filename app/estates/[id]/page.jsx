import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getEstateMarketProfile } from "@/lib/landBible";
import { getClientResources } from "@/lib/resourceStore";
import EstateDetailClient from "./EstateDetailClient";

export const dynamic = "force-dynamic";

export default async function EstateDetailPage({ params }) {
  const { id } = await params;
  const estate = getEstateMarketProfile(id);
  if (!estate) notFound();
  const resources = await getClientResources({ targetType: "estate", targetId: id });

  return (
    <AppShell active="map">
      <EstateDetailClient estate={estate} resources={resources} />
    </AppShell>
  );
}
