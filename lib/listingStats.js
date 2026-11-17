import { cache } from "react";
import { getDb } from "./database.js";
import { getUsdNgnRate } from "./fx.js";
import { MIN_FOR_MEDIAN, comparableRates, quantile } from "./listingMath.js";
import { getLandListings } from "./listingStore.js";

// Asking-price statistics worked out from the published listings. These are
// what sellers ask, not what plots sold for.

const SOLID_FROM = 30;

export const SIZE_BANDS = [
  { label: "Under 500 m²", max: 500 },
  { label: "500–999 m²", max: 1000 },
  { label: "1,000–1,999 m²", max: 2000 },
  { label: "2,000–4,999 m²", max: 5000 },
  { label: "5,000 m² and over", max: Infinity }
];

let lastKey;
let lastValue;

// { areas: { [neighborhoodId]: stats }, all: stats, fx }
// Recomputed only when the listings or the exchange rate have changed.
export const getListingStats = cache(async () => {
  const [fx, stamp] = await Promise.all([
    getUsdNgnRate(),
    getDb().then((db) => db.get("SELECT COUNT(*) AS n, MAX(updated_at) AS latest FROM land_listings"))
  ]);
  const key = `${stamp.n}|${stamp.latest}|${fx?.rate || 0}`;
  if (lastKey === key) return lastValue;
  const listings = await getLandListings({ summary: true });
  const groups = new Map();
  for (const listing of listings) {
    if (!groups.has(listing.neighborhoodId)) groups.set(listing.neighborhoodId, []);
    groups.get(listing.neighborhoodId).push(listing);
  }
  const areas = {};
  for (const [id, items] of groups) areas[id] = summarize(items);
  lastValue = { areas, all: summarize(listings), fx };
  lastKey = key;
  return lastValue;
});

export async function getAreaStats(neighborhoodId) {
  return (await getListingStats()).areas[neighborhoodId] || null;
}

export function summarize(listings) {
  const rates = comparableRates(listings);
  const enough = rates.length >= MIN_FOR_MEDIAN;
  const sizes = listings.map((listing) => listing.sizeSqm).filter((size) => size > 0);
  return {
    count: listings.length,
    pricedCount: rates.length,
    // null until there are enough priced listings to stand behind it.
    median: enough ? Math.round(quantile(rates, 0.5)) : null,
    lowerQuartile: enough ? Math.round(quantile(rates, 0.25)) : null,
    upperQuartile: enough ? Math.round(quantile(rates, 0.75)) : null,
    // Same drawing vocabulary as planning confidence (lib/metrics.js).
    pattern: rates.length >= SOLID_FROM ? "solid" : enough ? "hatch" : rates.length ? "dot" : "none",
    sampleLabel: rates.length >= SOLID_FROM ? "Many listings" : enough ? "Some listings" : rates.length ? "Too few to give a median" : "No priced listings",
    medianSize: sizes.length ? Math.round(quantile(sizes, 0.5)) : null,
    latestListedAt: listings.reduce((latest, listing) => (listing.listedAt > latest ? listing.listedAt : latest), ""),
    byOffer: tally(listings, (listing) => listing.offerType),
    byUse: tally(listings, (listing) => listing.landUse || "Not stated"),
    byTitle: tally(listings, (listing) => listing.titleDocument || "Not stated"),
    bySize: SIZE_BANDS
      .map((band, index) => ({
        label: band.label,
        count: sizes.filter((size) => size < band.max && size >= (SIZE_BANDS[index - 1]?.max || 0)).length
      }))
      .filter((band) => band.count),
    byMonth: months(listings)
  };
}

function tally(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) || 0) + 1);
  return Array.from(counts, ([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

// Listings added per calendar month, oldest first, with empty months filled in.
function months(listings) {
  const counts = new Map();
  for (const listing of listings) {
    const month = String(listing.listedAt || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(month)) counts.set(month, (counts.get(month) || 0) + 1);
  }
  if (!counts.size) return [];
  const keys = [...counts.keys()].sort();
  const out = [];
  let [year, month] = keys[0].split("-").map(Number);
  const last = keys.at(-1);
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    out.push({ month: key, count: counts.get(key) || 0 });
    if (key >= last) break;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return out;
}
