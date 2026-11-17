import { getDb, nowIso, uniqueId } from "./database.js";
import { getUsdNgnRate } from "./fx.js";

// "" means the listing does not say.
const landUses = new Set(["Residential", "Commercial", "Mixed-use", "Industrial", ""]);
const sizeUnits = new Set(["sqm", "ha", "acres"]);
const titleDocuments = new Set(["C of O", "Governor's Consent", "Excision", "Gazette", "Deed of Assignment", "Registered Survey", ""]);
const listingStatuses = new Set(["Available", "Under offer", "Sold", "Off-market", "Coming soon"]);
const offerTypes = new Set(["Sale", "Joint venture", "Lease"]);
// How the seller quoted the price. Only "total" and "per_sqm" are sale prices
// that can be compared; "unknown" is an amount whose basis could not be settled.
const priceBases = new Set(["total", "per_sqm", "lease", "lease_per_sqm", "unknown"]);
const SUMMARY_LENGTH = 280;

// options.summary shortens each description, for pages that list many plots.
export async function getLandListings(options = {}) {
  const fx = await getUsdNgnRate();
  const includeDrafts = Boolean(options.includeDrafts);
  const description = options.summary ? `substr(land_listings.description, 1, ${SUMMARY_LENGTH + 1}) AS description` : "land_listings.description";
  const rows = await (await getDb()).all(`
      SELECT land_listings.id, title, neighborhood_id, estate, size_value, size_unit, size_sqm,
             land_use, asking_price, title_document, listing_status, workflow_status, photos,
             author, land_listings.created_at, land_listings.updated_at, published_at,
             source_id, source_url, address, offer_type, price_amount, price_currency,
             price_basis, agent_name, agent_phone, listed_at,
             ${description}, neighborhoods.name AS neighborhood_name
      FROM land_listings
      JOIN neighborhoods ON neighborhoods.id = land_listings.neighborhood_id
      ${includeDrafts ? "" : "WHERE land_listings.workflow_status = 'Published'"}
      ORDER BY COALESCE(NULLIF(listed_at, ''), land_listings.created_at) DESC, land_listings.id
    `);
  return rows.map((row) => toListing(row, fx, options.summary));
}

export async function getLandListing(id, options = {}) {
  const row = await (await getDb()).get(`
      SELECT land_listings.*, neighborhoods.name AS neighborhood_name
      FROM land_listings
      JOIN neighborhoods ON neighborhoods.id = land_listings.neighborhood_id
      WHERE land_listings.id = ?
    `, id);
  if (!row) return null;
  const listing = toListing(row, await getUsdNgnRate());
  if (!options.includeDrafts && listing.workflowStatus !== "Published") return null;
  return listing;
}

