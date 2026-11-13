"use client";

import Link from "next/link";
import { useState } from "react";

// Lagos as squares: each location's area is proportional to its price per m².
// `layout` comes from layoutCartogram() in lib/plot.js (computed on the server).
export default function SqmCartogram({ layout, onNavy = true }) {
  const squares = layout?.squares || [];
  const lead = squares.reduce((best, item) => (!best || item.priceValue > best.priceValue ? item : best), null);
  const [activeId, setActiveId] = useState(null);
  const active = squares.find((item) => item.id === activeId) || lead;
  if (!squares.length) return null;

  return (
    <figure className={`sq-carto ${onNavy ? "sq-on-navy" : ""}`}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="group" aria-label="Lagos locations drawn as squares sized by price per square metre">
        {squares.map((item, index) => {
          const isActive = active?.id === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`sq-carto-plot ${isActive ? "active" : ""}`}
              style={{ animationDelay: `${index * 70}ms` }}
              aria-label={`${item.name}: ${item.priceLabel}, ${item.confidenceLevel} confidence`}
              onMouseEnter={() => setActiveId(item.id)}
              onFocus={() => setActiveId(item.id)}
            >
              {item.photo ? (
                <>
                  <image className="sq-carto-photo" href={item.photo} x={item.x} y={item.y} width={item.side} height={item.side} preserveAspectRatio="xMidYMid slice" />
                  <rect className="sq-carto-tint" x={item.x} y={item.y} width={item.side} height={item.side} />
                </>
              ) : (
                <rect className="sq-carto-fill" x={item.x} y={item.y} width={item.side} height={item.side} />
              )}
              <circle className="sq-carto-grade-bg" cx={item.x + item.side - 13} cy={item.y + 13} r="7.5" />
              <circle className={`sq-carto-grade sq-carto-${item.pattern}`} cx={item.x + item.side - 13} cy={item.y + 13} r="4.5" />
              <rect className="sq-carto-line" x={item.x} y={item.y} width={item.side} height={item.side} pathLength="1" />
              {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => (
                <rect className="sq-carto-beacon" key={`${dx}${dy}`} x={item.x + dx * item.side - 2.5} y={item.y + dy * item.side - 2.5} width="5" height="5" />
              ))}
              <text className="sq-carto-name" x={item.x} y={item.y - 8}>{item.name}</text>
              {item.side >= 64 ? (
                <g className="sq-carto-price">
                  <rect x={item.x + item.side / 2 - 31} y={item.y + item.side / 2 - 11} width="62" height="22" />
                  <text x={item.x + item.side / 2} y={item.y + item.side / 2 + 4.5} textAnchor="middle">{item.priceShort}</text>
                </g>
              ) : null}
            </Link>
          );
        })}
      </svg>
      <figcaption className="sq-carto-readout" aria-live="polite">
        <div>
          <span>Location</span>
          <strong>{active.name}</strong>
        </div>
        <div>
          <span>Price / m²</span>
          <strong className="sq-fig">{active.priceShort}</strong>
        </div>
        <div>
          <span>Growth / yr</span>
          <strong className="sq-fig">{active.growthLabel}</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong className="sq-fig"><i className={`sq-pat sq-pat-${active.pattern}`} aria-hidden="true" />{active.confidence || "—"}</strong>
        </div>
      </figcaption>
    </figure>
  );
}
