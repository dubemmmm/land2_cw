export function confidenceScore(neighborhood) {
  return Math.max(0, Math.min(100, Number(neighborhood?.recommendation?.confidence) || 0));
}

export function confidenceLevel(score) {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  if (score > 0) return "Low";
  return "No data";
}

export function confidenceColor(score) {
  if (score >= 70) return "#1F9D6B";
  if (score >= 40) return "#C98A1E";
  if (score > 0) return "#C8553D";
  return "#A7ACBC";
}

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
