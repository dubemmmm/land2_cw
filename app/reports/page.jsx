import AppShell from "@/components/AppShell";
import { getAdminSession, requirePortalPage } from "@/lib/auth";
import { clientView, getReports } from "@/lib/reportStore";
import ReportsClient from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }) {
  const wanted = (await searchParams)?.report;
  await requirePortalPage(typeof wanted === "string" ? `/reports?report=${encodeURIComponent(wanted)}` : "/reports");
  const [allReports, admin] = await Promise.all([getReports(), getAdminSession()]);
  const params = await searchParams;
  const isAdmin = Boolean(admin);
  // Only what this person may see is sent to the browser: drafts and CW's
  // internal notes stay on the server unless the admin is signed in.
  const reports = isAdmin ? allReports : allReports.filter((report) => report.clientVisible).map(clientView);
  const selected = params?.report
    ? reports.find((report) => report.id === params.report && (isAdmin || report.clientVisible))
    : null;

  return (
    <AppShell active="reports">
      <ReportsClient reports={reports} initialSelectedId={selected?.id} isAdmin={isAdmin} />
    </AppShell>
  );
}
