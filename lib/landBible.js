import fs from "fs";
import path from "path";
import { dynamicEstateToBibleEstate, getMarketEstatesSync, getPricePointsSync } from "./marketDataStore.js";

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

let cache;

export function getLandMarketProfile(locationId) {
  const bible = getBible();
  if (!bible) return null;

  const bibleId = idMap[locationId] || locationId.replaceAll("-", "_");
  const neighborhoods = bible.neighborhoods || [];
  const estates = combinedEstates(bible);
  let neighborhood = neighborhoods.find((item) => item.id === bibleId);
  const estate = estates.find((item) => item.id === bibleId);
  const parent = estate ? neighborhoods.find((item) => toLocationSlug(item.id) === toLocationSlug(estate.neighborhood_id)) : neighborhood;
  if (!neighborhood && !estate) {
    const dynamicPoints = getPricePointsSync({ targetType: "neighborhood", targetId: locationId });
    const dynamicEstates = estates.filter((item) => toLocationSlug(item.neighborhood_id) === toLocationSlug(locationId));
    if (!dynamicPoints.length && !dynamicEstates.length) return null;
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
  const dynamicPoints = getPricePointsSync({ targetType: dynamicTargetType, targetId: dynamicTargetId });
  const marketPrice = estate?.current_price_per_sqm || neighborhood?.avg_price_per_sqm || latestPrice(dynamicPoints) || null;
  const marketPriceLabel = estate?.current_price_label || neighborhood?.price_label || "Unavailable";
  const previousPrice = estate?.price_5yr_ago || null;
  const annualGrowth = estimateGrowth(marketPrice, previousPrice);
  const usesUsd = Boolean(estate?.current_price_usd && !marketPrice);
  const trend = buildTrendFromPricePoints(dynamicPoints, annualGrowth, usesUsd)
    || buildTrend(marketPrice || estate?.current_price_usd || null, previousPrice, annualGrowth, usesUsd);
  const currentEstimate = currentTrendValue(trend);
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
    priceLabel: currentEstimate ? `${formatPrice(currentEstimate, usesUsd)}/sqm est.` : marketPriceLabel,
    sourcePriceLabel: marketPriceLabel,
    sourcePriceYear: SOURCE_PRICE_YEAR,
    currentYear: MARKET_CURRENT_YEAR,
    asOfLabel: `${MARKET_CURRENT_YEAR} estimate · Source: ${bible.meta?.pricing_date || SOURCE_PRICE_YEAR}`,
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
    trendCurrency: usesUsd ? "USD" : "NGN",
    disclaimer: bible.meta?.disclaimer
  };
}

export function getEstateMarketProfile(estateSlug) {
  const bible = getBible();
  if (!bible) return null;

  const estateId = normalizeId(estateSlug);
  const neighborhoods = bible.neighborhoods || [];
  const estates = combinedEstates(bible);
  const estate = estates.find((item) => item.id === estateId || toEstateSlug(item.id) === toEstateSlug(estateSlug));
  if (!estate) return null;

  const neighborhood = neighborhoods.find((item) => toLocationSlug(item.id) === toLocationSlug(estate.neighborhood_id));
  const siblingIds = new Set(neighborhood?.estates || []);
  const siblingEstates = estates.filter((item) => (
    item.id !== estate.id
    && (toLocationSlug(item.neighborhood_id) === toLocationSlug(estate.neighborhood_id) || siblingIds.has(item.id))
  ));
  const dynamicPoints = getPricePointsSync({ targetType: "estate", targetId: toEstateSlug(estate.id) });
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

export function getLandBibleInventory() {
  const bible = getBible();
  return {
    meta: bible?.meta || null,
    neighborhoods: bible?.neighborhoods || [],
    estates: combinedEstates(bible)
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
  if (cache !== undefined) return cache;
  const file = path.join(process.cwd(), "land_bible.json");
  if (!fs.existsSync(file)) {
    cache = null;
    return cache;
  }
  cache = JSON.parse(fs.readFileSync(file, "utf8"));
  return cache;
}

function combinedEstates(bible) {
  return [
    ...(bible?.estates || []),
    ...getMarketEstatesSync().map(dynamicEstateToBibleEstate)
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
