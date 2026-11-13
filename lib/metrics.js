export function confidenceScore(neighborhood) {
  return Math.max(0, Math.min(100, Number(neighborhood?.recommendation?.confidence) || 0));
}

export function confidenceLevel(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  if (score > 0) return "Low";
  return "No data";
}

// Thin data is not an error, so low confidence is drawn in grey, not red.
export function confidenceColor(score) {
  if (score >= 70) return "#1F8A5F";
  if (score >= 40) return "#B97A12";
  if (score > 0) return "#666A76";
  return "#A7ACBC";
}

// Fill pattern used wherever confidence is drawn: solid = verified,
// hatched = estimated, dotted = thin data, none = no data.
export function confidencePattern(score) {
  if (score >= 70) return "solid";
  if (score >= 40) return "hatch";
  if (score > 0) return "dot";
  return "none";
}

export const confidenceLegend = [
  { pattern: "solid", level: "High", range: "70–100", meaning: "Verified against several sources" },
  { pattern: "hatch", level: "Medium", range: "40–69", meaning: "Estimated from partial records" },
  { pattern: "dot", level: "Low", range: "1–39", meaning: "Thin data, treat as a first read" },
  { pattern: "none", level: "No data", range: "0", meaning: "Not yet graded" }
];

export function formatDate(date) {
  if (!date) return "--";
  const parts = String(date).split("-");
  if (parts.length !== 3) return date;
  return `${parts[2]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(parts[1]) - 1]} ${parts[0]}`;
}

export function initials(name = "CO") {
  return String(name)
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function averageConfidence(records) {
  return Math.round(records.reduce((sum, record) => sum + confidenceScore(record), 0) / Math.max(1, records.length));
}
