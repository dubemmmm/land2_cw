// Turns a CW Lagos listings export (CSV) into data/listings.json, the seed the
// app loads its listings from.
//
//   npm run import:listings -- data/imports/land_listings_2026-11-16.csv
//
// The export's Price column mixes plot totals, per-sqm rates, dollars and
// yearly leases, so each row's price basis is worked out here. Rows the rules
// cannot settle are printed in the report; fix them in
// data/listing-overrides.json ({ "<listing id>": { "priceBasis": "total" } })
// and run the import again.
import fs from "fs";
import path from "path";

const input = process.argv[2];
const verbose = process.argv.includes("--verbose");
if (!input) {
  console.error("Usage: npm run import:listings -- <export.csv> [--verbose]");
  process.exit(1);
}

const root = process.cwd();
const outFile = path.join(root, "data", "listings.json");
const overridesFile = path.join(root, "data", "listing-overrides.json");

// Below this, a naira amount cannot be the price of a whole plot in these areas
// unless the listing says so; above it, it cannot be a per-sqm rate.
const RATE_CEILING = 20_000_000;
const USD_RATE_CEILING = 50_000;

// Export neighbourhood -> [our location id, estate name kept on the listing].
const AREAS = {
  "ikoyi": ["ikoyi", ""],
  "old ikoyi": ["ikoyi", "Old Ikoyi"],
  "osborne foreshore": ["ikoyi", "Osborne Foreshore"],
  "banana island": ["banana-island", ""],
  "victoria island": ["victoria-island", ""],
  "eko atlantic": ["eko-atlantic", ""],
  "oniru": ["oniru", ""],
  "lekki phase 1": ["lekki-phase-1", ""],
  "lekki": ["lekki", ""],
  "lekki phase 2": ["lekki", "Lekki Phase 2"],
  "ikate": ["lekki", "Ikate"],
  "chevron": ["lekki", "Chevron"],
  "idado": ["lekki", "Idado"],
  "ologolo": ["lekki", "Ologolo"],
  "orchid": ["lekki", "Orchid"],
  "vgc": ["lekki", "VGC"],
  "ajah": ["ajah", ""]
};

// Used only when the Neighbourhood cell is blank. Order matters.
const AREA_HINTS = [
  [/ibeju|epe\b/i, null],
  [/banana\s+island/i, ["banana-island", ""]],
  [/eko\s+atlantic/i, ["eko-atlantic", ""]],
  [/old\s+ikoyi/i, ["ikoyi", "Old Ikoyi"]],
  [/osborne/i, ["ikoyi", "Osborne Foreshore"]],
  [/ikoyi/i, ["ikoyi", ""]],
  [/oniru/i, ["oniru", ""]],
  [/victoria\s+island|\bV\.?\s?I\b/i, ["victoria-island", ""]],
  [/lekki\s+(phase|ph)\s*(1|one|i)\b/i, ["lekki-phase-1", ""]],
  [/ajah/i, ["ajah", ""]],
  [/lekki|ikate|chevron|vgc/i, ["lekki", ""]]
];

const LAND_USES = {
  "mixed-use land": "Mixed-use",
  "residential land": "Residential",
  "commercial land": "Commercial",
  "industrial land": "Industrial"
};

