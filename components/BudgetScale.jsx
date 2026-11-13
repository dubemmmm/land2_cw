"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { STANDARD_PLOT, formatNaira, formatSqm } from "@/lib/plot";

const MIN = 50e6;
const MAX = 2e9;
const STEP = 10e6;
const SERIES = ["var(--navy)", "var(--accent)", "var(--blue)", "var(--amber)", "var(--muted)", "var(--navy-300)"];
const M = { top: 20, right: 20, bottom: 34, left: 54 };

// Budget against land: one line per location (m² bought as budget rises),
// a slider that moves the cursor, and the standard 648 m² plot as a reference line.
export default function BudgetScale({ items, initial = 500e6 }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(720);
  const [budget, setBudget] = useState(initial);
  const [hoverId, setHoverId] = useState(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return undefined;
    const measure = () => setWidth(Math.max(280, Math.round(node.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const series = useMemo(
    () => items
      .filter((item) => Number(item.priceValue) > 0)
      .sort((a, b) => a.priceValue - b.priceValue)
      .map((item, index) => ({ ...item, color: SERIES[index % SERIES.length] })),
    [items]
  );
  if (!series.length) return null;

  const height = width < 520 ? 280 : 360;
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const yStep = niceStep((MAX / series[0].priceValue) / 4);
  const yMax = Math.ceil(MAX / series[0].priceValue / yStep) * yStep;
  const x = (value) => M.left + (value / MAX) * plotW;
  const y = (sqm) => M.top + plotH - (sqm / yMax) * plotH;
  const xTicks = width < 520 ? [0, 1e9, 2e9] : [0, 5e8, 1e9, 1.5e9, 2e9];
  const yTicks = Array.from({ length: Math.round(yMax / yStep) + 1 }, (_, i) => i * yStep);
  const rows = series.map((item) => ({ ...item, sqm: budget / item.priceValue })).sort((a, b) => b.sqm - a.sqm);
  const percent = ((budget - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="sq-budget">
      <div className="sq-budget-chart" ref={wrapRef}>
        <svg width={width} height={height} role="img"
          aria-label={`Land bought for ${formatNaira(budget)}: ${rows.map((row) => `${row.name} ${formatSqm(row.sqm)} square metres`).join(", ")}`}>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line className="sq-budget-grid" x1={M.left} x2={width - M.right} y1={y(tick)} y2={y(tick)} />
              <text className="sq-budget-tick" x={M.left - 10} y={y(tick) + 4} textAnchor="end">{formatSqm(tick)}</text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text key={tick} className="sq-budget-tick" x={x(tick)} y={height - 10}
              textAnchor={tick === 0 ? "start" : tick === MAX ? "end" : "middle"}>
              {tick === 0 ? "₦0" : formatNaira(tick)}
            </text>
          ))}
          <text className="sq-budget-axis" x={M.left} y={12}>m² of land</text>

          <line className="sq-budget-std" x1={M.left} x2={width - M.right} y1={y(STANDARD_PLOT.sqm)} y2={y(STANDARD_PLOT.sqm)} />
          <text className="sq-budget-std-label" x={width - M.right} y={y(STANDARD_PLOT.sqm) - 6} textAnchor="end">
            Standard plot, {STANDARD_PLOT.sqm} m²
          </text>

          {series.map((item) => (
            <line key={item.id} className={`sq-budget-line ${hoverId && hoverId !== item.id ? "dim" : ""}`}
              stroke={item.color} x1={x(0)} y1={y(0)} x2={x(MAX)} y2={y(MAX / item.priceValue)} />
          ))}

          <line className="sq-budget-cursor" x1={x(budget)} x2={x(budget)} y1={M.top} y2={M.top + plotH} />
          {rows.map((row) => (
            <circle key={row.id} className={`sq-budget-point ${hoverId && hoverId !== row.id ? "dim" : ""}`}
              cx={x(budget)} cy={y(row.sqm)} r="5" fill={row.color} />
          ))}
        </svg>
        <input
          className="sq-budget-slider"
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={budget}
          aria-label="Budget in naira"
          aria-valuetext={formatNaira(budget)}
          style={{ marginLeft: M.left + (MIN / MAX) * plotW - 9, width: plotW * ((MAX - MIN) / MAX) + 18, "--fill": `${percent}%` }}
          onChange={(event) => setBudget(Number(event.target.value))}
        />
      </div>

      <div className="sq-budget-panel">
        <p className="sq-budget-label">Budget</p>
        <p className="sq-budget-amount sq-fig">{formatNaira(budget)}</p>
        <table className="sq-budget-table">
          <thead>
            <tr>
              <th scope="col">Location</th>
              <th scope="col">Land</th>
              <th scope="col">Std plots</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} onMouseEnter={() => setHoverId(row.id)} onMouseLeave={() => setHoverId(null)}>
                <th scope="row">
                  <i style={{ background: row.color }} aria-hidden="true" />
                  <Link href={row.href}>{row.name}</Link>
                </th>
                <td className="sq-fig">{formatSqm(row.sqm)} m²</td>
                <td className="sq-fig">{(row.sqm / STANDARD_PLOT.sqm).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sq-budget-note">
          One standard plot ({STANDARD_PLOT.frontage} m × {STANDARD_PLOT.depth} m) costs about{" "}
          <b className="sq-fig">{formatNaira(series[0].priceValue * STANDARD_PLOT.sqm)}</b> in {series[0].name} and{" "}
          <b className="sq-fig">{formatNaira(series.at(-1).priceValue * STANDARD_PLOT.sqm)}</b> in {series.at(-1).name}.
        </p>
      </div>
    </div>
  );
}

function niceStep(raw) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * power;
}
