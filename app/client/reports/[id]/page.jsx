import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { confidencePattern, formatDate } from "@/lib/metrics";
import { requirePortalPage } from "@/lib/auth";
import { getReport, getReports } from "@/lib/reportStore";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

// The document markup mirrors ReportDetail in app/reports/ReportsClient.jsx, minus the
// admin-only parts. It stays server-rendered so internal notes never reach this page.
export default async function ClientReportPage({ params }) {
  const { id } = await params;
  await requirePortalPage(`/client/reports/${id}`);
  const report = await getReport(id);
  if (!report || !report.clientVisible) notFound();
  const reports = await getReports();
  const comparable = reports.filter((item) => item.id !== report.id && item.neighborhoodName === report.neighborhoodName).slice(0, 1);
  const n = report.neighborhood;
  const build = (report.data?.buildParameters?.length ? report.data.buildParameters : n.intelligence?.buildParameters || []).slice(0, 4);
  const rules = (report.data?.constraints?.length ? report.data.constraints : n.intelligence?.constraints || []).slice(0, 3);
  const approvals = (n.approvals || []).slice(0, 3);
  const rationale = report.data?.recommendationRationale || n.recommendation?.confidenceReason || "Verify source pricing, title, survey, estate rules, and approvals before committing capital.";
  const changes = report.changes || report.data?.changeNotes?.length || 0;
  const changeNotes = report.data?.changeNotes?.length ? report.data.changeNotes : ["No material changes since the previous brief"];

  return (
    <div className="client-report-screen">
      <header className="client-report-bar">
        <div className="client-report-bar-inner">
          <Link className="client-report-brand" href="/">
            <span className="cw-mark">CW</span>
            <span>Squaremeter by CW</span>
          </Link>
          <PrintButton />
        </div>
      </header>

      <main className="client-report-main">
        <article className="report-doc">
          <p className="report-doc-kind">{report.data?.reportType || "Client brief"} · {report.neighborhoodName}</p>
          <h1 className="report-doc-title">{report.siteTitle}</h1>
          {report.data?.executiveSummary ? <p className="report-doc-summary">{report.data.executiveSummary}</p> : null}

          <dl className="report-facts">
            <div><dt>Reference</dt><dd className="report-ref">{report.ref}</dd></div>
            <div><dt>Client</dt><dd>{report.client}</dd></div>
            <div><dt>Location</dt><dd>{report.neighborhoodName}</dd></div>
            <div><dt>Intended use</dt><dd>{report.use}</dd></div>
            {report.data?.publishDate ? <div><dt>Published</dt><dd className="sq-fig">{formatDate(report.data.publishDate)}</dd></div> : null}
            {report.data?.reviewDate ? <div><dt>Review by</dt><dd className="sq-fig">{formatDate(report.data.reviewDate)}</dd></div> : null}
          </dl>

          <section className="report-sec">
            <h2 className="report-sec-title">Recommendation</h2>
            <div className="report-verdict">
              <div className="report-verdict-main">
                <strong>{report.verdict}</strong>
                <p>{rationale}</p>
              </div>
              <dl className="report-verdict-facts">
                <div><dt>Data confidence</dt><dd><Confidence level={report.level} score={report.score} outOf /></dd></div>
                {report.data?.riskLevel ? <div><dt>Risk level</dt><dd>{report.data.riskLevel}</dd></div> : null}
              </dl>
            </div>
          </section>

          <section className="report-sec">
            <h2 className="report-sec-title">{changes} {changes === 1 ? "change" : "changes"} since this brief was sent</h2>
            <ul className="report-ul">
              {changeNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </section>

          {report.data?.keyRisks?.length || report.data?.opportunityNotes?.length ? (
            <div className="report-cols">
              {report.data?.keyRisks?.length ? (
                <section className="report-sec">
                  <h2 className="report-sec-title">Key risks</h2>
                  <ul className="report-ul">
                    {report.data.keyRisks.map((risk) => <li key={risk}>{risk}</li>)}
                  </ul>
                </section>
              ) : null}
              {report.data?.opportunityNotes?.length ? (
                <section className="report-sec">
                  <h2 className="report-sec-title">Opportunities</h2>
                  <ul className="report-ul">
                    {report.data.opportunityNotes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}

          {build.length ? (
            <section className="report-sec">
              <h2 className="report-sec-title">Key figures</h2>
              <div className="report-tbl-wrap">
                <table className="report-tbl">
                  <thead>
                    <tr><th scope="col">Item</th><th scope="col">Value</th><th scope="col">Source</th></tr>
                  </thead>
                  <tbody>
                    {build.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td className="report-tbl-value sq-fig">{row.value}</td>
                        <td className="report-tbl-source">{row.sourceType || "Internal"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {rules.length ? (
            <section className="report-sec">
              <h2 className="report-sec-title">Rules and constraints</h2>
              <div className="report-tbl-wrap">
                <table className="report-tbl">
                  <thead>
                    <tr><th scope="col">What applies</th><th scope="col">Source</th></tr>
                  </thead>
                  <tbody>
                    {rules.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        <td className="report-tbl-source">{row.sourceType || "Internal"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="report-sec">
            <h2 className="report-sec-title">Approval history</h2>
            {approvals.length ? (
              <div className="report-tbl-wrap">
                <table className="report-tbl">
                  <thead>
                    <tr><th scope="col">Date</th><th scope="col">Request</th><th scope="col">Outcome</th></tr>
                  </thead>
                  <tbody>
                    {approvals.map((row, index) => (
                      <tr key={`${row.date}-${index}`}>
                        <td className="report-tbl-date sq-fig">{formatDate(row.date)}</td>
                        <td>{row.request || row.projectType}</td>
                        <td className={`report-outcome ${String(row.outcome).toLowerCase()}`}>{row.outcome || "No data"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="report-none">No planning approvals are on record for this location yet.</p>
            )}
          </section>

          {report.resources?.length ? (
            <section className="report-sec">
              <h2 className="report-sec-title">Market research <span>{report.resources.length} {report.resources.length === 1 ? "resource" : "resources"}</span></h2>
              <ul className="report-resources">
                {report.resources.slice(0, 4).map((resource) => (
                  <li key={resource.id}>
                    {resource.url ? (
                      <a href={resource.url} target="_blank" rel="noreferrer">{resource.title}</a>
                    ) : resource.fileName ? (
                      <a href={`/api/resources/${resource.id}/file`} target="_blank" rel="noreferrer">{resource.title}</a>
                    ) : (
                      <strong>{resource.title}</strong>
                    )}
                    <span>{resource.resourceType} · {resource.source}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {comparable.length ? (
            <section className="report-sec">
              <h2 className="report-sec-title">Comparable sites in {report.neighborhoodName}</h2>
              {comparable.map((item) => (
                <div className="report-comp" key={item.id}>
                  <span className="report-comp-main">
                    <strong>{item.siteTitle}</strong>
                    <span>{item.use} · {item.client}</span>
                  </span>
                  <Confidence level={item.level} score={item.score} />
                </div>
              ))}
            </section>
          ) : null}
        </article>

        <p className="client-report-contact">
          Figures in this brief are estimates from tracked market data and may differ from final transaction prices.
          Verify title, survey and approvals before committing capital. Questions about this brief:{" "}
          <a href="mailto:hello@cwlagos.com">hello@cwlagos.com</a>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

// Confidence is always shown as coloured dot + level + score.
function Confidence({ score, level, outOf = false }) {
  return (
    <span className="report-conf">
      <i className={`sq-pat sq-pat-${confidencePattern(score)}`} aria-hidden="true" />
      {level} · <span className="sq-fig">{score}{outOf ? " of 100" : ""}</span>
    </span>
  );
}
