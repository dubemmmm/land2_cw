"use client";

import { useMemo, useState } from "react";
import { Check, Database, Plus, Save, Trash2 } from "lucide-react";
import { confidenceColor, confidenceLevel, confidenceScore, formatDate } from "@/lib/metrics";

const sourceTypes = ["Official", "Estate", "Internal", "Historical", "Manual"];
const outcomes = ["Approved", "Pending", "Denied", "Draft", "No data"];

export default function DataAdminClient({ initialRecords, initialEvents }) {
  const [records, setRecords] = useState(initialRecords);
  const [events, setEvents] = useState(initialEvents);
  const [selectedId, setSelectedId] = useState(initialRecords[0]?.id || "");
  const [draft, setDraft] = useState(initialRecords[0] || null);
  const [status, setStatus] = useState("");
  const selected = useMemo(() => records.find((record) => record.id === selectedId) || records[0] || null, [records, selectedId]);
  const score = confidenceScore(draft);

  function selectRecord(id) {
    const record = records.find((item) => item.id === id);
    setSelectedId(id);
    setDraft(clone(record));
    setStatus("");
  }

  async function createRecord() {
    const name = window.prompt("Neighborhood name");
    if (!name) return;
    const res = await fetch("/api/neighborhoods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, jurisdiction: "Lagos" })
    });
    const record = await res.json();
    if (!res.ok) {
      setStatus(record.error || "Could not create record");
      return;
    }
    const next = records.concat(record);
    setRecords(next);
    setSelectedId(record.id);
    setDraft(clone(record));
    await refreshEvents();
    setStatus("Created");
  }

  async function saveRecord(event) {
    event.preventDefault();
    if (!draft?.id) return;
    const patch = {
      ...draft,
      metadata: {
        ...(draft.metadata || {}),
        lastReviewed: new Date().toISOString().slice(0, 10),
        reviewStatus: "Reviewed"
      }
    };
    const res = await fetch(`/api/neighborhoods/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const record = await res.json();
    if (!res.ok) {
      setStatus(record.error || "Could not save record");
      return;
    }
    setRecords((current) => current.map((item) => item.id === record.id ? record : item));
    setDraft(clone(record));
    await refreshEvents();
    setStatus("Saved");
  }

  async function deleteRecord() {
    if (!draft?.id || !window.confirm(`Delete ${draft.name}?`)) return;
    const res = await fetch(`/api/neighborhoods/${draft.id}`, { method: "DELETE" });
    if (!res.ok) return;
    const next = records.filter((item) => item.id !== draft.id);
    setRecords(next);
    setSelectedId(next[0]?.id || "");
    setDraft(clone(next[0] || null));
    await refreshEvents();
  }

  async function refreshEvents() {
    const res = await fetch("/api/events");
    if (res.ok) setEvents(await res.json());
  }

  if (!draft) {
    return (
      <section className="data-page">
        <button className="data-primary" type="button" onClick={createRecord}><Plus size={16} /> Create first location</button>
      </section>
    );
  }

  return (
    <section className="data-page">
      <header className="data-header">
        <div>
          <span><Database size={15} /> SQLite database</span>
          <h1>Intelligence Data</h1>
          <p>Enter neighborhood intelligence, planning rules, approvals, notes, and manual overrides.</p>
        </div>
        <div>
          <button className="data-button" type="button" onClick={createRecord}><Plus size={16} /> New location</button>
          <button className="data-primary" type="submit" form="data-editor"><Save size={16} /> Save data</button>
        </div>
      </header>

      <div className="data-grid">
        <aside className="data-sidebar">
          <div className="data-sidebar-head">
            <strong>{records.length} locations</strong>
            <span>data/app.db</span>
          </div>
          {records.map((record) => {
            const recordScore = confidenceScore(record);
            return (
              <button className={record.id === selected?.id ? "active" : ""} type="button" key={record.id} onClick={() => selectRecord(record.id)}>
                <i style={{ "--tone": confidenceColor(recordScore) }}>{recordScore}</i>
                <span>
                  <b>{record.name}</b>
                  <small>{record.jurisdiction} · {confidenceLevel(recordScore)}</small>
                </span>
              </button>
            );
          })}
        </aside>

        <form id="data-editor" className="data-editor" onSubmit={saveRecord}>
          <section className="data-card data-basics">
            <div className="data-card-head">
              <div>
                <h2>{draft.name}</h2>
                <p>Last reviewed {formatDate(draft.metadata?.lastReviewed)} · {draft.metadata?.reviewedBy || "Admin"}</p>
              </div>
              <div className="data-score" style={{ "--tone": confidenceColor(score) }}>
                <b>{score}</b>
                <span>{confidenceLevel(score)}</span>
              </div>
            </div>

            <div className="data-fields two">
              <Field label="Neighborhood" value={draft.name} onChange={(value) => update("name", value)} />
              <Field label="Jurisdiction" value={draft.jurisdiction} onChange={(value) => update("jurisdiction", value)} />
              <Field label="Confidence score" type="number" value={draft.recommendation?.confidence || 0} onChange={(value) => update("recommendation.confidence", Number(value))} />
              <Field label="Risk level" value={draft.recommendation?.riskLevel || ""} onChange={(value) => update("recommendation.riskLevel", value)} />
            </div>
            <Textarea label="Summary" value={draft.recommendation?.summary || ""} onChange={(value) => update("recommendation.summary", value)} />
            <Textarea label="Best next action" value={draft.recommendation?.bestNextAction || ""} onChange={(value) => update("recommendation.bestNextAction", value)} />
            <Textarea label="Confidence reason" value={draft.recommendation?.confidenceReason || ""} onChange={(value) => update("recommendation.confidenceReason", value)} />
          </section>

          <ArrayEditor
            title="What you can build"
            items={draft.intelligence?.buildParameters || []}
            emptyItem={{ label: "New parameter", value: "", sourceType: "Manual" }}
            render={(item, index) => (
              <div className="data-array-row three">
                <Field label="Label" value={item.label} onChange={(value) => updateArray("intelligence.buildParameters", index, "label", value)} />
                <Field label="Value" value={item.value} onChange={(value) => updateArray("intelligence.buildParameters", index, "value", value)} />
                <Select label="Source" value={item.sourceType} options={sourceTypes} onChange={(value) => updateArray("intelligence.buildParameters", index, "sourceType", value)} />
              </div>
            )}
            onAdd={() => addArray("intelligence.buildParameters", { label: "New parameter", value: "", sourceType: "Manual" })}
            onRemove={(index) => removeArray("intelligence.buildParameters", index)}
          />

          <ArrayEditor
            title="Regulations"
            items={draft.intelligence?.constraints || []}
            emptyItem={{ label: "", sourceType: "Manual" }}
            render={(item, index) => (
              <div className="data-array-row two-wide">
                <Field label="Rule" value={item.label} onChange={(value) => updateArray("intelligence.constraints", index, "label", value)} />
                <Select label="Source" value={item.sourceType} options={sourceTypes} onChange={(value) => updateArray("intelligence.constraints", index, "sourceType", value)} />
              </div>
            )}
            onAdd={() => addArray("intelligence.constraints", { label: "", sourceType: "Manual" })}
            onRemove={(index) => removeArray("intelligence.constraints", index)}
          />

          <ArrayEditor
            title="Approval history"
            items={draft.approvals || []}
            emptyItem={{ date: new Date().toISOString().slice(0, 10), request: "", outcome: "Pending", sourceType: "Historical" }}
            render={(item, index) => (
              <div className="data-array-row four">
                <Field label="Date" type="date" value={item.date} onChange={(value) => updateArray("approvals", index, "date", value)} />
                <Field label="Request" value={item.request || item.projectType || ""} onChange={(value) => updateArray("approvals", index, "request", value)} />
                <Select label="Outcome" value={item.outcome} options={outcomes} onChange={(value) => updateArray("approvals", index, "outcome", value)} />
                <Select label="Source" value={item.sourceType} options={sourceTypes} onChange={(value) => updateArray("approvals", index, "sourceType", value)} />
              </div>
            )}
            onAdd={() => addArray("approvals", { date: new Date().toISOString().slice(0, 10), request: "", outcome: "Pending", sourceType: "Historical" })}
            onRemove={(index) => removeArray("approvals", index)}
          />

          <ArrayEditor
            title="Team notes"
            items={draft.notes || []}
            emptyItem={{ author: "Admin", category: "Note", text: "", date: new Date().toISOString().slice(0, 10) }}
            render={(item, index) => (
              <div className="data-array-row notes">
                <Field label="Author" value={item.author} onChange={(value) => updateArray("notes", index, "author", value)} />
                <Field label="Category" value={item.category} onChange={(value) => updateArray("notes", index, "category", value)} />
                <Field label="Date" type="date" value={item.date} onChange={(value) => updateArray("notes", index, "date", value)} />
                <Textarea label="Note" value={item.text} onChange={(value) => updateArray("notes", index, "text", value)} />
              </div>
            )}
            onAdd={() => addArray("notes", { author: "Admin", category: "Note", text: "", date: new Date().toISOString().slice(0, 10) })}
            onRemove={(index) => removeArray("notes", index)}
          />

          <div className="data-editor-actions">
            <button className="data-danger" type="button" onClick={deleteRecord}><Trash2 size={16} /> Delete</button>
            {status ? <span><Check size={15} /> {status}</span> : null}
            <button className="data-primary" type="submit"><Save size={16} /> Save data</button>
          </div>
        </form>

        <aside className="data-events">
          <h2>Recent changes</h2>
          {events.map((event) => (
            <article key={event.id}>
              <span>{event.action}</span>
              <strong>{event.neighborhoodId || "System"}</strong>
              <p>{new Date(event.createdAt).toLocaleString()}</p>
            </article>
          ))}
        </aside>
      </div>
    </section>
  );

  function update(path, value) {
    setDraft((current) => setPath(current, path, value));
  }

  function addArray(path, item) {
    setDraft((current) => {
      const next = clone(current);
      const list = getPath(next, path) || [];
      return setPath(next, path, list.concat(item));
    });
  }

  function removeArray(path, index) {
    setDraft((current) => {
      const next = clone(current);
      const list = [...(getPath(next, path) || [])];
      list.splice(index, 1);
      return setPath(next, path, list);
    });
  }

  function updateArray(path, index, key, value) {
    setDraft((current) => {
      const next = clone(current);
      const list = [...(getPath(next, path) || [])];
      list[index] = { ...(list[index] || {}), [key]: value };
      return setPath(next, path, list);
    });
  }
}

function ArrayEditor({ title, items, render, onAdd, onRemove }) {
  return (
    <section className="data-card">
      <div className="data-section-head">
        <h2>{title}</h2>
        <button type="button" onClick={onAdd}><Plus size={15} /> Add</button>
      </div>
      <div className="data-array">
        {items.map((item, index) => (
          <article key={index}>
            {render(item, index)}
            <button className="data-remove" type="button" onClick={() => onRemove(index)}><Trash2 size={14} /></button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="data-field">
      <span>{label}</span>
      <input type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="data-field">
      <span>{label}</span>
      <textarea value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="data-field">
      <span>{label}</span>
      <select value={value || options[0]} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function getPath(target, path) {
  return path.split(".").reduce((value, key) => value?.[key], target);
}

function setPath(target, path, value) {
  const next = clone(target);
  const keys = path.split(".");
  let cursor = next;
  keys.slice(0, -1).forEach((key) => {
    cursor[key] = cursor[key] || {};
    cursor = cursor[key];
  });
  cursor[keys.at(-1)] = value;
  return next;
}
