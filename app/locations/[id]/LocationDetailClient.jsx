"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Database, FileText, Link as LinkIcon, Pencil, Save, Share2 } from "lucide-react";
import { useState } from "react";
import BudgetScale from "@/components/BudgetScale";
import PlotCard from "@/components/PlotCard";
import PriceTrace from "@/components/PriceTrace";
import { SourcePill } from "@/components/Pills";
import { confidenceLevel, confidencePattern, confidenceScore, formatDate } from "@/lib/metrics";
import { areaPhoto, photoCredits } from "@/lib/photos";

export default function LocationDetailClient({ neighborhood, neighborhoods = [], market, resources = [], locationListings = [], pricedLocations = [], isAdmin = false }) {
  const [record, setRecord] = useState(neighborhood);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDraft(neighborhood));
  const router = useRouter();
  const score = confidenceScore(record);
  const level = confidenceLevel(score);
  const pattern = confidencePattern(score);
  const lead = areaPhoto(record.id, 1920);

  async function save(event) {
    event.preventDefault();
    const patch = {
      recommendation: {
        headline: draft.headline,
        bestNextAction: draft.bestNextAction,
        confidence: Number(draft.confidence),
        confidenceReason: draft.confidenceReason,
        riskLevel: draft.riskLevel
      },
      metadata: {
        reviewedBy: draft.reviewedBy,
        lastReviewed: new Date().toISOString().slice(0, 10),
        freshness: "Current",
        reviewStatus: "Saved to database"
      }
    };
    const res = await fetch(`/api/neighborhoods/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    const updated = await res.json();
    if (!res.ok) return;
    setRecord(updated);
    setDraft(toDraft(updated));
    setEditing(false);
    router.refresh();
  }

  async function shareLocation() {
    if (!navigator?.clipboard) return;
    await navigator.clipboard.writeText(window.location.href);
  }

  function switchLocation(id) {
    if (!id || id === record.id) return;
    router.push(`/locations/${id}`);
  }

  const hasPrice = Boolean(market && Number(market.priceValue) > 0);
  const priceText = hasPrice ? perSqmAmount(market.priceLabel) : null;
  const growthText = market?.annualGrowthLabel && market.annualGrowthLabel !== "N/A" ? market.annualGrowthLabel.replace("~", "") : null;
  const estateTotal = market?.estateSummary?.total || 0;
  const landText = mappedLand(market?.totalLandLabel);
  const trend = market?.trend || [];
  const budgetItems = pricedLocations.some((item) => item.id === record.id) && pricedLocations.length > 1
    ? pricedLocations.map((item) => (item.id === record.id ? { ...item, name: `${item.name} · here` } : item))
    : [];
  const buildParameters = record.intelligence?.buildParameters || [];
  const constraints = record.intelligence?.constraints || [];
  const approvals = record.approvals || [];
  const notes = record.notes || [];
  const plotScale = Math.max(0, ...locationListings.slice(0, 4).map((listing) => Number(listing.sizeSqm) || 0));
  const showsAreaPhotos = Boolean(lead) || locationListings.length > 0;
  const facts = [
    market?.lga ? { label: "Local government", value: market.lga } : null,
    record.jurisdiction ? { label: "Jurisdiction", value: record.jurisdiction } : null,
    market ? {
      label: "Estates tracked",
      value: estateTotal ? `${estateTotal} (${market.estateSummary.developing} developing, ${market.estateSummary.built} built)` : "None mapped yet"
    } : null,
    landText ? { label: "Land mapped", value: landText } : null,
    market ? { label: "Price basis", value: market.asOfLabel || market.meta?.pricing_date } : null,
    record.intelligence?.redFlags?.[0] ? { label: "Main risk flag", value: record.intelligence.redFlags[0] } : null,
    { label: "Last reviewed", value: `${formatDate(record.metadata?.lastReviewed)}${record.metadata?.reviewedBy ? ` by ${record.metadata.reviewedBy}` : ""}` }
  ].filter((fact) => fact && fact.value);

  return (
    <div className="focus-page">
      <header className="cw-pagehead focus-head">
        <div className="focus-head-main">
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/map">Map</Link>
            <span aria-hidden="true">/</span>
            <span>{record.name}</span>
          </nav>
          <h1 className="cw-pagehead-title">{record.name}</h1>
          {record.recommendation?.summary ? <p className="cw-lede">{record.recommendation.summary}</p> : null}
        </div>
        <div className="focus-head-actions">
          <select className="cw-select focus-location-select" value={record.id} onChange={(event) => switchLocation(event.target.value)} aria-label="Switch location">
            {(neighborhoods.length ? neighborhoods : [record]).map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
          <button className="cw-icon-btn" type="button" onClick={shareLocation} aria-label="Copy location link" title="Copy link"><Share2 size={16} /></button>
          {isAdmin ? (
            <>
              <button className="cw-icon-btn" type="button" onClick={() => setEditing(true)} aria-label="Quick edit intelligence" title="Quick edit"><Pencil size={16} /></button>
              <Link className="cw-icon-btn" href="/data" aria-label="Open full data admin" title="Data admin"><Database size={16} /></Link>
            </>
          ) : null}
          <Link className="cw-btn cw-btn-navy cw-btn-sm" href={`/reports?report=land-${record.id}`}><FileText size={15} /> Open report</Link>
        </div>
      </header>

      {lead ? (
        <figure className="focus-photo">
          <img src={lead.src} alt={`Aerial view of ${lead.place}`} />
          <figcaption>Area view · {lead.place}</figcaption>
        </figure>
      ) : null}

      <p className="focus-statement">
        {hasPrice ? (
          <>
            Land in {record.name} is estimated at <b className="sq-fig">{priceText} per m²</b> in {market.currentYear}
            {growthText ? <>, rising by about {growthText} a year</> : null}.{" "}
          </>
        ) : (
          <>We do not have a price per m² for {record.name} yet.{" "}</>
        )}
        {estateTotal ? (
          <>
            We track {estateTotal} {estateTotal === 1 ? "estate" : "estates"} here
            {landText ? <>, covering {landText} of mapped land</> : null}.{" "}
          </>
        ) : null}
        {score ? (
          <>
            Our confidence in this data is{" "}
            <span className="focus-conf"><i className={`sq-pat sq-pat-${pattern}`} aria-hidden="true" />{level.toLowerCase()}</span>, {score} out of 100.
          </>
        ) : (
          <>This location has not been given a confidence score yet.</>
        )}
      </p>

      <div className="focus-about">
        <div>
          {market?.description ? <p>{market.description}</p> : null}
          {market?.highlights?.length ? (
            <ul>
              {market.highlights.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
          <p><Link className="cw-link" href="/map">See {record.name} on the map <ArrowRight size={15} /></Link></p>
        </div>
        {record.recommendation?.confidenceReason ? (
          <div>
            <h2>Why the confidence is {level.toLowerCase()}</h2>
            <p>{record.recommendation.confidenceReason}</p>
          </div>
        ) : null}
      </div>

      {market ? (
        <section className="focus-section">
          <div className="focus-section-head">
            <h2 className="cw-h3">
              {trend.length > 1 ? `Price per m², ${trend[0].year} to ${trend.at(-1).year}` : "Market facts"}
            </h2>
          </div>
          {trend.length > 1 ? (
            <p className="focus-note">
              Years up to {market.currentYear} are recorded or estimated prices. Years after {market.currentYear} are
              projections{growthText ? ` at about ${growthText} a year` : ""}, not recorded prices.
            </p>
          ) : null}
          <div className={trend.length > 1 ? "focus-price" : ""}>
            {trend.length > 1 ? (
              <div className="focus-trace">
                <PriceTrace points={trend} />
                <p className="focus-trace-key">
                  <span><i />Recorded and estimated</span>
                  <span><i className="projected" />Projected</span>
                </p>
              </div>
            ) : null}
            <FactList facts={facts} />
          </div>
          {trend.length > 1 ? <YearTable points={trend} /> : null}
        </section>
      ) : (
        <section className="focus-section">
          <div className="focus-section-head"><h2 className="cw-h3">Location facts</h2></div>
          <FactList facts={facts} />
        </section>
      )}

      {budgetItems.length ? (
        <section className="focus-section">
          <div className="focus-section-head">
            <h2 className="cw-h3">What a budget buys here and elsewhere</h2>
          </div>
          <p className="focus-note">
            Drag the slider. Each line shows how much land the budget buys at this year&rsquo;s estimated price per m².
            The dashed line marks one standard 648 m² plot.
          </p>
          <BudgetScale items={budgetItems} />
        </section>
      ) : null}

      {market?.estates?.length ? (
        <section className="focus-section">
          <div className="focus-section-head">
            <h2 className="cw-h3">Estates in {record.name}</h2>
            <span>{market.estates.length} tracked</span>
          </div>
          <div className="focus-table-wrap">
            <table className="focus-table focus-table-wide">
              <thead>
                <tr>
                  <th scope="col">Estate</th>
                  <th scope="col">{market.currentYear} estimate</th>
                  <th scope="col">Source price</th>
                  <th scope="col">Land</th>
                  <th scope="col">Use</th>
                  <th scope="col">Status</th>
                  <th scope="col">Plots</th>
                  <th scope="col">Developer</th>
                </tr>
              </thead>
              <tbody>
                {market.estates.map((estate) => (
                  <tr key={estate.id}>
                    <th scope="row">
                      <Link href={`/estates/${toEstateSlug(estate.id)}`}>{estate.name} <ArrowRight size={14} aria-hidden="true" /></Link>
                      {estate.location_label ? <small>{estate.location_label}</small> : null}
                    </th>
                    <td className="sq-fig">{perSqmLabel(estate.current_estimated_price_label || estate.current_price_label) || "Contact for pricing"}</td>
                    <td className="sq-fig">{perSqmLabel(estate.current_price_label) || "Contact for pricing"}</td>
                    <td className="sq-fig">{mappedLand(estate.total_land_label) || "Not mapped"}</td>
                    <td>{estate.primary_use || "Mixed use"}</td>
                    <td>{estate.status || "Unknown"}</td>
                    <td>{estate.available_plots || "—"}</td>
                    <td>{estate.developer || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="focus-section focus-split">
        <section>
          <div className="focus-section-head"><h2 className="cw-h3">What you can build</h2></div>
          {buildParameters.length ? (
            <div className="focus-table-wrap">
              <table className="focus-table">
                <thead>
                  <tr><th scope="col">Parameter</th><th scope="col">Allowed</th><th scope="col">Source</th></tr>
                </thead>
                <tbody>
                  {buildParameters.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                      <td><SourcePill type={row.sourceType} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="focus-empty">No planning parameters are recorded for {record.name} yet.</p>
          )}
        </section>
        <section>
          <div className="focus-section-head">
            <h2 className="cw-h3">Rules that apply</h2>
            {constraints.length ? <span>{constraints.length} {constraints.length === 1 ? "rule" : "rules"}</span> : null}
          </div>
          {constraints.length ? (
            <div className="focus-table-wrap">
              <table className="focus-table">
                <thead>
                  <tr><th scope="col">Rule</th><th scope="col">Source</th></tr>
                </thead>
                <tbody>
                  {constraints.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td><SourcePill type={row.sourceType} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="focus-empty">No planning rules are recorded for {record.name} yet.</p>
          )}
        </section>
      </div>

      <section className="focus-section">
        <div className="focus-section-head"><h2 className="cw-h3">Past planning approvals</h2></div>
        {approvals.length ? (
          <div className="focus-table-wrap">
            <table className="focus-table">
              <thead>
                <tr><th scope="col">Date</th><th scope="col">Request</th><th scope="col">Outcome</th></tr>
              </thead>
              <tbody>
                {approvals.map((row, index) => (
                  <tr key={`${row.date}-${index}`}>
                    <td className="sq-fig"><time>{formatDate(row.date)}</time></td>
                    <td>{row.request || row.projectType}</td>
                    <td><span className={`focus-outcome ${String(row.outcome).toLowerCase()}`}>{row.outcome || "No data"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="focus-empty">No approval decisions are recorded for {record.name} yet.</p>
        )}
      </section>

      <section className="focus-section">
        <div className="focus-section-head">
          <h2 className="cw-h3">Plots listed in {record.name}</h2>
          <Link className="cw-link" href={`/listings?location=${record.id}`}>
            {locationListings.length ? `See all ${locationListings.length}` : "See all listings"} <ArrowRight size={14} />
          </Link>
        </div>
        {locationListings.length ? (
          <div className="focus-plots">
            {locationListings.slice(0, 4).map((listing) => (
              <PlotCard listing={listing} scaleSqm={plotScale} href={`/listings?location=${listing.neighborhoodId}`} key={listing.id} />
            ))}
          </div>
        ) : (
          <p className="focus-empty">No plots are listed in {record.name} right now. Published listings will appear here when they are added.</p>
        )}
      </section>

      {notes.length ? (
        <section className="focus-section">
          <div className="focus-section-head"><h2 className="cw-h3">Team notes</h2></div>
          <ul className="focus-notes">
            {notes.map((note, index) => (
              <li key={`${note.date}-${index}`}>
                <p>{note.text}</p>
                <small>{note.author} · {formatDate(note.date)}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {resources.length ? (
        <section className="focus-section">
          <div className="focus-section-head">
            <h2 className="cw-h3">Research and documents</h2>
            <span>{resources.length} {resources.length === 1 ? "item" : "items"}</span>
          </div>
          <ResourceList resources={resources} />
        </section>
      ) : null}

      {market?.disclaimer ? <p className="focus-disclaimer">{market.disclaimer}</p> : null}
      {showsAreaPhotos ? (
        <p className="sq-photo-credit">Area views are stand-in photos from Wikimedia Commons, not photos of a specific plot or estate. {photoCredits}</p>
      ) : null}

      {editing && (
        <div className="focus-edit-card" role="dialog" aria-label="Edit intelligence">
          <div className="focus-edit-head">
            <h2>Edit intelligence</h2>
            <button className="cw-btn cw-btn-soft cw-btn-sm" type="button" onClick={() => setEditing(false)}>Close</button>
          </div>
          <form className="focus-edit-form" onSubmit={save}>
            <label className="cw-field">Recommendation headline<textarea className="cw-textarea" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} /></label>
            <label className="cw-field">Best next action<textarea className="cw-textarea" value={draft.bestNextAction} onChange={(e) => setDraft({ ...draft, bestNextAction: e.target.value })} /></label>
            <label className="cw-field">Confidence score<input className="cw-input" type="number" min="0" max="100" value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: e.target.value })} /></label>
            <label className="cw-field">Confidence reason<textarea className="cw-textarea" value={draft.confidenceReason} onChange={(e) => setDraft({ ...draft, confidenceReason: e.target.value })} /></label>
            <label className="cw-field">Risk level<select className="cw-select" value={draft.riskLevel} onChange={(e) => setDraft({ ...draft, riskLevel: e.target.value })}>{["Low", "Medium", "High", "Unknown"].map((risk) => <option key={risk}>{risk}</option>)}</select></label>
            <label className="cw-field">Reviewer<input className="cw-input" value={draft.reviewedBy} onChange={(e) => setDraft({ ...draft, reviewedBy: e.target.value })} /></label>
            <button className="cw-btn cw-btn-navy" type="submit"><Save size={16} /> Save changes</button>
          </form>
        </div>
      )}
    </div>
  );
}

function FactList({ facts }) {
  return (
    <dl className="focus-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Every year of the trend as a table, with the projected years grouped and named.
function YearTable({ points }) {
  const projectedCount = points.filter((point) => point.projected).length;
  const pastCount = points.length - projectedCount;
  return (
    <div className="focus-table-wrap focus-years-wrap">
      <table className="focus-years" style={{ minWidth: `${points.length * 64}px` }}>
        <caption>Price per m² by year</caption>
        <thead>
          <tr>
            {pastCount ? <th scope="colgroup" colSpan={pastCount}>Recorded and estimated</th> : null}
            {projectedCount ? <th scope="colgroup" colSpan={projectedCount} className="is-projected">Projected</th> : null}
          </tr>
          <tr>
            {points.map((point) => (
              <th scope="col" key={point.year} className={point.current ? "is-current" : ""}>{point.year}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {points.map((point) => (
              <td key={point.year} className={[point.projected ? "is-projected" : "", point.current ? "is-current" : ""].join(" ").trim()}>
                {point.label || point.value}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ResourceList({ resources }) {
  return (
    <ul className="focus-resources">
      {resources.map((resource) => (
        <li key={resource.id}>
          <div>
            <h3>{resource.title}</h3>
            {resource.summary ? <p>{resource.summary}</p> : null}
            <small>{resource.resourceType} · {resource.source} · {resource.author} · {formatDate(resource.createdAt)}</small>
          </div>
          {resource.url ? (
            <a className="cw-btn cw-btn-soft cw-btn-sm" href={resource.url} target="_blank" rel="noreferrer">
              <LinkIcon size={15} /> Open
            </a>
          ) : resource.fileName ? (
            <a className="cw-btn cw-btn-soft cw-btn-sm" href={`/api/resources/${resource.id}/file`} target="_blank" rel="noreferrer">
              <LinkIcon size={15} /> Open
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function toEstateSlug(id = "") {
  return String(id).replaceAll("_", "-");
}

// "₦1.2M/sqm est." -> "₦1.2M"
function perSqmAmount(label = "") {
  return String(label || "").replace(/\s*\/\s*sqm.*$/i, "");
}

// "₦1.2M/sqm est." -> "₦1.2M/m² est."
function perSqmLabel(label = "") {
  return String(label || "").replace(/\/\s*sqm/i, "/m²");
}

// "120,000 sqm" -> "120,000 m²"; nothing when the land is not mapped.
function mappedLand(label = "") {
  const text = String(label || "");
  if (!text || /not mapped/i.test(text)) return null;
  return text.replace(/\bsqm\b/i, "m²");
}

function toDraft(record) {
  return {
    headline: record.recommendation?.headline || "",
    bestNextAction: record.recommendation?.bestNextAction || "",
    confidence: record.recommendation?.confidence || 0,
    confidenceReason: record.recommendation?.confidenceReason || "",
    riskLevel: record.recommendation?.riskLevel || "Unknown",
    reviewedBy: record.metadata?.reviewedBy || "Admin"
  };
}
