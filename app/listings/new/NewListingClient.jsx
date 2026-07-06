"use client";

import Link from "next/link";
import { CheckCircle2, Image, Save, Star, Trash2, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const sizeUnits = ["sqm", "ha", "acres"];
const landUses = ["Residential", "Commercial", "Mixed-use"];
const titleDocuments = ["C of O", "Governor's Consent", "Excision", "Gazette", "Deed of Assignment", "Registered Survey"];
const listingStatuses = ["Available", "Under offer", "Sold", "Off-market", "Coming soon"];

export default function NewListingClient({ neighborhoods, estates, listingsCount, initialListing = null }) {
  const router = useRouter();
  const firstLocation = initialListing?.neighborhoodId || neighborhoods[0]?.id || "";
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    id: initialListing?.id || "",
    title: initialListing?.title || "",
    neighborhoodId: firstLocation,
    estate: initialListing?.estate || "",
    sizeValue: initialListing?.sizeValue || "",
    sizeUnit: initialListing?.sizeUnit || "sqm",
    askingPrice: initialListing?.askingPrice || "",
    landUse: initialListing?.landUse || "Residential",
    titleDocument: initialListing?.titleDocument || "C of O",
    listingStatus: initialListing?.listingStatus || "Available",
    description: initialListing?.description || "",
    photos: initialListing?.photos || []
  });

  const selectedLocation = neighborhoods.find((neighborhood) => neighborhood.id === form.neighborhoodId);
  const matchingEstates = useMemo(() => estates.filter((estate) => estate.neighborhoodId === form.neighborhoodId), [estates, form.neighborhoodId]);
  const requirements = {
    title: Boolean(form.title.trim()),
    location: Boolean(form.neighborhoodId),
    photo: form.photos.length > 0
  };
  const canPublish = requirements.title && requirements.location && requirements.photo;
  const missingText = missingRequirements(requirements);
  const sizeSqm = toSqm(form.sizeValue, form.sizeUnit);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setToast("");
    setError("");
  }

  function clearForm() {
    setForm({
      id: "",
      title: "",
      neighborhoodId: neighborhoods[0]?.id || "",
      estate: "",
      sizeValue: "",
      sizeUnit: "sqm",
      askingPrice: "",
      landUse: "Residential",
      titleDocument: "C of O",
      listingStatus: "Available",
      description: "",
      photos: []
    });
    setToast("");
    setError("");
  }

  async function readFiles(files) {
    const selected = Array.from(files || []).slice(0, 8 - form.photos.length);
    const encoded = await Promise.all(selected.map((file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    setForm((current) => ({ ...current, photos: current.photos.concat(encoded.filter(Boolean)).slice(0, 8) }));
  }

  function removePhoto(index) {
    setForm((current) => ({ ...current, photos: current.photos.filter((_, itemIndex) => itemIndex !== index) }));
  }

  function setCover(index) {
    setForm((current) => {
      const photos = [...current.photos];
      const [photo] = photos.splice(index, 1);
      return { ...current, photos: [photo].concat(photos) };
    });
  }

  async function saveListing(workflowStatus) {
    setSaving(true);
    setError("");
    setToast("");
    const body = {
      ...form,
      workflowStatus,
      published: workflowStatus === "Published"
    };
    const res = await fetch(form.id ? `/api/listings/${form.id}` : "/api/listings", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const listing = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(listing.error || "Could not save listing");
      return;
    }
    setForm((current) => ({ ...current, id: listing.id }));
    setToast(workflowStatus === "Published" ? "Listing published" : "Draft saved");
    if (workflowStatus === "Published") router.push("/listings?view=cards");
  }

  return (
    <section className="listing-editor-page">
      <header className="listing-editor-topbar">
        <div>
          <h1>{initialListing ? "Edit land listing" : "New land listing"}</h1>
          <p>{listingsCount} listings tracked across {neighborhoods.length} locations</p>
        </div>
        <div className="listing-editor-actions">
          <span>{missingText}</span>
          <button type="button" onClick={clearForm}>Clear</button>
          <button type="button" onClick={() => saveListing("Draft")} disabled={saving}><Save size={15} /> Save as draft</button>
          <button className="primary" type="button" onClick={() => saveListing("Published")} disabled={!canPublish || saving}>
            <UploadCloud size={15} /> Publish listing
          </button>
        </div>
      </header>

      {toast ? <div className="listing-toast"><CheckCircle2 size={16} /> {toast}</div> : null}

      <div className="listing-editor-shell">
        <form className="listing-editor-form" onSubmit={(event) => event.preventDefault()}>
          <EditorSection title="Photos" meta={`${form.photos.length} added`}>
            <div
              className="listing-dropzone"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                readFiles(event.dataTransfer.files);
              }}
            >
              <input type="file" accept="image/*" multiple onChange={(event) => readFiles(event.target.files)} />
              <UploadCloud size={25} />
              <span>Drag photos here, or click to browse</span>
              <small>JPG or PNG · set cover with the star button</small>
            </div>
            {form.photos.length ? (
              <div className="listing-photo-strip">
                {form.photos.map((photo, index) => (
                  <figure key={`${photo.slice(0, 24)}-${index}`}>
                    <img src={photo} alt="" />
                    {index === 0 ? <b>Cover</b> : null}
                    <figcaption>
                      <button type="button" onClick={() => setCover(index)} aria-label="Set as cover"><Star size={12} /></button>
                      <button type="button" onClick={() => removePhoto(index)} aria-label="Remove photo"><X size={12} /></button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
          </EditorSection>

          <EditorSection title="Basic info & classification">
            <label className="listing-field full">
              <span>Title / plot address</span>
              <input value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Plot 14B, Bourdillon Close" />
            </label>
            <div className="listing-field-grid">
              <label className="listing-field">
                <span>Location</span>
                <select value={form.neighborhoodId} onChange={(event) => update("neighborhoodId", event.target.value)}>
                  <option value="">Select a location</option>
                  {neighborhoods.map((neighborhood) => <option value={neighborhood.id} key={neighborhood.id}>{neighborhood.name}</option>)}
                </select>
              </label>
              <label className="listing-field">
                <span>Estate <em>(optional)</em></span>
                <input list="estate-suggestions" value={form.estate} onChange={(event) => update("estate", event.target.value)} placeholder="e.g. Lekki Gardens Estate" />
                <datalist id="estate-suggestions">
                  {matchingEstates.map((estate) => <option value={estate.name} key={estate.id} />)}
                </datalist>
              </label>
            </div>
          </EditorSection>

          <EditorSection title="Specs">
            <div className="listing-field-grid">
              <label className="listing-field">
                <span>Land size</span>
                <div className="listing-size-control">
                  <input value={form.sizeValue} inputMode="decimal" onChange={(event) => update("sizeValue", event.target.value)} placeholder="1200" />
                  <div>
                    {sizeUnits.map((unit) => (
                      <button className={form.sizeUnit === unit ? "active" : ""} type="button" onClick={() => update("sizeUnit", unit)} key={unit}>{unit}</button>
                    ))}
                  </div>
                </div>
                <small>{sizeSqm ? `${formatNumber(sizeSqm)} sqm normalized` : "Enter a plot size"}</small>
              </label>
              <label className="listing-field">
                <span>Asking price</span>
                <div className="listing-price-field">
                  <i>₦</i>
                  <input value={form.askingPrice} inputMode="numeric" onChange={(event) => update("askingPrice", event.target.value)} placeholder="850000000" />
                </div>
                <small>{form.askingPrice ? formatFullPrice(form.askingPrice) : "Price not set"}</small>
              </label>
            </div>
            <div className="listing-field">
              <span>Land use</span>
              <div className="listing-choice-row">
                {landUses.map((use) => (
                  <button className={form.landUse === use ? "active" : ""} type="button" onClick={() => update("landUse", use)} key={use}>{use}</button>
                ))}
              </div>
            </div>
          </EditorSection>

          <EditorSection title="Legal & status">
            <label className="listing-field full">
              <span>Title document status</span>
              <select value={form.titleDocument} onChange={(event) => update("titleDocument", event.target.value)}>
                {titleDocuments.map((title) => <option key={title}>{title}</option>)}
              </select>
              <small>{titleDocumentHelp(form.titleDocument)}</small>
            </label>
            <div className="listing-field">
              <span>Listing status</span>
              <div className="listing-choice-row wrap">
                {listingStatuses.map((status) => (
                  <button className={form.listingStatus === status ? "active" : ""} type="button" onClick={() => update("listingStatus", status)} key={status}>{status}</button>
                ))}
              </div>
            </div>
          </EditorSection>

          <EditorSection title="Description">
            <label className="listing-field full">
              <span>Internal notes</span>
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Internal listing notes. Use this for access, owner, pricing context, or due diligence reminders." />
            </label>
          </EditorSection>

          {error ? <p className="listing-form-error">{error}</p> : null}
        </form>

        <aside className="listing-editor-aside">
          <span className="listing-aside-label">Live preview</span>
          <article className="listing-preview-card">
            <div className="listing-preview-media">
              {form.photos[0] ? <img src={form.photos[0]} alt="" /> : <div><Image size={28} /><span>Add photos to preview the cover</span></div>}
              <b>{form.listingStatus}</b>
              <em>{form.askingPrice ? formatCompactPrice(form.askingPrice) : "Price not set"}</em>
            </div>
            <div className="listing-preview-body">
              <h2>{form.title || "Untitled listing"}</h2>
              <p>{sizeSqm ? `${formatNumber(sizeSqm)} sqm` : "Size not set"} · {form.landUse}</p>
              <p>{selectedLocation?.name || "No location selected"}{form.estate ? ` · ${form.estate}` : ""}</p>
              <TitleBadge titleDocument={form.titleDocument} />
            </div>
          </article>

          <article className="listing-publish-check">
            <h2>Before you publish</h2>
            <CheckItem done={requirements.title} label="Title" />
            <CheckItem done={requirements.location} label="Location" />
            <CheckItem done={requirements.photo} label="At least one photo" />
          </article>

          <Link className="listing-back-link" href="/listings">Back to listings</Link>
        </aside>
      </div>
    </section>
  );
}

function EditorSection({ title, meta, children }) {
  return (
    <section className="listing-editor-card">
      <header>
        <div><i /> <h2>{title}</h2></div>
        {meta ? <span>{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function CheckItem({ done, label }) {
  return <p className={done ? "done" : ""}><i /> {label}</p>;
}

function TitleBadge({ titleDocument }) {
  return <span className={`title-badge ${titleClass(titleDocument)}`}><i />{titleDocument}</span>;
}

function missingRequirements(requirements) {
  const missing = [];
  if (!requirements.title) missing.push("a title");
  if (!requirements.location) missing.push("a location");
  if (!requirements.photo) missing.push("a photo");
  return missing.length ? `Needs ${listWords(missing)} to publish` : "Ready to publish";
}

function listWords(words) {
  if (words.length <= 1) return words[0] || "";
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

function toSqm(value, unit) {
  const size = Number(value) || 0;
  if (unit === "ha") return Math.round(size * 10000);
  if (unit === "acres") return Math.round(size * 4046.8564224);
  return Math.round(size);
}

function titleDocumentHelp(titleDocument) {
  if (titleDocument === "C of O") return "Certificate of Occupancy, full statutory title.";
  if (titleDocument === "Governor's Consent") return "Transfer title with governor consent recorded.";
  if (titleDocument === "Excision") return "Excised land; verify gazette and survey before closing.";
  if (titleDocument === "Gazette") return "Government gazette reference should be checked against survey coordinates.";
  return "Verify title documents before sharing final advice.";
}

function formatCompactPrice(value) {
  const price = Number(value) || 0;
  if (!price) return "Price not set";
  if (price >= 1000000000) return `₦${Number((price / 1000000000).toFixed(1))}B`;
  return `₦${Math.round(price / 1000000)}M`;
}

function formatFullPrice(value) {
  const price = Number(value) || 0;
  return price ? `₦${new Intl.NumberFormat("en-US").format(price)}` : "Price not set";
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function titleClass(titleDocument) {
  if (/consent/i.test(titleDocument)) return "consent";
  if (/excision/i.test(titleDocument)) return "excision";
  if (/gazette/i.test(titleDocument)) return "gazette";
  return "cofo";
}
