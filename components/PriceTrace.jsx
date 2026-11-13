// Yearly price per m² as a stepped trace with annotated ends.
// points: [{ year, value, label?, projected?, current? }]
export default function PriceTrace({ points = [], height = 220, className = "" }) {
  const data = points.filter((point) => Number.isFinite(Number(point.value)));
  if (data.length < 2) return null;
  const W = 640;
  const H = height;
  const pad = { l: 12, r: 12, t: 30, b: 30 };
  const max = Math.max(...data.map((point) => point.value));
  const min = Math.min(...data.map((point) => point.value));
  const span = max - min || 1;
  const stepX = (W - pad.l - pad.r) / data.length;
  const y = (value) => pad.t + (1 - (value - min) / span) * (H - pad.t - pad.b);
  const firstProjected = data.findIndex((point) => point.projected);
  const split = firstProjected === -1 ? data.length : firstProjected;
  // Stepped path over data[from..to). `startY` joins it to the previous segment.
  const build = (from, to, startY) => {
    let d = "";
    for (let i = from; i < to; i += 1) {
      const x0 = pad.l + i * stepX;
      const yy = y(data[i].value);
      if (i === from) d += startY === undefined ? `M${x0} ${yy}` : `M${x0} ${startY} V${yy}`;
      else d += ` V${yy}`;
      d += ` H${x0 + stepX}`;
    }
    return d;
  };
  const currentIndex = Math.max(0, data.findIndex((point) => point.current));
  const marks = Array.from(new Set([0, currentIndex, data.length - 1]));

  return (
    <svg className={`sq-trace ${className}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Price per square metre from ${data[0].year} to ${data.at(-1).year}`}>
      <line className="sq-trace-base" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      {data.map((point, i) => (
        <g key={point.year}>
          <line className="sq-trace-tick" x1={pad.l + i * stepX} x2={pad.l + i * stepX} y1={H - pad.b} y2={H - pad.b + 5} />
          {data.length <= 12 || i % 2 === 0 ? (
            <text className="sq-trace-year" x={pad.l + (i + 0.5) * stepX} y={H - 8} textAnchor="middle">{String(point.year).slice(2)}</text>
          ) : null}
        </g>
      ))}
      <path className="sq-trace-line" d={build(0, split)} pathLength="1" />
      {split > 0 && split < data.length ? (
        <path className="sq-trace-line projected" d={build(split, data.length, y(data[split - 1].value))} />
      ) : null}
      {marks.map((i) => (
        <g key={i} className={i === currentIndex ? "sq-trace-mark current" : "sq-trace-mark"}>
          <rect x={pad.l + (i + 0.5) * stepX - 3} y={y(data[i].value) - 3} width="6" height="6" />
          <text x={pad.l + (i + 0.5) * stepX} y={y(data[i].value) - 10}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>
            {data[i].label || data[i].value}
          </text>
        </g>
      ))}
    </svg>
  );
}
