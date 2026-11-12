"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Link as LinkIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/metrics";

const DEFAULT_CURRENT_YEAR = 2026;

export default function EstateDetailClient({ estate, resources = [] }) {
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

  const sectionNumber = (index) => String(index).padStart(2, "0");
  const comparisonNumber = sectionNumber(resources.length ? 5 : 4);

  return (
    <div className="estate-detail-page">
      <header className="cw-pagehead estate-head">
        <div className="estate-head-main">
          <nav className="cw-crumbs" aria-label="Breadcrumb">
            <Link href="/map">Map</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/locations/${estate.parentSlug}`}>{estate.parentName}</Link>
            <span aria-hidden="true">/</span>
            <span>{estate.name}</span>
          </nav>
          <h1 className="cw-pagehead-title">{estate.name}</h1>
          <p className="cw-lede">{estate.description}</p>
          <div className="market-tags">
            <span className="cw-chip market-lga"><i className="cw-dot" />{estate.lga}</span>
            {estate.status ? <span className="cw-chip cw-chip-navy">{estate.status}</span> : null}
            {estate.highlights.map((item) => <span className="cw-chip" key={item}>{item}</span>)}
          </div>
        </div>
        <div className="estate-head-actions">
          <Link className="cw-btn cw-btn-outline cw-btn-sm" href={`/locations/${estate.parentSlug}`}>
            <ArrowLeft size={15} /> Back to {estate.parentName}
          </Link>
        </div>
      </header>

      <section className="cw-card estate-hero-metrics" aria-label="Key metrics">
        <Metric label={`${currentYear} price/sqm`} value={estate.priceLabel} />
        <Metric label="Projected growth" value={estate.annualGrowthLabel} accent />
        <Metric label="Mapped land" value={estate.totalLandLabel} />
        <Metric label="Status" value={estate.status} />
      </section>

      <section className="estate-workspace">
        <article className="cw-card estate-panel estate-projection-panel">
          <div className="estate-section-head">
            <div>
              <p className="cw-label"><b>{sectionNumber(1)}</b>Projection model</p>
              <h2>Price projection</h2>
            </div>
            <strong>{formatMoney(selectedPoint?.value, estate.trendCurrency)} <small>/ sqm</small></strong>
          </div>
          {estate.trend?.length ? (
            <>
              <div className="estate-chart-scroll">
                <ProjectionChart points={estate.trend} selectedYear={Number(selectedYear)} currency={estate.trendCurrency} />
              </div>
              <div className="projection-slider">
                <div>
                  <span>{minYear}</span>
                  <b>{selectedYear}</b>
                  <span>{maxYear}</span>
                </div>
                <input
                  type="range"
                  min={minYear}
                  max={maxYear}
                  step="1"
                  value={selectedYear}
                  aria-label="Projection year"
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                />
                <p>
                  {Number(selectedYear) < currentYear ? "Historical estimate" : Number(selectedYear) === currentYear ? `Current ${currentYear} market baseline` : "Forward projection"}
                  {" "}based on available land bible pricing.
                </p>
              </div>
            </>
          ) : (
            <p className="estate-empty">No numeric price baseline is available yet for projections.</p>
          )}
        </article>

        <article className="cw-card estate-panel estate-calculator">
          <div className="estate-section-head">
            <div>
              <p className="cw-label"><b>{sectionNumber(2)}</b>Investment model</p>
              <h2>Value calculator</h2>
            </div>
          </div>
          <label className="cw-field">
            Plot size
            <div className="estate-calc-input">
              <input className="cw-input" type="number" min="1" value={plotSize} onChange={(event) => setPlotSize(event.target.value)} />
              <span>sqm</span>
            </div>
          </label>
          <label className="cw-field">
            Holding period
            <div className="estate-calc-input">
              <input className="cw-input" type="number" min="0" max={maxYear - currentYear} value={holdingYears} onChange={(event) => setHoldingYears(event.target.value)} />
              <span>years</span>
            </div>
          </label>
          <div className="calculator-results">
            <Metric label="Estimated current value" value={formatMoney(calculator.currentValue, estate.trendCurrency)} />
            <Metric label={`Projected value ${calculator.targetYear}`} value={formatMoney(calculator.projectedValue, estate.trendCurrency)} accent />
            <Metric label="Projected gain" value={formatMoney(calculator.gain, estate.trendCurrency)} />
            <Metric label="Estimated ROI" value={`${Math.round(calculator.roi)}%`} />
          </div>
          <p className="estate-disclaimer">{estate.disclaimer}</p>
        </article>
      </section>

      <section className="cw-card estate-panel estate-facts-panel">
        <div className="estate-section-head">
          <div>
            <p className="cw-label"><b>{sectionNumber(3)}</b>Estate data</p>
            <h2>Development profile</h2>
          </div>
        </div>
        <div className="estate-fact-grid">
          <Metric label="Primary use" value={estate.primaryUse} />
          <Metric label="Developer" value={estate.developer} />
          <Metric label="Available plots" value={estate.availablePlots} />
          <Metric label="Parent market" value={estate.parentName} />
          <Metric label={`${estate.sourcePriceYear} source price`} value={estate.sourcePriceLabel} />
        </div>
      </section>

      {resources.length ? (
        <section className="cw-card estate-panel estate-research-panel">
          <div className="estate-section-head">
            <div>
              <p className="cw-label"><b>{sectionNumber(4)}</b>Market research</p>
              <h2>Attached intelligence</h2>
            </div>
          </div>
          <ResourceList resources={resources} />
        </section>
      ) : null}

      <section className="cw-card estate-panel estate-comparison-panel">
        <div className="estate-section-head">
          <div>
            <p className="cw-label"><b>{comparisonNumber}</b>Comparable estates</p>
            <h2>Comparison with other estates in {estate.parentName}</h2>
          </div>
        </div>
        {estate.comparisons.length ? (
          <div className="estate-comparison-list">
            <div className="estate-comparison-header" aria-hidden="true">
              <span>Estate</span>
              <span>Price</span>
              <span>Growth</span>
              <span>Land</span>
              <span />
            </div>
            {estate.comparisons.map((item) => (
              <Link href={`/estates/${item.slug}`} className="estate-comparison-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.primaryUse} · {item.status}</p>
                </div>
                <span data-label="Price">{item.priceLabel}</span>
                <span data-label="Growth">{item.annualGrowthLabel}</span>
                <span data-label="Land">{item.landLabel}</span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="estate-empty">No comparable estate records are mapped in this neighborhood yet.</p>
        )}
      </section>
    </div>
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
            <a className="cw-btn cw-btn-soft cw-btn-sm" href={resource.url} target="_blank" rel="noreferrer">
              <LinkIcon size={15} /> Open
            </a>
          ) : resource.fileName ? (
            <a className="cw-btn cw-btn-soft cw-btn-sm" href={`/api/resources/${resource.id}/file`} target="_blank" rel="noreferrer">
              <LinkIcon size={15} /> Open
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Metric({ label, value, accent = false }) {
  return (
    <article className="estate-metric">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value || "N/A"}</strong>
    </article>
  );
}

function ProjectionChart({ points, selectedYear, currency }) {
  const width = 760;
  const height = 190;
  const pad = { top: 18, right: 20, bottom: 28, left: 66 };
  const values = points.map((point) => point.value);
  const min = Math.min(...values) * 0.9;
  const max = Math.max(...values) * 1.08;
  const x = (index) => pad.left + (index * (width - pad.left - pad.right)) / (points.length - 1);
  const y = (value) => pad.top + ((max - value) * (height - pad.top - pad.bottom)) / (max - min || 1);
  const path = points.map((point, index) => `${index ? "L" : "M"} ${x(index)} ${y(point.value)}`).join(" ");
  const selectedIndex = Math.max(0, points.findIndex((point) => point.year === selectedYear));
  const selected = points[selectedIndex] || points[0];
  const ticks = [min, min + (max - min) / 2, max].reverse();

  return (
    <svg className="estate-projection-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Estate price projection chart">
      {ticks.map((tick) => (
        <g key={tick}>
          <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
          <text x={pad.left - 10} y={y(tick) + 4} textAnchor="end">{formatMoney(tick, currency, true)}</text>
        </g>
      ))}
      <path d={path} />
      {points.map((point, index) => (
        <circle key={point.year} className={point.projected ? "projected" : ""} cx={x(index)} cy={y(point.value)} r={point.year === selectedYear ? 6 : 3} />
      ))}
      <line className="selected" x1={x(selectedIndex)} x2={x(selectedIndex)} y1={pad.top} y2={height - pad.bottom} />
      <text className="selected" x={x(selectedIndex)} y={height - 8} textAnchor="middle">{selected.year}</text>
    </svg>
  );
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
