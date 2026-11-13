"use client";

import Link from "next/link";
import { useState } from "react";
import { STANDARD_PLOT, formatNaira, formatSqm } from "@/lib/plot";

const BUDGETS = [50e6, 100e6, 250e6, 500e6, 1e9];

// "What ₦X buys": for one budget, the land it buys in each location,
// every square drawn at the same scale.
export default function BudgetScale({ items, initial = 500e6, maxPx = 220 }) {
  const [budget, setBudget] = useState(initial);
  const rows = items
    .filter((item) => Number(item.priceValue) > 0)
    .map((item) => {
      const sqm = budget / item.priceValue;
      return { ...item, sqm, side: Math.sqrt(sqm) };
    })
    .sort((a, b) => a.sqm - b.sqm);
  if (!rows.length) return null;

  // The standard plot (18 m by 36 m) is always drawn, so it always fits.
  const largest = Math.max(STANDARD_PLOT.depth, ...rows.map((row) => row.side));
  const pxPerM = maxPx / largest;
  const barMetres = [50, 20, 10, 5, 2, 1].find((m) => m * pxPerM <= 72) || 1;

  return (
    <div className="sq-budget">
      <div className="sq-budget-head">
        <div className="cw-tabs" role="group" aria-label="Budget">
          {BUDGETS.map((value) => (
            <button
              key={value}
              type="button"
              className={value === budget ? "active" : ""}
              aria-pressed={value === budget}
              onClick={() => setBudget(value)}
            >
              {formatNaira(value)}
            </button>
          ))}
        </div>
        <p className="sq-budget-scale" aria-hidden="true">
          <i style={{ width: `${barMetres * pxPerM}px` }} />
          {barMetres} m
        </p>
      </div>
      <ol className="sq-budget-row">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={row.href} aria-label={`${row.name}: ${formatNaira(budget)} buys about ${formatSqm(row.sqm)} square metres`}>
              <span className="sq-budget-square" style={{ width: `${row.side * pxPerM}px`, height: `${row.side * pxPerM}px` }} />
              <strong>{row.name}</strong>
              <b className="sq-fig">{formatSqm(row.sqm)} m²</b>
              <small className="sq-fig">{(row.sqm / STANDARD_PLOT.sqm).toFixed(row.sqm >= STANDARD_PLOT.sqm ? 1 : 2)} std plots</small>
            </Link>
          </li>
        ))}
        <li className="sq-budget-ref" aria-label={`For comparison: a standard plot, ${STANDARD_PLOT.frontage} by ${STANDARD_PLOT.depth} metres`}>
          <span className="sq-budget-square" style={{ width: `${STANDARD_PLOT.frontage * pxPerM}px`, height: `${STANDARD_PLOT.depth * pxPerM}px` }} />
          <strong>Standard plot</strong>
          <b className="sq-fig">{STANDARD_PLOT.sqm} m²</b>
          <small className="sq-fig">{STANDARD_PLOT.frontage} m × {STANDARD_PLOT.depth} m</small>
        </li>
      </ol>
    </div>
  );
}
