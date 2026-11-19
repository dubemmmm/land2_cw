"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ExternalLink, Paperclip, Plus, Save, Trash2, UploadCloud } from "lucide-react";
import ConfidenceLegend from "@/components/ConfidenceLegend";
import { confidenceLevel, confidencePattern, confidenceScore, formatDate } from "@/lib/metrics";

const sourceTypes = ["Official", "Estate", "Internal", "Historical", "Manual"];
const outcomes = ["Approved", "Pending", "Denied", "Draft", "No data"];
const resourceTypes = ["Research", "Attachment", "Planning memo", "Market report", "Comparable"];
const visibilityTypes = ["Client", "Internal"];
const sections = [
  { key: "record", label: "Location record" },
  { key: "resources", label: "Research & files" },
  { key: "market", label: "Estates & prices" },
  { key: "listings", label: "Listings" }
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
  // Display only: is the open location different from what is stored, and is the last message a failure.
  const dirty = useMemo(() => Boolean(draft && selected) && JSON.stringify(draft) !== JSON.stringify(selected), [draft, selected]);
  const statusIsError = /^Could not/.test(status);

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
            <h1 className="cw-pagehead-title">Location data</h1>
            <p className="cw-lede">There are no locations yet. Create the first one to start entering planning rules, approvals and prices.</p>
          </div>
          <button className="cw-btn cw-btn-navy" type="button" onClick={createRecord}><Plus size={16} /> Create first location</button>
        </header>
        {status ? <p className={`data-state ${statusIsError ? "is-error" : "is-saved"}`} role="status">{status}</p> : null}
      </section>
    );
  }

  return (
    <section className="data-page">
      <header className="cw-pagehead">
        <div>
          <DataCrumbs />
          <h1 className="cw-pagehead-title">Location data</h1>
          <p className="cw-lede">Edit what Squaremeter holds on each location: planning rules, approval history, notes, research files, estates, yearly prices and the plots listed there.</p>
        </div>
        <div className="data-head-actions">
          <span className="data-admin">Signed in as {adminEmail}</span>
          <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={logout}>Log out</button>
          <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={createRecord}><Plus size={16} /> New location</button>
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
          <SaveState dirty={dirty} status={status} isError={statusIsError} name={draft.name} />
          <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit" form="data-editor"><Save size={16} /> Save location</button>
        </div>
      </div>

      <div className="data-grid">
        <aside className="data-sidebar" aria-label="Locations">
          <div className="data-sidebar-head">
            <strong>{records.length} locations</strong>
            <span>Confidence</span>
          </div>
          <div className="data-sidebar-list">
            {records.map((record) => {
              const recordScore = confidenceScore(record);
              return (
                <button
                  className={record.id === selected?.id ? "active" : ""}
                  type="button"
                  key={record.id}
                  aria-current={record.id === selected?.id ? "true" : undefined}
                  onClick={() => selectRecord(record.id)}
                >
                  <span className="data-sidebar-name">
                    <b>{record.name}</b>
                    <small>{record.jurisdiction}</small>
                  </span>
                  <Confidence score={recordScore} />
                </button>
              );
            })}
          </div>
          <div className="data-sidebar-key">
            <ConfidenceLegend />
          </div>
        </aside>

        <div className="data-editor">
          <form id="data-editor" className="data-panel" onSubmit={saveRecord} hidden={section !== "record"}>
            <section className="data-card">
              <div className="data-card-head">
                <div>
                  <h2>{draft.name}</h2>
                  <p>Last reviewed {formatDate(draft.metadata?.lastReviewed)} by {draft.metadata?.reviewedBy || "Admin"}</p>
                </div>
                <Confidence score={score} showLevel />
              </div>

              <div className="data-fields">
                <Field label="Neighborhood" value={draft.name} onChange={(value) => update("name", value)} />
                <Field label="Jurisdiction" value={draft.jurisdiction} onChange={(value) => update("jurisdiction", value)} />
                <Field label="Confidence score (0 to 100)" type="number" value={draft.recommendation?.confidence || 0} onChange={(value) => update("recommendation.confidence", Number(value))} />
                <Field label="Risk level" value={draft.recommendation?.riskLevel || ""} onChange={(value) => update("recommendation.riskLevel", value)} />
                <Textarea wide label="Summary" value={draft.recommendation?.summary || ""} onChange={(value) => update("recommendation.summary", value)} />
                <Textarea wide label="Best next action" value={draft.recommendation?.bestNextAction || ""} onChange={(value) => update("recommendation.bestNextAction", value)} />
                <Textarea wide label="Why this confidence score" value={draft.recommendation?.confidenceReason || ""} onChange={(value) => update("recommendation.confidenceReason", value)} />
              </div>
            </section>

            <ArrayEditor
              title="What you can build"
              columns={[{ label: "Label", size: "md" }, { label: "Value" }, { label: "Source", size: "sm" }]}
              items={draft.intelligence?.buildParameters || []}
              render={(item, index) => (
                <>
                  <td><Field bare label="Label" value={item.label} onChange={(value) => updateArray("intelligence.buildParameters", index, "label", value)} /></td>
                  <td><Field bare label="Value" value={item.value} onChange={(value) => updateArray("intelligence.buildParameters", index, "value", value)} /></td>
                  <td><Select bare label="Source" value={item.sourceType} options={sourceTypes} onChange={(value) => updateArray("intelligence.buildParameters", index, "sourceType", value)} /></td>
                </>
              )}
              onAdd={() => addArray("intelligence.buildParameters", { label: "New parameter", value: "", sourceType: "Manual" })}
              onRemove={(index) => removeArray("intelligence.buildParameters", index)}
            />

            <ArrayEditor
              title="Regulations"
              columns={[{ label: "Rule" }, { label: "Source", size: "sm" }]}
              items={draft.intelligence?.constraints || []}
              render={(item, index) => (
                <>
                  <td><Field bare label="Rule" value={item.label} onChange={(value) => updateArray("intelligence.constraints", index, "label", value)} /></td>
                  <td><Select bare label="Source" value={item.sourceType} options={sourceTypes} onChange={(value) => updateArray("intelligence.constraints", index, "sourceType", value)} /></td>
                </>
              )}
              onAdd={() => addArray("intelligence.constraints", { label: "", sourceType: "Manual" })}
              onRemove={(index) => removeArray("intelligence.constraints", index)}
            />

            <ArrayEditor
              title="Approval history"
              columns={[{ label: "Date", size: "sm" }, { label: "Request" }, { label: "Outcome", size: "sm" }, { label: "Source", size: "sm" }]}
              items={draft.approvals || []}
              render={(item, index) => (
                <>
                  <td><Field bare label="Date" type="date" value={item.date} onChange={(value) => updateArray("approvals", index, "date", value)} /></td>
                  <td><Field bare label="Request" value={item.request || item.projectType || ""} onChange={(value) => updateArray("approvals", index, "request", value)} /></td>
                  <td><Select bare label="Outcome" value={item.outcome} options={outcomes} onChange={(value) => updateArray("approvals", index, "outcome", value)} /></td>
                  <td><Select bare label="Source" value={item.sourceType} options={sourceTypes} onChange={(value) => updateArray("approvals", index, "sourceType", value)} /></td>
                </>
              )}
              onAdd={() => addArray("approvals", { date: new Date().toISOString().slice(0, 10), request: "", outcome: "Pending", sourceType: "Historical" })}
              onRemove={(index) => removeArray("approvals", index)}
            />

            <ArrayEditor
              title="Team notes"
              columns={[{ label: "Date", size: "sm" }, { label: "Author", size: "sm" }, { label: "Category", size: "sm" }, { label: "Note" }]}
              items={draft.notes || []}
              render={(item, index) => (
                <>
                  <td><Field bare label="Date" type="date" value={item.date} onChange={(value) => updateArray("notes", index, "date", value)} /></td>
                  <td><Field bare label="Author" value={item.author} onChange={(value) => updateArray("notes", index, "author", value)} /></td>
                  <td><Field bare label="Category" value={item.category} onChange={(value) => updateArray("notes", index, "category", value)} /></td>
                  <td><Textarea bare label="Note" value={item.text} onChange={(value) => updateArray("notes", index, "text", value)} /></td>
                </>
              )}
              onAdd={() => addArray("notes", { author: "Admin", category: "Note", text: "", date: new Date().toISOString().slice(0, 10) })}
              onRemove={(index) => removeArray("notes", index)}
            />

            <div className="data-editor-actions">
              <button className="cw-btn cw-btn-danger cw-btn-sm" type="button" onClick={deleteRecord}><Trash2 size={16} /> Delete location</button>
              <SaveState dirty={dirty} status={status} isError={statusIsError} name={draft.name} />
              <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Save size={16} /> Save location</button>
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

          <div className="data-panel" hidden={section !== "listings"}>
            <section className="data-card">
              <div className="data-section-head">
                <div>
                  <h2>Listings have their own desk</h2>
                  <p>
                    Every plot is edited in one place now: prices, sizes, photos, your own fields, and whether buyers can see each one.
                  </p>
                </div>
                <Link className="cw-btn cw-btn-navy cw-btn-sm" href="/data/listings">Open the listings desk</Link>
              </div>
            </section>
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

          <section className="data-card">
            <div className="data-section-head">
              <h2>Recent changes</h2>
            </div>
            {events.length ? (
              <div className="data-tablewrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Change</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event.id}>
                        <td className="data-num">{new Date(event.createdAt).toLocaleString()}</td>
                        <td>{event.action}</td>
                        <td>{event.neighborhoodId || "System"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="data-empty">No changes recorded yet.</p>
            )}
          </section>
        </div>
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

// Unsaved edits to the open location win over the last message, so a stale "Saved" never hides them.
function SaveState({ dirty, status, isError, name }) {
  if (isError) return <span className="data-state is-error" role="alert">{status}</span>;
  if (dirty) return <span className="data-state is-dirty" role="status">Unsaved changes to {name}</span>;
  if (status) return <span className="data-state is-saved" role="status"><Check size={14} aria-hidden="true" /> {status}</span>;
  return <span className="data-state">No unsaved changes</span>;
}

function Confidence({ score, showLevel = false }) {
  const level = confidenceLevel(score);
  return (
    <span className={`data-conf${showLevel ? " data-conf-lg" : ""}`} title={`${level} confidence`}>
      <i className={`sq-pat sq-pat-${confidencePattern(score)}`} aria-hidden="true" />
      {showLevel ? <span>{level}</span> : <span className="data-sr">{level} confidence</span>}
      <b>{score}</b>
    </span>
  );
}

function ArrayEditor({ title, columns, items, render, onAdd, onRemove }) {
  return (
    <section className="data-card">
      <div className="data-section-head">
        <h2>{title} <span className="data-count">{items.length}</span></h2>
        <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={onAdd}><Plus size={15} /> Add row</button>
      </div>
      {items.length ? (
        <div className="data-tablewrap">
          <table className="data-table data-table-edit">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th className={column.size ? `data-col-${column.size}` : undefined} key={column.label}>{column.label}</th>
                ))}
                <th className="data-col-act"><span className="data-sr">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  {render(item, index)}
                  <td className="data-col-act">
                    <button className="cw-icon-btn data-remove" type="button" aria-label="Remove row" title="Remove row" onClick={() => onRemove(index)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="data-empty">Nothing added yet.</p>
      )}
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
          <h2>Research and files</h2>
          <p>Source links, research notes, planning memos and documents. Anything marked Client is visible to clients.</p>
        </div>
      </div>

      <form className="data-form" onSubmit={onCreate}>
        <h3>Add a resource</h3>
        <div className="data-form-grid">
          <label className="cw-field data-field">
            <span>Attach to</span>
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
          <Field label="Link to document" value={draft.url} onChange={(value) => updateDraft("url", value)} />
          <FileField
            label="Upload a document"
            file={draft.file}
            onChange={(file) => onDraftChange((current) => ({
              ...current,
              file,
              resourceType: file ? "Attachment" : current.resourceType,
              title: current.title || file?.name || ""
            }))}
          />
          <Textarea wide label="Summary" value={draft.summary} onChange={(value) => updateDraft("summary", value)} />
        </div>
        <div className="data-form-actions">
          <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Paperclip size={16} /> Add resource</button>
        </div>
      </form>

      <h3 className="data-subhead">
        Saved resources
        <span className="data-count">
          {visibleResources.length < resources.length ? `${visibleResources.length} of ${resources.length} shown` : resources.length}
        </span>
      </h3>
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
          <p className="data-empty">No research or files have been added yet.</p>
        ) : null}
      </div>
    </section>
  );
}

