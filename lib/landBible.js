import fs from "fs";
import path from "path";
import { cache } from "react";
import { getListingStats } from "./listingStats.js";
import { dynamicEstateToBibleEstate, getMarketEstates, getPricePoints } from "./marketDataStore.js";

const idMap = {
  "victoria-island": "victoria_island",
  "lekki-phase-1": "lekki_phase_1",
  "banana-island": "banana_island",
  "eko-atlantic": "eko_atlantic"
};

export const MARKET_CURRENT_YEAR = 2026;
const SOURCE_PRICE_YEAR = 2023;
const TREND_START_YEAR = 2018;
const TREND_END_YEAR = 2031;

let bibleFile;

// Everything the market profiles are built from, read from the database once
// per request: admin-entered estates and price points, and the listing
// statistics. The returned functions are plain lookups.
export const loadMarket = cache(async () => {
  const [estates, points, stats] = await Promise.all([getMarketEstates(), getPricePoints(), getListingStats()]);
  const data = { estates, points, stats };
  return {
    profile: (locationId) => landMarketProfile(String(locationId), data),
    estateProfile: (estateSlug) => estateMarketProfile(estateSlug, data),
    inventory: () => landBibleInventory(data)
  };
});

export async function getLandMarketProfile(locationId) {
  return (await loadMarket()).profile(locationId);
}

export async function getEstateMarketProfile(estateSlug) {
  return (await loadMarket()).estateProfile(estateSlug);
}

export async function getLandBibleInventory() {
  return (await loadMarket()).inventory();
}

function pointsFor(data, targetType, targetId) {
  const id = normalizeTargetId(targetId);
  return data.points.filter((point) => point.targetType === targetType && point.targetId === id);
}

function normalizeTargetId(value = "") {
  return String(value).trim().replaceAll("_", "-");
}

function landMarketProfile(locationId, data) {
  const bible = getBible();
  if (!bible) return null;

  const bibleId = idMap[locationId] || locationId.replaceAll("-", "_");
  const neighborhoods = bible.neighborhoods || [];
  const estates = combinedEstates(bible, data);
  let neighborhood = neighborhoods.find((item) => item.id === bibleId);
  const estate = estates.find((item) => item.id === bibleId);
  const parent = estate ? neighborhoods.find((item) => toLocationSlug(item.id) === toLocationSlug(estate.neighborhood_id)) : neighborhood;
  // Live listings: where an area has enough of them, their median asking price
  // is the area's price, ahead of the 2023 Land Bible figure grown forward.
  const asking = data.stats.areas[locationId] || null;
  const askingMedian = asking?.median || null;
  if (!neighborhood && !estate) {
    const dynamicPoints = pointsFor(data, "neighborhood", locationId);
    const dynamicEstates = estates.filter((item) => toLocationSlug(item.neighborhood_id) === toLocationSlug(locationId));
    if (!dynamicPoints.length && !dynamicEstates.length && !askingMedian) return null;
    neighborhood = {
      id: bibleId,
      name: titleize(locationId),
      lga: "Lagos",
      description: "Admin-entered market intelligence for this neighborhood.",
      highlights: []
    };
  }

  const relatedEstates = estate
    ? [estate]
    : estates.filter((item) => (
      toLocationSlug(item.neighborhood_id) === toLocationSlug(neighborhood.id)
      || neighborhood.estates?.some((id) => toEstateSlug(id) === toEstateSlug(item.id))
    ));
  const dynamicTargetType = estate ? "estate" : "neighborhood";
  const dynamicTargetId = estate ? toEstateSlug(estate.id) : locationId;
  const dynamicPoints = pointsFor(data, dynamicTargetType, dynamicTargetId);
  const marketPrice = estate?.current_price_per_sqm || neighborhood?.avg_price_per_sqm || latestPrice(dynamicPoints) || null;
  const marketPriceLabel = estate?.current_price_label || neighborhood?.price_label || "Unavailable";
  const previousPrice = estate?.price_5yr_ago || null;
  const usesUsd = Boolean(estate?.current_price_usd && !marketPrice);
  // No growth rate is quoted beside an asking median: the 2023 figure is an area
  // average and the median is what sellers ask now, so the gap is not growth.
  const annualGrowth = askingMedian ? null : estimateGrowth(marketPrice, previousPrice);
  const trend = askingMedian
    ? buildObservedTrend(dynamicPoints, marketPrice, askingMedian)
    : buildTrendFromPricePoints(dynamicPoints, annualGrowth, usesUsd)
      || buildTrend(marketPrice || estate?.current_price_usd || null, previousPrice, annualGrowth, usesUsd);
  const currentEstimate = askingMedian || currentTrendValue(trend);
  const mappedLand = sumLand(relatedEstates) || estate?.total_land_sqm || null;
  const developing = relatedEstates.filter((item) => /develop/i.test(item.status || "")).length;
  const built = relatedEstates.filter((item) => /built/i.test(item.status || "")).length;

  return {
    meta: bible.meta,
    kind: estate ? "estate" : "neighborhood",
    id: estate?.id || neighborhood.id,
    name: estate?.name || neighborhood.name,
    parentName: parent?.name || null,
    lga: neighborhood?.lga || parent?.lga || estate?.location_label || "",
    description: estate ? `${estate.name} is an estate within ${parent?.name || estate.location_label}.` : neighborhood.description,
    highlights: neighborhood?.highlights || [],
    priceLabel: askingMedian
      ? `${formatPrice(askingMedian)}/sqm`
      : currentEstimate ? `${formatPrice(currentEstimate, usesUsd)}/sqm est.` : marketPriceLabel,
    // "asking": median of live listings. "estimate": Land Bible figure grown forward.
    priceSource: askingMedian ? "asking" : "estimate",
    asking: asking || null,
    sourcePriceLabel: marketPriceLabel,
    sourcePriceYear: SOURCE_PRICE_YEAR,
    currentYear: MARKET_CURRENT_YEAR,
    asOfLabel: askingMedian
      ? `Median asking price of ${asking.pricedCount} listings, ${monthLabel(asking.latestListedAt)}`
      : `${MARKET_CURRENT_YEAR} estimate · Source: ${bible.meta?.pricing_date || SOURCE_PRICE_YEAR}`,
    priceValue: currentEstimate || marketPrice,
    sourcePriceValue: marketPrice,
    annualGrowth,
    annualGrowthLabel: annualGrowth ? `~${Math.round(annualGrowth * 100)}%` : "N/A",
    totalLandLabel: formatLand(mappedLand || estate?.total_land_sqm),
    totalLandSqm: mappedLand || estate?.total_land_sqm,
    estates: relatedEstates.map((item) => enrichEstateForCard(item)),
    estateSummary: {
      total: relatedEstates.length,
      developing,
      built
    },
    trend,
    trendCurrency: usesUsd && !askingMedian ? "USD" : "NGN",
    disclaimer: bible.meta?.disclaimer
  };
}

