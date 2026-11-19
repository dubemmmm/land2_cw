import crypto from "crypto";
import { getDb, nowIso, uniqueId } from "./database.js";
import { getUsdNgnRate } from "./fx.js";
import { getListingFields } from "./listingFieldStore.js";
import { MAX_PHOTOS, cleanCustom } from "./listingFields.js";
import { deleteObject, keyFromUrl } from "./s3.js";

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

const COLUMNS = `land_listings.id, title, neighborhood_id, estate, size_value, size_unit, size_sqm,
             land_use, asking_price, title_document, listing_status, workflow_status, photos,
             author, land_listings.created_at, land_listings.updated_at, published_at,
             source_id, source_url, address, offer_type, price_amount, price_currency,
             price_basis, agent_name, agent_phone, listed_at, custom, deleted_at`;

// options.summary shortens each description, for pages that list many plots.
// Listings in the bin are left out unless options.includeDeleted.
export async function getLandListings(options = {}) {
  const fx = await getUsdNgnRate();
  const where = [
    options.includeDrafts ? "" : "land_listings.workflow_status = 'Published'",
    options.includeDeleted ? "" : "land_listings.deleted_at IS NULL"
  ].filter(Boolean);
  const description = options.summary ? `substr(land_listings.description, 1, ${SUMMARY_LENGTH + 1}) AS description` : "land_listings.description";
  const rows = await (await getDb()).all(`
      SELECT ${COLUMNS}, ${description}, neighborhoods.name AS neighborhood_name
      FROM land_listings
      JOIN neighborhoods ON neighborhoods.id = land_listings.neighborhood_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY COALESCE(NULLIF(listed_at, ''), land_listings.created_at) DESC, land_listings.id
    `);
  return rows.map((row) => toListing(row, fx, options.summary));
}

export async function getLandListing(id, options = {}) {
  const [listing] = await listingsByIds([id]);
  if (!listing) return null;
  if (!options.includeDrafts && listing.workflowStatus !== "Published") return null;
  if (!options.includeDeleted && listing.deletedAt) return null;
  return listing;
}

// Full listings by id, drafts and binned ones included, in the order asked for.
async function listingsByIds(ids, db) {
  if (!ids.length) return [];
  const store = db || (await getDb());
  const found = new Map();
  for (let start = 0; start < ids.length; start += 200) {
    const chunk = ids.slice(start, start + 200);
    const rows = await store.all(`
        SELECT ${COLUMNS}, land_listings.description, neighborhoods.name AS neighborhood_name
        FROM land_listings
        JOIN neighborhoods ON neighborhoods.id = land_listings.neighborhood_id
        WHERE land_listings.id IN (${chunk.map(() => "?").join(", ")})
      `, ...chunk);
    const fx = await getUsdNgnRate();
    for (const row of rows) found.set(row.id, toListing(row, fx));
  }
  return ids.map((id) => found.get(id)).filter(Boolean);
}

