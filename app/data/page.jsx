import AppShell from "@/components/AppShell";
import { getDataEvents, getNeighborhoods } from "@/lib/neighborhoodStore";
import DataAdminClient from "./DataAdminClient";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const [neighborhoods, events] = await Promise.all([getNeighborhoods(), getDataEvents(12)]);
  return (
    <AppShell active="data">
      <DataAdminClient initialRecords={neighborhoods} initialEvents={events} />
    </AppShell>
  );
}
