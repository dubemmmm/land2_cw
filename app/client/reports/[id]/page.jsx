import { notFound } from "next/navigation";
import { Building2, ExternalLink, GitCommitHorizontal, User } from "lucide-react";
import { SourcePill, StatusPill } from "@/components/Pills";
import { confidenceColor, formatDate } from "@/lib/metrics";
import { getReport, getReports } from "@/lib/reportStore";

export const dynamic = "force-dynamic";

export default async function ClientReportPage({ params }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report || !report.clientVisible) notFound();
  const reports = await getReports();
  const comparable = reports.filter((item) => item.id !== report.id && item.neighborhoodName === report.neighborhoodName).slice(0, 1);
  const n = report.neighborhood;
  const build = (report.data?.buildParameters?.length ? report.data.buildParameters : n.intelligence?.buildParameters || []).slice(0, 4);
  const rules = (report.data?.constraints?.length ? report.data.constraints : n.intelligence?.constraints || []).slice(0, 3);
  const rationale = report.data?.recommendationRationale || n.recommendation?.confidenceReason || "Verify source pricing, title, survey, estate rules, and approvals before committing capital.";

  return (
    <main className="client-report-screen">
      <article className="report-paper">
        <header className="report-paper-head">
          <div className="report-brand">
            <span>CW</span>
            <div>
              <strong>CW Real Estate</strong>
              <p>Development brief</p>
            </div>
          </div>
          <aside>
            <strong>{report.ref}</strong>
            <p>Prepared 01 Jul 2026</p>
          </aside>
        </header>

        <span className="report-neighborhood">{report.neighborhoodName}</span>
        <h1>{report.siteTitle}</h1>
        <p className="report-meta">
          <span><User size={13} /> {report.client}</span>
          <span><Building2 size={13} /> {report.use}</span>
        </p>

        {report.data?.executiveSummary ? (
          <section className="report-intel-summary">
            <span>{report.data.reportType || "Client brief"}</span>
            <p>{report.data.executiveSummary}</p>
          </section>
        ) : null}

        <div className="report-brief-facts">
          {report.data?.riskLevel ? <span><b>Risk</b>{report.data.riskLevel}</span> : null}
          {report.data?.publishDate ? <span><b>Published</b>{formatDate(report.data.publishDate)}</span> : null}
          {report.data?.reviewDate ? <span><b>Review by</b>{formatDate(report.data.reviewDate)}</span> : null}
        </div>

        <section className="report-change-box">
          <strong><GitCommitHorizontal size={14} /> {report.changes || report.data?.changeNotes?.length || 0} changes since this brief was sent</strong>
          {(report.data?.changeNotes?.length ? report.data.changeNotes : ["No material changes since the previous brief"]).map((note) => <p key={note}>{note}</p>)}
        </section>

        <section className="report-recommendation">
          <div className="report-ring" style={{ "--score": report.score, "--tone": confidenceColor(report.score) }}><span>{report.score}</span></div>
          <div>
            <span>Recommendation <b>{report.verdict}</b></span>
            <p>{rationale}</p>
          </div>
        </section>

        {report.data?.keyRisks?.length || report.data?.opportunityNotes?.length ? (
          <div className="report-two-col report-intel-lists">
            {report.data?.keyRisks?.length ? (
              <section>
                <SectionHeading title="Key risks" />
                {report.data.keyRisks.map((risk) => <p key={risk}>{risk}</p>)}
              </section>
            ) : null}
            {report.data?.opportunityNotes?.length ? (
              <section>
                <SectionHeading title="Opportunity notes" />
                {report.data.opportunityNotes.map((note) => <p key={note}>{note}</p>)}
              </section>
            ) : null}
          </div>
        ) : null}

        <SectionHeading title="What you can build" />
        <div className="report-build-grid">
          {build.map((row) => (
            <article className="report-build-card" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
              <SourcePill type={row.sourceType} />
            </article>
          ))}
        </div>

        <div className="report-two-col">
          <section>
            <SectionHeading title="Regulations" />
            {rules.map((row) => (
              <div className="report-rule-row" key={row.label}>
                <p>{row.label}</p>
                <SourcePill type={row.sourceType} />
              </div>
            ))}
          </section>
          <section>
            <SectionHeading title="Approval history" />
            <div className="report-history">
              {(n.approvals || []).slice(0, 3).map((row, index) => (
                <article key={`${row.date}-${index}`}>
                  <i className={String(row.outcome).toLowerCase()} />
                  <div>
                    <time>{formatDate(row.date)}</time>
                    <p>{row.request || row.projectType}</p>
                  </div>
                  <StatusPill status={row.outcome} />
                </article>
              ))}
            </div>
          </section>
        </div>

        {report.resources?.length ? (
          <>
            <SectionHeading title="Market research" meta={`${report.resources.length} resources`} />
            <div className="report-resource-list">
              {report.resources.slice(0, 4).map((resource) => (
                <article className="report-resource-row" key={resource.id}>
                  <div>
                    <strong>{resource.title}</strong>
                    <p>{resource.resourceType} · {resource.source}</p>
                  </div>
                  {resource.url ? (
                    <a href={resource.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>
                  ) : resource.fileName ? (
                    <a href={`/api/resources/${resource.id}/file`} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : null}

        {comparable.length ? (
          <>
            <SectionHeading title="Comparable sites" meta={`in ${report.neighborhoodName}`} />
            {comparable.map((item) => (
              <div className="report-comp-row" key={item.id}>
                <div>
                  <strong>{item.siteTitle}</strong>
                  <p>{item.use} · {item.client}</p>
                </div>
                <span><i style={{ "--tone": confidenceColor(item.score) }} /> {item.score}</span>
              </div>
            ))}
          </>
        ) : null}
      </article>
    </main>
  );
}

function SectionHeading({ title, meta }) {
  return (
    <div className="report-section-title">
      <h2><i />{title}</h2>
      {meta ? <span>{meta}</span> : null}
    </div>
  );
}
