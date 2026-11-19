"use client";

import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useState } from "react";
import { CUSTOM_TYPES } from "@/lib/listingFields";

const typeName = Object.fromEntries(CUSTOM_TYPES.map(([type, label]) => [type, label]));

// Fields staff add to listings themselves: name them, choose what kind of
// answer they take and whether buyers see them. A removed field is only put
// away, with its answers kept, so it can be brought back.
export default function FieldsManager({ fields, onChange }) {
  const [draft, setDraft] = useState({ label: "", type: "text", options: "", showToBuyers: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const live = fields.filter((field) => !field.archived);
  const away = fields.filter((field) => field.archived);

  async function request(url, method, body) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Could not save");
    return data;
  }

  async function add(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const field = await request("/api/listing-fields", "POST", draft);
      onChange(fields.concat(field));
      setDraft({ label: "", type: "text", options: "", showToBuyers: false });
    } catch (problem) {
      setError(problem.message);
    }
    setSaving(false);
  }

  async function change(field, patch) {
    setError("");
    try {
      const updated = await request(`/api/listing-fields/${field.id}`, "PATCH", patch);
      onChange(fields.map((item) => (item.id === updated.id ? updated : item)));
    } catch (problem) {
      setError(`${field.label}: ${problem.message}`);
    }
  }

  // Swaps two fields' places in the order.
  async function move(index, by) {
    const other = live[index + by];
    const field = live[index];
    if (!other) return;
    setError("");
    try {
      const first = await request(`/api/listing-fields/${field.id}`, "PATCH", { sortOrder: index + by });
      const second = await request(`/api/listing-fields/${other.id}`, "PATCH", { sortOrder: index });
      const updated = new Map([[first.id, first], [second.id, second]]);
      onChange(fields.map((item) => updated.get(item.id) || item).sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (problem) {
      setError(problem.message);
    }
  }

  return (
    <div className="desk-fields">
      <section className="desk-fields-list">
        <h2>Fields you have added</h2>
        <p className="desk-section-help">
          Each one appears on every listing under "More details" and can be shown as a column in the table.
        </p>
        {live.length ? (
          <ul>
            {live.map((field, index) => (
              <li key={field.id}>
                <div className="desk-fields-order">
                  <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${field.label} up`}><ArrowUp size={15} /></button>
                  <button type="button" disabled={index === live.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${field.label} down`}><ArrowDown size={15} /></button>
                </div>
                <div className="desk-fields-main">
                  <label>Name
                    <input className="cw-input" defaultValue={field.label} maxLength={60} onBlur={(event) => { if (event.target.value.trim() !== field.label) change(field, { label: event.target.value }); }} />
                  </label>
                  <span className="desk-fields-type">{typeName[field.type]}</span>
                  {field.type === "choice" ? (
                    <label className="is-wide">Choices, one on each line
                      <textarea className="cw-input" rows={Math.min(6, field.options.length + 1)} defaultValue={field.options.join("\n")} onBlur={(event) => { if (event.target.value.trim() !== field.options.join("\n")) change(field, { options: event.target.value }); }} />
                    </label>
                  ) : null}
                  <label className="desk-check">
                    <input type="checkbox" checked={field.showToBuyers} onChange={(event) => change(field, { showToBuyers: event.target.checked })} />
                    Show to buyers on the listing page
                  </label>
                </div>
                <button type="button" className="desk-pop-link" onClick={() => change(field, { archived: true })}>Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="desk-empty">You have not added any fields yet. Add the first one on the right.</p>}

        {away.length ? (
          <>
            <h3>Removed fields</h3>
            <p className="desk-section-help">Their answers are kept. Bring one back and they reappear.</p>
            <ul className="desk-fields-away">
              {away.map((field) => (
                <li key={field.id}>
                  <span>{field.label} <small>{typeName[field.type]}</small></span>
                  <button type="button" className="desk-pop-link" onClick={() => change(field, { archived: false })}>Bring back</button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <form className="desk-fields-add" onSubmit={add}>
        <h2>Add a field</h2>
        <label>What is it called?
          <input className="cw-input" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="e.g. Fenced" maxLength={60} required />
        </label>
        <fieldset>
          <legend>What kind of answer does it take?</legend>
          {CUSTOM_TYPES.map(([type, label, hint]) => (
            <label className="desk-radio" key={type}>
              <input type="radio" name="field-type" checked={draft.type === type} onChange={() => setDraft({ ...draft, type })} />
              <span><b>{label}</b>{hint}</span>
            </label>
          ))}
        </fieldset>
        {draft.type === "choice" ? (
          <label>Choices, one on each line
            <textarea className="cw-input" rows={4} value={draft.options} onChange={(event) => setDraft({ ...draft, options: event.target.value })} placeholder={"Tarred\nUntarred"} />
          </label>
        ) : null}
        <label className="desk-check">
          <input type="checkbox" checked={draft.showToBuyers} onChange={(event) => setDraft({ ...draft, showToBuyers: event.target.checked })} />
          Show to buyers on the listing page
        </label>
        {error ? <p className="desk-pop-error" role="alert">{error}</p> : null}
        <button type="submit" className="cw-btn cw-btn-navy" disabled={saving || !draft.label.trim()}><Plus size={16} aria-hidden="true" /> {saving ? "Adding…" : "Add field"}</button>
        <p className="desk-section-help">The kind of answer cannot be changed afterwards, so that existing answers stay valid.</p>
      </form>
    </div>
  );
}
