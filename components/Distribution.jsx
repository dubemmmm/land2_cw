// Share of a whole, drawn as one bar to scale. Segments are shades of navy,
// darkest first; anything past the fourth entry is folded into "Other".
export default function Distribution({ title, total, unit = "estates", entries }) {
  const shown = entries.length > 4
    ? [...entries.slice(0, 3), { label: "Other", count: entries.slice(3).reduce((sum, entry) => sum + entry.count, 0) }]
    : entries;
  const sum = shown.reduce((acc, entry) => acc + entry.count, 0) || 1;
  return (
    <article className="land-dist">
      <header>
        <h3>{title}</h3>
        <span className="sq-fig">{total} {unit}</span>
      </header>
      <div className="land-dist-bar" role="img" aria-label={shown.map((entry) => `${entry.label} ${entry.count}`).join(", ")}>
        {shown.map((entry, index) => (
          <i key={entry.label} className={`land-shade-${index % 4}`} style={{ flexGrow: entry.count }} />
        ))}
      </div>
      <ul>
        {shown.map((entry, index) => (
          <li key={entry.label}>
            <i className={`land-swatch land-shade-${index % 4}`} aria-hidden="true" />
            <span>{entry.label}</span>
            <b className="sq-fig">{entry.count}</b>
            <em className="sq-fig">{Math.round((entry.count / sum) * 100)}%</em>
          </li>
        ))}
      </ul>
    </article>
  );
}