export async function createLandListing(input = {}, actor = "Admin") {
  const fields = await getListingFields({ includeArchived: true });
  const listing = await normalizeListing(input, actor, false, fields);
  const now = nowIso();
  await (await getDb()).run(`
      INSERT INTO land_listings (
        id, title, neighborhood_id, estate, size_value, size_unit, size_sqm,
        land_use, asking_price, title_document, listing_status, workflow_status,
        description, photos, author, created_at, updated_at, published_at,
        address, offer_type, price_amount, price_currency, price_basis,
        agent_name, agent_phone, listed_at, custom
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      now.slice(0, 10),
      JSON.stringify(listing.custom)
    );
  await recordChanges([{ listingId: listing.id, field: "created", before: {}, after: {} }], actor, now);
  await logListingActivity(listing, listing.workflowStatus === "Published" ? "published" : "saved draft for");
  return getLandListing(listing.id, { includeDrafts: true });
}

// Change one listing. Every field that ends up different is written to its history.
export async function updateLandListing(id, patch = {}, actor = "Admin") {
  const [listing] = await updateLandListings([id], patch, actor);
  if (!listing) return null;
  await logListingActivity({ ...listing, author: actor }, listing.workflowStatus === "Published" ? "updated" : "saved draft for");
  return listing;
}

// The same change made to many listings at once, saved together or not at all.
// `patch.custom` is merged into each listing's own custom values.
export async function updateLandListings(ids, patch = {}, actor = "Admin") {
  const db = await getDb();
  const existing = await listingsByIds([...new Set(ids)]);
  if (!existing.length) return [];
  const fields = await getListingFields({ includeArchived: true });
  const now = nowIso();
  const saves = [];
  const changes = [];
  for (const before of existing) {
    const merged = { ...before, ...patch, id: before.id, custom: { ...before.custom, ...(patch.custom || {}) } };
    // "published" on a stored listing only mirrors workflowStatus; a patch may use either.
    merged.workflowStatus = "published" in patch ? (patch.published ? "Published" : "Draft") : merged.workflowStatus;
    delete merged.published;
    const after = await normalizeListing(merged, actor, true, fields);
    const changed = diffListing(before, after);
    if (!changed.length) continue;
    saves.push({ before, after });
    for (const change of changed) changes.push({ listingId: before.id, ...change });
  }
  if (saves.length) {
    await db.transaction(async (tx) => {
      for (const { before, after } of saves) {
        await tx.run(`
            UPDATE land_listings
            SET title = ?, neighborhood_id = ?, estate = ?, size_value = ?, size_unit = ?,
                size_sqm = ?, land_use = ?, asking_price = ?, title_document = ?,
                listing_status = ?, workflow_status = ?, description = ?, photos = ?,
                author = ?, updated_at = ?, published_at = ?, address = ?, offer_type = ?,
                price_amount = ?, price_currency = ?, price_basis = ?, agent_name = ?, agent_phone = ?,
                custom = ?
            WHERE id = ?
          `,
          after.title,
          after.neighborhoodId,
          after.estate,
          after.sizeValue,
          after.sizeUnit,
          after.sizeSqm,
          after.landUse,
          after.askingPrice,
          after.titleDocument,
          after.listingStatus,
          after.workflowStatus,
          after.description,
          JSON.stringify(after.photos),
          after.author,
          now,
          after.workflowStatus === "Published" ? before.publishedAt || now : null,
          after.address,
          after.offerType,
          after.priceAmount,
          after.priceCurrency,
          after.priceBasis,
          after.agentName,
          after.agentPhone,
          JSON.stringify(after.custom),
          before.id
        );
      }
      await recordChanges(changes, actor, now, tx);
    });
  }
  return listingsByIds(existing.map((listing) => listing.id));
}

// A listing as a buyer may see it: staff-only details and who edited it left out.
export function buyerView(listing, fields) {
  const shown = new Set(fields.filter((field) => field.showToBuyers && !field.archived).map((field) => field.id));
  const { author, deletedAt, ...rest } = listing;
  return { ...rest, custom: Object.fromEntries(Object.entries(listing.custom || {}).filter(([id]) => shown.has(id))) };
}

/* ---------- The bin ---------- */

// Deleting moves a listing to the bin: hidden everywhere, and restorable.
export async function binLandListings(ids, actor = "Admin") {
  return setBinned(ids, true, actor);
}

export async function restoreLandListings(ids, actor = "Admin") {
  return setBinned(ids, false, actor);
}

async function setBinned(ids, binned, actor) {
  const db = await getDb();
  const targets = (await listingsByIds([...new Set(ids)])).filter((listing) => Boolean(listing.deletedAt) !== binned);
  if (!targets.length) return listingsByIds([...new Set(ids)]);
  const now = nowIso();
  await db.transaction(async (tx) => {
    for (const listing of targets) {
      await tx.run("UPDATE land_listings SET deleted_at = ?, updated_at = ? WHERE id = ?", binned ? now : null, now, listing.id);
    }
    await recordChanges(targets.map((listing) => ({ listingId: listing.id, field: binned ? "binned" : "restored", before: {}, after: {} })), actor, now, tx);
  });
  if (targets.length === 1) await logListingActivity({ ...targets[0], author: actor }, binned ? "moved to the bin" : "restored");
  return listingsByIds([...new Set(ids)]);
}

// Removes binned listings for good, with their history and every photo they
// ever had. Only listings already in the bin can be purged.
export async function purgeLandListings(ids) {
  const db = await getDb();
  const targets = (await listingsByIds([...new Set(ids)])).filter((listing) => listing.deletedAt);
  for (const listing of targets) {
    const history = await db.all("SELECT before_value, after_value FROM listing_changes WHERE listing_id = ? AND field = 'photos'", listing.id);
    const photos = new Set(listing.photos);
    for (const row of history) {
      for (const value of [row.before_value, row.after_value]) {
        for (const photo of parseJson(value, {}).photos || []) photos.add(photo);
      }
    }
    await db.transaction(async (tx) => {
      await tx.run("DELETE FROM listing_changes WHERE listing_id = ?", listing.id);
      await tx.run("DELETE FROM land_listings WHERE id = ?", listing.id);
    });
    await removeStoredPhotos([...photos]);
  }
  return targets.map((listing) => listing.id);
}

// Kept for older callers: deleting now means moving to the bin.
export async function deleteLandListing(id, actor = "Admin") {
  const [listing] = await binLandListings([id], actor);
  return listing || null;
}

/* ---------- History ---------- */

// What a save changed, as { field, before, after }, where before and after are
// the patches that would set the field to each value. Putting a change back is
// then just saving its "before".
const TRACKED = ["title", "neighborhoodId", "estate", "address", "offerType", "landUse", "priceAmount", "priceCurrency", "priceBasis", "titleDocument", "listingStatus", "workflowStatus", "agentName", "agentPhone", "description"];

function diffListing(before, after) {
  const changes = [];
  for (const key of TRACKED) {
    if (String(before[key] ?? "") !== String(after[key] ?? "")) changes.push({ field: key, before: { [key]: before[key] }, after: { [key]: after[key] } });
  }
  if (Number(before.sizeValue) !== Number(after.sizeValue) || before.sizeUnit !== after.sizeUnit) {
    changes.push({ field: "size", before: { sizeValue: before.sizeValue, sizeUnit: before.sizeUnit }, after: { sizeValue: after.sizeValue, sizeUnit: after.sizeUnit } });
  }
  if (JSON.stringify(before.photos) !== JSON.stringify(after.photos)) {
    changes.push({ field: "photos", before: { photos: before.photos }, after: { photos: after.photos } });
  }
  for (const id of new Set([...Object.keys(before.custom || {}), ...Object.keys(after.custom || {})])) {
    const was = before.custom?.[id] ?? null;
    const now = after.custom?.[id] ?? null;
    if (was !== now) changes.push({ field: `custom.${id}`, before: { custom: { [id]: was } }, after: { custom: { [id]: now } } });
  }
  return changes;
}

async function recordChanges(changes, actor, at, db) {
  if (!changes.length) return;
  const store = db || (await getDb());
  for (let start = 0; start < changes.length; start += 40) {
    const chunk = changes.slice(start, start + 40);
    await store.run(
      `INSERT INTO listing_changes (id, listing_id, field, before_value, after_value, actor, created_at)
       VALUES ${chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ")}`,
      ...chunk.flatMap((change) => [crypto.randomUUID(), change.listingId, change.field, JSON.stringify(change.before), JSON.stringify(change.after), String(actor || "Admin"), at])
    );
  }
}