export async function createLandListing(input = {}, actor = "Admin") {
  const listing = await normalizeListing(input, actor);
  const now = nowIso();
  await (await getDb()).run(`
      INSERT INTO land_listings (
        id, title, neighborhood_id, estate, size_value, size_unit, size_sqm,
        land_use, asking_price, title_document, listing_status, workflow_status,
        description, photos, author, created_at, updated_at, published_at,
        address, offer_type, price_amount, price_currency, price_basis,
        agent_name, agent_phone, listed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, 
      listing.id,
      listing.title,
      listing.neighborhoodId,
      listing.estate,
      listing.sizeValue,
      listing.sizeUnit,
      listing.sizeSqm,
      listing.landUse,
      listing.askingPrice,
      listing.titleDocument,
      listing.listingStatus,
      listing.workflowStatus,
      listing.description,
      JSON.stringify(listing.photos),
      listing.author,
      now,
      now,
      listing.workflowStatus === "Published" ? now : null,
      listing.address,
      listing.offerType,
      listing.priceAmount,
      listing.priceCurrency,
      listing.priceBasis,
      listing.agentName,
      listing.agentPhone,
      now.slice(0, 10)
    );
  await logListingActivity(listing, listing.workflowStatus === "Published" ? "published" : "saved draft for");
  return getLandListing(listing.id, { includeDrafts: true });
}

export async function updateLandListing(id, patch = {}, actor = "Admin") {
  const existing = await getLandListing(id, { includeDrafts: true });
  if (!existing) return null;
  const listing = await normalizeListing({ ...existing, ...patch, id }, actor, true);
  const now = nowIso();
  const publishedAt = listing.workflowStatus === "Published" ? existing.publishedAt || now : null;
  await (await getDb()).run(`
      UPDATE land_listings
      SET title = ?, neighborhood_id = ?, estate = ?, size_value = ?, size_unit = ?,
          size_sqm = ?, land_use = ?, asking_price = ?, title_document = ?,
          listing_status = ?, workflow_status = ?, description = ?, photos = ?,
          author = ?, updated_at = ?, published_at = ?, address = ?, offer_type = ?,
          price_amount = ?, price_currency = ?, price_basis = ?, agent_name = ?, agent_phone = ?
      WHERE id = ?
    `, 
      listing.title,
      listing.neighborhoodId,
      listing.estate,
      listing.sizeValue,
      listing.sizeUnit,
      listing.sizeSqm,
      listing.landUse,
      listing.askingPrice,
      listing.titleDocument,
      listing.listingStatus,
      listing.workflowStatus,
      listing.description,
      JSON.stringify(listing.photos),
      listing.author,
      now,
      publishedAt,
      listing.address,
      listing.offerType,
      listing.priceAmount,
      listing.priceCurrency,
      listing.priceBasis,
      listing.agentName,
      listing.agentPhone,
      id
    );
  await logListingActivity(listing, listing.workflowStatus === "Published" ? "updated" : "saved draft for");
  return getLandListing(id, { includeDrafts: true });
}

export async function deleteLandListing(id, actor = "Admin") {
  const existing = await getLandListing(id, { includeDrafts: true });
  if (!existing) return null;
  await (await getDb()).run("DELETE FROM land_listings WHERE id = ?", id);
  await logListingActivity({ ...existing, author: actor }, "removed");
  return existing;
}

async function normalizeListing(input, actor, keepId = false) {
  const title = String(input.title || "").trim();
  const neighborhoodId = String(input.neighborhoodId || input.neighborhood_id || "").trim();
  const workflowStatus = input.workflowStatus === "Published" || input.published ? "Published" : "Draft";
  const photos = normalizePhotos(input.photos);
  if (workflowStatus === "Published") {
    if (!title) throw new Error("A title is required before publishing");
    if (!neighborhoodId) throw new Error("A location is required before publishing");
  }
  if (!neighborhoodId) throw new Error("Location is required");
  const sizeUnit = sizeUnits.has(input.sizeUnit) ? input.sizeUnit : "sqm";
  const sizeValue = Number(input.sizeValue ?? input.size_value) || 0;
  const landUse = landUses.has(input.landUse ?? input.land_use) ? input.landUse ?? input.land_use : "";
  const titleDocument = titleDocuments.has(input.titleDocument ?? input.title_document) ? input.titleDocument ?? input.title_document : "";
  const sizeSqm = toSqm(sizeValue, sizeUnit);
  const priceCurrency = input.priceCurrency === "USD" ? "USD" : "NGN";
  const priceBasis = priceBases.has(input.priceBasis) ? input.priceBasis : "total";
  // priceAmount is what the seller quoted; askingPrice alone is the older form's naira total.
  const priceAmount = Number(input.priceAmount ?? input.askingPrice ?? input.asking_price) || 0;
  const listingStatus = listingStatuses.has(input.listingStatus || input.listing_status) ? input.listingStatus || input.listing_status : "Available";
  return {
    id: keepId ? input.id : await uniqueId("land_listings", slugify(input.id || title || "land-listing")),
    title: title || "Untitled listing",
    neighborhoodId,
    estate: String(input.estate || "").trim(),
    sizeValue,
    sizeUnit,
    sizeSqm,
    landUse,
    // The stored naira total, where it is known without converting currency.
    askingPrice: priceCurrency !== "NGN" ? 0 : priceBasis === "total" ? priceAmount : priceBasis === "per_sqm" ? Math.round(priceAmount * sizeSqm) : 0,
    priceAmount,
    priceCurrency,
    priceBasis,
    offerType: offerTypes.has(input.offerType) ? input.offerType : "Sale",
    address: String(input.address || "").trim(),
    agentName: String(input.agentName || "").trim(),
    agentPhone: String(input.agentPhone || "").trim(),
    titleDocument,
    listingStatus,
    workflowStatus,
    description: String(input.description || "").trim(),
    photos,
    author: String(actor || input.author || "Admin").trim()
  };
}

function toListing(row, fx, summary = false) {
  const sizeSqm = Number(row.size_sqm) || 0;
  const description = String(row.description || "");
  return {
    id: row.id,
    title: row.title,
    neighborhoodId: row.neighborhood_id,
    neighborhoodName: row.neighborhood_name,
    estate: row.estate,
    address: row.address || "",
    sizeValue: Number(row.size_value) || 0,
    sizeUnit: row.size_unit || "sqm",
    sizeSqm,
    landUse: row.land_use,
    offerType: row.offer_type || "Sale",
    ...priceFields(row, sizeSqm, fx),
    titleDocument: row.title_document,
    listingStatus: row.listing_status,
    workflowStatus: row.workflow_status,
    published: row.workflow_status === "Published",
    description: summary && description.length > SUMMARY_LENGTH ? `${description.slice(0, SUMMARY_LENGTH).trimEnd()}…` : description,
    photos: normalizePhotos(parseJson(row.photos, [])),
    agentName: row.agent_name || "",
    agentPhone: row.agent_phone || "",
    sourceId: row.source_id || "",
    sourceUrl: row.source_url || "",
    author: row.author,
    listedAt: row.listed_at || String(row.created_at || "").slice(0, 10),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

// Every listing ends up with the same two naira figures, however it was quoted:
// askingPrice for the whole plot and pricePerSqm. Either is 0 when it cannot be
// worked out (no plot size, a lease, an unsettled basis, or dollars with no rate).
function priceFields(row, sizeSqm, fx) {
  const priceBasis = row.price_basis || "total";
  const priceCurrency = row.price_currency === "USD" ? "USD" : "NGN";
  const priceAmount = Number(row.price_amount) || Number(row.asking_price) || 0;
  const rate = priceCurrency === "USD" ? Number(fx?.rate) || 0 : 1;
  const naira = priceAmount * rate;
  let askingPrice = 0;
  let pricePerSqm = 0;
  if (priceBasis === "total") {
    askingPrice = naira;
    pricePerSqm = sizeSqm ? naira / sizeSqm : 0;
  } else if (priceBasis === "per_sqm") {
    pricePerSqm = naira;
    askingPrice = naira * sizeSqm;
  }
  const converted = priceCurrency === "USD" && rate > 0;
  return {
    askingPrice: Math.round(askingPrice),
    pricePerSqm: Math.round(pricePerSqm),
    priceAmount,
    priceCurrency,
    priceBasis,
    // The lease or unsettled amount in naira, for display only.
    quotedNaira: Math.round(naira),
    converted,
    fxRate: converted ? rate : null,
    fxAsOf: converted ? fx.asOf || null : null
  };
}

function normalizePhotos(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((photo) => String(typeof photo === "string" ? photo : photo?.url || "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function toSqm(value, unit) {
  const size = Number(value) || 0;
  if (unit === "ha") return Math.round(size * 10000);
  if (unit === "acres") return Math.round(size * 4046.8564224);
  return Math.round(size);
}


async function logListingActivity(listing, action) {
  const id = await uniqueId("team_activity", slugify(`${listing.id}-${action}` || "listing-activity"));
  await (await getDb()).run(`
      INSERT INTO team_activity (id, initials, text, activity, highlight, created_at, updated_at)
      VALUES (?, ?, ?, 'just now', ?, ?, ?)
    `, 
      id,
      initials(listing.author),
      `${listing.author} ${action} land listing ${listing.title}`,
      listing.workflowStatus === "Published" ? 1 : 0,
      nowIso(),
      nowIso()
    );
}


function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function initials(value = "CW") {
  return String(value)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "CW";
}

function slugify(value) {
  return String(value || "listing")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "listing";
}
