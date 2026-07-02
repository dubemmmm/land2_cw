import { notFound } from "next/navigation";
import { Building2, GitCommitHorizontal, User } from "lucide-react";
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
  const build = report.id === "glover-road"
    ? [
        { label: "Permitted use", value: "Res + commercial", sourceType: "Official" },
        { label: "Max height", value: "8 floors", sourceType: "Official" },
        { label: "Front setback", value: "4.5 m", sourceType: "Official" },
        { label: "Plot coverage", value: "65%", sourceType: "Internal" }
      ]
    : (n.intelligence?.buildParameters || []).slice(0, 4);
  const rules = report.id === "glover-road"
    ? [
        { label: "Commercial permitted on designated corridors only", sourceType: "Official" },
        { label: "Heritage frontages require design-review sign-off", sourceType: "Estate" },
        { label: "Basement parking mandatory above 4 floors", sourceType: "Official" }
      ]
    : (n.intelligence?.constraints || []).slice(0, 3);

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

        <section className="report-change-box">
          <strong><GitCommitHorizontal size={14} /> {report.changes || report.data?.changeNotes?.length || 0} changes since this brief was sent</strong>
          {(report.data?.changeNotes?.length ? report.data.changeNotes : ["No material changes since the previous brief"]).map((note) => <p key={note}>{note}</p>)}
        </section>

        <section className="report-recommendation">
          <div className="report-ring" style={{ "--score": report.score, "--tone": confidenceColor(report.score) }}><span>{report.score}</span></div>
          <div>
            <span>Recommendation <b>{report.verdict}</b></span>
            <p>Signals are mixed. Verify before committing capital.</p>
          </div>
        </section>

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
