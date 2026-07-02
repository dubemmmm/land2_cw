import Link from "next/link";
import { Building2, FileText, GitCommitHorizontal, Plus, Search, Share2, User } from "lucide-react";
import AppShell from "@/components/AppShell";
import { SourcePill, StatusPill } from "@/components/Pills";
import { getReports } from "@/lib/reportStore";
import { confidenceColor, formatDate } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }) {
  const reports = await getReports();
  const params = await searchParams;
  const selected = reports.find((report) => report.id === params?.report) || reports[2] || reports[0];

  return (
    <AppShell active="reports">
      <section className="reports-split-page">
        <ReportLedger reports={reports} selectedId={selected?.id} />
        {selected ? <ReportDetail report={selected} reports={reports} embedded /> : null}
      </section>
    </AppShell>
  );
}

function ReportLedger({ reports, selectedId }) {
  const counts = {
    draft: reports.filter((report) => report.status === "Draft").length,
    shared: reports.filter((report) => report.status === "Shared").length,
    viewed: reports.filter((report) => report.status === "Client viewed").length
  };

  return (
    <section className="report-ledger-page">
      <header className="report-ledger-header">
        <div>
          <h1>Reports</h1>
          <p>{reports.length} of {reports.length} briefs</p>
          <nav className="report-tabs" aria-label="Report filters">
            <span className="active">All <b>{reports.length}</b></span>
            <span>Drafts <b>{counts.draft}</b></span>
            <span>Shared <b>{counts.shared}</b></span>
            <span>Client viewed <b>{counts.viewed}</b></span>
          </nav>
        </div>
        <div className="report-ledger-tools">
          <label className="report-search">
            <Search size={15} />
            <input placeholder="Search site, client, neighborhood..." />
          </label>
          <Link className="report-new-btn" href="/reports/new"><Plus size={15} /> New report</Link>
          <div className="report-filter-row">
            <span><i /> Changed since sent <b>3</b></span>
            <em>Sort</em>
            <button className="active" type="button">Recent</button>
            <button type="button">Confidence</button>
            <button type="button">A-Z</button>
          </div>
        </div>
      </header>

      <div className="report-table">
        <div className="report-table-head">
          <span>Report</span>
          <span>Confidence</span>
          <span>Status</span>
          <span>Activity</span>
        </div>
        {reports.map((report) => (
          <Link className={`report-ledger-row ${report.id === selectedId ? "featured" : ""}`} href={`/reports?report=${report.id}`} key={report.id}>
            <div>
              <strong>{report.siteTitle}</strong>
              <p>{report.neighborhoodName} · {report.use} · {report.client}</p>
            </div>
            <span className="report-confidence"><i style={{ "--tone": confidenceColor(report.score) }} /> <b>{report.score}</b> {report.level}</span>
            <StatusPill status={report.status} />
            <span className="report-activity">
              {report.activity}
              {report.changes ? <em><GitCommitHorizontal size={12} /> {report.changes} since sent</em> : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ReportDetail({ report, reports, embedded = false }) {
  const n = report.neighborhood;
  const comparable = reports.filter((item) => item.id !== report.id && item.neighborhoodName === report.neighborhoodName).slice(0, 1);
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
    <section className={`report-detail-screen ${embedded ? "embedded" : ""}`}>
      <div className="report-detail-actions">
        <span className={statusClass(report.status)}>{report.status}</span>
        <button type="button"><Share2 size={15} /></button>
      </div>

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
          {(report.data?.changeNotes?.length ? report.data.changeNotes : ["Max height revised 8 -> 6 floors", "Design-review sign-off now required on heritage frontages"]).map((note) => (
            <p key={note}>{note}</p>
          ))}
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

        <SectionHeading title="Advisory commentary" />
        <div className="report-notes">
          {(n.notes || []).slice(0, 2).map((note, index) => (
            <article key={`${note.date}-${index}`}>
              <span>{note.author?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "CW"}</span>
              <div>
                <p>{note.text}</p>
                <small>{note.author} · {formatDate(note.date)}</small>
              </div>
            </article>
          ))}
        </div>

        {comparable.length ? (
          <>
            <SectionHeading title={`Comparable sites`} meta={`in ${report.neighborhoodName}`} />
            {comparable.map((item) => (
              <Link className="report-comp-row" href={`/reports?report=${item.id}`} key={item.id}>
                <div>
                  <strong>{item.siteTitle}</strong>
                  <p>{item.use} · {item.client}</p>
                </div>
                <span><i style={{ "--tone": confidenceColor(item.score) }} /> {item.score}</span>
              </Link>
            ))}
          </>
        ) : null}
      </article>
    </section>
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

function statusClass(status) {
  return `report-detail-status ${String(status).toLowerCase().replace(/\s+/g, "-")}`;
}
