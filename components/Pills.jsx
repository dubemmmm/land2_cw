export function SourcePill({ type = "Internal" }) {
  return <span className="source-pill">{type}</span>;
}

export function StatusPill({ status = "No data" }) {
  return <span className="status-pill">{status}</span>;
}
