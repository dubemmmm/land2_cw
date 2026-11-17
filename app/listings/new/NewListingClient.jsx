"use client";

import Link from "next/link";
import { CheckCircle2, Save, Star, UploadCloud, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PlotGlyph from "@/components/PlotGlyph";
import { formatNaira, formatSqm } from "@/lib/plot";

const sizeUnits = ["sqm", "ha", "acres"];
const sizeUnitLabels = { sqm: "m²", ha: "ha", acres: "acres" };
const landUses = ["Residential", "Commercial", "Mixed-use", "Industrial"];
const titleDocuments = ["C of O", "Governor's Consent", "Excision", "Gazette", "Deed of Assignment", "Registered Survey"];
const listingStatuses = ["Available", "Under offer", "Sold", "Off-market", "Coming soon"];
const offerTypes = ["Sale", "Joint venture", "Lease"];
// How the price is quoted. A lease is always per year.
const priceBases = { Sale: [["total", "For the whole plot"], ["per_sqm", "Per m²"]], "Joint venture": [["total", "For the whole plot"], ["per_sqm", "Per m²"]], Lease: [["lease", "Per year"], ["lease_per_sqm", "Per m² per year"]] };

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
    priceAmount: initialListing?.priceAmount || "",
    priceCurrency: initialListing?.priceCurrency || "NGN",
    priceBasis: initialListing?.priceBasis || "total",
    offerType: initialListing?.offerType || "Sale",
    landUse: initialListing ? initialListing.landUse : "Residential",
    titleDocument: initialListing?.titleDocument || "",
    listingStatus: initialListing?.listingStatus || "Available",
    address: initialListing?.address || "",
    agentName: initialListing?.agentName || "",
    agentPhone: initialListing?.agentPhone || "",
    description: initialListing?.description || "",
    photos: initialListing?.photos || []
  });

  const selectedLocation = neighborhoods.find((neighborhood) => neighborhood.id === form.neighborhoodId);
  const matchingEstates = useMemo(() => estates.filter((estate) => estate.neighborhoodId === form.neighborhoodId), [estates, form.neighborhoodId]);
  const requirements = {
    title: Boolean(form.title.trim()),
    location: Boolean(form.neighborhoodId)
  };
  const canPublish = requirements.title && requirements.location;
  const missingText = missingRequirements(requirements);
  const sizeSqm = toSqm(form.sizeValue, form.sizeUnit);
  const priceAmount = Number(form.priceAmount) || 0;
  const symbol = form.priceCurrency === "USD" ? "$" : "₦";
  // Whole-plot price and rate per m², in the currency entered. Leases have neither.
  const askingPrice = form.priceBasis === "total" ? priceAmount : form.priceBasis === "per_sqm" ? priceAmount * sizeSqm : 0;
  const pricePerSqm = form.priceBasis === "per_sqm" ? priceAmount : form.priceBasis === "total" && sizeSqm > 0 ? priceAmount / sizeSqm : 0;
  const basisOptions = priceBases[form.offerType] || priceBases.Sale;

  function updateOffer(offerType) {
    const allowed = (priceBases[offerType] || priceBases.Sale).map(([value]) => value);
    setForm((current) => ({ ...current, offerType, priceBasis: allowed.includes(current.priceBasis) ? current.priceBasis : allowed[0] }));
    setToast("");
    setError("");
  }

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
      priceAmount: "",
      priceCurrency: "NGN",
      priceBasis: "total",
      offerType: "Sale",
      landUse: "Residential",
      titleDocument: "",
      listingStatus: "Available",
      address: "",
      agentName: "",
      agentPhone: "",
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
      <header className="cw-pagehead">
        <div>
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/listings">Listings</Link>
            <span aria-hidden="true">/</span>
            <span>{initialListing ? "Edit listing" : "New listing"}</span>
          </nav>
          <h1 className="cw-pagehead-title">{initialListing ? "Edit land listing" : "New land listing"}</h1>
          <p className="cw-lede">
            A listing needs a title and a location before it can be published. Without a photo it is shown with a view of its area. {listingsCount} listings are on file across {neighborhoods.length} locations.
          </p>
        </div>
      </header>

      <div className="listing-editor-shell">
        <form className="listing-editor-form" onSubmit={(event) => event.preventDefault()}>
          <div className="listing-editor-card">
            <EditorSection title="Photos" meta={`${form.photos.length} of 8 added`}>
              <div
                className="listing-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  readFiles(event.dataTransfer.files);
                }}
              >
                <input type="file" accept="image/*" multiple aria-label="Add photos" onChange={(event) => readFiles(event.target.files)} />
                <UploadCloud size={22} aria-hidden="true" />
                <span>Drag photos here, or click to browse</span>
                <small>JPG or PNG. The first photo is the cover; use the star to change it.</small>
              </div>
              {form.photos.length ? (
                <div className="listing-photo-strip">
                  {form.photos.map((photo, index) => (
                    <figure key={`${photo.slice(0, 24)}-${index}`}>
                      <img src={photo} alt="" />
                      {index === 0 ? <b>Cover</b> : null}
                      <figcaption>
                        <button type="button" onClick={() => setCover(index)} aria-label="Set as cover" title="Set as cover"><Star size={13} /></button>
                        <button type="button" onClick={() => removePhoto(index)} aria-label="Remove photo" title="Remove photo"><X size={13} /></button>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              ) : null}
            </EditorSection>

            <EditorSection title="Where it is">
              <label className="listing-field">
                <span>Title or plot address</span>
                <input className="cw-input" value={form.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. Plot 14B, Bourdillon Close" />
              </label>
              <div className="listing-field-grid">
                <label className="listing-field">
                  <span>Location</span>
                  <select className="cw-select" value={form.neighborhoodId} onChange={(event) => update("neighborhoodId", event.target.value)}>
                    <option value="">Select a location</option>
                    {neighborhoods.map((neighborhood) => <option value={neighborhood.id} key={neighborhood.id}>{neighborhood.name}</option>)}
                  </select>
                </label>
                <label className="listing-field">
                  <span>Estate <em>(optional)</em></span>
                  <input className="cw-input" list="estate-suggestions" value={form.estate} onChange={(event) => update("estate", event.target.value)} placeholder="e.g. Lekki Gardens Estate" />
                  <datalist id="estate-suggestions">
                    {matchingEstates.map((estate) => <option value={estate.name} key={estate.id} />)}
                  </datalist>
                </label>
              </div>
            </EditorSection>

            <EditorSection title="Size and price">
              <div className="listing-field-grid">
                <div className="listing-field">
                  <label htmlFor="listing-size">Land size</label>
                  <div className="listing-size-control">
                    <input id="listing-size" className="cw-input" value={form.sizeValue} inputMode="decimal" onChange={(event) => update("sizeValue", event.target.value)} placeholder="1200" />
                    <div className="cw-tabs" role="group" aria-label="Size unit">
                      {sizeUnits.map((unit) => (
                        <button className={form.sizeUnit === unit ? "active" : ""} type="button" aria-pressed={form.sizeUnit === unit} onClick={() => update("sizeUnit", unit)} key={unit}>{sizeUnitLabels[unit]}</button>
                      ))}
                    </div>
                  </div>
                  <small>{sizeHint(sizeSqm, form.sizeUnit)}</small>
                </div>
                <div className="listing-field">
                  <label htmlFor="listing-price">Price as quoted</label>
                  <div className="listing-size-control">
                    <div className="listing-price-field">
                      <i aria-hidden="true">{symbol}</i>
                      <input id="listing-price" className="cw-input" value={form.priceAmount} inputMode="numeric" onChange={(event) => update("priceAmount", event.target.value)} placeholder="850000000" />
                    </div>
                    <div className="cw-tabs" role="group" aria-label="Currency">
                      {["NGN", "USD"].map((currency) => (
                        <button className={form.priceCurrency === currency ? "active" : ""} type="button" aria-pressed={form.priceCurrency === currency} onClick={() => update("priceCurrency", currency)} key={currency}>{currency === "USD" ? "$" : "₦"}</button>
                      ))}
                    </div>
                  </div>
                  <small>
                    {priceAmount ? `${symbol}${new Intl.NumberFormat("en-US").format(priceAmount)}` : "Digits only"}
                    {form.priceCurrency === "USD" ? ". Shown on the site in naira at the day's exchange rate." : ""}
                  </small>
                </div>
              </div>
              <div className="listing-field">
                <span id="listing-offer-label">Offer</span>
                <div className="listing-choice-row" role="group" aria-labelledby="listing-offer-label">
                  {offerTypes.map((type) => (
                    <button className={form.offerType === type ? "active" : ""} type="button" aria-pressed={form.offerType === type} onClick={() => updateOffer(type)} key={type}>{type}</button>
                  ))}
                </div>
              </div>
              <div className="listing-field">
                <span id="listing-basis-label">The price is</span>
                <div className="listing-choice-row" role="group" aria-labelledby="listing-basis-label">
                  {basisOptions.map(([value, label]) => (
                    <button className={form.priceBasis === value ? "active" : ""} type="button" aria-pressed={form.priceBasis === value} onClick={() => update("priceBasis", value)} key={value}>{label}</button>
                  ))}
                </div>
                {form.priceBasis === "unknown" ? <small>The import could not tell whether this price is for the whole plot or per m². Choose one to include it in price comparisons.</small> : null}
              </div>
              <div className="listing-field">
                <span id="listing-use-label">Land use</span>
                <div className="listing-choice-row" role="group" aria-labelledby="listing-use-label">
                  {landUses.map((use) => (
                    <button className={form.landUse === use ? "active" : ""} type="button" aria-pressed={form.landUse === use} onClick={() => update("landUse", use)} key={use}>{use}</button>
                  ))}
                  <button className={form.landUse === "" ? "active" : ""} type="button" aria-pressed={form.landUse === ""} onClick={() => update("landUse", "")}>Not stated</button>
                </div>
              </div>
            </EditorSection>

            <EditorSection title="Title and status">
              <label className="listing-field">
                <span>Title document</span>
                <select className="cw-select" value={form.titleDocument} onChange={(event) => update("titleDocument", event.target.value)}>
                  <option value="">Not stated</option>
                  {titleDocuments.map((title) => <option key={title}>{title}</option>)}
                </select>
                <small>{titleDocumentHelp(form.titleDocument)}</small>
              </label>
              <div className="listing-field">
                <span id="listing-status-label">Listing status</span>
                <div className="listing-choice-row" role="group" aria-labelledby="listing-status-label">
                  {listingStatuses.map((status) => (
                    <button className={form.listingStatus === status ? "active" : ""} type="button" aria-pressed={form.listingStatus === status} onClick={() => update("listingStatus", status)} key={status}>{status}</button>
                  ))}
                </div>
              </div>
            </EditorSection>

            <EditorSection title="Agent and description">
              <div className="listing-field-grid">
                <label className="listing-field">
                  <span>Agent name</span>
                  <input className="cw-input" value={form.agentName} onChange={(event) => update("agentName", event.target.value)} placeholder="e.g. Emmanuel" />
                </label>
                <label className="listing-field">
                  <span>Agent phone</span>
                  <input className="cw-input" value={form.agentPhone} inputMode="tel" onChange={(event) => update("agentPhone", event.target.value)} placeholder="+234 908 000 0000" />
                </label>
              </div>
              <label className="listing-field">
                <span>Address <em>(optional)</em></span>
                <input className="cw-input" value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="Street or estate" />
              </label>
              <label className="listing-field">
                <span>Description <em>(shown on the listing page, with the agent&rsquo;s name and phone)</em></span>
                <textarea className="cw-textarea" value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="What a buyer should know about the plot." />
              </label>
            </EditorSection>
          </div>

          <div className="listing-editor-actions">
            {error ? (
              <p className="listing-form-error" role="alert">{error}</p>
            ) : toast ? (
              <p className="listing-toast" role="status"><CheckCircle2 size={16} aria-hidden="true" /> {toast}</p>
            ) : (
              <p>{missingText}</p>
            )}
            <div>
              <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={clearForm}>Clear</button>
              <button className="cw-btn cw-btn-outline cw-btn-sm" type="button" onClick={() => saveListing("Draft")} disabled={saving}><Save size={15} /> Save as draft</button>
              <button className="cw-btn cw-btn-navy cw-btn-sm" type="button" onClick={() => saveListing("Published")} disabled={!canPublish || saving}>
                <UploadCloud size={15} /> Publish listing
              </button>
            </div>
          </div>
        </form>

        <aside className="listing-editor-aside" aria-label="Listing summary">
          <section className="listing-summary">
            <h2>Summary so far</h2>
            {form.photos[0] ? <img className="listing-summary-cover" src={form.photos[0]} alt="Cover photo" /> : null}
            <p className="listing-summary-title">{form.title || "Untitled listing"}</p>
            <p className="listing-summary-place">{selectedLocation?.name || "No location selected"}{form.estate ? ` · ${form.estate}` : ""}</p>

            <figure className="listing-summary-plot">
              <PlotGlyph sqm={sizeSqm} />
              <figcaption>
                {sizeSqm
                  ? "Drawn from the size you entered. The area is to scale; the outline is indicative."
                  : "Enter a land size to see the plot drawn to scale."}
              </figcaption>
            </figure>

            <dl className="listing-summary-facts">
              <div>
                <dt>Size</dt>
                <dd className={sizeSqm ? "" : "is-empty"}>{sizeSqm ? `${formatSqm(sizeSqm)} m²` : "Not set"}</dd>
              </div>
              <div>
                <dt>Asking price</dt>
                <dd className={askingPrice ? "" : "is-empty"}>{askingPrice ? `${symbol}${new Intl.NumberFormat("en-US").format(Math.round(askingPrice))}` : priceAmount && form.offerType === "Lease" ? "Lease, no sale price" : "Not set"}</dd>
              </div>
              <div className="listing-summary-key">
                <dt>Price per m²</dt>
                <dd className={pricePerSqm ? "" : "is-empty"}>{pricePerSqm ? (form.priceCurrency === "USD" ? `$${new Intl.NumberFormat("en-US").format(Math.round(pricePerSqm))}` : formatNaira(pricePerSqm)) : "Needs size and price"}</dd>
              </div>
              <div>
                <dt>Land use</dt>
                <dd>{form.landUse || "Not stated"}</dd>
              </div>
              <div>
                <dt>Title document</dt>
                <dd>{form.titleDocument || "Not stated"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{form.listingStatus}</dd>
              </div>
            </dl>
          </section>

          <section className="listing-publish-check">
            <h2>Needed to publish</h2>
            <CheckItem done={requirements.title} label="Title" />
            <CheckItem done={requirements.location} label="Location" />
          </section>

          <Link className="cw-link listing-back-link" href="/listings">Back to listings</Link>
        </aside>
      </div>
    </section>
  );
}

function EditorSection({ title, meta, children }) {
  return (
    <section className="listing-editor-group">
      <header>
        <h2>{title}</h2>
        {meta ? <span>{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}

function CheckItem({ done, label }) {
  return (
    <p className={done ? "done" : ""}>
      <i aria-hidden="true" /> {label}
    </p>
  );
}

function missingRequirements(requirements) {
  const missing = [];
  if (!requirements.title) missing.push("a title");
  if (!requirements.location) missing.push("a location");
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

function sizeHint(sizeSqm, unit) {
  if (!sizeSqm) return "Enter the plot size";
  return unit === "sqm" ? `${formatSqm(sizeSqm)} m²` : `Equals ${formatSqm(sizeSqm)} m²`;
}

function titleDocumentHelp(titleDocument) {
  if (titleDocument === "C of O") return "Certificate of Occupancy, full statutory title.";
  if (titleDocument === "Governor's Consent") return "Transfer title with governor consent recorded.";
  if (titleDocument === "Excision") return "Excised land; verify gazette and survey before closing.";
  if (!titleDocument) return "Leave as not stated unless the document has been seen.";
  if (titleDocument === "Gazette") return "Government gazette reference should be checked against survey coordinates.";
  return "Verify title documents before sharing final advice.";
}