const TITLE_DOCUMENTS = [
  ["C of O", /c\s*of\s*o\b|c\.\s?of\s?o|certificate\s+of\s+occupancy/i],
  ["Governor's Consent", /governor[’']?s?\s+consent/i],
  ["Deed of Assignment", /deed\s+of\s+assignment/i],
  ["Gazette", /gazette/i],
  ["Registered Survey", /registered\s+survey|survey\s+plan/i]
];

const rows = parseCsv(fs.readFileSync(input, "utf8"));
const snapshotDate = (path.basename(input).match(/\d{4}-\d{2}-\d{2}/) || [new Date().toISOString().slice(0, 10)])[0];
const skipped = [];
const sizeMismatches = [];
const seenIds = new Set();
const seenContent = new Set();
const listings = [];

for (const row of rows) {
  const ref = `${row["Property ID"]} · ${row["Property Title"]}`;
  const type = clean(row["Property Type"]);
  const status = clean(row["Listing Status"]);
  if (/terrace|duplex|apartment|house/i.test(type)) { skipped.push([ref, `not land (${type})`]); continue; }
  if (/^rent$/i.test(status)) { skipped.push([ref, "rental"]); continue; }
  if (clean(row.City).toLowerCase() !== "lagos") { skipped.push([ref, `outside Lagos (${row.City})`]); continue; }

  const area = resolveArea(row);
  if (!area) { skipped.push([ref, `no matching location (${clean(row.Neighbourhood) || "blank"})`]); continue; }

  const contentKey = [row["Property Title"], row.Price, row["Land Size"], row.Agent].map(clean).join("|").toLowerCase();
  if (seenContent.has(contentKey)) { skipped.push([ref, "exact duplicate"]); continue; }
  seenContent.add(contentKey);

  const overview = String(row.Overview || "").trim();
  const title = clean(row["Property Title"]);
  const titleSize = parseSize((title.match(/\d[\d,.]*\s*(sq\.?\s*m|m²)/gi) || []).join(" "));
  const cellSize = parseSize(row["Land Size"]);
  // Where the two disagree fivefold or more, the Land Size cell has a slipped
  // digit or decimal point ("1.7 sqm", "1099973 sqm") and the title is right.
  const slipped = titleSize && cellSize && Math.max(titleSize, cellSize) / Math.min(titleSize, cellSize) >= 5;
  if (titleSize && cellSize && Math.abs(titleSize - cellSize) / Math.max(titleSize, cellSize) > 0.05) {
    sizeMismatches.push(`${ref}: title says ${titleSize} sqm, Land Size says ${cellSize} sqm (using ${slipped ? "the title" : "Land Size"})`);
  }
  const price = parsePrice(row.Price);
  const offerType = /\/\s*year/i.test(row.Price) || /lease/i.test(status) || /\blease\b/i.test(title)
    ? "Lease"
    : /joint\s+venture/i.test(type) || /joint\s+venture|\bJV\b/.test(title) ? "Joint venture" : "Sale";

  listings.push({
    id: uniqueId(row),
    sourceId: clean(row["Property ID"]),
    title,
    neighborhoodId: area[0],
    estate: area[1],
    address: clean(row.Address),
    sizeSqm: slipped ? titleSize : cellSize || titleSize,
    landUse: LAND_USES[type.toLowerCase()] || "",
    offerType,
    priceAmount: price.amount,
    priceCurrency: price.currency,
    priceBasis: null,
    priceRule: null,
    priceMarker: price.marker,
    saysPerSqm: /per\s*sq\.?\s*m|\/\s*sq\.?\s*m|per\s+square\s+met/i.test(overview),
    titleDocument: (TITLE_DOCUMENTS.find(([, pattern]) => pattern.test(overview)) || [""])[0],
    agentName: clean(row.Agent),
    agentPhone: clean(row["Agent Phone"]),
    sourceUrl: clean(row["Property Link"]) ? `https://${clean(row["Property Link"]).replace(/^https?:\/\//, "")}` : "",
    listedAt: clean(row.Created),
    description: overview
  });
}

// Pass 1: every rule that does not need to know what the area usually costs.
for (const listing of listings) classify(listing, null);
// Pass 2: the leftovers, judged against the area's provisional median rate.
const provisional = medianRates(listings);
for (const listing of listings) if (!listing.priceBasis) classify(listing, provisional);

const overrides = fs.existsSync(overridesFile) ? JSON.parse(fs.readFileSync(overridesFile, "utf8")) : {};
let overridden = 0;
for (const listing of listings) {
  if (!overrides[listing.id]) continue;
  Object.assign(listing, overrides[listing.id], { priceRule: "override" });
  overridden += 1;
}

report();

const output = listings.map(({ priceRule, priceMarker, saysPerSqm, ...listing }) => listing);
fs.writeFileSync(outFile, `${JSON.stringify({ snapshotDate, generatedAt: new Date().toISOString(), source: path.basename(input), listings: output }, null, 1)}\n`);
console.log(`\nWrote ${output.length} listings to ${path.relative(root, outFile)} (snapshot ${snapshotDate}).`);

function classify(listing, areaMedians) {
  const { priceAmount: amount, priceCurrency: currency, priceMarker: marker, sizeSqm } = listing;
  const set = (basis, rule) => { listing.priceBasis = basis; listing.priceRule = rule; };
  if (!amount) return set("unknown", "no price");
  if (marker === "sqm-year") return set("lease_per_sqm", "labelled");
  if (marker === "year") return set("lease", "labelled");
  if (listing.offerType === "Lease") return set(marker === "sqm" || amount < RATE_CEILING / 10 ? "lease_per_sqm" : "lease", "lease listing");
  if (marker === "sqm") return set("per_sqm", "labelled");
  if (currency === "USD") return set(amount < USD_RATE_CEILING ? "per_sqm" : "total", "dollar amount");
  if (amount >= RATE_CEILING) return set("total", "large amount");
  if (listing.saysPerSqm) return set("per_sqm", "overview says per sqm");
  if (!areaMedians) return null;
  if (!sizeSqm) return set("unknown", "small amount, no size");
  const typical = areaMedians[listing.neighborhoodId] || areaMedians.all;
  if (amount / sizeSqm >= typical * 0.1) return set("total", "plausible as a total");
  // Too low for a whole plot. It is a rate only if it also looks like one for this area.
  return amount <= typical * 5
    ? set("per_sqm", "too low to be a total")
    : set("unknown", "fits neither a total nor a rate");
}

function medianRates(items) {
  const byArea = { all: [] };
  for (const listing of items) {
    if (listing.offerType !== "Sale" || listing.priceCurrency !== "NGN") continue;
    const rate = listing.priceBasis === "per_sqm"
      ? listing.priceAmount
      : listing.priceBasis === "total" && listing.sizeSqm ? listing.priceAmount / listing.sizeSqm : 0;
    if (!rate) continue;
    (byArea[listing.neighborhoodId] ||= []).push(rate);
    byArea.all.push(rate);
  }
  return Object.fromEntries(Object.entries(byArea).map(([area, rates]) => [area, median(rates)]));
}

function resolveArea(row) {
  const named = AREAS[clean(row.Neighbourhood).toLowerCase()];
  if (named) return named;
  if (clean(row.Neighbourhood)) return null;
  const text = `${row["Property Title"]} ${row.Address}`;
  for (const [pattern, area] of AREA_HINTS) if (pattern.test(text)) return area;
  return null;
}

function parsePrice(cell) {
  const text = clean(cell);
  const amount = Number((text.match(/\d[\d,]*(\.\d+)?/) || ["0"])[0].replace(/,/g, "")) || 0;
  const perSqm = /\/\s*sq\.?\s*m/i.test(text);
  const perYear = /\/\s*year/i.test(text);
  return {
    amount,
    currency: text.includes("$") ? "USD" : "NGN",
    marker: perSqm && perYear ? "sqm-year" : perYear ? "year" : perSqm ? "sqm" : ""
  };
}

// One size only. A cell listing several plots ("500 sqm, 600 sqm") has no single size.
function parseSize(cell) {
  const numbers = (clean(cell).match(/\d[\d,]*(\.\d+)?/g) || []).map((n) => Number(n.replace(/,/g, "")));
  const distinct = [...new Set(numbers)].filter((n) => n > 0);
  return distinct.length === 1 ? distinct[0] : 0;
}

function uniqueId(row) {
  const link = clean(row["Property Link"]).replace(/\/+$/, "").split("/").pop();
  const base = slugify(link || `${row["Property Title"]}-${row["Property ID"]}`);
  let id = base;
  for (let n = 2; seenIds.has(id); n += 1) id = `${base}-${n}`;
  seenIds.add(id);
  return id;
}

function report() {
  const count = (items, key) => items.reduce((acc, item) => ({ ...acc, [key(item)]: (acc[key(item)] || 0) + 1 }), {});
  const table = (title, counts) => {
    console.log(`\n${title}`);
    Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([label, n]) => console.log(`  ${String(n).padStart(4)}  ${label}`));
  };
  console.log(`Read ${rows.length} rows from ${path.basename(input)}: ${listings.length} imported, ${skipped.length} skipped, ${overridden} overridden.`);
  table("Skipped", count(skipped, ([, reason]) => reason.replace(/\s*\(.*\)$/, "")));
  if (verbose) skipped.forEach(([ref, reason]) => console.log(`        ${reason}: ${ref}`));
  table("By location", count(listings, (l) => l.neighborhoodId));
  table("By offer", count(listings, (l) => l.offerType));
  table("Price basis (and the rule that decided it)", count(listings, (l) => `${l.priceBasis} ${l.priceCurrency} — ${l.priceRule}`));
  table("Title document", count(listings, (l) => l.titleDocument || "(not stated)"));
  console.log(`\n  ${listings.filter((l) => !l.sizeSqm).length} listings have no single plot size.`);

  const review = listings.filter((l) => ["too low to be a total", "plausible as a total", "small amount, no size", "fits neither a total nor a rate", "no price"].includes(l.priceRule));
  console.log(`\nPrices decided by judgement or left unknown (${review.length}). Check these; correct any in data/listing-overrides.json:`);
  review.forEach((l) => console.log(`  ${l.priceBasis.padEnd(8)} ${l.id}\n           ${formatAmount(l)} · ${l.sizeSqm || "?"} sqm · ${l.neighborhoodId} · ${l.priceRule}`));

  console.log(`\nTitle and Land Size disagree (${sizeMismatches.length}). Correct the size in data/listing-overrides.json ({ "sizeSqm": 8000 }):`);
  sizeMismatches.forEach((line) => console.log(`  ${line}`));

  console.log("\nMedian asking ₦/sqm, naira sale listings (dollar listings join in the app at the live rate):");
  const final = {};
  for (const l of listings) {
    if (l.offerType !== "Sale" || l.priceCurrency !== "NGN") continue;
    const rate = l.priceBasis === "per_sqm" ? l.priceAmount : l.priceBasis === "total" && l.sizeSqm ? l.priceAmount / l.sizeSqm : 0;
    if (rate) (final[l.neighborhoodId] ||= []).push(rate);
  }
  Object.entries(final).sort((a, b) => b[1].length - a[1].length)
    .forEach(([area, rates]) => console.log(`  ${area.padEnd(16)} n=${String(rates.length).padStart(3)}  ₦${Math.round(median(rates)).toLocaleString("en-US")}`));
}

function formatAmount(listing) {
  return `${listing.priceCurrency === "USD" ? "$" : "₦"}${listing.priceAmount.toLocaleString("en-US")}`;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return String(value || "listing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "listing";
}

// RFC 4180: quoted cells may hold commas, line breaks and doubled quotes.
function parseCsv(text) {
  const records = [];
  let record = [];
  let cell = "";
  let quoted = false;
  const source = text.replace(/^﻿/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { record.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      record.push(cell);
      records.push(record);
      record = [];
      cell = "";
    } else cell += char;
  }
  if (cell || record.length) { record.push(cell); records.push(record); }
  const [header, ...body] = records.filter((item) => item.some((value) => value !== ""));
  return body.map((item) => Object.fromEntries(header.map((name, index) => [name.trim(), item[index] ?? ""])));
}