function estateMarketProfile(estateSlug, data) {
  const bible = getBible();
  if (!bible) return null;

  const estateId = normalizeId(estateSlug);
  const neighborhoods = bible.neighborhoods || [];
  const estates = combinedEstates(bible, data);
  const estate = estates.find((item) => item.id === estateId || toEstateSlug(item.id) === toEstateSlug(estateSlug));
  if (!estate) return null;

  const neighborhood = neighborhoods.find((item) => toLocationSlug(item.id) === toLocationSlug(estate.neighborhood_id));
  const siblingIds = new Set(neighborhood?.estates || []);
  const siblingEstates = estates.filter((item) => (
    item.id !== estate.id
    && (toLocationSlug(item.neighborhood_id) === toLocationSlug(estate.neighborhood_id) || siblingIds.has(item.id))
  ));
  const dynamicPoints = pointsFor(data, "estate", toEstateSlug(estate.id));
  const marketPrice = estate.current_price_per_sqm || estate.current_price_usd || latestPrice(dynamicPoints) || neighborhood?.avg_price_per_sqm || null;
  const usesUsd = Boolean(estate.current_price_usd && !estate.current_price_per_sqm);
  const annualGrowth = estimateGrowth(marketPrice, estate.price_5yr_ago);
  const trend = buildTrendFromPricePoints(dynamicPoints, annualGrowth, usesUsd)
    || buildTrend(marketPrice, estate.price_5yr_ago, annualGrowth, usesUsd);
  const currentEstimate = currentTrendValue(trend);

  return {
    meta: bible.meta,
    id: estate.id,
    slug: toEstateSlug(estate.id),
    name: estate.name,
    parentId: neighborhood?.id || estate.neighborhood_id,
    parentSlug: toLocationSlug(neighborhood?.id || estate.neighborhood_id),
    parentName: neighborhood?.name || estate.location_label,
    lga: neighborhood?.lga || estate.location_label || "",
    description: describeEstate(estate, neighborhood),
    highlights: buildEstateHighlights(estate, neighborhood),
    priceLabel: currentEstimate ? `${formatPrice(currentEstimate, usesUsd)}/sqm est.` : estate.current_price_label || "Contact for pricing",
    sourcePriceLabel: estate.current_price_label || "Contact for pricing",
    sourcePriceYear: SOURCE_PRICE_YEAR,
    currentYear: MARKET_CURRENT_YEAR,
    asOfLabel: `${MARKET_CURRENT_YEAR} estimate · Source: ${bible.meta?.pricing_date || SOURCE_PRICE_YEAR}`,
    priceValue: currentEstimate || marketPrice,
    sourcePriceValue: marketPrice,
    currentPricePerSqm: estate.current_price_per_sqm || null,
    annualGrowth,
    annualGrowthLabel: annualGrowth ? `~${Math.round(annualGrowth * 100)}%` : "N/A",
    totalLandLabel: estate.total_land_label || formatLand(estate.total_land_sqm),
    totalLandSqm: estate.total_land_sqm || null,
    primaryUse: estate.primary_use || "Mixed use",
    status: estate.status || "Unknown",
    developer: estate.developer || "Not specified",
    availablePlots: estate.available_plots || "Not specified",
    trend,
    trendCurrency: usesUsd ? "USD" : "NGN",
    comparisons: siblingEstates.map((item) => enrichEstateForComparison(item, neighborhood)),
    disclaimer: bible.meta?.disclaimer
  };
}

