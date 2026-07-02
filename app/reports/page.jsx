import AppShell from "@/components/AppShell";
import { getAdminSession } from "@/lib/auth";
import { getReports } from "@/lib/reportStore";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }) {
  const [reports, admin] = await Promise.all([getReports(), getAdminSession()]);
  const params = await searchParams;
  const isAdmin = Boolean(admin);
  const selected = params?.report
    ? reports.find((report) => report.id === params.report && (isAdmin || report.clientVisible))
    : null;

  return (
    <AppShell active="reports">
      <ReportsClient reports={reports} initialSelectedId={selected?.id} isAdmin={isAdmin} />
    </AppShell>
  );
}
