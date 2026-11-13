import { confidenceLegend } from "@/lib/metrics";

export default function ConfidenceLegend({ onNavy = false, withRange = false }) {
  return (
    <ul className={`sq-legend ${onNavy ? "on-navy" : ""}`} aria-label="Data confidence key">
      {confidenceLegend.map((item) => (
        <li key={item.pattern}>
          <i className={`sq-pat sq-pat-${item.pattern}`} aria-hidden="true" />
          {item.level}{withRange ? ` · ${item.range}` : ""}
        </li>
      ))}
    </ul>
  );
}
