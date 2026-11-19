"use client";

import { ArrowDown, ArrowUp, Check, ChevronDown, Columns3, Filter, Plus, Search, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_COLUMNS, fieldCatalogue, fieldValue, formatValue, listingGaps, patchFor } from "@/lib/listingFields";
import { formatNaira } from "@/lib/plot";
import FieldsManager from "./FieldsManager";
import ListingPanel from "./ListingPanel";
import { FieldControl, Modal, Switch } from "./controls";

const STEP = 60;
const QUICK = [
  ["all", "All"],
  ["public", "Public"],
  ["hidden", "Hidden"],
  ["attention", "Needs attention"],
  ["nophotos", "No photos"],
  ["bin", "Bin"]
];
const COLUMNS_KEY = "cw-desk-columns";

// The listings desk: every listing in one table that edits in place, with a
// side panel for the whole record. Built from the field catalogue, so a field
// staff add shows up as a column, a filter and a form control without new code.
export default function ListingsDesk({ initialListings, neighborhoods, initialFields, initialViews, photosReady, initialOpen = "", startNew = false }) {
  const [listings, setListings] = useState(initialListings);
  const [customFields, setCustomFields] = useState(initialFields);
  const [views, setViews] = useState(initialViews);
  const [tab, setTab] = useState("listings");
  const [quick, setQuick] = useState("all");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);
  const [sort, setSort] = useState({ key: "", dir: "asc" });
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [selected, setSelected] = useState(() => new Set());
  const [openId, setOpenId] = useState(initialOpen);
  const [editing, setEditing] = useState(null);
  const [shown, setShown] = useState(STEP);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(startNew ? { type: "new" } : null);
  const [menu, setMenu] = useState("");
  const sentinel = useRef(null);

  const catalogue = useMemo(() => fieldCatalogue(customFields, neighborhoods), [customFields, neighborhoods]);
  const byKey = useMemo(() => new Map(catalogue.map((field) => [field.key, field])), [catalogue]);
  const shownColumns = useMemo(() => columns.map((key) => byKey.get(key)).filter(Boolean), [byKey, columns]);
  const filterable = useMemo(() => catalogue.filter((field) => ["choice", "yesno"].includes(field.type)), [catalogue]);

  // Each viewer's own column choice is remembered in their browser.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COLUMNS_KEY) || "null");
      if (Array.isArray(saved) && saved.length) setColumns(saved);
    } catch {
      // Without storage the default columns are used.
    }
  }, []);

  function chooseColumns(next) {
    setColumns(next);
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
    } catch {
      // Not remembered; still applied for this visit.
    }
  }

  const counts = useMemo(() => {
    const live = listings.filter((listing) => !listing.deletedAt);
    return {
      all: live.length,
      public: live.filter((listing) => listing.published).length,
      hidden: live.filter((listing) => !listing.published).length,
      attention: live.filter((listing) => listingGaps(listing).length).length,
      nophotos: live.filter((listing) => !listing.photos.length).length,
      bin: listings.length - live.length
    };
  }, [listings]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = listings.filter((listing) => {
      if (quick === "bin") {
        if (!listing.deletedAt) return false;
      } else {
        if (listing.deletedAt) return false;
        if (quick === "public" && !listing.published) return false;
        if (quick === "hidden" && listing.published) return false;
        if (quick === "attention" && !listingGaps(listing).length) return false;
        if (quick === "nophotos" && listing.photos.length) return false;
      }
      for (const filter of filters) {
        const field = byKey.get(filter.key);
        if (field && String(fieldValue(listing, field) ?? "") !== String(filter.value)) return false;
      }
      if (needle && ![listing.title, listing.neighborhoodName, listing.estate, listing.address, listing.sourceId, listing.agentName, listing.agentPhone].some((value) => String(value || "").toLowerCase().includes(needle))) return false;
      return true;
    });
    const field = byKey.get(sort.key);
    if (!field) return rows;
    const direction = sort.dir === "desc" ? -1 : 1;
    const key = (listing) => {
      const value = fieldValue(listing, field);
      if (field.type === "photos") return value.length;
      if (["number", "money"].includes(field.type)) return Number(value) || 0;
      if (field.type === "public" || field.type === "yesno") return value ? 1 : 0;
      return formatValue(field, value).toLowerCase();
    };
    return [...rows].sort((a, b) => {
      const left = key(a);
      const right = key(b);
      return (left < right ? -1 : left > right ? 1 : 0) * direction;
    });
  }, [byKey, filters, listings, query, quick, sort]);

  useEffect(() => {
    setShown(STEP);
  }, [filters, query, quick, sort]);

  // More rows are drawn as the bottom of the table comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + STEP);
    }, { rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible.length, tab]);

  const open = listings.find((listing) => listing.id === openId) || null;
  const chosen = visible.filter((listing) => selected.has(listing.id));
  const allTicked = visible.length > 0 && chosen.length === visible.length;

  function merge(updated) {
    const map = new Map(updated.map((listing) => [listing.id, listing]));
    setListings((current) => current.map((listing) => map.get(listing.id) || listing));
  }

  // Saves a list of { ids, patch } and offers to put things back. `undo` is the
  // same kind of list, holding what each listing had before.
  async function apply(edits, message, undo) {
    setBusy(true);
    setNotice(null);
    try {
      for (const edit of edits) {
        const single = edit.ids.length === 1;
        const res = await fetch(single ? `/api/listings/${edit.ids[0]}` : "/api/listings/bulk", {
          method: single ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(single ? edit.patch : { ids: edit.ids, patch: edit.patch })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Could not save");
        merge(single ? [body] : body.listings);
      }
      setNotice({ text: message, undo: undo ? () => apply(undo, "Put back") : null });
      return true;
    } catch (error) {
      setNotice({ text: `Not saved: ${error.message}`, error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  // One field set to one value on some listings. Undo groups them by what they had.
  function setField(ids, field, value) {
    const targets = listings.filter((listing) => ids.includes(listing.id) && String(fieldValue(listing, field) ?? "") !== String(value ?? ""));
    if (!targets.length) return Promise.resolve(true);
    const groups = new Map();
    for (const listing of targets) {
      const before = field.key === "sizeSqm" ? JSON.stringify({ sizeValue: listing.sizeValue, sizeUnit: listing.sizeUnit }) : JSON.stringify(patchFor(field, fieldValue(listing, field)));
      groups.set(before, (groups.get(before) || []).concat(listing.id));
    }
    const undo = [...groups].map(([before, group]) => ({ ids: group, patch: JSON.parse(before) }));
    const what = targets.length === 1 ? `"${targets[0].title}"` : `${targets.length} listings`;
    const message = field.type === "public"
      ? `${what} ${targets.length === 1 ? "is" : "are"} now ${value ? "public" : "hidden from buyers"}`
      : `Saved ${field.label.toLowerCase()} for ${what}`;
    return apply([{ ids: targets.map((listing) => listing.id), patch: patchFor(field, value) }], message, undo);
  }

  async function binAction(ids, action) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/listings/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not do that");
      const many = ids.length === 1 ? "1 listing" : `${ids.length} listings`;
      if (action === "purge") {
        setListings((current) => current.filter((listing) => !body.removed.includes(listing.id)));
        setNotice({ text: `${many} deleted for good` });
        if (ids.includes(openId)) setOpenId("");
      } else {
        merge(body.listings);
        // A binned listing's panel is closed, so the table is back in view.
        if (action === "bin" && ids.includes(openId)) setOpenId("");
        setNotice({
          text: action === "bin" ? `${many} moved to the bin` : `${many} restored`,
          undo: () => binAction(ids, action === "bin" ? "restore" : "bin")
        });
      }
      setSelected(new Set());
    } catch (error) {
      setNotice({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function createListing(title, neighborhoodId) {
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, neighborhoodId, landUse: "", priceBasis: "total" })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Could not add the listing");
    setListings((current) => [body, ...current]);
    setQuick("all");
    setDialog(null);
    setOpenId(body.id);
    setNotice({ text: `"${body.title}" added. It stays hidden from buyers until you make it public.` });
  }

  async function saveViews(next) {
    const res = await fetch("/api/listing-views", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ views: next })
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error || "Could not save the view");
    setViews(body);
  }

  function useView(view) {
    const config = view.config || {};
    if (Array.isArray(config.columns) && config.columns.length) chooseColumns(config.columns);
    setQuick(QUICK.some(([id]) => id === config.quick) ? config.quick : "all");
    setFilters(Array.isArray(config.filters) ? config.filters : []);
    setSort(config.sort?.key ? config.sort : { key: "", dir: "asc" });
    setQuery(typeof config.query === "string" ? config.query : "");
    setMenu("");
  }

  function toggleSort(key) {
    setSort((current) => (current.key !== key ? { key, dir: "asc" } : current.dir === "asc" ? { key, dir: "desc" } : { key: "", dir: "asc" }));
  }

  function tick(id, on) {
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="desk">
      <header className="desk-head">
        <div>
          <h1>Listings desk</h1>
          <p>Every plot on the site. Click a cell to change it, or a title to open the whole listing. Changes are saved as you make them.</p>
        </div>
        <button type="button" className="cw-btn cw-btn-navy" onClick={() => setDialog({ type: "new" })}><Plus size={16} aria-hidden="true" /> New listing</button>
      </header>

      <div className="desk-tabs" role="tablist" aria-label="Desk sections">
        <button type="button" role="tab" aria-selected={tab === "listings"} className={tab === "listings" ? "is-on" : ""} onClick={() => setTab("listings")}>Listings</button>
        <button type="button" role="tab" aria-selected={tab === "fields"} className={tab === "fields" ? "is-on" : ""} onClick={() => setTab("fields")}>Your own fields <span>{customFields.filter((field) => !field.archived).length}</span></button>
      </div>

      {tab === "fields" ? (
        <FieldsManager fields={customFields} onChange={setCustomFields} />
      ) : (
        <>
          <div className="desk-quick" role="group" aria-label="Which listings to show">
            {QUICK.map(([id, label]) => (
              <button type="button" key={id} className={quick === id ? "is-on" : ""} aria-pressed={quick === id} onClick={() => { setQuick(id); setSelected(new Set()); }}>
                {label} <span>{counts[id]}</span>
              </button>
            ))}
          </div>

          <div className="desk-tools">
            <label className="desk-search">
              <Search size={16} aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, area, estate, agent or reference" aria-label="Search listings" />
            </label>

            <div className="desk-menu">
              <button type="button" className="desk-tool" aria-expanded={menu === "filter"} onClick={() => setMenu(menu === "filter" ? "" : "filter")}><Filter size={15} aria-hidden="true" /> Filter</button>
              {menu === "filter" ? <FilterMenu fields={filterable} onAdd={(filter) => { setFilters((current) => current.filter((item) => item.key !== filter.key).concat(filter)); setMenu(""); }} /> : null}
            </div>

            <div className="desk-menu">
              <button type="button" className="desk-tool" aria-expanded={menu === "columns"} onClick={() => setMenu(menu === "columns" ? "" : "columns")}><Columns3 size={15} aria-hidden="true" /> Columns</button>
              {menu === "columns" ? <ColumnsMenu catalogue={catalogue} columns={columns} onChange={chooseColumns} onReset={() => chooseColumns(DEFAULT_COLUMNS)} /> : null}
            </div>

            <div className="desk-menu">
              <button type="button" className="desk-tool" aria-expanded={menu === "views"} onClick={() => setMenu(menu === "views" ? "" : "views")}>Saved views <ChevronDown size={15} aria-hidden="true" /></button>
              {menu === "views" ? (
                <ViewsMenu
                  views={views}
                  onUse={useView}
                  onSave={(name) => saveViews(views.filter((view) => view.name !== name).concat({ name, config: { columns, quick, filters, sort, query } }))}
                  onRemove={(view) => saveViews(views.filter((item) => item.id !== view.id))}
                />
              ) : null}
            </div>
          </div>

          {filters.length ? (
            <div className="desk-chips">
              {filters.map((filter) => {
                const field = byKey.get(filter.key);
                if (!field) return null;
                return (
                  <button type="button" key={filter.key} onClick={() => setFilters((current) => current.filter((item) => item.key !== filter.key))} aria-label={`Remove filter ${field.label}`}>
                    {field.label}: <b>{formatValue(field, filter.value === "true" ? true : filter.value === "false" ? false : filter.value) || "Not set"}</b> <X size={13} aria-hidden="true" />
                  </button>
                );
              })}
              <button type="button" className="desk-chips-clear" onClick={() => setFilters([])}>Clear filters</button>
            </div>
          ) : null}

          {chosen.length ? (
            <BulkBar
              count={chosen.length}
              inBin={quick === "bin"}
              fields={catalogue.filter((field) => !field.readOnly && !["photos", "longtext", "public"].includes(field.type) && field.key !== "title")}
              busy={busy}
              onPublic={(value) => setField(chosen.map((listing) => listing.id), byKey.get("published"), value)}
              onSet={(field, value) => setField(chosen.map((listing) => listing.id), field, value)}
              onBin={() => binAction(chosen.map((listing) => listing.id), "bin")}
              onRestore={() => binAction(chosen.map((listing) => listing.id), "restore")}
              onPurge={() => setDialog({ type: "purge", ids: chosen.map((listing) => listing.id) })}
              onClear={() => setSelected(new Set())}
            />
          ) : null}

          <p className="desk-count" role="status">
            {visible.length} {visible.length === 1 ? "listing" : "listings"}
            {quick === "bin" ? " in the bin. They are hidden from everyone until restored." : ""}
          </p>

          <div className="desk-tablewrap">
            <table className="desk-table">
              <thead>
                <tr>
                  <th className="desk-col-tick">
                    <input type="checkbox" checked={allTicked} aria-label="Choose every listing shown" onChange={(event) => setSelected(event.target.checked ? new Set(visible.map((listing) => listing.id)) : new Set())} />
                  </th>
                  {shownColumns.map((field) => (
                    <th key={field.key} style={{ minWidth: field.width, width: field.width }} aria-sort={sort.key === field.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" onClick={() => toggleSort(field.key)}>
                        {field.label}
                        {sort.key === field.key ? (sort.dir === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, shown).map((listing) => (
                  <tr key={listing.id} className={`${selected.has(listing.id) ? "is-ticked" : ""} ${openId === listing.id ? "is-open" : ""}`}>
                    <td className="desk-col-tick">
                      <input type="checkbox" checked={selected.has(listing.id)} aria-label={`Choose ${listing.title}`} onChange={(event) => tick(listing.id, event.target.checked)} />
                    </td>
                    {shownColumns.map((field) => (
                      <Cell
                        key={field.key}
                        listing={listing}
                        field={field}
                        editing={editing?.id === listing.id && editing.key === field.key}
                        locked={Boolean(listing.deletedAt)}
                        onEdit={() => setEditing({ id: listing.id, key: field.key })}
                        onDone={() => setEditing(null)}
                        onOpen={() => setOpenId(listing.id)}
                        onSave={(value) => setField([listing.id], field, value)}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length ? <p className="desk-empty">{quick === "bin" ? "The bin is empty." : "No listings match. Try clearing the search or the filters."}</p> : null}
            <div ref={sentinel} aria-hidden="true" />
          </div>
        </>
      )}

      {open ? (
        <ListingPanel
          key={open.id}
          summary={open}
          catalogue={catalogue}
          photosReady={photosReady}
          onClose={() => setOpenId("")}
          onSaved={(listing) => merge([listing])}
          onNotice={setNotice}
          onBin={() => binAction([open.id], "bin")}
          onRestore={() => binAction([open.id], "restore")}
          onPurge={() => setDialog({ type: "purge", ids: [open.id] })}
        />
      ) : null}

      {notice ? (
        <div className={`desk-notice ${notice.error ? "is-error" : ""}`} role="status">
          {notice.error ? null : <Check size={16} aria-hidden="true" />}
          <span>{notice.text}</span>
          {notice.undo ? <button type="button" onClick={notice.undo} disabled={busy}><Undo2 size={14} aria-hidden="true" /> Undo</button> : null}
          <button type="button" className="desk-notice-close" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      ) : null}

      {dialog?.type === "new" ? <NewListingDialog neighborhoods={neighborhoods} onCreate={createListing} onClose={() => setDialog(null)} /> : null}
      {dialog?.type === "purge" ? (
        <Modal title={`Delete ${dialog.ids.length === 1 ? "this listing" : `${dialog.ids.length} listings`} for good?`} onClose={() => setDialog(null)}>
          <p>This removes {dialog.ids.length === 1 ? "it" : "them"} with {dialog.ids.length === 1 ? "its" : "their"} photos and history. It cannot be undone.</p>
          <div className="desk-modal-actions">
            <button type="button" className="cw-btn cw-btn-soft" onClick={() => setDialog(null)}>Keep in the bin</button>
            <button type="button" className="cw-btn cw-btn-danger" onClick={() => { const ids = dialog.ids; setDialog(null); binAction(ids, "purge"); }}><Trash2 size={15} aria-hidden="true" /> Delete for good</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/* ---------- One cell ---------- */
function Cell({ listing, field, editing, locked, onEdit, onDone, onOpen, onSave }) {
  const value = fieldValue(listing, field);

  if (field.key === "title") {
    const gaps = listingGaps(listing);
    return (
      <td className="desk-cell-title">
        <button type="button" onClick={onOpen}>{listing.title}</button>
        <small>
          {[listing.sourceId, listing.offerType !== "Sale" ? listing.offerType : ""].filter(Boolean).join(" · ")}
          {gaps.length ? <em>{listing.sourceId ? " · " : ""}Missing {gaps.join(", ")}</em> : null}
        </small>
      </td>
    );
  }
  if (field.type === "public") {
    return (
      <td>
        <Switch checked={Boolean(value)} disabled={locked} label={`${listing.title} is ${value ? "public" : "hidden"}`} onChange={onSave} />
      </td>
    );
  }
  if (field.type === "photos") {
    return (
      <td>
        <button type="button" className="desk-cell-photos" onClick={onOpen} aria-label={`${value.length} photos on ${listing.title}. Open to add or change.`}>
          {value.length ? <img src={value[0]} alt="" loading="lazy" /> : null}
          <span>{value.length || "Add"}</span>
        </button>
      </td>
    );
  }
  if (field.readOnly || locked || field.type === "longtext") {
    const text = field.type === "money" ? (value ? formatNaira(value) : "") : formatValue(field, value);
    return (
      <td className={`desk-cell-plain ${["number", "money"].includes(field.type) ? "is-num" : ""}`}>
        {field.type === "longtext" && !locked ? <button type="button" className="desk-cell" onClick={onOpen}>{text ? `${text.slice(0, 70)}${text.length > 70 ? "…" : ""}` : <i>Add</i>}</button> : text || <i>—</i>}
      </td>
    );
  }
  if (editing) {
    return (
      <td className="desk-cell-editing">
        <FieldControl field={field} value={value} autoFocus compact label={`${field.label} of ${listing.title}`} onCommit={(next) => { onDone(); onSave(next); }} onCancel={onDone} />
      </td>
    );
  }
  const text = field.key === "priceAmount" && value ? `${listing.priceCurrency === "USD" ? "$" : "₦"}${formatValue(field, value)}` : formatValue(field, value);
  return (
    <td className={field.type === "number" ? "is-num" : ""}>
      <button type="button" className={`desk-cell ${field.key === "priceBasis" && value === "unknown" ? "is-warn" : ""}`} onClick={onEdit} aria-label={`${field.label} of ${listing.title}: ${text || "not set"}. Change.`}>
        {text || <i>Add</i>}
      </button>
    </td>
  );
}

/* ---------- Toolbar menus ---------- */
function FilterMenu({ fields, onAdd }) {
  const [key, setKey] = useState(fields[0]?.key || "");
  const field = fields.find((item) => item.key === key);
  const options = field?.type === "yesno" ? [["true", "Yes"], ["false", "No"]] : field?.options || [];
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(options[0]?.[0] ?? "");
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="desk-pop">
      <label>Show only listings where
        <select className="cw-select" value={key} onChange={(event) => setKey(event.target.value)}>
          {fields.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
        </select>
      </label>
      <label>is
        <select className="cw-select" value={value} onChange={(event) => setValue(event.target.value)}>
          {options.map(([option, label]) => <option value={option} key={option}>{label || "Not set"}</option>)}
        </select>
      </label>
      <button type="button" className="cw-btn cw-btn-navy cw-btn-sm" onClick={() => onAdd({ key, value })}>Apply filter</button>
    </div>
  );
}

function ColumnsMenu({ catalogue, columns, onChange, onReset }) {
  const on = columns.map((key) => catalogue.find((field) => field.key === key)).filter(Boolean);
  const off = catalogue.filter((field) => !columns.includes(field.key));
  const move = (index, by) => {
    const next = [...columns];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };
  return (
    <div className="desk-pop desk-pop-columns">
      <p>Tick the columns to show. Use the arrows to change their order.</p>
      <ul>
        {on.map((field, index) => (
          <li key={field.key}>
            <label><input type="checkbox" checked disabled={field.key === "title"} onChange={() => onChange(columns.filter((key) => key !== field.key))} /> {field.label}</label>
            <span>
              <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move ${field.label} left`}><ArrowUp size={14} /></button>
              <button type="button" disabled={index === on.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${field.label} right`}><ArrowDown size={14} /></button>
            </span>
          </li>
        ))}
        {off.map((field) => (
          <li key={field.key}>
            <label><input type="checkbox" checked={false} onChange={() => onChange(columns.concat(field.key))} /> {field.label}</label>
          </li>
        ))}
      </ul>
      <button type="button" className="desk-pop-link" onClick={onReset}>Back to the usual columns</button>
    </div>
  );
}

function ViewsMenu({ views, onUse, onSave, onRemove }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const run = async (work) => {
    setError("");
    try {
      await work();
    } catch (problem) {
      setError(problem.message);
    }
  };
  return (
    <div className="desk-pop desk-pop-views">
      {views.length ? (
        <ul>
          {views.map((view) => (
            <li key={view.id}>
              <button type="button" onClick={() => onUse(view)}>{view.name}</button>
              <button type="button" onClick={() => run(() => onRemove(view))} aria-label={`Remove the view ${view.name}`}><X size={14} /></button>
            </li>
          ))}
        </ul>
      ) : <p>A view remembers the columns, filters, search and order you have now, so you can come back to them in one click.</p>}
      <label>Save what you see now as
        <input className="cw-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ikoyi without photos" maxLength={60} />
      </label>
      <button type="button" className="cw-btn cw-btn-navy cw-btn-sm" disabled={!name.trim()} onClick={() => run(async () => { await onSave(name.trim()); setName(""); })}>Save view</button>
      {error ? <p className="desk-pop-error">{error}</p> : null}
    </div>
  );
}

/* ---------- Bulk actions ---------- */
function BulkBar({ count, inBin, fields, busy, onPublic, onSet, onBin, onRestore, onPurge, onClear }) {
  const [key, setKey] = useState("");
  const field = fields.find((item) => item.key === key);
  const [value, setValue] = useState("");
  return (
    <div className="desk-bulk" role="region" aria-label="Actions for the chosen listings">
      <b>{count} chosen</b>
      {inBin ? (
        <>
          <button type="button" className="cw-btn cw-btn-soft cw-btn-sm" disabled={busy} onClick={onRestore}>Restore</button>
          <button type="button" className="cw-btn cw-btn-danger cw-btn-sm" disabled={busy} onClick={onPurge}>Delete for good</button>
        </>
      ) : (
        <>
          <button type="button" className="cw-btn cw-btn-soft cw-btn-sm" disabled={busy} onClick={() => onPublic(true)}>Make public</button>
          <button type="button" className="cw-btn cw-btn-soft cw-btn-sm" disabled={busy} onClick={() => onPublic(false)}>Hide from buyers</button>
          <span className="desk-bulk-set">
            <select className="cw-select" value={key} aria-label="Detail to change on all chosen listings" onChange={(event) => { setKey(event.target.value); setValue(""); }}>
              <option value="">Change a detail…</option>
              {fields.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
            </select>
            {field ? (
              <>
                <FieldControl field={field} value={value} live compact label={`New ${field.label}`} onCommit={setValue} />
                <button type="button" className="cw-btn cw-btn-navy cw-btn-sm" disabled={busy} onClick={() => { onSet(field, value); setKey(""); }}>Apply to {count}</button>
              </>
            ) : null}
          </span>
          <button type="button" className="cw-btn cw-btn-soft cw-btn-sm" disabled={busy} onClick={onBin}><Trash2 size={14} aria-hidden="true" /> Move to bin</button>
        </>
      )}
      <button type="button" className="desk-bulk-clear" onClick={onClear}>Clear</button>
    </div>
  );
}

function NewListingDialog({ neighborhoods, onCreate, onClose }) {
  const [title, setTitle] = useState("");
  const [area, setArea] = useState(neighborhoods[0]?.id || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onCreate(title.trim(), area);
    } catch (problem) {
      setError(problem.message);
      setSaving(false);
    }
  }
  return (
    <Modal title="New listing" onClose={onClose}>
      <form onSubmit={submit} className="desk-form">
        <p>Start with a title and an area. You fill in the rest next, and buyers do not see it until you make it public.</p>
        <label>Title
          <input className="cw-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. 650 m² plot off Bourdillon Road" autoFocus required maxLength={160} />
        </label>
        <label>Area
          <select className="cw-select" value={area} onChange={(event) => setArea(event.target.value)}>
            {neighborhoods.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
          </select>
        </label>
        {error ? <p className="desk-pop-error">{error}</p> : null}
        <div className="desk-modal-actions">
          <button type="button" className="cw-btn cw-btn-soft" onClick={onClose}>Cancel</button>
          <button type="submit" className="cw-btn cw-btn-navy" disabled={saving || !title.trim()}>{saving ? "Adding…" : "Add listing"}</button>
        </div>
      </form>
    </Modal>
  );
}
