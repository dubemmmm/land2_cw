"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, Share2 } from "lucide-react";
import { confidencePattern, formatDate } from "@/lib/metrics";

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
    <section className="reports-page">
      <header className="cw-pagehead">
        <div>
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/dashboard">Portal</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Reports</span>
          </nav>
          <h1 className="cw-pagehead-title">Reports</h1>
          <p className="cw-lede">
            Showing {visibleReports.length} of {accessibleReports.length} briefs, grouped by location. Pick one to read it as the client sees it.
          </p>
        </div>
        {isAdmin ? <Link className="cw-btn cw-btn-navy" href="/reports/new"><Plus size={16} /> New report</Link> : null}
      </header>

      <div className="reports-tools">
        <label className="reports-search">
          <Search size={16} aria-hidden="true" />
          <input
            aria-label="Search reports"
            className="cw-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by site, client, location or reference"
            value={query}
          />
        </label>
        {isAdmin ? (
          <nav className="cw-tabs reports-tabs" aria-label="Filter by status">
            {filters.map((filter) => (
              <button
                aria-pressed={statusFilter === filter.key}
                className={statusFilter === filter.key ? "active" : ""}
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                type="button"
              >
                {filter.label} <span className="sq-fig">{counts[filter.key]}</span>
              </button>
            ))}
          </nav>
        ) : null}
        {isAdmin ? (
          <label className="reports-check">
            <input checked={changedOnly} onChange={(event) => setChangedOnly(event.target.checked)} type="checkbox" />
            <span>Changed since sent ({counts.changed})</span>
          </label>
        ) : null}
        <label className="reports-sort">
          <span>Sort by</span>
          <select className="cw-select" onChange={(event) => setSortBy(event.target.value)} value={sortBy}>
            <option value="recent">Most recent</option>
            <option value="confidence">Confidence</option>
            <option value="az">Title, A to Z</option>
          </select>
        </label>
      </div>

      <div className="reports-layout">
        <div className="reports-list">
          {groupedReports.map((group) => (
            <section className="reports-group" key={group.key}>
              <h2 className="reports-group-head">
                {group.name}
                <span>{group.reports.length} {group.reports.length === 1 ? "brief" : "briefs"}</span>
              </h2>
              {group.reports.map((report) => (
                <button
                  aria-pressed={report.id === selectedId}
                  className={`reports-item ${report.sourceType === "estate" ? "estate-child" : "location-parent"} ${report.id === selectedId ? "selected" : ""}`}
                  key={report.id}
                  onClick={() => selectReport(report.id)}
                  type="button"
                >
                  <span className="reports-item-top">
                    <span className="reports-item-ref">{report.ref}</span>
                    <span className="reports-item-when">{isAdmin ? report.activity : "Published"}</span>
                  </span>
                  <strong className="reports-item-title">{report.siteTitle}</strong>
                  <span className="reports-item-meta">{reportRowMeta(report)}</span>
                  <span className="reports-item-foot">
                    {isAdmin ? <span className={statusClass(report.status)}>{report.status}</span> : null}
                    <Confidence level={report.level} score={report.score} />
                    {isAdmin && hasChanges(report) ? (
                      <span className="reports-item-changed">{changeLabel(changeCount(report))} since sent</span>
                    ) : null}
                  </span>
                </button>
              ))}
            </section>
          ))}
          {!visibleReports.length ? (
            <div className="reports-empty">
              <strong>No reports match</strong>
              <p>Change the search or the filters to see more briefs.</p>
            </div>
          ) : null}
        </div>

        {selected ? (
          <ReportDetail key={selected.id} report={selected} reports={accessibleReports} shareState={shareState} onSelect={selectReport} onShare={() => shareReport(selected)} isAdmin={isAdmin} embedded />
        ) : (
          <section className="report-preview embedded empty">
            <div className="reports-empty">
              <strong>No report selected</strong>
              <p>Choose a brief from the list to read the document the client receives.</p>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

// The document markup below is mirrored in app/client/reports/[id]/page.jsx (server-rendered,
// so internal notes never reach the public page). Keep the two in step.
function ReportDetail({ report, reports, shareState, onSelect, onShare, isAdmin = false, embedded = false }) {
  const n = report.neighborhood;
  const comparable = reports.filter((item) => item.id !== report.id && item.neighborhoodName === report.neighborhoodName).slice(0, 1);
  const build = (report.data?.buildParameters?.length ? report.data.buildParameters : n.intelligence?.buildParameters || []).slice(0, 4);
  const rules = (report.data?.constraints?.length ? report.data.constraints : n.intelligence?.constraints || []).slice(0, 3);
  const notes = (report.data?.notes?.length ? report.data.notes : n.notes || []).slice(0, 2);
  const approvals = (n.approvals || []).slice(0, 3);
  const rationale = report.data?.recommendationRationale || n.recommendation?.confidenceReason || "Verify source pricing, title, survey, estate rules, and approvals before committing capital.";
  const changes = changeCount(report);
  const changeNotes = changes > 0 && report.data?.changeNotes?.length ? report.data.changeNotes : ["No material changes since this brief was prepared"];

  return (
    <section className={`report-preview ${embedded ? "embedded" : ""}`}>
      <div className="report-preview-bar">
        <span className="report-preview-label">Preview of the client document</span>
        {shareState ? <span className="report-preview-note" role="status">{shareState}</span> : null}
        {isAdmin ? <Link className="cw-btn cw-btn-soft cw-btn-sm" href={`/reports/${report.id}/edit`}><Pencil size={15} /> Edit</Link> : null}
        {isAdmin ? <button className="cw-btn cw-btn-soft cw-btn-sm" onClick={onShare} type="button"><Share2 size={15} /> Share client link</button> : null}
      </div>

      <article className="report-doc">
        <p className="report-doc-kind">{report.data?.reportType || "Client brief"} · {report.neighborhoodName}</p>
        <h2 className="report-doc-title">{report.siteTitle}</h2>
        {report.data?.executiveSummary ? <p className="report-doc-summary">{report.data.executiveSummary}</p> : null}

        <dl className="report-facts">
          <div><dt>Reference</dt><dd className="report-ref">{report.ref}</dd></div>
          <div><dt>Client</dt><dd>{report.client}</dd></div>
          <div><dt>Location</dt><dd>{report.neighborhoodName}</dd></div>
          <div><dt>Intended use</dt><dd>{report.use}</dd></div>
          {report.data?.publishDate ? <div><dt>Published</dt><dd className="sq-fig">{formatDate(report.data.publishDate)}</dd></div> : null}
          {report.data?.reviewDate ? <div><dt>Review by</dt><dd className="sq-fig">{formatDate(report.data.reviewDate)}</dd></div> : null}
          {isAdmin ? <div><dt>Status</dt><dd><span className={statusClass(report.status)}>{report.status}</span></dd></div> : null}
        </dl>

        <section className="report-sec">
          <h3 className="report-sec-title">Recommendation</h3>
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
          <h3 className="report-sec-title">{changeLabel(changes)} since this brief was sent</h3>
          <ul className="report-ul">
            {changeNotes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </section>

        {report.data?.keyRisks?.length || report.data?.opportunityNotes?.length ? (
          <div className="report-cols">
            {report.data?.keyRisks?.length ? (
              <section className="report-sec">
                <h3 className="report-sec-title">Key risks</h3>
                <ul className="report-ul">
                  {report.data.keyRisks.map((risk) => <li key={risk}>{risk}</li>)}
                </ul>
              </section>
            ) : null}
            {report.data?.opportunityNotes?.length ? (
              <section className="report-sec">
                <h3 className="report-sec-title">Opportunities</h3>
                <ul className="report-ul">
                  {report.data.opportunityNotes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {build.length ? (
          <section className="report-sec">
            <h3 className="report-sec-title">Key figures</h3>
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
            <h3 className="report-sec-title">Rules and constraints</h3>
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
          <h3 className="report-sec-title">Approval history</h3>
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

        {notes.length ? (
          <section className="report-sec">
            <h3 className="report-sec-title">Advisory commentary</h3>
            {notes.map((note, index) => (
              <figure className="report-note" key={`${note.date}-${index}`}>
                <blockquote>{note.text}</blockquote>
                <figcaption>{note.author} · {formatDate(note.date)}</figcaption>
              </figure>
            ))}
          </section>
        ) : null}

        {report.resources?.length ? (
          <section className="report-sec">
            <h3 className="report-sec-title">Market research <span>{report.resources.length} {report.resources.length === 1 ? "resource" : "resources"}</span></h3>
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
            <h3 className="report-sec-title">Comparable sites in {report.neighborhoodName}</h3>
            {comparable.map((item) => (
              <button className="report-comp" key={item.id} onClick={() => onSelect(item.id)} type="button">
                <span className="report-comp-main">
                  <strong>{item.siteTitle}</strong>
                  <span>{item.use} · {item.client}</span>
                </span>
                <Confidence level={item.level} score={item.score} />
              </button>
            ))}
          </section>
        ) : null}

        {isAdmin && report.data?.internalNotes ? (
          <section className="report-sec report-internal">
            <h3 className="report-sec-title">Internal notes <span>Admins only, not shown to the client</span></h3>
            <p>{report.data.internalNotes}</p>
          </section>
        ) : null}
      </article>
    </section>
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

function changeLabel(count) {
  return `${count} ${count === 1 ? "change" : "changes"}`;
}

function statusClass(status) {
  return `cw-chip report-status ${String(status).toLowerCase().replace(/\s+/g, "-")}`;
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
