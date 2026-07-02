import AppShell from "@/components/AppShell";
import { getReports } from "@/lib/reportStore";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }) {
  const reports = await getReports();
  const params = await searchParams;
  const selected = reports.find((report) => report.id === params?.report) || reports[2] || reports[0];

  return (
    <AppShell active="reports">
      <ReportsClient reports={reports} initialSelectedId={selected?.id} />
    </AppShell>
  );
}
