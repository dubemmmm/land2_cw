"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, FileText, GitCommitHorizontal, Pencil, Plus, Search, Share2, User } from "lucide-react";
import { SourcePill, StatusPill } from "@/components/Pills";
import { confidenceColor, formatDate } from "@/lib/metrics";

const filters = [
  { key: "all", label: "All" },
  { key: "Draft", label: "Drafts" },
  { key: "Published", label: "Published" },
  { key: "Client viewed", label: "Client viewed" }
];

export default function ReportsClient({ reports, initialSelectedId, isAdmin = false }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [changedOnly, setChangedOnly] = useState(false);
  const [sortBy, setSortBy] = useState("recent");
  const [query, setQuery] = useState("");
  const [shareState, setShareState] = useState("");

  const accessibleReports = useMemo(() => (
    isAdmin ? reports : reports.filter((report) => report.clientVisible)
  ), [isAdmin, reports]);

  const counts = useMemo(() => ({
    all: accessibleReports.length,
    Draft: accessibleReports.filter((report) => report.status === "Draft").length,
    Published: accessibleReports.filter((report) => report.status === "Published").length,
    "Client viewed": accessibleReports.filter((report) => report.status === "Client viewed").length,
    changed: accessibleReports.filter(hasChanges).length
  }), [accessibleReports]);

  const visibleReports = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...accessibleReports]
      .filter((report) => !isAdmin || statusFilter === "all" || report.status === statusFilter)
      .filter((report) => !changedOnly || hasChanges(report))
      .filter((report) => {
        if (!needle) return true;
        return [
          report.siteTitle,
          report.client,
          report.neighborhoodName,
          report.use,
          isAdmin ? report.status : "",
          report.ref
        ].some((value) => String(value || "").toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        if (sortBy === "confidence") return b.score - a.score || a.siteTitle.localeCompare(b.siteTitle);
        if (sortBy === "az") return a.siteTitle.localeCompare(b.siteTitle);
        return activityRank(a.activity) - activityRank(b.activity);
      });
  }, [accessibleReports, changedOnly, isAdmin, query, sortBy, statusFilter]);

  const groupedReports = useMemo(() => groupReportsByLocation(visibleReports), [visibleReports]);

  const selected = visibleReports.find((report) => report.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId || visibleReports.some((report) => report.id === selectedId)) return;
    setSelectedId("");
    const params = new URLSearchParams(window.location.search);
    params.delete("report");
    const queryString = params.toString();
    window.history.replaceState(null, "", queryString ? `/reports?${queryString}` : "/reports");
  }, [selectedId, visibleReports]);

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
        setShareState("Published link shared");
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
            <p>{visibleReports.length} of {accessibleReports.length} briefs · grouped by location</p>
            {isAdmin ? (
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
            ) : null}
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
            {isAdmin ? <Link className="report-new-btn" href="/reports/new"><Plus size={15} /> New report</Link> : null}
            <div className="report-filter-row">
              {isAdmin ? (
                <button className={changedOnly ? "active" : ""} onClick={() => setChangedOnly((value) => !value)} type="button">
                  <i /> Changed since sent <b>{counts.changed}</b>
                </button>
              ) : null}
              <em>Sort</em>
              <button className={sortBy === "recent" ? "active" : ""} onClick={() => setSortBy("recent")} type="button">Recent</button>
              <button className={sortBy === "confidence" ? "active" : ""} onClick={() => setSortBy("confidence")} type="button">Confidence</button>
              <button className={sortBy === "az" ? "active" : ""} onClick={() => setSortBy("az")} type="button">A-Z</button>
            </div>
          </div>
        </header>

        <div className={`report-table ${isAdmin ? "admin-mode" : "client-mode"}`}>
          <div className="report-table-head">
            <span>Report</span>
            <span>Confidence</span>
            {isAdmin ? <span>Status</span> : null}
            <span>{isAdmin ? "Activity" : "Publication"}</span>
          </div>
          {groupedReports.map((group) => (
            <section className="report-location-group" key={group.key}>
              <div className="report-location-head">
                <div>
                  <strong>{group.name}</strong>
                  <span>{group.reports.length} {group.reports.length === 1 ? "brief" : "briefs"}</span>
                </div>
                <em>{group.hasEstates ? "Location + estates" : "Location"}</em>
              </div>
              {group.reports.map((report) => (
                <button
                  className={`report-ledger-row ${report.sourceType === "estate" ? "estate-child" : "location-parent"} ${report.id === selectedId ? "featured" : ""}`}
                  key={report.id}
                  onClick={() => selectReport(report.id)}
                  type="button"
                >
                  <div>
                    <strong>{report.siteTitle}</strong>
                    <p>{reportRowMeta(report)}</p>
                  </div>
                  <span className="report-confidence"><i style={{ "--tone": confidenceColor(report.score) }} /> <b>{report.score}</b> {report.level}</span>
                  {isAdmin ? <StatusPill status={report.status} /> : null}
                  <span className="report-activity">
                    {isAdmin ? report.activity : "Published"}
                    {isAdmin && hasChanges(report) ? <em><GitCommitHorizontal size={12} /> {changeCount(report)} since sent</em> : null}
                  </span>
                </button>
              ))}
            </section>
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
        <ReportDetail report={selected} reports={accessibleReports} shareState={shareState} onSelect={selectReport} onShare={() => shareReport(selected)} isAdmin={isAdmin} embedded />
      ) : (
        <section className="report-detail-screen embedded empty">
          <div className="report-select-empty">
            <FileText size={22} />
            <h2>Select a report</h2>
            <p>Choose a land or estate brief from the ledger to preview its client-facing intelligence.</p>
          </div>
        </section>
      )}
    </section>
  );
}

