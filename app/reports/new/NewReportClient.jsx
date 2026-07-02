"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Save } from "lucide-react";
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
      <header className="new-report-header">
        <div>
          <Link href="/reports"><ArrowLeft size={15} /> Reports</Link>
          <h1>{mode === "edit" ? "Edit Client Report" : "Create Client Report"}</h1>
          <p>{mode === "edit" ? "Update the report intelligence, publishing controls, and client-facing recommendation." : "Create a database-backed report that can appear in the internal reports workspace and on a client-facing link."}</p>
        </div>
      </header>

      <form className="new-report-card" onSubmit={createReport}>
        <div className="new-report-kicker"><FileText size={16} /> Client brief setup</div>
        <div className="new-report-grid">
          <label>
            <span>Report type</span>
            <select required value={form.reportType} onChange={(event) => updateField("reportType", event.target.value)}>
              {reportTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>Target level</span>
            <select value={targetType} onChange={(event) => updateTargetType(event.target.value)}>
              <option value="neighborhood">Neighborhood / land</option>
              <option value="estate">Estate</option>
            </select>
          </label>
          <label>
            <span>Site / report title</span>
            <input required value={form.siteTitle} placeholder={targetType === "estate" ? selectedEstate?.name || "Banana Island Waterfront" : "Plot 1841, Glover Road"} onChange={(event) => updateField("siteTitle", event.target.value)} />
          </label>
          <label>
            <span>Client</span>
            <input required value={form.client} placeholder="Meridian Estates" onChange={(event) => updateField("client", event.target.value)} />
          </label>
          <label>
            <span>Neighborhood intelligence</span>
            <select required value={form.neighborhoodId} onChange={(event) => updateNeighborhood(event.target.value)}>
              {neighborhoods.map((neighborhood) => (
                <option value={neighborhood.id} key={neighborhood.id}>{neighborhood.name}</option>
              ))}
            </select>
          </label>
          {targetType === "estate" ? (
            <label>
              <span>Estate</span>
              <select required value={form.estateId} onChange={(event) => updateField("estateId", event.target.value)}>
                <option value="">Select estate</option>
                {availableEstates.map((estate) => (
                  <option value={estate.id} key={estate.id}>{estate.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>Project / use case</span>
            <input required value={form.use} placeholder="8-floor mixed-use" onChange={(event) => updateField("use", event.target.value)} />
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value, clientVisible: event.target.value !== "Draft" })}>
              {["Draft", "Published", "Client viewed"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <span>Publish date</span>
            <input type="date" value={form.publishDate} onChange={(event) => updateField("publishDate", event.target.value)} />
          </label>
          <label>
            <span>Review date</span>
            <input type="date" value={form.reviewDate} onChange={(event) => updateField("reviewDate", event.target.value)} />
          </label>
          <label>
            <span>Risk level</span>
            <select value={form.riskLevel} onChange={(event) => updateField("riskLevel", event.target.value)}>
              {riskLevels.map((risk) => <option key={risk}>{risk}</option>)}
            </select>
          </label>
          <label>
            <span>Confidence override</span>
            <input type="number" min="0" max="100" value={form.confidenceOverride} placeholder="0-100, optional" onChange={(event) => updateField("confidenceOverride", event.target.value)} />
          </label>
          <label>
            <span>Change count</span>
            <input type="number" min="0" value={form.changes} onChange={(event) => updateField("changes", Number(event.target.value))} />
          </label>
        </div>

        <label>
          <span>Executive summary</span>
          <textarea required value={form.executiveSummary} placeholder="What should the client understand before making a decision?" onChange={(event) => updateField("executiveSummary", event.target.value)} />
        </label>
        <label>
          <span>Recommendation rationale</span>
          <textarea required value={form.recommendationRationale} placeholder="Why are we recommending this position?" onChange={(event) => updateField("recommendationRationale", event.target.value)} />
        </label>
        <label>
          <span>Change notes</span>
          <textarea value={form.changeNotes} onChange={(event) => updateField("changeNotes", event.target.value)} />
        </label>
        <label>
          <span>Recommendation label</span>
          <input value={form.recommendationOverride} onChange={(event) => updateField("recommendationOverride", event.target.value)} />
        </label>
        <label>
          <span>Key risks</span>
          <textarea value={form.keyRisks} placeholder="One risk per line: title risk, approval uncertainty, drainage, access..." onChange={(event) => updateField("keyRisks", event.target.value)} />
        </label>
        <label>
          <span>Opportunity notes</span>
          <textarea value={form.opportunityNotes} placeholder="One opportunity per line: pricing upside, approval precedent, demand signal..." onChange={(event) => updateField("opportunityNotes", event.target.value)} />
        </label>
        <label>
          <span>Internal admin notes</span>
          <textarea value={form.internalNotes} placeholder="Private notes for admins only. These do not show in the client report." onChange={(event) => updateField("internalNotes", event.target.value)} />
        </label>
        <label className="new-report-toggle">
          <input type="checkbox" checked={form.clientVisible} onChange={(event) => updateField("clientVisible", event.target.checked)} />
          <span>Client can view this report link</span>
        </label>

        <footer>
          {error ? <p>{error}</p> : <span>{mode === "edit" ? "Changes will update the client-facing report if visible." : "Client URL will be available after saving."}</span>}
          <button type="submit" disabled={saving}><Save size={16} /> {saving ? "Saving..." : mode === "edit" ? "Save changes" : "Create report"}</button>
        </footer>
      </form>
    </section>
  );
}
