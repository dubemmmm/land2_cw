// Yearly price per m² as a stepped trace with annotated ends.
// points: [{ year, value, label?, projected?, current?, asking? }]
export default function PriceTrace({ points = [], height = 220, className = "" }) {
  const data = points.filter((point) => Number.isFinite(Number(point.value)));
  if (data.length < 2) return null;
  // Years with gaps between them are recorded figures, not a yearly series.
  if (data.some((point, i) => i > 0 && point.year - data[i - 1].year !== 1)) {
    return <RecordedTrace data={data} height={height} className={className} />;
  }
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

// A few recorded figures placed at their years. The join to an asking-price
// point is dashed: it is measured differently from the figures before it.
function RecordedTrace({ data, height, className }) {
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 44, t: 34, b: 30 };
  const max = Math.max(...data.map((point) => point.value));
  const min = Math.min(0, ...data.map((point) => point.value));
  const first = data[0].year;
  const years = data.at(-1).year - first || 1;
  const x = (year) => pad.l + ((year - first) / years) * (W - pad.l - pad.r);
  const y = (value) => pad.t + (1 - (value - min) / (max - min || 1)) * (H - pad.t - pad.b);
  return (
    <svg className={`sq-trace ${className}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={data.map((point) => `${point.year}: ${point.label || point.value}${point.basis ? `, ${point.basis}` : ""}`).join("; ")}>
      <line className="sq-trace-base" x1={12} x2={W - 12} y1={H - pad.b} y2={H - pad.b} />
      {data.slice(1).map((point, i) => (
        <path key={point.year} className={point.asking ? "sq-trace-line projected" : "sq-trace-line"} pathLength={point.asking ? undefined : "1"}
          d={`M${x(data[i].year)} ${y(data[i].value)} L${x(point.year)} ${y(point.value)}`} />
      ))}
      {data.map((point) => (
        <g key={point.year} className={point.current ? "sq-trace-mark current" : "sq-trace-mark"}>
          <line className="sq-trace-tick" x1={x(point.year)} x2={x(point.year)} y1={H - pad.b} y2={H - pad.b + 5} />
          <text className="sq-trace-year" x={x(point.year)} y={H - 8} textAnchor="middle">{point.year}</text>
          <rect x={x(point.year) - 3} y={y(point.value) - 3} width="6" height="6" />
          <text x={x(point.year)} y={y(point.value) - 10} textAnchor="middle">{point.label || point.value}</text>
        </g>
      ))}
    </svg>
  );
}
