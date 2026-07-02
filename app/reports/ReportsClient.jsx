"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FileText, GitCommitHorizontal, Plus, Search, Share2, User } from "lucide-react";
import { SourcePill, StatusPill } from "@/components/Pills";
import { confidenceColor, formatDate } from "@/lib/metrics";

const filters = [
  { key: "all", label: "All" },
  { key: "Draft", label: "Drafts" },
  { key: "Shared", label: "Shared" },
  { key: "Client viewed", label: "Client viewed" }
];

export default function ReportsClient({ reports, initialSelectedId }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId || reports[2]?.id || reports[0]?.id);
  const [statusFilter, setStatusFilter] = useState("all");
  const [changedOnly, setChangedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [query, setQuery] = useState("");
  const [shareState, setShareState] = useState("");

  const counts = useMemo(() => ({
    all: reports.length,
    Draft: reports.filter((report) => report.status === "Draft").length,
    Shared: reports.filter((report) => report.status === "Shared").length,
    "Client viewed": reports.filter((report) => report.status === "Client viewed").length,
    changed: reports.filter(hasChanges).length
  }), [reports]);

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...reports]
      .filter((report) => statusFilter === "all" || report.status === statusFilter)
      .filter((report) => !changedOnly || hasChanges(report))
      .filter((report) => {
        if (!needle) return true;
        return [
          report.siteTitle,
          report.client,
          report.neighborhoodName,
          report.use,
          report.status,
          report.ref
        ].some((value) => String(value || "").toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sortBy === "confidence") return b.score - a.score || a.siteTitle.localeCompare(b.siteTitle);
        if (sortBy === "az") return a.siteTitle.localeCompare(b.siteTitle);
        return activityRank(a.activity) - activityRank(b.activity);
      });
  }, [changedOnly, query, reports, sortBy, statusFilter]);

  const selected = visibleReports.find((report) => report.id === selectedId) || visibleReports[0] || reports[0];

  useEffect(() => {
    if (!selected || visibleReports.some((report) => report.id === selected.id)) return;
    setSelectedId(visibleReports[0]?.id || reports[0]?.id);
  }, [reports, selected, visibleReports]);

  function selectReport(id) {
    setSelectedId(id);
    setShareState("");
    const params = new URLSearchParams(window.location.search);
    params.set("report", id);
    window.history.replaceState(null, "", `/reports?${params.toString()}`);
  }

  async function shareReport(report) {
    const url = `${window.location.origin}/client/reports/${report.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: report.siteTitle, text: `${report.siteTitle} development brief`, url });
        setShareState("Shared");
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState("Client link copied");
    } catch {
      setShareState("Copy failed");
    }
  }

  return (
    <section className="reports-split-page">
      <section className="report-ledger-page">
        <header className="report-ledger-header">
          <div>
            <h1>Reports</h1>
            <p>{visibleReports.length} of {reports.length} briefs</p>
            <nav className="report-tabs" aria-label="Report filters">
              {filters.map((filter) => (
                <button
                  className={statusFilter === filter.key ? "active" : ""}
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  type="button"
                >
                  {filter.label} <b>{counts[filter.key]}</b>
                </button>
              ))}
            </nav>
          </div>
          <div className="report-ledger-tools">
            <label className="report-search">
              <Search size={15} />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search site, client, neighborhood..."
                value={query}
              />
            </label>
            <Link className="report-new-btn" href="/reports/new"><Plus size={15} /> New report</Link>
            <div className="report-filter-row">
              <button className={changedOnly ? "active" : ""} onClick={() => setChangedOnly((value) => !value)} type="button">
                <i /> Changed since sent <b>{counts.changed}</b>
              </button>
              <em>Sort</em>
              <button className={sortBy === "recent" ? "active" : ""} onClick={() => setSortBy("recent")} type="button">Recent</button>
              <button className={sortBy === "confidence" ? "active" : ""} onClick={() => setSortBy("confidence")} type="button">Confidence</button>
              <button className={sortBy === "az" ? "active" : ""} onClick={() => setSortBy("az")} type="button">A-Z</button>
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
          {visibleReports.map((report) => (
            <button
              className={`report-ledger-row ${report.id === selected?.id ? "featured" : ""}`}
              key={report.id}
              onClick={() => selectReport(report.id)}
              type="button"
            >
              <div>
                <strong>{report.siteTitle}</strong>
                <p>{report.neighborhoodName} · {report.use} · {report.client}</p>
              </div>
              <span className="report-confidence"><i style={{ "--tone": confidenceColor(report.score) }} /> <b>{report.score}</b> {report.level}</span>
              <StatusPill status={report.status} />
              <span className="report-activity">
                {report.activity}
                {hasChanges(report) ? <em><GitCommitHorizontal size={12} /> {changeCount(report)} since sent</em> : null}
              </span>
            </button>
          ))}
          {!visibleReports.length ? (
            <div className="report-empty-state">
              <FileText size={18} />
              <strong>No reports found</strong>
              <p>Adjust the filters or search term.</p>
            </div>
          ) : null}
        </div>
      </section>

      {selected ? (
        <ReportDetail report={selected} reports={reports} shareState={shareState} onSelect={selectReport} onShare={() => shareReport(selected)} embedded />
      ) : null}
    </section>
  );
}

function ReportDetail({ report, reports, shareState, onSelect, onShare, embedded = false }) {
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
        <button aria-label="Copy client report link" onClick={onShare} type="button"><Share2 size={15} /></button>
        {shareState ? <em>{shareState}</em> : null}
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
          <strong><GitCommitHorizontal size={14} /> {changeCount(report)} changes since this brief was sent</strong>
          {(changeCount(report) > 0 && report.data?.changeNotes?.length ? report.data.changeNotes : ["No material changes since this brief was prepared"]).map((note) => (
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
            <SectionHeading title="Comparable sites" meta={`in ${report.neighborhoodName}`} />
            {comparable.map((item) => (
              <button className="report-comp-row" key={item.id} onClick={() => onSelect(item.id)} type="button">
                <div>
                  <strong>{item.siteTitle}</strong>
                  <p>{item.use} · {item.client}</p>
                </div>
                <span><i style={{ "--tone": confidenceColor(item.score) }} /> {item.score}</span>
              </button>
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

function hasChanges(report) {
  return changeCount(report) > 0;
}

function changeCount(report) {
  return Number(report.changes) || 0;
}

function activityRank(value = "") {
  const text = String(value).toLowerCase();
  const amount = Number(text.match(/\d+/)?.[0] || 1);
  if (text.includes("just")) return 0;
  if (text.includes("h")) return amount;
  if (text.includes("yesterday")) return 24;
  if (text.includes("d")) return amount * 24;
  if (text.includes("w")) return amount * 24 * 7;
  return 9999;
}
