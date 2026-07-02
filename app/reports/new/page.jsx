import AppShell from "@/components/AppShell";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import NewReportClient from "./NewReportClient";

export const dynamic = "force-dynamic";

export default async function NewReportPage() {
  const neighborhoods = await getNeighborhoods();
  return (
    <AppShell active="reports">
      <NewReportClient neighborhoods={neighborhoods} />
    </AppShell>
  );
}
