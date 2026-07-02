import Link from "next/link";
import { AlertTriangle, Clock, FilePen, Map, Minus, Plus, RefreshCw, TrendingDown, TrendingUp, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import { getDashboardData } from "@/lib/dashboardStore";
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
  const actions = dashboard.tasks;
  const changes = dashboard.signals;
  const activity = dashboard.activity;
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
            <h1>Good morning, Chidubem</h1>
            <p>{today} · {neighborhoods.length} neighborhoods · {reports.length} active briefs · {dashboard.clientCount || 12} clients</p>
          </div>
          <div className="brief-actions">
            <div className="range-tabs" aria-label="Date range">
              <button type="button">Today</button>
              <button className="active" type="button">Week</button>
              <button type="button">Month</button>
            </div>
            <Link className="brief-button primary" href="/reports"><Plus size={15} /> New report</Link>
            <Link className="brief-button" href="/map"><Map size={15} /> Open map</Link>
          </div>
        </header>

        <section className="brief-kpis">
          <Kpi label="Portfolio confidence" value={portfolioConfidence} sub="▼ 1 vs prior" tone="down" />
          <Kpi label="Active briefs" value={reports.length} sub="▲ 1 new" tone="up" />
          <Kpi label="Needs attention" value={actions.length} sub="in queue" />
          <Kpi label="New signals" value={dashboard.newSignalCount || changes.length} sub="this week" />
          <Kpi label="Pending approvals" value={pending || 2} sub="this week" />
        </section>

        <section className="brief-grid">
          <div className="brief-left">
            <article className="brief-card needs-card">
              <CardTitle title="Needs you today" count={actions.length} />
              <div className="action-list">
                {actions.map((item) => {
                  const Icon = taskIcons[item.icon] || AlertTriangle;
                  return (
                    <Link className="action-row" href={item.href} key={item.id || item.subject}>
                      <span className={`action-icon ${item.tone}`}><Icon size={16} /></span>
                      <span>
                        <strong>{item.subject}</strong>
                        <em>{item.meta}</em>
                      </span>
                      <b>{item.action}</b>
                      <X className="dismiss" size={14} />
                    </Link>
                  );
                })}
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
            <article className="brief-card changes-card">
              <CardTitle title="What changed" meta="this week" />
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

            <article className="brief-card activity-card">
              <CardTitle title="Team activity" />
              {activity.map((item, index) => (
                <div className="activity-row" key={`${item.who}-${index}`}>
                  <span className={item.gold ? "gold" : ""}>{item.who}</span>
                  <div>
                    <p>{item.text}</p>
                    <em>{item.when}</em>
                  </div>
                </div>
              ))}
            </article>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

const taskIcons = {
  alert: AlertTriangle,
  clock: Clock,
  file: FilePen,
  refresh: RefreshCw
};

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