const resourceFields = ["title", "resourceType", "visibility", "source", "url", "summary"];

function ResourceRow({ resource, target, onDelete, onUpdate }) {
  const [draft, setDraft] = useState(resource);
  const dirty = differs(draft, resource, resourceFields);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="data-item">
      <header>
        <div className="data-item-title">
          <strong>{resource.title || target?.name || resource.targetId}</strong>
          <small>
            {resource.resourceType} · {resource.visibility} · {target?.name || resource.targetId} · {resource.author} · {new Date(resource.createdAt).toLocaleDateString()}
            {resource.fileName ? ` · ${resource.fileName}` : ""}
          </small>
        </div>
        <div className="data-item-actions">
          {resource.url ? (
            <a className="cw-icon-btn" href={resource.url} target="_blank" rel="noreferrer" aria-label="Open link" title="Open link"><ExternalLink size={15} /></a>
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
        <Field label="Link" value={draft.url} onChange={(value) => update("url", value)} />
        <Textarea wide label="Summary" value={draft.summary} onChange={(value) => update("summary", value)} />
      </div>
      <footer className="data-item-foot">
        <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => onUpdate(draft)}><Save size={15} /> Save resource</button>
        <RowState dirty={dirty} />
      </footer>
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
  const selectedName = neighborhoods.find((record) => record.id === selectedId)?.name || "this location";

  return (
    <>
      <section className="data-card">
        <div className="data-section-head">
          <div>
            <h2>Estates in {selectedName} <span className="data-count">{visibleEstates.length}</span></h2>
            <p>Estates added here can be chosen on listings and reports, and can carry their own yearly prices.</p>
          </div>
        </div>

        <form className="data-form" onSubmit={onCreateEstate}>
          <h3>Add an estate</h3>
          <div className="data-form-grid">
            <label className="cw-field data-field">
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
            <Field label="Total land (m²)" type="number" value={estateDraft.totalLandSqm} onChange={(value) => onEstateDraftChange((current) => ({ ...current, totalLandSqm: value }))} />
            <Textarea wide label="Description" value={estateDraft.description} onChange={(value) => onEstateDraftChange((current) => ({ ...current, description: value }))} />
          </div>
          <div className="data-form-actions">
            <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Plus size={16} /> Add estate</button>
          </div>
        </form>

        <div className="data-list">
          {visibleEstates.map((estate) => (
            <EstateAdminRow key={estate.id} estate={estate} onDelete={onDeleteEstate} onUpdate={onUpdateEstate} />
          ))}
          {!visibleEstates.length ? <p className="data-empty">No editable estates have been added for {selectedName} yet.</p> : null}
        </div>
      </section>

      <section className="data-card">
        <div className="data-section-head">
          <div>
            <h2>Yearly prices <span className="data-count">{visiblePrices.length}</span></h2>
            <p>One price per m² per year, for {selectedName} or one of its estates. The price history and projection are drawn from these.</p>
          </div>
        </div>

        <form className="data-form" onSubmit={onCreatePricePoint}>
          <h3>Add a price</h3>
          <div className="data-form-grid">
            <label className="cw-field data-field">
              <span>Price is for</span>
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
            <Field label="Price per m²" type="number" value={priceDraft.value} onChange={(value) => onPriceDraftChange((current) => ({ ...current, value }))} />
            <Select label="Currency" value={priceDraft.currency} options={["NGN", "USD"]} onChange={(value) => onPriceDraftChange((current) => ({ ...current, currency: value }))} />
            <Field label="Source" value={priceDraft.source} onChange={(value) => onPriceDraftChange((current) => ({ ...current, source: value }))} />
          </div>
          <div className="data-form-actions">
            <button className="cw-btn cw-btn-navy cw-btn-sm" type="submit"><Plus size={16} /> Save price</button>
          </div>
        </form>

        {visiblePrices.length ? (
          <div className="data-tablewrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="data-col-xs">Year</th>
                  <th>For</th>
                  <th>Source</th>
                  <th className="data-num">Price per m²</th>
                  <th className="data-col-act"><span className="data-sr">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {visiblePrices.sort((a, b) => b.year - a.year).map((point) => (
                  <tr key={point.id}>
                    <td className="data-year">{point.year}</td>
                    <td>{targetName(targets, point)}</td>
                    <td className="data-quiet">{point.source}</td>
                    <td className="data-num">{formatPricePoint(point)}</td>
                    <td className="data-col-act">
                      <button className="cw-icon-btn data-remove" type="button" aria-label="Remove price" title="Remove price" onClick={() => onDeletePricePoint(point.id)}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="data-empty">No yearly prices have been added for {selectedName} or its estates.</p>
        )}
      </section>
    </>
  );
}

const estateFields = ["name", "primaryUse", "status", "developer", "availablePlots", "totalLandSqm", "description"];

function EstateAdminRow({ estate, onDelete, onUpdate }) {
  const [draft, setDraft] = useState(estate);
  const dirty = differs(draft, estate, estateFields);

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="data-item">
      <header>
        <div className="data-item-title">
          <strong>{estate.name}</strong>
          <small>{estate.primaryUse || "Use not set"} · {estate.status || "Status not set"} · {estate.neighborhoodId}</small>
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
        <Field label="Total land (m²)" type="number" value={draft.totalLandSqm} onChange={(value) => update("totalLandSqm", value)} />
        <Textarea wide label="Description" value={draft.description} onChange={(value) => update("description", value)} />
      </div>
      <footer className="data-item-foot">
        <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => onUpdate(draft)}><Save size={15} /> Save estate</button>
        <RowState dirty={dirty} />
      </footer>
    </article>
  );
}

function RowState({ dirty }) {
  return dirty
    ? <span className="data-state is-dirty" role="status">Unsaved changes</span>
    : <span className="data-state">No unsaved changes</span>;
}

// Display only: compares the editable fields of a row with what is stored.
function differs(draft, stored, fields) {
  return fields.some((field) => String(draft?.[field] ?? "").trim() !== String(stored?.[field] ?? "").trim());
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

function Field({ label, value, onChange, type = "text", bare = false, wide = false }) {
  const input = <input className="cw-input" type={type} value={value ?? ""} aria-label={bare ? label : undefined} onChange={(event) => onChange(event.target.value)} />;
  if (bare) return input;
  return (
    <label className={`cw-field data-field${wide ? " data-field-wide" : ""}`}>
      <span>{label}</span>
      {input}
    </label>
  );
}

function Textarea({ label, value, onChange, bare = false, wide = false }) {
  const input = <textarea className="cw-textarea" value={value ?? ""} aria-label={bare ? label : undefined} onChange={(event) => onChange(event.target.value)} />;
  if (bare) return input;
  return (
    <label className={`cw-field data-field${wide ? " data-field-wide" : ""}`}>
      <span>{label}</span>
      {input}
    </label>
  );
}

function FileField({ label, file, onChange }) {
  return (
    <label className="cw-field data-field data-field-wide">
      <span>{label}</span>
      <div className="data-dropzone">
        <input
          key={file ? "selected" : "empty"}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
        />
        <UploadCloud size={20} aria-hidden="true" />
        <strong>{file ? file.name : "Drop a document here, or click to browse"}</strong>
        <small>{file ? "Selected. It uploads when you add the resource." : "PDF, Word, Excel, CSV, text or image"}</small>
      </div>
    </label>
  );
}

function Select({ label, value, options, onChange, bare = false }) {
  const input = (
    <select className="cw-select" value={value || options[0]} aria-label={bare ? label : undefined} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={option}>{option}</option>)}
    </select>
  );
  if (bare) return input;
  return (
    <label className="cw-field data-field">
      <span>{label}</span>
      {input}
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
  return point.currency === "USD" ? `$${value}` : `₦${value}`;
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
