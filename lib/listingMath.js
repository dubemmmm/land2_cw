// Asking-price arithmetic shared by the server statistics and the listing
// pages. No database access, so it is safe to import in client components.

// A median is only shown from this many priced listings; fewer is too thin.
export const MIN_FOR_MEDIAN = 8;

// Whether a listing's price can stand beside others: a sale with a naira rate per m².
export function isComparable(listing) {
  return listing.offerType === "Sale" && listing.pricePerSqm > 0;
}

// Percent above (+) or below (-) a median asking rate, or null when either side
// is missing. A rate under a quarter or over four times the median is far more
// likely a mis-keyed size or price than a bargain, so it gets no comparison.
export function againstMedian(listing, median) {
  if (!median || !isComparable(listing)) return null;
  const ratio = listing.pricePerSqm / median;
  if (ratio < 0.25 || ratio > 4) return null;
  return Math.round((ratio - 1) * 100);
}

// "12% below the Ikoyi median", "at the Ikoyi median", or "" when there is nothing to compare.
export function againstMedianText(listing, median, areaName) {
  const diff = againstMedian(listing, median);
  if (diff === null) return "";
  if (Math.abs(diff) < 3) return `At the ${areaName} median`;
  return `${Math.abs(diff)}% ${diff > 0 ? "above" : "below"} the ${areaName} median`;
}

// The comparable rates of a set of listings, sorted, with far outliers dropped
// (Tukey's 1.5 × IQR). In this data those are mis-keyed prices, not real plots.
export function comparableRates(listings) {
  const sorted = listings.filter(isComparable).map((listing) => listing.pricePerSqm).sort((a, b) => a - b);
  if (sorted.length < 4) return sorted;
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const reach = (q3 - q1) * 1.5;
  return sorted.filter((value) => value >= q1 - reach && value <= q3 + reach);
}

// Median asking rate per m², or null when there are too few priced listings.
export function medianRate(listings) {
  const rates = comparableRates(listings);
  return rates.length >= MIN_FOR_MEDIAN ? Math.round(quantile(rates, 0.5)) : null;
}

export function quantile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}
