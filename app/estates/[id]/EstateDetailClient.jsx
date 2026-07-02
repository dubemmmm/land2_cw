"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Calculator, Link as LinkIcon, TrendingUp } from "lucide-react";
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

  return (
    <div className="estate-detail-page">
      <header className="estate-hero">
        <div>
          <Link className="focus-back" href={`/locations/${estate.parentSlug}`}>
            <ArrowLeft size={15} /> Back to {estate.parentName}
          </Link>
          <span className="market-lga"><i />{estate.lga}</span>
          <h1>{estate.name}</h1>
          <p>{estate.description}</p>
          <div className="market-tags">
            {estate.highlights.map((item) => <span key={item}>{item}</span>)}
          </div>
        </div>
        <div className="estate-hero-metrics">
          <Metric label={`${currentYear} price/sqm`} value={estate.priceLabel} />
          <Metric label="Projected growth" value={estate.annualGrowthLabel} accent />
          <Metric label="Mapped land" value={estate.totalLandLabel} />
          <Metric label="Status" value={estate.status} />
        </div>
      </header>

      <section className="estate-workspace">
        <article className="estate-panel estate-projection-panel">
          <div className="estate-section-head">
            <div>
              <span><TrendingUp size={14} /> Projection model</span>
              <h2>Price projection</h2>
            </div>
            <strong>{formatMoney(selectedPoint?.value, estate.trendCurrency)} / sqm</strong>
          </div>
          {estate.trend?.length ? (
            <>
              <ProjectionChart points={estate.trend} selectedYear={Number(selectedYear)} currency={estate.trendCurrency} />
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

        <article className="estate-panel estate-calculator">
          <div className="estate-section-head">
            <div>
              <span><Calculator size={14} /> Investment model</span>
              <h2>Value calculator</h2>
            </div>
          </div>
          <label>
            Plot size
            <div>
              <input type="number" min="1" value={plotSize} onChange={(event) => setPlotSize(event.target.value)} />
              <span>sqm</span>
            </div>
          </label>
          <label>
            Holding period
            <div>
              <input type="number" min="0" max={maxYear - currentYear} value={holdingYears} onChange={(event) => setHoldingYears(event.target.value)} />
              <span>years</span>
            </div>
          </label>
          <div className="calculator-results">
            <Metric label="Estimated current value" value={formatMoney(calculator.currentValue, estate.trendCurrency)} />
            <Metric label={`Projected value ${calculator.targetYear}`} value={formatMoney(calculator.projectedValue, estate.trendCurrency)} accent />
            <Metric label="Projected gain" value={formatMoney(calculator.gain, estate.trendCurrency)} />
            <Metric label="Estimated ROI" value={`${Math.round(calculator.roi)}%`} />
          </div>
          <p>{estate.disclaimer}</p>
        </article>
      </section>

      <section className="estate-panel estate-facts-panel">
        <div className="estate-section-head">
          <div>
            <span>Estate data</span>
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
        <section className="estate-panel estate-research-panel">
          <div className="estate-section-head">
            <div>
              <span>Market research</span>
              <h2>Attached intelligence</h2>
            </div>
          </div>
          <ResourceList resources={resources} />
        </section>
      ) : null}

      <section className="estate-panel estate-comparison-panel">
        <div className="estate-section-head">
          <div>
            <span>Comparable estates</span>
            <h2>Comparison with other estates in {estate.parentName}</h2>
          </div>
        </div>
        {estate.comparisons.length ? (
          <div className="estate-comparison-list">
            {estate.comparisons.map((item) => (
              <Link href={`/estates/${item.slug}`} className="estate-comparison-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.primaryUse} · {item.status}</p>
                </div>
                <span>{item.priceLabel}</span>
                <span>{item.annualGrowthLabel}</span>
                <span>{item.landLabel}</span>
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