// A listing's changes, newest first.
export async function getListingHistory(id, limit = 100) {
  const rows = await (await getDb()).all(
    "SELECT id, field, before_value, after_value, actor, created_at FROM listing_changes WHERE listing_id = ? ORDER BY created_at DESC, id LIMIT ?",
    id, limit
  );
  return rows.map((row) => ({
    id: row.id,
    field: row.field,
    before: parseJson(row.before_value, {}),
    after: parseJson(row.after_value, {}),
    actor: row.actor,
    at: row.created_at
  }));
}

// Puts one field back to what it was before the given change.
export async function restoreListingChange(listingId, changeId, actor = "Admin") {
  const row = await (await getDb()).get("SELECT field, before_value FROM listing_changes WHERE id = ? AND listing_id = ?", changeId, listingId);
  if (!row) return null;
  if (["created", "binned", "restored"].includes(row.field)) throw new Error("This entry cannot be put back");
  return updateLandListing(listingId, parseJson(row.before_value, {}), actor);
}

async function normalizeListing(input, actor, keepId = false, customFields = []) {
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
    custom: cleanCustom(input.custom, customFields),
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
    custom: parseJson(row.custom || "{}", {}) || {},
    deletedAt: row.deleted_at || null,
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

// Photos no longer on any listing are deleted from photo storage. A failure
// here only leaves an unused file behind, so it never fails the save.
async function removeStoredPhotos(photos) {
  for (const photo of photos) {
    const key = keyFromUrl(photo);
    if (key) await deleteObject(key).catch(() => false);
  }
}

function normalizePhotos(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((photo) => String(typeof photo === "string" ? photo : photo?.url || "").trim())
    .filter(Boolean)
    .slice(0, MAX_PHOTOS);
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