function ReportDetail({ report, reports, shareState, onSelect, onShare, isAdmin = false, embedded = false }) {
  const n = report.neighborhood;
  const comparable = reports.filter((item) => item.id !== report.id && item.neighborhoodName === report.neighborhoodName).slice(0, 1);
  const build = (report.data?.buildParameters?.length ? report.data.buildParameters : n.intelligence?.buildParameters || []).slice(0, 4);
  const rules = (report.data?.constraints?.length ? report.data.constraints : n.intelligence?.constraints || []).slice(0, 3);
  const notes = report.data?.notes?.length ? report.data.notes : n.notes || [];
  const rationale = report.data?.recommendationRationale || n.recommendation?.confidenceReason || "Verify source pricing, title, survey, estate rules, and approvals before committing capital.";

  return (
    <section className={`report-detail-screen ${embedded ? "embedded" : ""}`}>
      <div className="report-detail-actions">
        {isAdmin ? <span className={statusClass(report.status)}>{report.status}</span> : null}
        {isAdmin ? <Link aria-label="Edit report" href={`/reports/${report.id}/edit`}><Pencil size={15} /></Link> : null}
        {isAdmin ? <button aria-label="Copy client report link" onClick={onShare} type="button"><Share2 size={15} /></button> : null}
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
          <strong><GitCommitHorizontal size={14} /> {changeCount(report)} changes since this brief was sent</strong>
          {(changeCount(report) > 0 && report.data?.changeNotes?.length ? report.data.changeNotes : ["No material changes since this brief was prepared"]).map((note) => (
            <p key={note}>{note}</p>
          ))}
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

        <SectionHeading title="Advisory commentary" />
        <div className="report-notes">
          {notes.slice(0, 2).map((note, index) => (
            <article key={`${note.date}-${index}`}>
              <span>{note.author?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "CW"}</span>
              <div>
                <p>{note.text}</p>
                <small>{note.author} · {formatDate(note.date)}</small>
              </div>
            </article>
          ))}
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

        {isAdmin && report.data?.internalNotes ? (
          <>
            <SectionHeading title="Internal notes" meta="admin only" />
            <section className="report-internal-notes">
              <p>{report.data.internalNotes}</p>
            </section>
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

function reportRowMeta(report) {
  return [
    report.sourceType === "estate" ? "Estate" : "Location",
    report.use,
    isInternalReportClient(report.client) ? null : report.client
  ].filter(Boolean).join(" · ");
}

function isInternalReportClient(client) {
  return String(client || "").trim().toLowerCase() === "cw real estate intelligence";
}

function hasChanges(report) {
  return changeCount(report) > 0;
}

function changeCount(report) {
  return Number(report.changes) || 0;
}

function groupReportsByLocation(reports) {
  const groups = new Map();
  reports.forEach((report) => {
    const key = report.neighborhoodId || report.neighborhoodName || "portfolio";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: report.neighborhoodName || "Portfolio",
        reports: [],
        hasEstates: false
      });
    }
    const group = groups.get(key);
    group.reports.push(report);
    if (report.sourceType === "estate") group.hasEstates = true;
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    reports: group.reports.sort((a, b) => {
      if (a.sourceType === "neighborhood" && b.sourceType !== "neighborhood") return -1;
      if (a.sourceType !== "neighborhood" && b.sourceType === "neighborhood") return 1;
      return a.siteTitle.localeCompare(b.siteTitle);
    })
  }));
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
