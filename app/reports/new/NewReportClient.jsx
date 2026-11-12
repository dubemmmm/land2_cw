"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const reportTypes = ["Neighborhood brief", "Estate brief", "Parcel brief", "Investment memo", "Planning risk memo"];
const riskLevels = ["Low", "Medium", "High", "Critical", "Unknown"];

export default function NewReportClient({ neighborhoods, estates = [], initialReport = null, mode = "create" }) {
  const router = useRouter();
  const firstNeighborhoodId = neighborhoods[0]?.id || "";
  const initialTargetType = initialReport?.data?.targetType || initialReport?.sourceType || "neighborhood";
  const [targetType, setTargetType] = useState(initialTargetType === "estate" ? "estate" : "neighborhood");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    reportType: initialReport?.data?.reportType || "Neighborhood brief",
    siteTitle: initialReport?.siteTitle || "",
    client: initialReport?.client || "",
    use: initialReport?.use || "",
    neighborhoodId: initialReport?.neighborhoodId || firstNeighborhoodId,
    estateId: initialTargetType === "estate" ? initialReport?.data?.targetId || initialReport?.sourceId || "" : "",
    status: initialReport?.status || "Published",
    clientVisible: initialReport ? initialReport.clientVisible : true,
    publishDate: initialReport?.data?.publishDate || new Date().toISOString().slice(0, 10),
    reviewDate: initialReport?.data?.reviewDate || "",
    confidenceOverride: initialReport?.data?.confidenceOverride ?? "",
    riskLevel: initialReport?.data?.riskLevel || "Medium",
    changes: initialReport?.changes || 0,
    changeNotes: initialReport?.data?.changeNotes?.join("\n") || "Max height revised 8 -> 6 floors\nDesign-review sign-off now required on heritage frontages",
    recommendationOverride: initialReport?.data?.recommendationOverride || initialReport?.verdict || "Proceed with conditions",
    recommendationRationale: initialReport?.data?.recommendationRationale || "",
    executiveSummary: initialReport?.data?.executiveSummary || "",
    keyRisks: initialReport?.data?.keyRisks?.join("\n") || "",
    opportunityNotes: initialReport?.data?.opportunityNotes?.join("\n") || "",
    internalNotes: initialReport?.data?.internalNotes || ""
  });

  const selectedEstate = useMemo(() => estates.find((estate) => estate.id === form.estateId), [estates, form.estateId]);
  const availableEstates = useMemo(() => estates.filter((estate) => estate.neighborhoodId === form.neighborhoodId), [estates, form.neighborhoodId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateTargetType(value) {
    setTargetType(value);
    setForm((current) => ({
      ...current,
      reportType: value === "estate" ? "Estate brief" : current.reportType === "Estate brief" ? "Neighborhood brief" : current.reportType,
      estateId: value === "estate" ? current.estateId || availableEstates[0]?.id || "" : ""
    }));
  }

  function updateNeighborhood(value) {
    const nextEstate = estates.find((estate) => estate.neighborhoodId === value);
    setForm((current) => ({
      ...current,
      neighborhoodId: value,
      estateId: targetType === "estate" ? nextEstate?.id || "" : current.estateId
    }));
  }

  async function createReport(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(mode === "edit" ? `/api/reports/${initialReport.id}` : "/api/reports", {
      method: mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        targetType,
        targetId: targetType === "estate" ? form.estateId : form.neighborhoodId,
        siteTitle: form.siteTitle || selectedEstate?.name || ""
      })
    });
    const report = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(report.error || "Could not create report");
      return;
    }
    router.push(`/reports?report=${report.id}`);
  }

  return (
    <section className="new-report-page">
      <header className="cw-pagehead">
        <div>
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/reports">Reports</Link>
            <span aria-hidden="true">/</span>
            <span>{mode === "edit" ? "Edit report" : "New report"}</span>
          </nav>
          <h1 className="cw-pagehead-title">{mode === "edit" ? "Edit client report" : "Create client report"}</h1>
          <p className="cw-lede">{mode === "edit" ? "Update the report intelligence, publishing controls, and client-facing recommendation." : "Create a database-backed report that can appear in the internal reports workspace and on a client-facing link."}</p>
        </div>
      </header>

      <form className="new-report-form" onSubmit={createReport}>
        <section className="new-report-card">
          <header>
            <h2 className="cw-label"><b>01</b>Client brief setup</h2>
          </header>
          <div className="new-report-grid">
            <label className="new-report-field">
              <span>Report type</span>
              <select className="cw-select" required value={form.reportType} onChange={(event) => updateField("reportType", event.target.value)}>
                {reportTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className="new-report-field">
              <span>Target level</span>
              <select className="cw-select" value={targetType} onChange={(event) => updateTargetType(event.target.value)}>
                <option value="neighborhood">Neighborhood / land</option>
                <option value="estate">Estate</option>
              </select>
            </label>
            <label className="new-report-field">
              <span>Site / report title</span>
              <input className="cw-input" required value={form.siteTitle} placeholder={targetType === "estate" ? selectedEstate?.name || "Banana Island Waterfront" : "Plot 1841, Glover Road"} onChange={(event) => updateField("siteTitle", event.target.value)} />
            </label>
            <label className="new-report-field">
              <span>Client</span>
              <input className="cw-input" required value={form.client} placeholder="Meridian Estates" onChange={(event) => updateField("client", event.target.value)} />
            </label>
            <label className="new-report-field">
              <span>Neighborhood intelligence</span>
              <select className="cw-select" required value={form.neighborhoodId} onChange={(event) => updateNeighborhood(event.target.value)}>
                {neighborhoods.map((neighborhood) => (
                  <option value={neighborhood.id} key={neighborhood.id}>{neighborhood.name}</option>
                ))}
              </select>
            </label>
            {targetType === "estate" ? (
              <label className="new-report-field">
                <span>Estate</span>
                <select className="cw-select" required value={form.estateId} onChange={(event) => updateField("estateId", event.target.value)}>
                  <option value="">Select estate</option>
                  {availableEstates.map((estate) => (
                    <option value={estate.id} key={estate.id}>{estate.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="new-report-field">
              <span>Project / use case</span>
              <input className="cw-input" required value={form.use} placeholder="8-floor mixed-use" onChange={(event) => updateField("use", event.target.value)} />
            </label>
          </div>
        </section>

        <section className="new-report-card">
          <header>
            <h2 className="cw-label"><b>02</b>Publishing & status</h2>
          </header>
          <div className="new-report-grid">
            <label className="new-report-field">
              <span>Status</span>
              <select className="cw-select" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value, clientVisible: event.target.value !== "Draft" })}>
                {["Draft", "Published", "Client viewed"].map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="new-report-field">
              <span>Risk level</span>
              <select className="cw-select" value={form.riskLevel} onChange={(event) => updateField("riskLevel", event.target.value)}>
                {riskLevels.map((risk) => <option key={risk}>{risk}</option>)}
              </select>
            </label>
            <label className="new-report-field">
              <span>Publish date</span>
              <input className="cw-input" type="date" value={form.publishDate} onChange={(event) => updateField("publishDate", event.target.value)} />
            </label>
            <label className="new-report-field">
              <span>Review date</span>
              <input className="cw-input" type="date" value={form.reviewDate} onChange={(event) => updateField("reviewDate", event.target.value)} />
            </label>
            <label className="new-report-field">
              <span>Confidence override</span>
              <input className="cw-input" type="number" min="0" max="100" value={form.confidenceOverride} placeholder="0-100, optional" onChange={(event) => updateField("confidenceOverride", event.target.value)} />
            </label>
            <label className="new-report-field">
              <span>Change count</span>
              <input className="cw-input" type="number" min="0" value={form.changes} onChange={(event) => updateField("changes", Number(event.target.value))} />
            </label>
          </div>
          <label className="new-report-toggle">
            <input type="checkbox" checked={form.clientVisible} onChange={(event) => updateField("clientVisible", event.target.checked)} />
            <span>Client can view this report link</span>
          </label>
        </section>

        <section className="new-report-card">
          <header>
            <h2 className="cw-label"><b>03</b>Recommendation</h2>
          </header>
          <label className="new-report-field">
            <span>Recommendation label</span>
            <input className="cw-input" value={form.recommendationOverride} onChange={(event) => updateField("recommendationOverride", event.target.value)} />
          </label>
          <label className="new-report-field">
            <span>Executive summary</span>
            <textarea className="cw-textarea" required value={form.executiveSummary} placeholder="What should the client understand before making a decision?" onChange={(event) => updateField("executiveSummary", event.target.value)} />
          </label>
          <label className="new-report-field">
            <span>Recommendation rationale</span>
            <textarea className="cw-textarea" required value={form.recommendationRationale} placeholder="Why are we recommending this position?" onChange={(event) => updateField("recommendationRationale", event.target.value)} />
          </label>
        </section>

        <section className="new-report-card">
          <header>
            <h2 className="cw-label"><b>04</b>Changes, risks & notes</h2>
          </header>
          <label className="new-report-field">
            <span>Change notes</span>
            <textarea className="cw-textarea" value={form.changeNotes} onChange={(event) => updateField("changeNotes", event.target.value)} />
            <small>One change per line.</small>
          </label>
          <label className="new-report-field">
            <span>Key risks</span>
            <textarea className="cw-textarea" value={form.keyRisks} placeholder="One risk per line: title risk, approval uncertainty, drainage, access..." onChange={(event) => updateField("keyRisks", event.target.value)} />
          </label>
          <label className="new-report-field">
            <span>Opportunity notes</span>
            <textarea className="cw-textarea" value={form.opportunityNotes} placeholder="One opportunity per line: pricing upside, approval precedent, demand signal..." onChange={(event) => updateField("opportunityNotes", event.target.value)} />
          </label>
          <label className="new-report-field">
            <span>Internal admin notes</span>
            <textarea className="cw-textarea" value={form.internalNotes} placeholder="Private notes for admins only. These do not show in the client report." onChange={(event) => updateField("internalNotes", event.target.value)} />
          </label>
        </section>

        <footer className="new-report-actions">
          {error ? <p className="new-report-error" role="alert">{error}</p> : <span>{mode === "edit" ? "Changes will update the client-facing report if visible." : "Client URL will be available after saving."}</span>}
          <div>
            <Link className="cw-btn cw-btn-soft cw-btn-sm" href="/reports">Cancel</Link>
            <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit" disabled={saving}><Save size={16} /> {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create report"}</button>
          </div>
        </footer>
      </form>
    </section>
  );
}
