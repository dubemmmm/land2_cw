"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, Check, Database, ExternalLink, FileText, Paperclip, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import { confidenceColor, confidenceLevel, confidenceScore, formatDate } from "@/lib/metrics";

const sourceTypes = ["Official", "Estate", "Internal", "Historical", "Manual"];
const outcomes = ["Approved", "Pending", "Denied", "Draft", "No data"];
const resourceTypes = ["Research", "Attachment", "Planning memo", "Market report", "Comparable"];
const visibilityTypes = ["Client", "Internal"];
const sections = [
  { key: "record", label: "Location record" },
  { key: "resources", label: "Research & files" },
  { key: "market", label: "Estates & prices" }
];

export default function DataAdminClient({
  initialRecords,
  initialEvents,
  initialResources = [],
  initialMarketEstates = [],
  initialPricePoints = [],
  estates = [],
  adminEmail
}) {
  const [records, setRecords] = useState(initialRecords);
  const [events, setEvents] = useState(initialEvents);
  const [resources, setResources] = useState(initialResources);
  const [marketEstates, setMarketEstates] = useState(initialMarketEstates);
  const [pricePoints, setPricePoints] = useState(initialPricePoints);
  const [selectedId, setSelectedId] = useState(initialRecords[0]?.id || "");
  const [draft, setDraft] = useState(initialRecords[0] || null);
  const [resourceDraft, setResourceDraft] = useState(defaultResourceDraft(initialRecords[0]?.id || ""));
  const [estateDraft, setEstateDraft] = useState(defaultEstateDraft(initialRecords[0]?.id || ""));
  const [priceDraft, setPriceDraft] = useState(defaultPriceDraft(initialRecords[0]?.id || ""));
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("record");
  const selected = useMemo(() => records.find((record) => record.id === selectedId) || records[0] || null, [records, selectedId]);
  const score = confidenceScore(draft);
  const targetOptions = useMemo(() => (
    records.map((record) => ({ type: "neighborhood", id: record.id, name: record.name, meta: record.jurisdiction || "Location" }))
      .concat(estates.map((estate) => ({ type: "estate", id: estate.id, name: estate.name, meta: estate.parentName || "Estate" })))
  ), [estates, records]);

  function selectRecord(id) {
    const record = records.find((item) => item.id === id);
    setSelectedId(id);
    setDraft(clone(record));
    setResourceDraft((current) => ({ ...current, targetType: "neighborhood", targetId: id }));
    setEstateDraft((current) => ({ ...current, neighborhoodId: id }));
    setPriceDraft((current) => ({ ...current, targetType: "neighborhood", targetId: id }));
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
    setResourceDraft(defaultResourceDraft(record.id));
    setEstateDraft(defaultEstateDraft(record.id));
    setPriceDraft(defaultPriceDraft(record.id));
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

  async function refreshResources() {
    const res = await fetch("/api/resources");
    if (res.ok) setResources(await res.json());
  }

  async function createResource(event) {
    event.preventDefault();
    const form = new FormData();
    Object.entries(resourceDraft).forEach(([key, value]) => {
      if (key !== "file" && value !== undefined && value !== null) form.append(key, value);
    });
    if (resourceDraft.file) form.append("file", resourceDraft.file);
    const res = await fetch("/api/resources", {
      method: "POST",
      body: form
    });
    const resource = await res.json();
    if (!res.ok) {
      setStatus(resource.error || "Could not add resource");
      return;
    }
    setResources((current) => [resource].concat(current));
    setResourceDraft(defaultResourceDraft(resourceDraft.targetId, resourceDraft.targetType));
    await refreshEvents();
    setStatus("Resource added");
  }

  async function updateResource(resource) {
    const res = await fetch(`/api/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resource)
    });
    const updated = await res.json();
    if (!res.ok) {
      setStatus(updated.error || "Could not update resource");
      return;
    }
    setResources((current) => current.map((item) => item.id === updated.id ? updated : item));
    setStatus("Resource updated");
  }

  async function deleteResource(resourceId) {
    if (!window.confirm("Remove this resource?")) return;
    const res = await fetch(`/api/resources/${resourceId}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("Could not remove resource");
      return;
    }
    setResources((current) => current.filter((item) => item.id !== resourceId));
    await refreshEvents();
    setStatus("Resource removed");
  }

  async function createEstate(event) {
    event.preventDefault();
    const res = await fetch("/api/market/estates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(estateDraft)
    });
    const estate = await res.json();
    if (!res.ok) {
      setStatus(estate.error || "Could not add estate");
      return;
    }
    setMarketEstates((current) => current.concat(estate));
    setEstateDraft(defaultEstateDraft(estateDraft.neighborhoodId));
    setStatus("Estate added");
  }

  async function updateEstate(estate) {
    const res = await fetch(`/api/market/estates/${estate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(estate)
    });
    const updated = await res.json();
    if (!res.ok) {
      setStatus(updated.error || "Could not update estate");
      return;
    }
    setMarketEstates((current) => current.map((item) => item.id === updated.id ? updated : item));
    setStatus("Estate updated");
  }

  async function deleteEstate(id) {
    if (!window.confirm("Remove this estate and its price points?")) return;
    const res = await fetch(`/api/market/estates/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("Could not remove estate");
      return;
    }
    setMarketEstates((current) => current.filter((item) => item.id !== id));
    setPricePoints((current) => current.filter((item) => item.targetId !== id));
    setStatus("Estate removed");
  }

  async function createPricePoint(event) {
    event.preventDefault();
    const res = await fetch("/api/market/prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(priceDraft)
    });
    const point = await res.json();
    if (!res.ok) {
      setStatus(point.error || "Could not save price point");
      return;
    }
    setPricePoints((current) => current.filter((item) => item.id !== point.id).concat(point));
    setPriceDraft((current) => ({ ...current, year: new Date().getFullYear(), value: "" }));
    setStatus("Price point saved");
  }

  async function deletePricePoint(id) {
    const res = await fetch(`/api/market/prices/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("Could not remove price point");
      return;
    }
    setPricePoints((current) => current.filter((item) => item.id !== id));
    setStatus("Price point removed");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login?next=/data";
  }

  if (!draft) {
    return (
      <section className="data-page">
        <header className="cw-pagehead">
          <div>
            <DataCrumbs />
            <h1 className="cw-pagehead-title">Intelligence data</h1>
            <p className="cw-lede">No locations yet. Create the first one to start entering intelligence.</p>
          </div>
          <button className="cw-btn cw-btn-navy" type="button" onClick={createRecord}><Plus size={16} /> Create first location</button>
        </header>
      </section>
    );
  }

  return (
    <section className="data-page">
      <header className="cw-pagehead">
        <div>
          <DataCrumbs />
          <h1 className="cw-pagehead-title">Intelligence data</h1>
          <p className="cw-lede">Enter neighborhood intelligence, planning rules, approvals, notes, and manual overrides.</p>
        </div>
        <div className="data-head-actions">
          <span className="cw-chip data-admin-badge">{adminEmail}</span>
          <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={logout}>Log out</button>
          <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={createRecord}><Plus size={16} /> New location</button>
          <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit" form="data-editor"><Save size={16} /> Save data</button>
        </div>
      </header>

      <div className="data-toolbar">
        <div className="cw-tabs data-tabs" role="tablist" aria-label="Data sections">
          {sections.map((item) => (
            <button
              className={section === item.key ? "active" : ""}
              type="button"
              role="tab"
              aria-selected={section === item.key}
              key={item.key}
              onClick={() => setSection(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="data-toolbar-meta">
          {status ? <span className="data-status" role="status"><Check size={14} /> {status}</span> : null}
          <span className="cw-chip"><Database size={13} /> SQLite database</span>
        </div>
      </div>

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

        <div className="data-editor">
          <form id="data-editor" className="data-panel data-editor-stack" onSubmit={saveRecord} hidden={section !== "record"}>
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
              <button className="cw-btn cw-btn-danger cw-btn-sm" type="button" onClick={deleteRecord}><Trash2 size={16} /> Delete</button>
              {status ? <span className="data-status"><Check size={14} /> {status}</span> : null}
              <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Save size={16} /> Save data</button>
            </div>
          </form>

          <div className="data-panel" hidden={section !== "resources"}>
          <ResourceManager
            draft={resourceDraft}
            resources={resources}
            selectedId={selectedId}
            targetOptions={targetOptions}
            onCreate={createResource}
            onDraftChange={setResourceDraft}
            onDelete={deleteResource}
            onUpdate={updateResource}
          />
          </div>

          <div className="data-panel" hidden={section !== "market"}>
          <MarketManager
            estateDraft={estateDraft}
            marketEstates={marketEstates}
            neighborhoods={records}
            priceDraft={priceDraft}
            pricePoints={pricePoints}
            selectedId={selectedId}
            targetOptions={targetOptions.concat(marketEstates.map((estate) => ({
              type: "estate",
              id: estate.id,
              name: estate.name,
              meta: estate.neighborhoodId
            })))}
            onCreateEstate={createEstate}
            onCreatePricePoint={createPricePoint}
            onDeleteEstate={deleteEstate}
            onDeletePricePoint={deletePricePoint}
            onEstateDraftChange={setEstateDraft}
            onPriceDraftChange={setPriceDraft}
            onUpdateEstate={updateEstate}
          />
          </div>
        </div>

        <aside className="data-events">
          <h2>Recent changes</h2>
          {events.map((event) => (
            <article key={event.id}>
              <span className="cw-chip">{event.action}</span>
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
        <h2>{title}<span className="data-count">{items.length}</span></h2>
        <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={onAdd}><Plus size={15} /> Add</button>
      </div>
      <div className="data-array">
        {items.map((item, index) => (
          <article key={index}>
            {render(item, index)}
            <button className="cw-icon-btn data-remove" type="button" aria-label="Remove row" title="Remove row" onClick={() => onRemove(index)}><Trash2 size={14} /></button>
          </article>
        ))}
        {!items.length ? <p className="data-empty">Nothing added yet.</p> : null}
      </div>
    </section>
  );
}

function ResourceManager({ draft, resources, selectedId, targetOptions, onCreate, onDraftChange, onDelete, onUpdate }) {
  const targetMap = new Map(targetOptions.map((target) => [`${target.type}:${target.id}`, target]));
  const selectedResources = resources.filter((resource) => resource.targetId === selectedId);
  const visibleResources = selectedResources.concat(resources.filter((resource) => resource.targetId !== selectedId)).slice(0, 12);

  function updateDraft(key, value) {
    onDraftChange((current) => ({ ...current, [key]: value }));
  }

  function updateTarget(value) {
    const [targetType, targetId] = value.split(":");
    onDraftChange((current) => ({ ...current, targetType, targetId }));
  }

  return (
    <section className="data-card">
      <div className="data-section-head">
        <div>
          <h2>Attachments & market research</h2>
          <p>Post source links, research notes, planning memos, and client-visible market intelligence.</p>
        </div>
      </div>

      <form className="data-form" onSubmit={onCreate}>
        <label className="data-field">
          <span>Target</span>
          <select className="cw-select" value={`${draft.targetType}:${draft.targetId}`} onChange={(event) => updateTarget(event.target.value)}>
            {targetOptions.map((target) => (
              <option value={`${target.type}:${target.id}`} key={`${target.type}:${target.id}`}>
                {target.name} · {target.type === "estate" ? "Estate" : "Location"}
              </option>
            ))}
          </select>
        </label>
        <Select label="Type" value={draft.resourceType} options={resourceTypes} onChange={(value) => updateDraft("resourceType", value)} />
        <Select label="Visibility" value={draft.visibility} options={visibilityTypes} onChange={(value) => updateDraft("visibility", value)} />
        <Field label="Title" value={draft.title} onChange={(value) => updateDraft("title", value)} />
        <Field label="Source" value={draft.source} onChange={(value) => updateDraft("source", value)} />
        <Field label="URL / document link" value={draft.url} onChange={(value) => updateDraft("url", value)} />
        <FileField
          label="Upload document"
          file={draft.file}
          onChange={(file) => onDraftChange((current) => ({
            ...current,
            file,
            resourceType: file ? "Attachment" : current.resourceType,
            title: current.title || file?.name || ""
          }))}
        />
        <Textarea label="Research summary" value={draft.summary} onChange={(value) => updateDraft("summary", value)} />
        <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Paperclip size={16} /> Add resource</button>
      </form>

      <div className="data-list">
        {visibleResources.map((resource) => (
          <ResourceRow
            key={resource.id}
            resource={resource}
            target={targetMap.get(`${resource.targetType}:${resource.targetId}`)}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ))}
        {!visibleResources.length ? (
          <p className="data-empty">No attachments or market research have been added yet.</p>
        ) : null}
      </div>
    </section>
  );
}

function ResourceRow({ resource, target, onDelete, onUpdate }) {
  const [draft, setDraft] = useState(resource);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="data-item">
      <header>
        <span className="data-item-icon">{resource.fileName ? <Paperclip size={18} /> : <FileText size={18} />}</span>
        <div className="data-item-title">
          <strong>{resource.title || target?.name || resource.targetId}</strong>
          <small>{target?.name || resource.targetId} · {resource.author} · {new Date(resource.createdAt).toLocaleDateString()}</small>
          <div className="data-item-chips">
            <span className="cw-chip">{resource.resourceType}</span>
            <span className="cw-chip">{resource.visibility}</span>
          </div>
        </div>
        <div className="data-item-actions">
          {resource.url ? (
            <a className="cw-icon-btn" href={resource.url} target="_blank" rel="noreferrer" aria-label="Open resource" title="Open resource"><ExternalLink size={15} /></a>
          ) : null}
          {resource.fileName ? (
            <a className="cw-icon-btn" href={`/api/resources/${resource.id}/file`} target="_blank" rel="noreferrer" aria-label="Open attachment" title="Open attachment"><Paperclip size={15} /></a>
          ) : null}
          <button className="cw-icon-btn data-remove" type="button" aria-label="Remove resource" title="Remove resource" onClick={() => onDelete(resource.id)}><Trash2 size={14} /></button>
        </div>
      </header>
      <div className="data-item-grid">
        <Field label="Title" value={draft.title} onChange={(value) => update("title", value)} />
        <Select label="Type" value={draft.resourceType} options={resourceTypes} onChange={(value) => update("resourceType", value)} />
        <Select label="Visibility" value={draft.visibility} options={visibilityTypes} onChange={(value) => update("visibility", value)} />
        <Field label="Source" value={draft.source} onChange={(value) => update("source", value)} />
        <Field label="URL" value={draft.url} onChange={(value) => update("url", value)} />
        <Textarea label="Summary" value={draft.summary} onChange={(value) => update("summary", value)} />
      </div>
      <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => onUpdate(draft)}><Save size={15} /> Save resource</button>
    </article>
  );
}

function MarketManager({
  estateDraft,
  marketEstates,
  neighborhoods,
  priceDraft,
  pricePoints,
  selectedId,
  targetOptions,
  onCreateEstate,
  onCreatePricePoint,
  onDeleteEstate,
  onDeletePricePoint,
  onEstateDraftChange,
  onPriceDraftChange,
  onUpdateEstate
}) {
  const visibleEstates = marketEstates.filter((estate) => estate.neighborhoodId === selectedId);
  const visiblePrices = pricePoints.filter((point) => point.targetId === selectedId || visibleEstates.some((estate) => estate.id === point.targetId));
  const targets = uniqueTargets(targetOptions);

  return (
    <section className="data-card">
      <div className="data-section-head">
        <div>
          <h2>Estate & price intelligence</h2>
          <p>Add estates inside neighborhoods and yearly price points used by the projection model.</p>
        </div>
      </div>

      <form className="data-form" onSubmit={onCreateEstate}>
        <label className="data-field">
          <span>Neighborhood</span>
          <select className="cw-select" value={estateDraft.neighborhoodId} onChange={(event) => onEstateDraftChange((current) => ({ ...current, neighborhoodId: event.target.value }))}>
            {neighborhoods.map((record) => <option value={record.id} key={record.id}>{record.name}</option>)}
          </select>
        </label>
        <Field label="Estate name" value={estateDraft.name} onChange={(value) => onEstateDraftChange((current) => ({ ...current, name: value }))} />
        <Field label="Primary use" value={estateDraft.primaryUse} onChange={(value) => onEstateDraftChange((current) => ({ ...current, primaryUse: value }))} />
        <Field label="Status" value={estateDraft.status} onChange={(value) => onEstateDraftChange((current) => ({ ...current, status: value }))} />
        <Field label="Developer" value={estateDraft.developer} onChange={(value) => onEstateDraftChange((current) => ({ ...current, developer: value }))} />
        <Field label="Available plots" value={estateDraft.availablePlots} onChange={(value) => onEstateDraftChange((current) => ({ ...current, availablePlots: value }))} />
        <Field label="Total land sqm" type="number" value={estateDraft.totalLandSqm} onChange={(value) => onEstateDraftChange((current) => ({ ...current, totalLandSqm: value }))} />
        <Textarea label="Estate description" value={estateDraft.description} onChange={(value) => onEstateDraftChange((current) => ({ ...current, description: value }))} />
        <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Plus size={16} /> Add estate</button>
      </form>

      <div className="data-list">
        {visibleEstates.map((estate) => (
          <EstateAdminRow key={estate.id} estate={estate} onDelete={onDeleteEstate} onUpdate={onUpdateEstate} />
        ))}
        {!visibleEstates.length ? <p className="data-empty">No editable estates have been added for this neighborhood yet.</p> : null}
      </div>

      <form className="data-form" onSubmit={onCreatePricePoint}>
        <label className="data-field">
          <span>Price target</span>
          <select className="cw-select" value={`${priceDraft.targetType}:${priceDraft.targetId}`} onChange={(event) => {
            const [targetType, targetId] = event.target.value.split(":");
            onPriceDraftChange((current) => ({ ...current, targetType, targetId }));
          }}>
            {targets.map((target) => (
              <option value={`${target.type}:${target.id}`} key={`${target.type}:${target.id}`}>
                {target.name} · {target.type === "estate" ? "Estate" : "Location"}
              </option>
            ))}
          </select>
        </label>
        <Field label="Year" type="number" value={priceDraft.year} onChange={(value) => onPriceDraftChange((current) => ({ ...current, year: Number(value) }))} />
        <Field label="Price / sqm" type="number" value={priceDraft.value} onChange={(value) => onPriceDraftChange((current) => ({ ...current, value }))} />
        <Select label="Currency" value={priceDraft.currency} options={["NGN", "USD"]} onChange={(value) => onPriceDraftChange((current) => ({ ...current, currency: value }))} />
        <Field label="Source" value={priceDraft.source} onChange={(value) => onPriceDraftChange((current) => ({ ...current, source: value }))} />
        <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Plus size={16} /> Save price point</button>
      </form>

      <div className="data-table">
        {visiblePrices.length ? (
          <div className="data-table-head" aria-hidden="true">
            <span>Year</span>
            <span>Target · source</span>
            <span>Price</span>
            <span />
          </div>
        ) : null}
        {visiblePrices.sort((a, b) => b.year - a.year).map((point) => (
          <article key={point.id}>
            <strong>{point.year}</strong>
            <span>{targetName(targets, point)} · {point.source}</span>
            <b>{formatPricePoint(point)}</b>
            <button className="cw-icon-btn data-remove" type="button" aria-label="Remove price point" title="Remove price point" onClick={() => onDeletePricePoint(point.id)}><Trash2 size={14} /></button>
          </article>
        ))}
        {!visiblePrices.length ? <p className="data-empty">No yearly price points have been added for this neighborhood or its estates.</p> : null}
      </div>
    </section>
  );
}

function EstateAdminRow({ estate, onDelete, onUpdate }) {
  const [draft, setDraft] = useState(estate);
  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="data-item">
      <header>
        <span className="data-item-icon"><Building2 size={18} /></span>
        <div className="data-item-title">
          <strong>{estate.name}</strong>
          <small>{estate.primaryUse || "Use not set"} · {estate.status || "Status not set"}</small>
          <div className="data-item-chips">
            <span className="cw-chip">Estate</span>
            <span className="cw-chip">{estate.neighborhoodId}</span>
          </div>
        </div>
        <div className="data-item-actions">
          <button className="cw-icon-btn data-remove" type="button" aria-label="Remove estate" title="Remove estate" onClick={() => onDelete(estate.id)}><Trash2 size={14} /></button>
        </div>
      </header>
      <div className="data-item-grid">
        <Field label="Name" value={draft.name} onChange={(value) => update("name", value)} />
        <Field label="Primary use" value={draft.primaryUse} onChange={(value) => update("primaryUse", value)} />
        <Field label="Status" value={draft.status} onChange={(value) => update("status", value)} />
        <Field label="Developer" value={draft.developer} onChange={(value) => update("developer", value)} />
        <Field label="Available plots" value={draft.availablePlots} onChange={(value) => update("availablePlots", value)} />
        <Field label="Total land sqm" type="number" value={draft.totalLandSqm} onChange={(value) => update("totalLandSqm", value)} />
        <Textarea label="Description" value={draft.description} onChange={(value) => update("description", value)} />
      </div>
      <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => onUpdate(draft)}><Save size={15} /> Save estate</button>
    </article>
  );
}

function DataCrumbs() {
  return (
    <nav className="cw-crumbs" aria-label="Breadcrumb">
      <Link href="/dashboard">Dashboard</Link>
      <span aria-hidden="true">/</span>
      <span>Data</span>
    </nav>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="data-field">
      <span>{label}</span>
      <input className="cw-input" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Textarea({ label, value, onChange }) {
  return (
    <label className="data-field">
      <span>{label}</span>
      <textarea className="cw-textarea" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FileField({ label, file, onChange }) {
  return (
    <label className="data-field data-file-field">
      <span>{label}</span>
      <div className="data-dropzone">
        <input
          key={file ? "selected" : "empty"}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
        />
        <UploadCloud size={22} />
        <strong>Drop a document here, or click to browse</strong>
        <small>PDF, Word, Excel, CSV, text or image</small>
        {file ? <em>{file.name}</em> : null}
      </div>
    </label>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <label className="data-field">
      <span>{label}</span>
      <select className="cw-select" value={value || options[0]} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function defaultResourceDraft(targetId, targetType = "neighborhood") {
  return {
    targetType,
    targetId,
    resourceType: "Research",
    title: "",
    summary: "",
    url: "",
    file: null,
    source: "Internal",
    visibility: "Client"
  };
}

function defaultEstateDraft(neighborhoodId) {
  return {
    neighborhoodId,
    name: "",
    primaryUse: "",
    status: "",
    developer: "",
    availablePlots: "",
    totalLandSqm: "",
    description: ""
  };
}

function defaultPriceDraft(targetId, targetType = "neighborhood") {
  return {
    targetType,
    targetId,
    year: new Date().getFullYear(),
    value: "",
    currency: "NGN",
    source: "Manual"
  };
}

function uniqueTargets(targets) {
  const seen = new Set();
  return targets.filter((target) => {
    const key = `${target.type}:${target.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function targetName(targets, point) {
  return targets.find((target) => target.type === point.targetType && target.id === point.targetId)?.name || point.targetId;
}

function formatPricePoint(point) {
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(point.value) || 0);
  return point.currency === "USD" ? `$${value}/sqm` : `₦${value}/sqm`;
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