function landBibleInventory(data) {
  const bible = getBible();
  return {
    meta: bible?.meta || null,
    neighborhoods: bible?.neighborhoods || [],
    estates: combinedEstates(bible, data)
  };
}

export function toEstateSlug(id = "") {
  return String(id).replaceAll("_", "-");
}

function normalizeId(value = "") {
  return String(value).replaceAll("-", "_");
}

function toLocationSlug(id = "") {
  return String(id).replaceAll("_", "-");
}

function describeEstate(estate, neighborhood) {
  const location = neighborhood?.name || estate.location_label;
  const status = estate.status ? `${estate.status.toLowerCase()} ` : "";
  return `${estate.name} is a ${status}estate within ${location}, tracked for pricing, land availability, use profile, and future value movement.`;
}

function buildEstateHighlights(estate, neighborhood) {
  return [
    estate.primary_use,
    estate.status,
    estate.total_land_label,
    estate.developer ? `Developer: ${estate.developer}` : null,
    neighborhood?.name ? `Part of ${neighborhood.name}` : null
  ].filter(Boolean).slice(0, 4);
}

function enrichEstateForComparison(estate, neighborhood) {
  const price = estate.current_price_per_sqm || estate.current_price_usd || null;
  const growth = estimateGrowth(price, estate.price_5yr_ago);
  const trend = buildTrend(price, estate.price_5yr_ago, growth, Boolean(estate.current_price_usd && !estate.current_price_per_sqm));
  const currentEstimate = currentTrendValue(trend);
  return {
    id: estate.id,
    slug: toEstateSlug(estate.id),
    name: estate.name,
    location: estate.location_label || neighborhood?.name,
    priceLabel: currentEstimate ? `${formatPrice(currentEstimate, Boolean(estate.current_price_usd && !estate.current_price_per_sqm))}/sqm est.` : estate.current_price_label || "Contact for pricing",
    sourcePriceLabel: estate.current_price_label || "Contact for pricing",
    priceValue: currentEstimate || price,
    annualGrowthLabel: growth ? `~${Math.round(growth * 100)}%` : "N/A",
    landLabel: estate.total_land_label || formatLand(estate.total_land_sqm),
    primaryUse: estate.primary_use || "Mixed use",
    status: estate.status || "Unknown"
  };
}

function enrichEstateForCard(estate) {
  const usesUsd = Boolean(estate.current_price_usd && !estate.current_price_per_sqm);
  const price = estate.current_price_per_sqm || estate.current_price_usd || null;
  const growth = estimateGrowth(price, estate.price_5yr_ago);
  const trend = buildTrend(price, estate.price_5yr_ago, growth, usesUsd);
  const currentEstimate = currentTrendValue(trend);
  return {
    ...estate,
    current_estimated_price_label: currentEstimate ? `${formatPrice(currentEstimate, usesUsd)}/sqm est.` : estate.current_price_label,
    source_price_label: estate.current_price_label,
    source_price_year: SOURCE_PRICE_YEAR
  };
}

function getBible() {
  if (bibleFile !== undefined) return bibleFile;
  const file = path.join(process.cwd(), "land_bible.json");
  if (!fs.existsSync(file)) {
    bibleFile = null;
    return bibleFile;
  }
  bibleFile = JSON.parse(fs.readFileSync(file, "utf8"));
  return bibleFile;
}

function combinedEstates(bible, data) {
  return [
    ...(bible?.estates || []),
    ...data.estates.map(dynamicEstateToBibleEstate)
  ];
}

function latestPrice(points) {
  const sorted = [...(points || [])].sort((a, b) => b.year - a.year);
  return sorted[0]?.value || null;
}

function estimateGrowth(current, previous) {
  if (current && previous && current > previous) return Math.pow(current / previous, 1 / 5) - 1;
  if (current) return 0.15;
  return null;
}

