import { getDb, nowIso } from "./database.js";

const landUses = new Set(["Residential", "Commercial", "Mixed-use"]);
const sizeUnits = new Set(["sqm", "ha", "acres"]);
const titleDocuments = new Set(["C of O", "Governor's Consent", "Excision", "Gazette", "Deed of Assignment", "Registered Survey"]);
const listingStatuses = new Set(["Available", "Under offer", "Sold", "Off-market", "Coming soon"]);

export async function getLandListings(options = {}) {
  const includeDrafts = Boolean(options.includeDrafts);
  const rows = getDb()
    .prepare(`
      SELECT land_listings.*, neighborhoods.name AS neighborhood_name
      FROM land_listings
      JOIN neighborhoods ON neighborhoods.id = land_listings.neighborhood_id
      ${includeDrafts ? "" : "WHERE land_listings.workflow_status = 'Published'"}
      ORDER BY land_listings.rowid ASC
    `)
    .all();
  return rows.map(toListing);
}

export async function getLandListing(id, options = {}) {
  const row = getDb()
    .prepare(`
      SELECT land_listings.*, neighborhoods.name AS neighborhood_name
      FROM land_listings
      JOIN neighborhoods ON neighborhoods.id = land_listings.neighborhood_id
      WHERE land_listings.id = ?
    `)
    .get(id);
  if (!row) return null;
  const listing = toListing(row);
  if (!options.includeDrafts && listing.workflowStatus !== "Published") return null;
  return listing;
}

export async function createLandListing(input = {}, actor = "Admin") {
  const listing = normalizeListing(input, actor);
  const now = nowIso();
  getDb()
    .prepare(`
      INSERT INTO land_listings (
        id, title, neighborhood_id, estate, size_value, size_unit, size_sqm,
        land_use, asking_price, title_document, listing_status, workflow_status,
        description, photos, author, created_at, updated_at, published_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
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
      listing.workflowStatus === "Published" ? now : null
    );
  logListingActivity(listing, listing.workflowStatus === "Published" ? "published" : "saved draft for");
  return getLandListing(listing.id, { includeDrafts: true });
}

export async function updateLandListing(id, patch = {}, actor = "Admin") {
  const existing = await getLandListing(id, { includeDrafts: true });
  if (!existing) return null;
  const listing = normalizeListing({ ...existing, ...patch, id }, actor, true);
  const now = nowIso();
  const publishedAt = listing.workflowStatus === "Published" ? existing.publishedAt || now : null;
  getDb()
    .prepare(`
      UPDATE land_listings
      SET title = ?, neighborhood_id = ?, estate = ?, size_value = ?, size_unit = ?,
          size_sqm = ?, land_use = ?, asking_price = ?, title_document = ?,
          listing_status = ?, workflow_status = ?, description = ?, photos = ?,
          author = ?, updated_at = ?, published_at = ?
      WHERE id = ?
    `)
    .run(
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
      id
    );
  logListingActivity(listing, listing.workflowStatus === "Published" ? "updated" : "saved draft for");
  return getLandListing(id, { includeDrafts: true });
}

export async function deleteLandListing(id, actor = "Admin") {
  const existing = await getLandListing(id, { includeDrafts: true });
  if (!existing) return null;
  getDb().prepare("DELETE FROM land_listings WHERE id = ?").run(id);
  logListingActivity({ ...existing, author: actor }, "removed");
  return existing;
}

function normalizeListing(input, actor, keepId = false) {
  const title = String(input.title || "").trim();
  const neighborhoodId = String(input.neighborhoodId || input.neighborhood_id || "").trim();
  const workflowStatus = input.workflowStatus === "Published" || input.published ? "Published" : "Draft";
  const photos = normalizePhotos(input.photos);
  if (workflowStatus === "Published") {
    if (!title) throw new Error("A title is required before publishing");
    if (!neighborhoodId) throw new Error("A location is required before publishing");
    if (!photos.length) throw new Error("At least one photo is required before publishing");
  }
  if (!neighborhoodId) throw new Error("Location is required");
  const sizeUnit = sizeUnits.has(input.sizeUnit) ? input.sizeUnit : "sqm";
  const sizeValue = Number(input.sizeValue ?? input.size_value) || 0;
  const landUse = landUses.has(input.landUse || input.land_use) ? input.landUse || input.land_use : "Residential";
  const titleDocument = titleDocuments.has(input.titleDocument || input.title_document) ? input.titleDocument || input.title_document : "C of O";
  const listingStatus = listingStatuses.has(input.listingStatus || input.listing_status) ? input.listingStatus || input.listing_status : "Available";
  return {
    id: keepId ? input.id : uniqueId(input.id || title || "land-listing"),
    title: title || "Untitled listing",
    neighborhoodId,
    estate: String(input.estate || "").trim(),
    sizeValue,
    sizeUnit,
    sizeSqm: toSqm(sizeValue, sizeUnit),
    landUse,
    askingPrice: Number(input.askingPrice ?? input.asking_price) || 0,
    titleDocument,
    listingStatus,
    workflowStatus,
    description: String(input.description || "").trim(),
    photos,
    author: String(actor || input.author || "Admin").trim()
  };
}

function toListing(row) {
  return {
    id: row.id,
    title: row.title,
    neighborhoodId: row.neighborhood_id,
    neighborhoodName: row.neighborhood_name,
    estate: row.estate,
    sizeValue: Number(row.size_value) || 0,
    sizeUnit: row.size_unit || "sqm",
    sizeSqm: Number(row.size_sqm) || 0,
    landUse: row.land_use,
    askingPrice: Number(row.asking_price) || 0,
    titleDocument: row.title_document,
    listingStatus: row.listing_status,
    workflowStatus: row.workflow_status,
    published: row.workflow_status === "Published",
    description: row.description,
    photos: normalizePhotos(parseJson(row.photos, [])),
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
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

function uniqueId(value) {
  const base = slugify(value);
  let id = base;
  let suffix = 2;
  const exists = getDb().prepare("SELECT 1 FROM land_listings WHERE id = ?");
  while (exists.get(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function logListingActivity(listing, action) {
  const id = uniqueActivityId(`${listing.id}-${action}`);
  getDb()
    .prepare(`
      INSERT INTO team_activity (id, initials, text, activity, highlight, created_at, updated_at)
      VALUES (?, ?, ?, 'just now', ?, ?, ?)
    `)
    .run(
      id,
      initials(listing.author),
      `${listing.author} ${action} land listing ${listing.title}`,
      listing.workflowStatus === "Published" ? 1 : 0,
      nowIso(),
      nowIso()
    );
}

function uniqueActivityId(value) {
  const base = slugify(value || "listing-activity");
  let id = base;
  let suffix = 2;
  const exists = getDb().prepare("SELECT 1 FROM team_activity WHERE id = ?");
  while (exists.get(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
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
