import Link from "next/link";
import { Map, Minus, TrendingDown, TrendingUp } from "lucide-react";
import AppShell from "@/components/AppShell";
import { requirePortalPage } from "@/lib/auth";
import ConfidenceLegend from "@/components/ConfidenceLegend";
import { getDashboardData } from "@/lib/dashboardStore";
import { loadMarket } from "@/lib/landBible";
import { getNeighborhoods } from "@/lib/neighborhoodStore";
import { getReports } from "@/lib/reportStore";
import { priceBasisLabel } from "@/lib/plot";
import { averageConfidence, confidenceLevel, confidencePattern, confidenceScore } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const UPDATES_SHOWN = 8;

export default async function DashboardPage() {
  await requirePortalPage("/dashboard");
  const [neighborhoods, reports, dashboard, marketData] = await Promise.all([getNeighborhoods(), getReports(), getDashboardData(), loadMarket()]);
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
  const marketProfiles = neighborhoods
    .map((neighborhood) => ({ neighborhood, market: marketData.profile(neighborhood.id), score: confidenceScore(neighborhood) }))
    .filter((item) => item.market);
  const askingAreas = marketProfiles.filter((item) => item.market.priceSource === "asking");
  const askingListings = askingAreas.reduce((sum, item) => sum + item.market.asking.pricedCount, 0);
  const approvalCounts = {
    approved: approvals.filter((item) => item.row.outcome === "Approved").length,
    pending,
    denied: approvals.filter((item) => item.row.outcome === "Denied").length
  };
  const approvalTotal = Math.max(1, approvalCounts.approved + approvalCounts.pending + approvalCounts.denied);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const priceRows = buildPriceRows(marketProfiles);
  const publishedCount = stats.publishedReports || clientReports.length;
  const newThisWeek = stats.reportsPublishedThisWeek || 0;
  const editedThisWeek = stats.reportsEditedThisWeek || 0;
  const dataUpdates = stats.dataUpdatesThisWeek || dashboard.newSignalCount || changes.length;
  const estateRecords = stats.estateCount || estateReportCount;
  const shownUpdates = activity.slice(0, UPDATES_SHOWN);
  const earlierUpdates = activity.slice(UPDATES_SHOWN);

  return (
    <AppShell active="dashboard">
      <div className="briefing">
        <header className="cw-pagehead brief-head">
          <div>
            <nav className="cw-crumbs" aria-label="Breadcrumb">
              <Link href="/">Squaremeter</Link>
              <span aria-hidden="true">/</span>
              <span>Dashboard</span>
            </nav>
            <h1 className="cw-pagehead-title">Dashboard</h1>
            <p className="brief-head-date">{today}</p>
          </div>
          <div className="brief-actions">
            <Link className="cw-btn cw-btn-soft cw-btn-sm" href="/admin/login">Admin login</Link>
            <Link className="cw-btn cw-btn-navy cw-btn-sm" href="/map"><Map size={15} /> Open map</Link>
          </div>
        </header>

        <section className="brief-summary" aria-label="What needs attention">
          <p className="brief-summary-lead">
            <a href="#approvals"><b>{pending}</b> {plural(pending, "approval is", "approvals are")} pending</a>,{" "}
            <Link href="/signals"><b>{changes.length}</b> location {plural(changes.length, "signal has", "signals have")} come in</Link> and{" "}
            <a href="#client-updates"><b>{activity.length}</b> client {plural(activity.length, "update is", "updates are")} waiting for review</a>.
          </p>
          <p className="brief-summary-rest">
            <Link href="/reports"><b>{publishedCount}</b> {plural(publishedCount, "report is", "reports are")} published</Link>
            {" "}({newThisWeek} new this week, {editedThisWeek} edited), and{" "}
            <Link href="/data"><b>{dataUpdates}</b> data {plural(dataUpdates, "update has", "updates have")} been logged</Link> across land and locations.
            Squaremeter tracks {neighborhoods.length} {plural(neighborhoods.length, "location", "locations")} and {estateRecords} estate {plural(estateRecords, "record", "records")}.
          </p>
        </section>

        <section className="brief-card brief-prices" aria-labelledby="brief-prices-title">
          <div className="brief-card-title">
            <div>
              <h2 id="brief-prices-title">Prices by location</h2>
              <p>
                {priceRows.length} {plural(priceRows.length, "location", "locations")} priced.
                {askingAreas.length ? ` ${askingAreas.length} ${plural(askingAreas.length, "price is the median", "prices are medians")} of ${askingListings} live asking prices; the rest are 2023 figures estimated forward.` : ""}
              </p>
            </div>
            <Link className="cw-link" href="/data">Open data <span aria-hidden="true">→</span></Link>
          </div>
          {priceRows.length ? (
            <div className="brief-prices-body">
              <div className="brief-prices-table">
                <div className="brief-table-wrap">
                  <table className="brief-table">
                    <thead>
                      <tr>
                        <th scope="col">Location</th>
                        <th scope="col">Price per m²</th>
                        <th scope="col">Based on</th>
                        <th scope="col">Data confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceRows.map((row) => (
                        <tr key={row.id}>
                          <th scope="row"><Link href={row.href}>{row.name}</Link></th>
                          <td className="brief-price-cell">
                            <span className="brief-price-bar" aria-hidden="true">
                              {row.share ? <i style={{ width: `${row.share}%` }} /> : null}
                            </span>
                            <span className="sq-fig">{row.price}</span>
                          </td>
                          <td className="sq-fig">{row.basis}</td>
                          <td>
                            <span className="brief-conf">
                              <i className={`sq-pat sq-pat-${row.pattern}`} aria-hidden="true" />
                              {row.level}{row.score ? ` · ${row.score}` : ""}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="brief-prices-foot">
                  <ConfidenceLegend withRange />
                  <p className="brief-note">
                    The {leaders.length === 1 ? "best-documented location scores" : `${leaders.length} best-documented locations average`} <b className="sq-fig">{portfolioConfidence}</b> out of 100.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="brief-empty">No location has a price on record yet.</p>
          )}
        </section>

        <section className="brief-grid">
          <div className="brief-col">
            <article className="brief-card" id="client-updates">
              <CardTitle title="Client updates" meta={`${activity.length} to review`} href="/reports" />
              {activity.length ? (
                <>
                  <ul className="brief-list">
                    {shownUpdates.map((item, index) => <UpdateRow item={item} key={item.id || `${item.who}-${index}`} />)}
                  </ul>
                  {earlierUpdates.length ? (
                    <details className="brief-more">
                      <summary>Show {earlierUpdates.length} earlier {plural(earlierUpdates.length, "update", "updates")}</summary>
                      <ul className="brief-list">
                        {earlierUpdates.map((item, index) => <UpdateRow item={item} key={item.id || `${item.who}-earlier-${index}`} />)}
                      </ul>
                    </details>
                  ) : null}
                </>
              ) : (
                <p className="brief-empty">No client updates to review.</p>
              )}
            </article>
          </div>

          <div className="brief-col">
            <article className="brief-card">
              <CardTitle
                title="Published reports"
                meta={`${publishedCount} published · ${newThisWeek} new this week · ${editedThisWeek} edited`}
                href="/reports"
              />
              {latestReports.length ? (
                <ul className="brief-list">
                  {latestReports.map((report) => (
                    <li key={report.id}>
                      <Link className="brief-row" href={`/reports?report=${report.id}`}>
                        <span className="brief-row-main">
                          <strong>{report.siteTitle}</strong>
                          <small>{report.neighborhoodName} · {report.data?.reportType || report.use}</small>
                        </span>
                        <span className="brief-row-side">{report.status === "Client viewed" ? "Viewed by client" : "Published"}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="brief-empty">No reports have been published yet.</p>
              )}
            </article>

            <article className="brief-card">
              <CardTitle title="What changed" meta={`${changes.length} location ${plural(changes.length, "signal", "signals")}`} href="/signals" />
              {changes.length ? (
                <ul className="brief-list">
                  {changes.map((item) => {
                    const Icon = signalIcons[item.icon] || Minus;
                    return (
                      <li className="brief-row" key={item.id || item.text}>
                        <span className="brief-row-main">
                          <span className="brief-change">
                            <Icon className={`brief-change-icon ${item.tone || ""}`} size={15} aria-hidden="true" />
                            {item.text}
                          </span>
                          <small>{item.hood} · {item.when}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="brief-empty">No location signals yet.</p>
              )}
            </article>

            <article className="brief-card" id="approvals">
              <CardTitle title="Approvals" meta={`${approvalCounts.approved + approvalCounts.pending + approvalCounts.denied} on record`} />
              <div className="brief-approvals">
                <div className="brief-approvals-bar" aria-hidden="true">
                  <span className="approved" style={{ width: `${(approvalCounts.approved / approvalTotal) * 100}%` }} />
                  <span className="pending" style={{ width: `${(approvalCounts.pending / approvalTotal) * 100}%` }} />
                  <span className="denied" style={{ width: `${(approvalCounts.denied / approvalTotal) * 100}%` }} />
                </div>
                <dl className="brief-approvals-counts">
                  <div><dt><i className="approved" aria-hidden="true" />Approved</dt><dd className="sq-fig">{approvalCounts.approved}</dd></div>
                  <div><dt><i className="pending" aria-hidden="true" />Pending</dt><dd className="sq-fig">{approvalCounts.pending}</dd></div>
                  <div><dt><i className="denied" aria-hidden="true" />Denied</dt><dd className="sq-fig">{approvalCounts.denied}</dd></div>
                </dl>
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

function plural(count, one, many) {
  return Number(count) === 1 ? one : many;
}

function cleanPriceLabel(value = "") {
  return String(value || "").replace("/sqm est.", "/m² est.").replace("/sqm", "/m²");
}

// Table rows: every location with a market profile, dearest first.
// `share` is each naira price as a percentage of the highest, for the bar in the
// price column. Locations priced in dollars get no bar.
function buildPriceRows(marketProfiles) {
  const naira = (market) => (market.trendCurrency !== "USD" ? Number(market.priceValue) || 0 : 0);
  const top = Math.max(0, ...marketProfiles.map((item) => naira(item.market)));
  return [...marketProfiles]
    .sort((a, b) => (Number(b.market.priceValue) || 0) - (Number(a.market.priceValue) || 0))
    .map(({ neighborhood, market, score }) => ({
      id: neighborhood.id,
      name: neighborhood.name,
      href: `/locations/${neighborhood.id}`,
      price: cleanPriceLabel(market.priceLabel).replace("/m² est.", "").replace("/m²", "") || "Under review",
      share: top ? Math.round((naira(market) / top) * 100) : 0,
      basis: priceBasisLabel(market),
      score,
      level: confidenceLevel(score),
      pattern: confidencePattern(score)
    }));
}

function UpdateRow({ item }) {
  return (
    <li>
      <Link className="brief-row" href={item.href || "/reports"}>
        <span className="brief-row-main">{item.text}</span>
        <span className="brief-row-side">{item.when}</span>
      </Link>
    </li>
  );
}

function CardTitle({ title, meta, href, linkLabel = "View all" }) {
  return (
    <div className="brief-card-title">
      <div>
        <h2>{title}</h2>
        {meta ? <p>{meta}</p> : null}
      </div>
      {href ? <Link className="cw-link" href={href}>{linkLabel} <span aria-hidden="true">→</span></Link> : null}
    </div>
  );
}
