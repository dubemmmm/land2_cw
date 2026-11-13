import { STANDARD_PLOT, formatSqm, plotOutline } from "@/lib/plot";

// A plot drawn to scale. `scaleSqm` lets several glyphs share one scale
// (pass the largest area in the set). The outline is indicative; the area is exact.
export default function PlotGlyph({ sqm, scaleSqm, label, className = "" }) {
  const W = 240;
  const H = 150;
  const plot = plotOutline(sqm);
  const reference = plotOutline(Math.max(Number(scaleSqm) || 0, plot.sqm, STANDARD_PLOT.sqm));
  // Long side runs horizontally. Leave room for the area label and scale bar.
  const pxPerM = Math.min((W - 76) / reference.depth, (H - 46) / reference.frontage);
  const pw = plot.depth * pxPerM;
  const ph = plot.frontage * pxPerM;
  const sw = STANDARD_PLOT.depth * pxPerM;
  const sh = STANDARD_PLOT.frontage * pxPerM;
  const x0 = 20;
  const y1 = H - 26;
  const barMetres = pickBar(reference.depth);
  const beacons = [[x0, y1 - ph], [x0 + pw, y1 - ph], [x0, y1], [x0 + pw, y1]];
  const text = label || `Plot of ${formatSqm(plot.sqm)} square metres, drawn to scale beside a standard ${STANDARD_PLOT.sqm} square metre plot`;

  return (
    <svg className={`sq-plot ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={text}>
      {plot.sqm > 0 ? (
        <>
          <rect className="sq-plot-std" x={x0} y={y1 - sh} width={sw} height={sh} />
          <rect className="sq-plot-fill" x={x0} y={y1 - ph} width={pw} height={ph} />
          <rect className="sq-plot-line" x={x0} y={y1 - ph} width={pw} height={ph} pathLength="1" />
          {beacons.map(([bx, by], index) => (
            <rect className="sq-plot-beacon" key={index} x={bx - 2.5} y={by - 2.5} width="5" height="5" />
          ))}
          <text className="sq-plot-area" x={x0 + pw / 2} y={y1 - ph / 2 + 4} textAnchor="middle">
            {formatSqm(plot.sqm)} m²
          </text>
        </>
      ) : (
        <text className="sq-plot-note" x={W / 2} y={H / 2} textAnchor="middle">Size not recorded</text>
      )}
      {/* north arrow */}
      <g className="sq-plot-north" transform={`translate(${W - 22} 14)`}>
        <path d="M0 22 L0 2 M-4 9 L0 2 L4 9" />
        <text x="0" y="33" textAnchor="middle">N</text>
      </g>
      {/* scale bar */}
      <g className="sq-plot-scale" transform={`translate(${x0} ${H - 9})`}>
        <path d={`M0 -3 V3 M0 0 H${barMetres * pxPerM} M${barMetres * pxPerM} -3 V3`} />
        <text x={barMetres * pxPerM + 6} y="3">{barMetres} m</text>
      </g>
      <text className="sq-plot-note" x={W - 8} y={H - 6} textAnchor="end">std plot {STANDARD_PLOT.sqm} m² dashed</text>
    </svg>
  );
}

function pickBar(depth) {
  if (depth >= 80) return 20;
  if (depth >= 30) return 10;
  return 5;
}
