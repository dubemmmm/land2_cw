"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Database, ExternalLink, FileText, Link as LinkIcon, Pencil, Save, Share2 } from "lucide-react";
import { useState } from "react";
import { SourcePill, StatusPill } from "@/components/Pills";
import { confidenceColor, confidenceLevel, confidenceScore, formatDate, initials } from "@/lib/metrics";

export default function LocationDetailClient({ neighborhood, neighborhoods = [], market, resources = [], locationListings = [], isAdmin = false }) {
  const [record, setRecord] = useState(neighborhood);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(toDraft(neighborhood));
  const router = useRouter();
  const score = confidenceScore(record);
  const level = confidenceLevel(score);
  const tone = confidenceColor(score);
  const tags = [
    record.intelligence?.buildParameters?.[0]?.value,
    record.jurisdiction?.split("/").pop()?.trim(),
    shortSignal(record.intelligence?.redFlags?.[0])
  ].filter(Boolean);

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

  return (
    <div className="focus-page">
      <header className="focus-topbar">
        <div className="focus-titlebar">
          <Link className="focus-back" href="/map"><ArrowLeft size={15} /> Back to map</Link>
          <span className="focus-divider" />
          <select className="focus-location-select" value={record.id} onChange={(event) => switchLocation(event.target.value)} aria-label="Switch location">
            {(neighborhoods.length ? neighborhoods : [record]).map((item) => (
              <option value={item.id} key={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div className="focus-actions">
          <button className="focus-icon-btn" type="button" onClick={shareLocation} aria-label="Copy location link"><Share2 size={16} /></button>
          {isAdmin ? (
            <>
              <button className="focus-icon-btn" type="button" onClick={() => setEditing(true)} aria-label="Quick edit intelligence"><Pencil size={16} /></button>
              <Link className="focus-icon-btn" href="/data" aria-label="Open full data admin"><Database size={16} /></Link>
            </>
          ) : null}
          <Link className="focus-report-btn" href={`/reports?report=land-${record.id}`}><FileText size={15} /> Open report</Link>
        </div>
      </header>

      <section className="focus-grid">
        <aside className="focus-left">
          <article className="focus-hero-panel">
            <div className="focus-score-chip">
              <i style={{ background: tone }} />
              <span>{score}</span>
              <em>{level}</em>
            </div>
            <div>
              <span>Satellite / aerial</span>
              <h1>{record.name}</h1>
              <p>{record.recommendation?.summary}</p>
            </div>
          </article>

          <div className="focus-tags">
            {tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>

          <article className="focus-confidence-card">
            <div className="focus-ring" style={{ "--score": score, "--tone": tone }}>
              <span>{score}</span>
            </div>
            <div>
              <span className="focus-eyebrow">Development confidence</span>
              <h2 style={{ color: tone }}>{level} <small>{score} / 100</small></h2>
              <p>{record.recommendation?.confidenceReason}</p>
              <footer>Last reviewed {formatDate(record.metadata?.lastReviewed)} · {record.metadata?.reviewedBy}</footer>
            </div>
          </article>

          <article className="focus-mini-map">
            <svg viewBox="0 0 520 220" role="img" aria-label={`${record.name} context map`}>
              <g className="focus-map-grid">
                <path d="M0 86H520M0 166H520M102 0L120 220M300 0L318 220" />
              </g>
              <polygon className="focus-map-poly medium" points="36,86 68,36 176,28 208,82 174,132 76,142" />
              <polygon className="focus-map-poly active" points="236,102 360,94 402,146 372,190 250,202 216,142" style={{ "--tone": tone }} />
              <polygon className="focus-map-poly low" points="416,62 518,54 560,106 518,168 420,178 382,116" />
              <circle cx="304" cy="138" r="8" className="focus-map-dot" style={{ "--tone": tone }} />
            </svg>
            <Link className="focus-map-link" href="/map"><ExternalLink size={14} /> View on map</Link>
          </article>
        </aside>

        <main className="focus-brief">
          {market ? <MarketSection market={market} /> : null}

          <section className="focus-section">
            <SectionHeading title="What you can build" />
            <div className="focus-build-grid">
              {(record.intelligence?.buildParameters || []).map((row) => (
                <article className="focus-build-item" key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  <SourcePill type={row.sourceType} />
                </article>
              ))}
            </div>
          </section>

          <section className="focus-section">
            <SectionHeading title="Regulations" meta={`${record.intelligence?.constraints?.length || 0} rules`} />
            <div className="focus-rule-list">
              {(record.intelligence?.constraints || []).map((row) => (
                <div className="focus-rule-row" key={row.label}>
                  <p>{row.label}</p>
                  <SourcePill type={row.sourceType} />
                </div>
              ))}
            </div>
          </section>

          <section className="focus-section">
            <SectionHeading title="Approval history" />
            <div className="focus-timeline">
              {(record.approvals || []).map((row, index) => (
                <article className="focus-history-row" key={`${row.date}-${index}`}>
                  <i className={String(row.outcome).toLowerCase()} />
                  <div>
                    <time>{formatDate(row.date)}</time>
                    <p>{row.request || row.projectType}</p>
                  </div>
                  <StatusPill status={row.outcome} />
                </article>
              ))}
            </div>
          </section>

          <section className="focus-section">
            <SectionHeading
              title={`Land listings in ${record.name}`}
              meta={`${locationListings.length} listings`}
              action={<Link href={`/listings?location=${record.id}`}>View all listings <ArrowRight size={14} /></Link>}
            />
            {locationListings.length ? (
              <div className="focus-listing-grid">
                {locationListings.slice(0, 4).map((listing) => <LocationListingCard listing={listing} key={listing.id} />)}
              </div>
            ) : (
              <div className="focus-listing-empty">
                <strong>No active listings yet</strong>
                <p>Published land listings for {record.name} will appear here when they are added.</p>
              </div>
            )}
          </section>

          <section className="focus-section">
            <SectionHeading title="Team notes" />
            <div className="focus-note-list">
              {(record.notes || []).map((note, index) => (
                <article className="focus-note-row" key={`${note.date}-${index}`}>
                  <span>{initials(note.author)}</span>
                  <div>
                    <p>{note.text}</p>
                    <small>{note.author} · {formatDate(note.date)}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {resources.length ? (
            <section className="focus-section">
              <SectionHeading title="Market research" meta={`${resources.length} resources`} />
              <ResourceList resources={resources} />
            </section>
          ) : null}
        </main>
      </section>

      {editing && (
        <div className="focus-edit-card">
          <div className="section-title">
            <h2>Edit intelligence</h2>
            <button className="btn" type="button" onClick={() => setEditing(false)}>Close</button>
          </div>
          <form className="admin-form" onSubmit={save}>
            <label>Recommendation headline<textarea value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} /></label>
            <label>Best next action<textarea value={draft.bestNextAction} onChange={(e) => setDraft({ ...draft, bestNextAction: e.target.value })} /></label>
            <label>Confidence score<input type="number" min="0" max="100" value={draft.confidence} onChange={(e) => setDraft({ ...draft, confidence: e.target.value })} /></label>
            <label>Confidence reason<textarea value={draft.confidenceReason} onChange={(e) => setDraft({ ...draft, confidenceReason: e.target.value })} /></label>
            <label>Risk level<select value={draft.riskLevel} onChange={(e) => setDraft({ ...draft, riskLevel: e.target.value })}>{["Low", "Medium", "High", "Unknown"].map((risk) => <option key={risk}>{risk}</option>)}</select></label>
            <label>Reviewer<input value={draft.reviewedBy} onChange={(e) => setDraft({ ...draft, reviewedBy: e.target.value })} /></label>
            <button className="btn primary" type="submit"><Save size={16} /> Save changes</button>
          </form>
        </div>
      )}
    </div>
  );
}

function LocationListingCard({ listing }) {
  return (
    <Link className="focus-listing-card" href={`/listings?location=${listing.neighborhoodId}`}>
      <div className="focus-listing-media">
        {listing.photos?.[0] ? <img src={listing.photos[0]} alt="" /> : null}
        <span className={`listing-status ${statusClass(listing.listingStatus)}`}>{listing.listingStatus}</span>
        <b>{formatListingPrice(listing.askingPrice)}</b>
      </div>
      <div className="focus-listing-body">
        <h3>{listing.title}</h3>
        <p>{formatNumber(listing.sizeSqm)} sqm · {listing.landUse}</p>
        <p>{listing.estate || listing.neighborhoodName}</p>
        <span className={`title-badge ${titleClass(listing.titleDocument)}`}><i />{listing.titleDocument}</span>
      </div>
    </Link>
  );
}

function ResourceList({ resources }) {
  return (
    <div className="intelligence-resource-list">
      {resources.map((resource) => (
        <article className="intelligence-resource-card" key={resource.id}>
          <div>
            <span>{resource.resourceType} · {resource.source}</span>
            <h3>{resource.title}</h3>
            {resource.summary ? <p>{resource.summary}</p> : null}
            <small>{resource.author} · {formatDate(resource.createdAt)}</small>
          </div>
          {resource.url ? (
            <a href={resource.url} target="_blank" rel="noreferrer">
              <LinkIcon size={15} /> Open
            </a>
          ) : resource.fileName ? (
            <a href={`/api/resources/${resource.id}/file`} target="_blank" rel="noreferrer">
              <LinkIcon size={15} /> Open
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function MarketSection({ market }) {
  const primaryMetric = market.kind === "estate" ? `${market.currentYear} estate price/sqm` : `${market.currentYear} avg price/sqm`;
  const estatesLabel = market.estateSummary.total
    ? `${market.estateSummary.developing} developing · ${market.estateSummary.built} built`
    : "No estates mapped";
  const firstYear = market.trend?.[0]?.year;
  const lastYear = market.trend?.at(-1)?.year;

  return (
    <section className="focus-section market-section">
      <SectionHeading title="Market intelligence" meta={market.asOfLabel || market.meta?.pricing_date} />
      <div className="market-overview">
        <div>
          <span className="market-lga"><i />{market.lga}</span>
          <h3>{market.name}</h3>
          <p>{market.description}</p>
          {market.highlights?.length ? (
            <div className="market-tags">
              {market.highlights.slice(0, 4).map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : null}
        </div>
        <div className="market-metrics">
          <MetricCard label={primaryMetric} value={market.priceLabel} />
          <MetricCard label="Est. annual growth" value={market.annualGrowthLabel} accent />
          <MetricCard label="Estates" value={market.estateSummary.total || "N/A"} sub={estatesLabel} />
          <MetricCard label="Total land mapped" value={market.totalLandLabel} />
        </div>
      </div>

      {market.trend?.length ? (
        <div className="market-chart-card">
          <div className="market-chart-head">
            <div>
              <h3>Price Trend - {market.name}</h3>
              <p>Estimated average price per sqm from {firstYear} to {lastYear}. Dashed line is projected after {market.currentYear}.</p>
            </div>
            <div className="market-legend">
              <span><i />Historical</span>
              <span><i className="projected" />Projected</span>
            </div>
          </div>
          <PriceTrendChart points={market.trend} currency={market.trendCurrency} />
        </div>
      ) : null}

      {market.estates?.length ? (
        <div className="estate-section">
          <div className="market-chart-head">
            <div>
              <h3>Estate intelligence</h3>
              <p>Estate-level pricing, land mapped, use, status, and available plot details.</p>
            </div>
          </div>
          <div className="estate-grid">
            {market.estates.map((estate) => <EstateCard estate={estate} key={estate.id} />)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ label, value, sub, accent = false }) {
  return (
    <article className="market-metric-card">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
      {sub ? <p>{sub}</p> : null}
    </article>
  );
}

function EstateCard({ estate }) {
  return (
    <Link className="estate-card estate-card-link" href={`/estates/${toEstateSlug(estate.id)}`}>
      <div>
        <span>{estate.location_label}</span>
        <h4>{estate.name}<ArrowRight size={15} /></h4>
      </div>
      <dl>
        <div><dt>Price</dt><dd>{estate.current_price_label || "Contact for pricing"}</dd></div>
        <div><dt>2026 est.</dt><dd>{estate.current_estimated_price_label || estate.current_price_label || "Contact for pricing"}</dd></div>
        <div><dt>Land</dt><dd>{estate.total_land_label || "Not mapped"}</dd></div>
        <div><dt>Use</dt><dd>{estate.primary_use || "Mixed use"}</dd></div>
        <div><dt>Status</dt><dd>{estate.status || "Unknown"}</dd></div>
        {estate.available_plots ? <div><dt>Plots</dt><dd>{estate.available_plots}</dd></div> : null}
        {estate.developer ? <div><dt>Developer</dt><dd>{estate.developer}</dd></div> : null}
      </dl>
    </Link>
  );
}

function toEstateSlug(id = "") {
  return String(id).replaceAll("_", "-");
}

function PriceTrendChart({ points, currency = "NGN" }) {
  const width = 780;
  const height = 260;
  const pad = { top: 24, right: 28, bottom: 36, left: 72 };
  const values = points.map((point) => point.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.08;
  const x = (index) => pad.left + (index * (width - pad.left - pad.right)) / (points.length - 1);
  const y = (value) => pad.top + ((max - value) * (height - pad.top - pad.bottom)) / (max - min || 1);
  const historical = points.filter((point) => !point.projected);
  const currentIndex = Math.max(0, points.findIndex((point) => point.current));
  const currentYear = points[currentIndex]?.year;
  const projected = points.filter((point) => point.year >= currentYear);
  const toPath = (series) => series.map((point, index) => `${index ? "L" : "M"} ${x(points.findIndex((item) => item.year === point.year))} ${y(point.value)}`).join(" ");
  const ticks = [min, min + (max - min) / 3, min + (max - min) * 2 / 3, max].reverse();

  return (
    <svg className="market-price-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Price trend chart">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
          <text x={pad.left - 12} y={y(tick) + 4} textAnchor="end">{formatCompactPrice(tick, currency)}</text>
        </g>
      ))}
      <line className="market-now-line" x1={x(currentIndex)} x2={x(currentIndex)} y1={pad.top} y2={height - pad.bottom} />
      <text className="market-now-text" x={x(currentIndex)} y={pad.top - 5} textAnchor="middle">NOW</text>
      <path className="market-historical-line" d={toPath(historical)} />
      <path className="market-projected-line" d={toPath(projected)} />
      {points.map((point, index) => (
        <g key={point.year}>
          <circle className={point.projected ? "projected" : ""} cx={x(index)} cy={y(point.value)} r={point.current ? 7 : 4} />
          <text className={point.current ? "current" : ""} x={x(index)} y={height - 10} textAnchor="middle">{point.year}</text>
        </g>
      ))}
    </svg>
  );
}

function formatCompactPrice(value, currency = "NGN") {
  if (!value) return "";
  if (currency === "USD") return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
  if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `₦${Math.round(value / 1000)}K`;
  return `${Math.round(value)}`;
}

function SectionHeading({ title, meta, action }) {
  return (
    <div className="focus-section-head">
      <h2><i />{title}</h2>
      <div className="focus-section-actions">
        {meta ? <span>{meta}</span> : null}
        {action || null}
      </div>
    </div>
  );
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

function shortSignal(value = "") {
  const text = String(value);
  if (/drain/i.test(text)) return "Drainage review";
  if (/height/i.test(text)) return "Height sensitivity";
  if (/commercial/i.test(text)) return "Commercial control";
  return text.split(/\s+/).slice(0, 2).join(" ");
}

function formatListingPrice(value) {
  const price = Number(value) || 0;
  if (!price) return "Price not set";
  if (price >= 1000000000) return `₦${Number((price / 1000000000).toFixed(1))}B`;
  return `₦${Math.round(price / 1000000)}M`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value) || 0));
}

function statusClass(status) {
  return String(status || "").toLowerCase().replace(/\s+/g, "-");
}

function titleClass(titleDocument) {
  if (/consent/i.test(titleDocument)) return "consent";
  if (/excision/i.test(titleDocument)) return "excision";
  if (/gazette/i.test(titleDocument)) return "gazette";
  return "cofo";
}
