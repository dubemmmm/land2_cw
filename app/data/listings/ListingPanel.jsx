"use client";

import { ArrowLeft, ArrowRight, ExternalLink, ImagePlus, RotateCcw, Star, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MAX_PHOTOS, SIZE_UNITS, fieldValue, formatValue, listingGaps, optionLabel, patchFor } from "@/lib/listingFields";
import { uploadPhoto } from "@/lib/photoUpload";
import { formatNaira, formatSqm, headlinePrice } from "@/lib/plot";
import { FieldControl, Switch } from "./controls";

const GROUPS = ["Basics", "Price", "Size and title", "Photos", "Agent", "Description", "More details", "Visibility"];
const HELP = {
  Price: "Type the figure exactly as the seller quoted it, then say what it is for.",
  Photos: "The first photo is the one buyers see in the list.",
  "More details": "Fields you have added yourself. Add more under \"Your own fields\".",
  Agent: "Shown to signed-in buyers on the listing page."
};

// The whole of one listing, beside the table. Each detail saves on its own as
// soon as it is changed, and every save can be undone.
export default function ListingPanel({ summary, catalogue, photosReady, onClose, onSaved, onNotice, onBin, onRestore, onPurge }) {
  const [listing, setListing] = useState(summary);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);
  const panelRef = useRef(null);
  const locked = Boolean(listing.deletedAt);

  // The table holds a shortened description; the panel fetches the listing in full.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/listings/${summary.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((full) => {
        if (!cancelled && full) setListing(full);
        if (!cancelled) setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [summary.id]);

  // Changes made in the table (a switch, a bin action) show here too.
  useEffect(() => {
    setListing((current) => ({ ...current, ...summary, description: loaded ? current.description : summary.description }));
  }, [summary]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) && !document.querySelector(".desk-modal")) onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save(patch, message, undoPatch) {
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save");
      setListing(body);
      onSaved({ ...body, description: body.description.slice(0, 280) });
      setHistory(null);
      onNotice({ text: message, undo: undoPatch ? () => save(undoPatch, "Put back") : null });
      return true;
    } catch (error) {
      onNotice({ text: `Not saved: ${error.message}`, error: true });
      return false;
    } finally {
      setSaving(false);
    }
  }

  function saveField(field, value) {
    const before = fieldValue(listing, field);
    if (String(before ?? "") === String(value ?? "")) return;
    save(patchFor(field, value), `Saved ${field.label.toLowerCase()}`, patchFor(field, before));
  }

  const byGroup = useMemo(() => {
    const groups = new Map(GROUPS.map((group) => [group, []]));
    for (const field of catalogue) {
      if (field.readOnly || !groups.has(field.group)) continue;
      if (["sizeSqm", "published", "photos"].includes(field.key)) continue;
      groups.get(field.group).push(field);
    }
    return groups;
  }, [catalogue]);

  const price = headlinePrice(listing);
  const gaps = listingGaps(listing);

  return (
    <aside className="desk-panel" role="dialog" aria-label={`Edit ${listing.title}`} tabIndex={-1} ref={panelRef}>
      <header className="desk-panel-head">
        <div>
          <p>{[listing.sourceId, listing.neighborhoodName].filter(Boolean).join(" · ")}</p>
          <h2>{listing.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close the listing"><X size={20} /></button>
      </header>

      <div className="desk-panel-status">
        {locked ? (
          <>
            <span className="desk-pill is-bin">In the bin</span>
            <button type="button" className="cw-btn cw-btn-soft cw-btn-sm" onClick={onRestore}><RotateCcw size={14} aria-hidden="true" /> Restore</button>
            <button type="button" className="cw-btn cw-btn-danger cw-btn-sm" onClick={onPurge}>Delete for good</button>
          </>
        ) : (
          <>
            <Switch checked={listing.published} disabled={saving} label="Buyers can see this listing" onChange={(value) => save({ workflowStatus: value ? "Published" : "Draft" }, value ? "Now public: buyers can see it" : "Now hidden from buyers", { workflowStatus: listing.published ? "Published" : "Draft" })}>
              {listing.published ? "Public: buyers can see it" : "Hidden from buyers"}
            </Switch>
            <a className="desk-panel-link" href={`/listings/${listing.id}`} target="_blank" rel="noreferrer">See it as a buyer <ExternalLink size={14} aria-hidden="true" /></a>
          </>
        )}
      </div>

      {gaps.length && !locked ? <p className="desk-panel-gaps">Still missing: {gaps.join(", ")}.</p> : null}

      <fieldset className="desk-panel-body" disabled={locked}>
        {GROUPS.map((group) => {
          const fields = byGroup.get(group) || [];
          if (group === "More details" && !fields.length) return null;
          return (
            <section className="desk-section" key={group}>
              <h3>{group}</h3>
              {HELP[group] ? <p className="desk-section-help">{HELP[group]}</p> : null}

              {group === "Photos" ? (
                <PhotoManager
                  photos={listing.photos}
                  ready={photosReady}
                  disabled={locked}
                  onChange={(photos, message) => save({ photos }, message, { photos: listing.photos })}
                  onProblem={(text) => onNotice({ text, error: true })}
                />
              ) : null}

              {group === "Size and title" ? <SizeField listing={listing} onSave={(patch) => save(patch, "Saved size", { sizeValue: listing.sizeValue, sizeUnit: listing.sizeUnit })} /> : null}

              {fields.map((field) => (
                <PanelField key={field.key} field={field} value={fieldValue(listing, field)} wide={field.type === "longtext" || field.key === "title" || field.key === "address"} onSave={(value) => saveField(field, value)} />
              ))}

              {group === "Price" ? (
                <p className={`desk-buyers-see ${listing.priceBasis === "unknown" ? "is-warn" : ""}`}>
                  {listing.priceBasis === "unknown"
                    ? "Buyers see the figure with no price per m² until you say what the price is for."
                    : price.value
                      ? <>Buyers will see <b>{price.value}</b>{listing.askingPrice && listing.pricePerSqm ? <>, which is <b>{formatNaira(listing.pricePerSqm)} per m²</b></> : null}{listing.converted ? " (converted from dollars at today's rate)" : ""}.</>
                      : "Buyers will see \"Price on request\"."}
                </p>
              ) : null}

              {group === "Visibility" ? (
                <p className="desk-section-help">
                  "Status" says whether the plot can still be bought. Whether buyers can see the listing at all is the switch at the top.
                </p>
              ) : null}
            </section>
          );
        })}
      </fieldset>

      <section className="desk-section desk-history">
        <h3>History</h3>
        {history === null ? (
          <button type="button" className="cw-btn cw-btn-soft cw-btn-sm" onClick={() => loadHistory(listing.id, setHistory)}>Show what has changed</button>
        ) : history.length ? (
          <ul>
            {history.map((change) => (
              <li key={change.id}>
                <div>
                  <b>{describeChange(change, catalogue)}</b>
                  <small>{formatWhen(change.at)}</small>
                </div>
                {!locked && !["created", "binned", "restored"].includes(change.field) ? (
                  <button type="button" disabled={saving} onClick={() => save(change.before, "Put back")}>Put back</button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p className="desk-section-help">Nothing has been changed since this listing was imported.</p>}
      </section>

      {!locked ? (
        <footer className="desk-panel-foot">
          <button type="button" className="desk-panel-bin" onClick={onBin}><Trash2 size={15} aria-hidden="true" /> Move to the bin</button>
          <span>{saving ? "Saving…" : "All changes saved"}</span>
        </footer>
      ) : null}
    </aside>
  );
}

function PanelField({ field, value, wide, onSave }) {
  const id = useId();
  return (
    <div className={`desk-field ${wide ? "is-wide" : ""}`}>
      <label htmlFor={id}>{field.label}{field.showToBuyers ? <em>shown to buyers</em> : null}</label>
      <FieldControl id={id} field={field} value={value} onCommit={onSave} />
    </div>
  );
}

// Size is a figure and a unit; the site always shows it in m².
function SizeField({ listing, onSave }) {
  const id = useId();
  const [value, setValue] = useState(listing.sizeValue ? String(listing.sizeValue) : "");
  const [unit, setUnit] = useState(listing.sizeUnit || "sqm");
  useEffect(() => {
    setValue(listing.sizeValue ? String(listing.sizeValue) : "");
    setUnit(listing.sizeUnit || "sqm");
  }, [listing.sizeValue, listing.sizeUnit]);
  const commit = (nextValue, nextUnit) => {
    const number = Number(String(nextValue).replace(/[,\s]/g, "")) || 0;
    if (number === (Number(listing.sizeValue) || 0) && nextUnit === listing.sizeUnit) return;
    onSave({ sizeValue: number, sizeUnit: nextUnit });
  };
  return (
    <div className="desk-field">
      <label htmlFor={id}>Size</label>
      <div className="desk-size">
        <input id={id} className="cw-input" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} onBlur={() => commit(value, unit)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
        <select className="cw-select" value={unit} aria-label="Unit of size" onChange={(event) => { setUnit(event.target.value); commit(value, event.target.value); }}>
          {SIZE_UNITS.map(([option, text]) => <option value={option} key={option}>{text}</option>)}
        </select>
      </div>
      {listing.sizeSqm && listing.sizeUnit !== "sqm" ? <small>Equals {formatSqm(listing.sizeSqm)} m²</small> : null}
    </div>
  );
}

/* ---------- Photos ---------- */
function PhotoManager({ photos, ready, disabled, onChange, onProblem }) {
  const [uploading, setUploading] = useState(0);
  const [over, setOver] = useState(false);
  const [dragged, setDragged] = useState(-1);
  const inputRef = useRef(null);
  const room = MAX_PHOTOS - photos.length;

  async function add(files) {
    const chosen = Array.from(files || []).filter((file) => file.type.startsWith("image/")).slice(0, room);
    if (!chosen.length) return;
    setUploading(chosen.length);
    const added = [];
    const failed = [];
    for (const file of chosen) {
      try {
        added.push(await uploadPhoto(file));
      } catch (error) {
        failed.push(`${file.name}: ${error.message}`);
      }
      setUploading((count) => Math.max(0, count - 1));
    }
    setUploading(0);
    if (added.length) await onChange(photos.concat(added), added.length === 1 ? "Photo added" : `${added.length} photos added`);
    if (failed.length) onProblem(`Could not add ${failed.join("; ")}`);
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(from, to) {
    if (to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    const [photo] = next.splice(from, 1);
    next.splice(to, 0, photo);
    onChange(next, to === 0 ? "Cover photo changed" : "Photo order changed");
  }

  return (
    <div className="desk-photos">
      {photos.length ? (
        <ul>
          {photos.map((photo, index) => (
            <li
              key={photo}
              draggable={!disabled}
              className={dragged === index ? "is-dragged" : ""}
              onDragStart={() => setDragged(index)}
              onDragEnd={() => setDragged(-1)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); event.stopPropagation(); if (dragged >= 0) move(dragged, index); setDragged(-1); }}
            >
              <img src={photo} alt={`Photo ${index + 1}`} loading="lazy" />
              {index === 0 ? <span className="desk-photo-cover">Cover</span> : null}
              <div className="desk-photo-tools">
                {index > 0 ? <button type="button" onClick={() => move(index, 0)} aria-label={`Make photo ${index + 1} the cover`} title="Make this the cover"><Star size={14} /></button> : null}
                <button type="button" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move photo ${index + 1} earlier`} title="Move earlier"><ArrowLeft size={14} /></button>
                <button type="button" disabled={index === photos.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move photo ${index + 1} later`} title="Move later"><ArrowRight size={14} /></button>
                <button type="button" onClick={() => onChange(photos.filter((_, item) => item !== index), "Photo removed")} aria-label={`Remove photo ${index + 1}`} title="Remove"><X size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {ready ? (
        room > 0 ? (
          <label
            className={`desk-drop ${over ? "is-over" : ""}`}
            onDragOver={(event) => { event.preventDefault(); if (dragged < 0) setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(event) => { event.preventDefault(); setOver(false); if (dragged < 0) add(event.dataTransfer.files); }}
          >
            <ImagePlus size={20} aria-hidden="true" />
            <b>{uploading ? `Adding ${uploading} ${uploading === 1 ? "photo" : "photos"}…` : "Add photos"}</b>
            <span>Drop them here or click to choose. JPG or PNG, up to {room} more.</span>
            <input ref={inputRef} type="file" accept="image/*" multiple disabled={disabled || uploading > 0} onChange={(event) => add(event.target.files)} />
          </label>
        ) : <p className="desk-section-help">This listing has the most photos it can hold ({MAX_PHOTOS}). Remove one to add another.</p>
      ) : (
        <p className="desk-drop is-off">Photo storage is not set up on this server, so photos cannot be added here yet.</p>
      )}
    </div>
  );
}

/* ---------- History ---------- */
async function loadHistory(id, setHistory) {
  const res = await fetch(`/api/listings/${id}/history`).catch(() => null);
  setHistory(res?.ok ? await res.json() : []);
}

function describeChange(change, catalogue) {
  if (change.field === "created") return "Listing added";
  if (change.field === "binned") return "Moved to the bin";
  if (change.field === "restored") return "Restored from the bin";
  if (change.field === "workflowStatus") return change.after.workflowStatus === "Published" ? "Made public" : "Hidden from buyers";
  if (change.field === "photos") return `Photos: ${(change.before.photos || []).length} → ${(change.after.photos || []).length}`;
  if (change.field === "size") {
    const words = (side) => (side.sizeValue ? `${formatSqm(side.sizeValue)} ${optionLabel({ options: SIZE_UNITS }, side.sizeUnit)}` : "none");
    return `Size: ${words(change.before)} → ${words(change.after)}`;
  }
  const custom = change.field.startsWith("custom.");
  const field = catalogue.find((item) => item.key === change.field) || { key: change.field, label: custom ? "A removed field" : change.field, type: "text" };
  const read = (side) => {
    const value = custom ? side.custom?.[change.field.slice(7)] : side[change.field];
    const text = formatValue(field, value);
    return text ? (text.length > 60 ? `${text.slice(0, 60)}…` : text) : "empty";
  };
  return `${field.label}: ${read(change.before)} → ${read(change.after)}`;
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
