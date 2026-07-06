import Link from "next/link";
import { FileText, Map, Minus, TrendingDown, TrendingUp } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getDashboardData } from "@/lib/dashboardStore";
import { getLandMarketProfile } from "@/lib/landBible";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { getReports } from "@/lib/reportStore";
import { averageConfidence, confidenceColor, confidenceScore } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [neighborhoods, reports, dashboard] = await Promise.all([getNeighborhoods(), getReports(), getDashboardData()]);
  const approvals = neighborhoods.flatMap((n) => (n.approvals || []).map((row) => ({ neighborhood: n, row })));
  const pending = approvals.filter((item) => item.row.outcome === "Pending").length;
  const leaders = [...neighborhoods].sort((a, b) => confidenceScore(b) - confidenceScore(a)).slice(0, 4);
  const portfolioConfidence = leaders.length ? averageConfidence(leaders) : averageConfidence(neighborhoods);
  const stats = dashboard.clientStats || {};
  const changes = dashboard.signals;
  const activity = dashboard.clientUpdates || dashboard.activity || [];
  const clientReports = reports.filter((report) => report.clientVisible || ["Published", "Client viewed"].includes(report.status));
  const latestReports = clientReports.slice(0, 5);
  const estateReportCount = reports.filter((report) => report.sourceType === "estate").length;
  const marketSnapshots = neighborhoods
    .map((neighborhood) => ({ neighborhood, market: getLandMarketProfile(neighborhood.id), score: confidenceScore(neighborhood) }))
    .filter((item) => item.market)
    .sort((a, b) => (b.market.annualGrowth || 0) - (a.market.annualGrowth || 0))
    .slice(0, 4);
  const avgGrowth = marketSnapshots.length
    ? Math.round((marketSnapshots.reduce((sum, item) => sum + (item.market.annualGrowth || 0), 0) / marketSnapshots.length) * 100)
    : 0;
  const approvalCounts = {
    approved: approvals.filter((item) => item.row.outcome === "Approved").length,
    pending,
    denied: approvals.filter((item) => item.row.outcome === "Denied").length
  };
  const approvalTotal = Math.max(1, approvalCounts.approved + approvalCounts.pending + approvalCounts.denied);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return (
    <AppShell active="dashboard">
      <div className="briefing">
        <header className="brief-header">
          <div>
            <h1>Market intelligence dashboard</h1>
            <p>{today} · {neighborhoods.length} tracked locations · {clientReports.length} published briefs · {stats.estateCount || estateReportCount} estate records</p>
          </div>
          <div className="brief-actions">
            <Link className="brief-button" href="/admin/login">Admin login</Link>
            <Link className="brief-button" href="/map"><Map size={15} /> Open map</Link>
          </div>
        </header>

        <section className="brief-kpis">
          <Kpi label="Portfolio confidence" value={portfolioConfidence} sub="tracked intelligence" />
          <Kpi label="Published reports" value={stats.publishedReports || clientReports.length} sub={`${stats.reportsPublishedThisWeek || 0} new this week`} tone="up" />
          <Kpi label="Edited reports" value={stats.reportsEditedThisWeek || 0} sub="admin updates" />
          <Kpi label="Data updates" value={stats.dataUpdatesThisWeek || dashboard.newSignalCount || changes.length} sub="land + locations" />
          <Kpi label="Avg market growth" value={`${avgGrowth || 0}%`} sub="tracked trend" tone="up" />
        </section>

        <section className="brief-grid">
          <div className="brief-left">
            <article className="brief-card needs-card client-feed-card">
              <CardTitle title="Latest client intelligence" count={activity.length} />
              <div className="client-intel-list">
                {activity.map((item, index) => (
                  <Link className="client-intel-row" href={item.href || "/reports"} key={item.id || `${item.who}-${index}`}>
                    <span className={item.gold ? "gold" : ""}>{item.who}</span>
                    <div>
                      <p>{item.text}</p>
                      <em>{item.when}</em>
                    </div>
                  </Link>
                ))}
              </div>
            </article>

            <article className="brief-card leaderboard-card">
              <CardTitle title="Confidence leaderboard" />
              <div className="leaderboard">
                {leaders.map((n, index) => {
                  const score = confidenceScore(n);
                  const width = Math.max(6, score);
                  const down = index === 0 || index === 3;
                  return (
                    <Link className="dash-leader" href={`/locations/${n.id}`} key={n.id}>
                      <span>{index + 1}</span>
                      <div>
                        <strong>{n.name}</strong>
                        <i><span style={{ width: `${width}%`, background: confidenceColor(score) }} /></i>
                      </div>
                      <em className={down ? "down" : "up"}>{down ? "▼" : "▲"} {index === 2 ? 1 : 4}</em>
                      <b>{score}</b>
                    </Link>
                  );
                })}
              </div>
            </article>
          </div>

          <div className="brief-right">
            <article className="brief-card reports-card">
              <CardTitle title="Published report activity" meta={`${latestReports.length} latest`} />
              <div className="published-report-list">
                {latestReports.map((report) => (
                  <Link className="published-report-row" href={`/reports?report=${report.id}`} key={report.id}>
                    <span><FileText size={14} /></span>
                    <div>
                      <strong>{report.siteTitle}</strong>
                      <p>{report.neighborhoodName} · {report.data?.reportType || report.use}</p>
                    </div>
                    <em>{report.status === "Client viewed" ? "Viewed" : "Published"}</em>
                  </Link>
                ))}
              </div>
            </article>

            <article className="brief-card changes-card">
              <CardTitle title="What changed" meta="location signals" />
              {changes.map((item) => {
                const Icon = signalIcons[item.icon] || Minus;
                return (
                  <div className="change-row" key={item.id || item.text}>
                    <span className={`change-icon ${item.tone}`}><Icon size={14} /></span>
                    <div>
                      <p>{item.text}</p>
                      <em>{item.hood} · {item.when}</em>
                    </div>
                  </div>
                );
              })}
            </article>

            <article className="brief-card trend-card">
              <CardTitle title="Market trend snapshot" meta="price movement" />
              <div className="trend-list">
                {marketSnapshots.map(({ neighborhood, market, score }) => (
                  <Link className="trend-row" href={`/locations/${neighborhood.id}`} key={neighborhood.id}>
                    <div>
                      <strong>{neighborhood.name}</strong>
                      <p>{market.priceLabel || "Pricing under review"} · {market.annualGrowthLabel || "N/A"} growth</p>
                    </div>
                    <i><span style={{ width: `${Math.max(8, Math.min(100, Math.round((market.annualGrowth || 0) * 500)))}%` }} /></i>
                    <b>{score}</b>
                  </Link>
                ))}
              </div>
            </article>

            <article className="brief-card pipeline-card">
              <CardTitle title="Approval pipeline" meta={`${approvalTotal} this week`} />
              <div className="pipeline-bar">
                <span className="approved" style={{ width: `${(approvalCounts.approved / approvalTotal) * 100}%` }} />
                <span className="pending" style={{ width: `${(approvalCounts.pending / approvalTotal) * 100}%` }} />
                <span className="denied" style={{ width: `${(approvalCounts.denied / approvalTotal) * 100}%` }} />
              </div>
              <div className="pipeline-legend">
                <span><i className="approved" />Approved <b>{approvalCounts.approved}</b></span>
                <span><i className="pending" />Pending <b>{approvalCounts.pending}</b></span>
                <span><i className="denied" />Denied <b>{approvalCounts.denied}</b></span>
              </div>
            </article>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const signalIcons = {
  down: TrendingDown,
  flat: Minus,
  minus: Minus,
  up: TrendingUp
};

function Kpi({ label, value, sub, tone }) {
  return (
    <article className="brief-kpi">
      <span>{label}</span>
      <div><strong>{value}</strong><em className={tone || ""}>{sub}</em></div>
    </article>
  );
}

function CardTitle({ title, count, meta }) {
  return (
    <div className="brief-card-title">
      <div><span /> <h2>{title}</h2></div>
      {count ? <b>{count}</b> : meta ? <em>{meta}</em> : null}
    </div>
  );
}