function buildTrend(sourcePrice, previous, growth, usd = false) {
  if (!sourcePrice) return [];
  const safeGrowth = growth || 0.12;
  const points = [];
  for (let year = TREND_START_YEAR; year <= TREND_END_YEAR; year += 1) {
    let value;
    if (previous && year <= SOURCE_PRICE_YEAR) {
      const step = (sourcePrice / previous) ** (1 / (SOURCE_PRICE_YEAR - TREND_START_YEAR));
      value = previous * step ** (year - TREND_START_YEAR);
    } else {
      value = sourcePrice * (1 + safeGrowth) ** (year - SOURCE_PRICE_YEAR);
    }
    points.push({
      year,
      value: Math.round(value),
      projected: year > MARKET_CURRENT_YEAR,
      current: year === MARKET_CURRENT_YEAR,
      source: year === SOURCE_PRICE_YEAR,
      label: formatPrice(Math.round(value), usd)
    });
  }
  return points;
}

// Recorded figures only, no years filled in between or projected: admin-entered
// price points, the Land Bible's 2023 area average, and this year's median
// asking price from live listings.
function buildObservedTrend(points = [], biblePrice, askingMedian) {
  const byYear = new Map();
  if (biblePrice) byYear.set(SOURCE_PRICE_YEAR, { value: biblePrice, basis: "Land Bible average" });
  points
    .filter((point) => Number(point.value) > 0 && Number(point.year) < MARKET_CURRENT_YEAR && point.currency !== "USD")
    .forEach((point) => byYear.set(Number(point.year), { value: Number(point.value), basis: "Recorded" }));
  byYear.set(MARKET_CURRENT_YEAR, { value: askingMedian, basis: "Median asking price" });
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, point]) => ({
      year,
      value: Math.round(point.value),
      basis: point.basis,
      projected: false,
      current: year === MARKET_CURRENT_YEAR,
      asking: year === MARKET_CURRENT_YEAR,
      source: true,
      label: formatPrice(Math.round(point.value))
    }));
}

function monthLabel(date) {
  const [year, month] = String(date || "").split("-");
  const name = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return name ? `${name} ${year}` : String(MARKET_CURRENT_YEAR);
}

function buildTrendFromPricePoints(points = [], fallbackGrowth, usd = false) {
  const known = points
    .filter((point) => Number.isFinite(Number(point.value)) && Number.isFinite(Number(point.year)))
    .map((point) => ({ year: Number(point.year), value: Number(point.value), currency: point.currency }))
    .sort((a, b) => a.year - b.year);
  if (!known.length) return null;
  const first = known[0];
  const last = known.at(-1);
  const inferredGrowth = known.length > 1 && first.value > 0
    ? Math.pow(last.value / first.value, 1 / Math.max(1, last.year - first.year)) - 1
    : null;
  const growth = Number.isFinite(inferredGrowth) ? inferredGrowth : fallbackGrowth || 0.12;
  const pointMap = new Map(known.map((point) => [point.year, point.value]));
  const start = Math.min(TREND_START_YEAR, first.year);
  const pointsOut = [];

  for (let year = start; year <= TREND_END_YEAR; year += 1) {
    let value = pointMap.get(year);
    if (!value) {
      const before = known.filter((point) => point.year < year).at(-1);
      const after = known.find((point) => point.year > year);
      if (before && after && before.value > 0) {
        const step = Math.pow(after.value / before.value, 1 / (after.year - before.year));
        value = before.value * step ** (year - before.year);
      } else if (before) {
        value = before.value * (1 + growth) ** (year - before.year);
      } else {
        value = first.value / (1 + growth) ** (first.year - year);
      }
    }
    pointsOut.push({
      year,
      value: Math.round(value),
      projected: year > MARKET_CURRENT_YEAR || year > last.year,
      current: year === MARKET_CURRENT_YEAR,
      source: pointMap.has(year),
      label: formatPrice(Math.round(value), usd)
    });
  }

  return pointsOut;
}

function currentTrendValue(trend) {
  return trend.find((point) => point.current)?.value || null;
}

function sumLand(estates) {
  return estates.reduce((sum, estate) => sum + (Number(estate.total_land_sqm) || 0), 0);
}

function formatLand(value) {
  if (!value) return "Not mapped";
  return `${new Intl.NumberFormat("en-US").format(value)} sqm`;
}

function formatPrice(value, usd = false) {
  if (!value) return "N/A";
  if (usd) return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
  if (value >= 1000000) return `₦${(value / 1000000).toFixed(value % 1000000 ? 1 : 0)}M`;
  return `₦${Math.round(value / 1000)}K`;
}

function titleize(value = "") {
  return String(value)
    .replaceAll("_", "-")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
