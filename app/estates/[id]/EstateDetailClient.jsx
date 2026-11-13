"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Link as LinkIcon } from "lucide-react";
import { useMemo, useState } from "react";
import BudgetScale from "@/components/BudgetScale";
import PlotGlyph from "@/components/PlotGlyph";
import PriceTrace from "@/components/PriceTrace";
import { formatDate } from "@/lib/metrics";
import { areaPhoto, photoCredits } from "@/lib/photos";

const DEFAULT_CURRENT_YEAR = 2026;

export default function EstateDetailClient({ estate, resources = [], pricedLocations = [] }) {
  const currentYear = estate.currentYear || DEFAULT_CURRENT_YEAR;
  const years = estate.trend?.map((point) => point.year) || [currentYear];
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const [selectedYear, setSelectedYear] = useState(maxYear);
  const [plotSize, setPlotSize] = useState(600);
  const [holdingYears, setHoldingYears] = useState(5);
  const selectedPoint = estate.trend?.find((point) => point.year === Number(selectedYear));
  const currentPoint = estate.trend?.find((point) => point.current || point.year === currentYear);
  const calculator = useMemo(() => {
    const currentPrice = currentPoint?.value || estate.priceValue || 0;
    const targetYear = Math.min(maxYear, currentYear + Number(holdingYears || 0));
    const targetPoint = estate.trend?.find((point) => point.year === targetYear) || currentPoint;
    const sqm = Number(plotSize || 0);
    const currentValue = sqm * currentPrice;
    const projectedValue = sqm * (targetPoint?.value || currentPrice);
    const gain = projectedValue - currentValue;
    const roi = currentValue ? (gain / currentValue) * 100 : 0;
    return { currentValue, projectedValue, gain, roi, targetYear };
  }, [currentPoint, currentYear, estate.priceValue, estate.trend, holdingYears, maxYear, plotSize]);

  const trend = estate.trend || [];
  const hasTrend = trend.length > 1;
  const lead = areaPhoto(estate.parentSlug, 1920);
  const hasPrice = Number(estate.priceValue) > 0;
  const priceText = hasPrice ? String(estate.priceLabel || "").replace(/\s*\/\s*sqm.*$/i, "") : null;
  const growthText = estate.annualGrowthLabel && estate.annualGrowthLabel !== "N/A" ? estate.annualGrowthLabel.replace("~", "") : null;
  const landText = mappedLand(estate.totalLandLabel);
  const statusText = estate.status && estate.status !== "Unknown" ? estate.status.toLowerCase() : null;
  const selectedKind = Number(selectedYear) < currentYear
    ? "Recorded or estimated price"
    : Number(selectedYear) === currentYear ? `This year's estimate` : "Projection, not a recorded price";
  const budgetItems = hasPrice && estate.trendCurrency !== "USD" && pricedLocations.length
    ? [...pricedLocations, { id: `estate-${estate.slug}`, name: `${estate.name} · here`, href: `/estates/${estate.slug}`, priceValue: estate.priceValue }]
    : [];
  const facts = [
    { label: "Primary use", value: estate.primaryUse },
    { label: "Status", value: estate.status },
    { label: "Developer", value: estate.developer },
    { label: "Available plots", value: estate.availablePlots },
    { label: "Mapped land", value: landText || "Not mapped" },
    { label: "Neighbourhood", value: <Link className="focus-fact-link" href={`/locations/${estate.parentSlug}`}>{estate.parentName}</Link> },
    estate.lga && estate.lga !== estate.parentName ? { label: "Local government", value: estate.lga } : null,
    { label: `${estate.sourcePriceYear} source price`, value: String(estate.sourcePriceLabel || "N/A").replace(/\/\s*sqm/i, "/m²") }
  ].filter((fact) => fact && fact.value);

  return (
    <div className="focus-page">
      <header className="cw-pagehead focus-head">
        <div className="focus-head-main">
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/map">Map</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/locations/${estate.parentSlug}`}>{estate.parentName}</Link>
            <span aria-hidden="true">/</span>
            <span>{estate.name}</span>
          </nav>
          <h1 className="cw-pagehead-title">{estate.name}</h1>
          <p className="cw-lede">{estate.description}</p>
        </div>
        <div className="focus-head-actions">
          <Link className="cw-btn cw-btn-outline cw-btn-sm" href={`/locations/${estate.parentSlug}`}>
            <ArrowLeft size={15} /> Back to {estate.parentName}
          </Link>
        </div>
      </header>

      {lead ? (
        <figure className="focus-photo">
          <img src={lead.src} alt={`Aerial view of ${lead.place}`} />
          <figcaption>Area view · {lead.place}, not the estate itself</figcaption>
        </figure>
      ) : null}

      <p className="focus-statement">
        {hasPrice ? (
          <>
            Land in {estate.name} is estimated at <b className="sq-fig">{priceText} per m²</b> in {currentYear}
            {growthText ? <>, rising by about {growthText} a year</> : null}.{" "}
          </>
        ) : (
          <>We do not have a price per m² for {estate.name} yet.{" "}</>
        )}
        {landText || statusText ? (
          <>
            The estate {landText ? <>covers {landText} of mapped land in {estate.parentName}</> : <>is in {estate.parentName}</>}
            {statusText ? <> and is recorded as {statusText}</> : null}.
          </>
        ) : null}
      </p>

      <section className="focus-section">
        <div className="focus-section-head">
          <h2 className="cw-h3">{hasTrend ? `Price per m², ${minYear} to ${maxYear}` : "Estate facts"}</h2>
        </div>
        {hasTrend ? (
          <p className="focus-note">
            Years up to {currentYear} are recorded or estimated prices. Years after {currentYear} are
            projections{growthText ? ` at about ${growthText} a year` : ""}, not recorded prices.
          </p>
        ) : (
          <p className="focus-note">No numeric price baseline is available yet, so there is no price history or projection for this estate.</p>
        )}
        <div className={hasTrend ? "focus-price" : ""}>
          {hasTrend ? (
            <div>
              <div className="focus-trace">
                <PriceTrace points={trend} />
                <p className="focus-trace-key">
                  <span><i />Recorded and estimated</span>
                  <span><i className="projected" />Projected</span>
                </p>
              </div>
              <div className="estate-year">
                <p className="estate-year-readout">
                  <b className="sq-fig">{selectedYear}: {formatMoney(selectedPoint?.value, estate.trendCurrency)} per m²</b>
                  <span>{selectedKind}</span>
                </p>
                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  step="1"
                  value={selectedYear}
                  aria-label="Projection year"
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                />
                <p className="estate-year-ends sq-fig"><span>{minYear}</span><span>{maxYear}</span></p>
              </div>
            </div>
          ) : null}
          <FactList facts={facts} />
        </div>
        {hasTrend ? <YearTable points={trend} selectedYear={Number(selectedYear)} /> : null}
      </section>

      <section className="focus-section">
        <div className="focus-section-head">
          <h2 className="cw-h3">What a plot here could be worth</h2>
        </div>
        <div className="estate-calc">
          <div className="estate-calc-inputs">
            <label className="cw-field">
              Plot size
              <div className="estate-calc-input">
                <input className="cw-input" type="number" min="1" value={plotSize} onChange={(event) => setPlotSize(event.target.value)} />
                <span>m²</span>
              </div>
            </label>
            <label className="cw-field">
              Holding period
              <div className="estate-calc-input">
                <input className="cw-input" type="number" min="0" max={maxYear - currentYear} value={holdingYears} onChange={(event) => setHoldingYears(event.target.value)} />
                <span>years</span>
              </div>
            </label>
            <PlotGlyph className="estate-calc-plot" sqm={Number(plotSize) || 0} />
          </div>
          <dl className="estate-calc-results">
            <div>
              <dt>Estimated value today</dt>
              <dd className="sq-fig">{formatMoney(calculator.currentValue, estate.trendCurrency)}</dd>
            </div>
            <div className="is-key">
              <dt>Projected value in {calculator.targetYear}</dt>
              <dd className="sq-fig">{formatMoney(calculator.projectedValue, estate.trendCurrency)}</dd>
            </div>
            <div>
              <dt>Projected gain</dt>
              <dd className="sq-fig">{formatMoney(calculator.gain, estate.trendCurrency)}</dd>
            </div>
            <div>
              <dt>Return over the period</dt>
              <dd className="sq-fig">{Math.round(calculator.roi)}%</dd>
            </div>
          </dl>
        </div>
        {estate.disclaimer ? <p className="focus-disclaimer">{estate.disclaimer}</p> : null}
      </section>

      {budgetItems.length ? (
        <section className="focus-section">
          <div className="focus-section-head">
            <h2 className="cw-h3">What a budget buys here and elsewhere</h2>
          </div>
          <p className="focus-note">
            Pick an amount. Each square is the land it buys at this year&rsquo;s estimated price per m² in this estate
            and in each neighbourhood we track, drawn at one scale beside a standard 648 m² plot.
          </p>
          <BudgetScale items={budgetItems} />
        </section>
      ) : null}

      <section className="focus-section">
        <div className="focus-section-head">
          <h2 className="cw-h3">Other estates in {estate.parentName}</h2>
          {estate.comparisons.length ? <span>{estate.comparisons.length} tracked</span> : null}
        </div>
        {estate.comparisons.length ? (
          <div className="focus-table-wrap">
            <table className="focus-table focus-table-mid">
              <thead>
                <tr>
                  <th scope="col">Estate</th>
                  <th scope="col">Price per m²</th>
                  <th scope="col">Growth per year</th>
                  <th scope="col">Land</th>
                  <th scope="col">Use</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {estate.comparisons.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <Link href={`/estates/${item.slug}`}>{item.name} <ArrowRight size={14} aria-hidden="true" /></Link>
                    </th>
                    <td className="sq-fig">{String(item.priceLabel || "").replace(/\/\s*sqm/i, "/m²")}</td>
                    <td className="sq-fig">{item.annualGrowthLabel === "N/A" ? "—" : item.annualGrowthLabel}</td>
                    <td className="sq-fig">{mappedLand(item.landLabel) || "Not mapped"}</td>
                    <td>{item.primaryUse}</td>
                    <td>{item.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="focus-empty">No other estates are mapped in {estate.parentName} yet.</p>
        )}
      </section>

      {resources.length ? (
        <section className="focus-section">
          <div className="focus-section-head">
            <h2 className="cw-h3">Research and documents</h2>
            <span>{resources.length} {resources.length === 1 ? "item" : "items"}</span>
          </div>
          <ResourceList resources={resources} />
        </section>
      ) : null}

      {lead ? (
        <p className="sq-photo-credit">Area views are stand-in photos from Wikimedia Commons, not photos of this estate. {photoCredits}</p>
      ) : null}
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
function YearTable({ points, selectedYear }) {
  const projectedCount = points.filter((point) => point.projected).length;
  const pastCount = points.length - projectedCount;
  const cellClass = (point) => [
    point.projected ? "is-projected" : "",
    point.current ? "is-current" : "",
    point.year === selectedYear ? "is-selected" : ""
  ].join(" ").trim();
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
              <td key={point.year} className={cellClass(point)}>{point.label || point.value}</td>
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

// "120,000 sqm" -> "120,000 m²"; nothing when the land is not mapped.
function mappedLand(label = "") {
  const text = String(label || "");
  if (!text || /not mapped/i.test(text)) return null;
  return text.replace(/\bsqm\b/i, "m²");
}

function formatMoney(value, currency = "NGN", compact = false) {
  if (!Number.isFinite(Number(value))) return "N/A";
  const amount = Number(value);
  if (currency === "USD") {
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(amount >= 10000000000 ? 0 : 1)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1)}M`;
    if (compact && amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)}`;
  }
  if (amount >= 1000000000) return `₦${(amount / 1000000000).toFixed(amount >= 10000000000 ? 0 : 1)}B`;
  if (compact || amount >= 1000000) return `₦${(amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1)}M`;
  if (amount >= 1000) return `₦${Math.round(amount / 1000)}K`;
  return `₦${Math.round(amount)}`;
}
