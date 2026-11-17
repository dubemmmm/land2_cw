"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { formatNaira, quotedPrice } from "@/lib/plot";

const titleDocuments = ["C of O", "Governor's Consent", "Excision", "Gazette", "Deed of Assignment", "Registered Survey"];
const listingStatuses = ["Available", "Under offer", "Sold", "Off-market", "Coming soon"];
const saleBases = [["total", "Whole plot"], ["per_sqm", "Per m²"]];
const leaseBases = [["lease", "Per year"], ["lease_per_sqm", "Per m² per year"]];
const PAGE_SIZE = 25;

// What still needs a person to look at it, in the order it matters to buyers.
function gaps(listing) {
  const missing = [];
  if (listing.priceBasis === "unknown") missing.push("price basis");
  if (!listing.sizeSqm) missing.push("size");
  if (!listing.titleDocument) missing.push("title document");
  if (!listing.photoCount) missing.push("photo");
  return missing;
}

// The listings of one location as an editable table. The three things most often
// wrong after an import (size, what the price is for, title document) and the
// status are changed in place; everything else is on the full edit page.
export default function ListingsManager({ listings, locationId, locationName, onChange }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [message, setMessage] = useState({ text: "", error: false });
  const [savingId, setSavingId] = useState("");

  const inLocation = useMemo(() => listings.filter((listing) => listing.neighborhoodId === locationId), [listings, locationId]);
  // Photos are worth adding but are not an error, so they do not count as "needs attention".
  const needsAttention = useMemo(() => inLocation.filter((listing) => gaps(listing).some((gap) => gap !== "photo")), [inLocation]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (filter === "attention" ? needsAttention : inLocation)
      .filter((listing) => !needle || [listing.title, listing.sourceId, listing.estate, listing.agentName].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [filter, inLocation, needsAttention, query]);

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [filter, locationId, query]);

  async function save(listing, patch, label) {
    setSavingId(listing.id);
    setMessage({ text: "", error: false });
    try {
      const res = await fetch(`/api/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Could not save");
      onChange(updated);
      setMessage({ text: `Saved ${label} for ${updated.title}`, error: false });
    } catch (error) {
      setMessage({ text: `Could not save ${listing.title}: ${error.message}`, error: true });
    }
    setSavingId("");
  }

  return (
    <section className="data-card">
      <div className="data-section-head">
        <div>
          <h2>Listings in {locationName} <span className="data-count">{inLocation.length}</span></h2>
          <p>
            Change the size, what the price is for, the title document or the status here and it saves straight away.
            Open a listing to change anything else or to add photos.
          </p>
        </div>
        <Link className="cw-btn cw-btn-soft cw-btn-sm" href="/listings/new"><Plus size={15} /> New listing</Link>
      </div>

      <div className="data-listing-tools">
        <div className="cw-tabs" role="group" aria-label="Which listings to show">
          <button className={filter === "all" ? "active" : ""} type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All {inLocation.length}
          </button>
          <button className={filter === "attention" ? "active" : ""} type="button" aria-pressed={filter === "attention"} onClick={() => setFilter("attention")}>
            Needs attention {needsAttention.length}
          </button>
        </div>
        <input className="cw-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, reference, estate or agent" aria-label="Search listings" />
        {message.text ? <span className={`data-state ${message.error ? "is-error" : "is-saved"}`} role="status">{message.text}</span> : null}
      </div>

      {visible.length ? (
        <div className="data-tablewrap">
          <table className="data-table data-listing-table">
            <thead>
              <tr>
                <th>Listing</th>
                <th>Size, m²</th>
                <th>Price as quoted</th>
                <th>The price is</th>
                <th>Title document</th>
                <th>Status</th>
                <th className="data-col-act"><span className="data-sr">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, shown).map((listing) => (
                <ListingRow listing={listing} saving={savingId === listing.id} onSave={save} key={listing.id} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="data-empty">
          {filter === "attention" && !query ? `Nothing in ${locationName} needs attention.` : "No listings match."}
        </p>
      )}
      {shown < visible.length ? (
        <p className="data-listing-more">
          <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => setShown((count) => count + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, visible.length - shown)} more
          </button>
          <span>Showing {shown} of {visible.length}</span>
        </p>
      ) : null}
    </section>
  );
}

function ListingRow({ listing, saving, onSave }) {
  const [size, setSize] = useState(listing.sizeSqm ? String(listing.sizeSqm) : "");
  const missing = gaps(listing);
  const bases = listing.offerType === "Lease" ? leaseBases : saleBases;

  useEffect(() => {
    setSize(listing.sizeSqm ? String(listing.sizeSqm) : "");
  }, [listing.sizeSqm]);

  function saveSize() {
    const value = Number(size) || 0;
    if (value === (Number(listing.sizeSqm) || 0)) return;
    onSave(listing, { sizeValue: value, sizeUnit: "sqm" }, "the size");
  }

  return (
    <tr aria-busy={saving}>
      <td>
        <Link className="data-listing-title" href={`/listings/${listing.id}`}>{listing.title}</Link>
        <small>
          {[listing.sourceId, listing.offerType !== "Sale" ? listing.offerType : "", listing.workflowStatus === "Draft" ? "Draft" : ""].filter(Boolean).join(" · ")}
          {missing.length ? <em> · Missing: {missing.join(", ")}</em> : null}
        </small>
      </td>
      <td>
        <input
          className="cw-input data-listing-size"
          value={size}
          inputMode="decimal"
          aria-label={`Size of ${listing.title} in square metres`}
          disabled={saving}
          onChange={(event) => setSize(event.target.value)}
          onBlur={saveSize}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
      </td>
      <td className="data-num">
        {quotedPrice(listing) || "—"}
        {listing.pricePerSqm ? <small>{formatNaira(listing.pricePerSqm)} per m²</small> : null}
      </td>
      <td>
        <select
          className="cw-select"
          value={listing.priceBasis}
          aria-label={`What the price of ${listing.title} is for`}
          disabled={saving}
          onChange={(event) => onSave(listing, { priceBasis: event.target.value }, "the price basis")}
        >
          {listing.priceBasis === "unknown" ? <option value="unknown">Not settled</option> : null}
          {bases.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </td>
      <td>
        <select
          className="cw-select"
          value={listing.titleDocument || ""}
          aria-label={`Title document of ${listing.title}`}
          disabled={saving}
          onChange={(event) => onSave(listing, { titleDocument: event.target.value }, "the title document")}
        >
          <option value="">Not stated</option>
          {titleDocuments.map((title) => <option key={title}>{title}</option>)}
        </select>
      </td>
      <td>
        <select
          className="cw-select"
          value={listing.listingStatus}
          aria-label={`Status of ${listing.title}`}
          disabled={saving}
          onChange={(event) => onSave(listing, { listingStatus: event.target.value }, "the status")}
        >
          {listingStatuses.map((status) => <option key={status}>{status}</option>)}
        </select>
      </td>
      <td className="data-col-act">
        <Link className="cw-icon-btn" href={`/listings/new?id=${listing.id}`} aria-label={`Edit ${listing.title}`} title="Edit everything, add photos"><Pencil size={14} /></Link>
      </td>
    </tr>
  );
}
