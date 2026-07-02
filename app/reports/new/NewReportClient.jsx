"use client";

import Link from "next/link";
import { ArrowLeft, FileText, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewReportClient({ neighborhoods }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    siteTitle: "",
    client: "",
    use: "",
    neighborhoodId: neighborhoods[0]?.id || "",
    status: "Shared",
    clientVisible: true,
    changes: 0,
    changeNotes: "Max height revised 8 -> 6 floors\nDesign-review sign-off now required on heritage frontages",
    recommendationOverride: "Proceed with conditions"
  });

  async function createReport(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
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
          <h1>Create Client Report</h1>
          <p>Create a database-backed report that can appear in the internal reports workspace and on a client-facing link.</p>
        </div>
      </header>

      <form className="new-report-card" onSubmit={createReport}>
        <div className="new-report-kicker"><FileText size={16} /> Client brief setup</div>
        <div className="new-report-grid">
          <label>
            <span>Site / report title</span>
            <input required value={form.siteTitle} placeholder="Plot 1841, Glover Road" onChange={(event) => setForm({ ...form, siteTitle: event.target.value })} />
          </label>
          <label>
            <span>Client</span>
            <input required value={form.client} placeholder="Meridian Estates" onChange={(event) => setForm({ ...form, client: event.target.value })} />
          </label>
          <label>
            <span>Neighborhood intelligence</span>
            <select value={form.neighborhoodId} onChange={(event) => setForm({ ...form, neighborhoodId: event.target.value })}>
              {neighborhoods.map((neighborhood) => (
                <option value={neighborhood.id} key={neighborhood.id}>{neighborhood.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Project / use case</span>
            <input required value={form.use} placeholder="8-floor mixed-use" onChange={(event) => setForm({ ...form, use: event.target.value })} />
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value, clientVisible: event.target.value !== "Draft" })}>
              {["Draft", "Shared", "Client viewed"].map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label>
            <span>Change count</span>
            <input type="number" min="0" value={form.changes} onChange={(event) => setForm({ ...form, changes: Number(event.target.value) })} />
          </label>
        </div>

        <label>
          <span>Change notes</span>
          <textarea value={form.changeNotes} onChange={(event) => setForm({ ...form, changeNotes: event.target.value })} />
        </label>
        <label>
          <span>Recommendation label</span>
          <input value={form.recommendationOverride} onChange={(event) => setForm({ ...form, recommendationOverride: event.target.value })} />
        </label>
        <label className="new-report-toggle">
          <input type="checkbox" checked={form.clientVisible} onChange={(event) => setForm({ ...form, clientVisible: event.target.checked })} />
          <span>Client can view this report link</span>
        </label>

        <footer>
          {error ? <p>{error}</p> : <span>Client URL will be available after saving.</span>}
          <button type="submit" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Create report"}</button>
        </footer>
      </form>
    </section>
  );
}
