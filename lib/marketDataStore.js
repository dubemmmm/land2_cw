import { getDb, nowIso } from "./database.js";

export function getMarketEstatesSync() {
  return getDb()
    .prepare(`
      SELECT id, neighborhood_id AS neighborhoodId, name, primary_use AS primaryUse, status,
             developer, available_plots AS availablePlots, total_land_sqm AS totalLandSqm,
             description, created_at AS createdAt, updated_at AS updatedAt
      FROM market_estates
      ORDER BY neighborhood_id, name
    `)
    .all();
}

export function getPricePointsSync(filter = {}) {
  const clauses = [];
  const values = [];
  if (filter.targetType) {
    clauses.push("target_type = ?");
    values.push(filter.targetType);
  }
  if (filter.targetId) {
    clauses.push("target_id = ?");
    values.push(normalizeId(filter.targetId));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare(`
      SELECT id, target_type AS targetType, target_id AS targetId, year, value, currency,
             source, created_at AS createdAt, updated_at AS updatedAt
      FROM market_price_points
      ${where}
      ORDER BY target_type, target_id, year
    `)
    .all(...values);
}

export async function getMarketEstates() {
  return getMarketEstatesSync();
}

export async function getPricePoints(filter = {}) {
  return getPricePointsSync(filter);
}

export async function createMarketEstate(input = {}) {
  const now = nowIso();
  const name = String(input.name || "").trim();
  const neighborhoodId = normalizeId(input.neighborhoodId || input.neighborhood_id || "");
  if (!name) throw new Error("Estate name is required");
  if (!neighborhoodId) throw new Error("Neighborhood is required");
  const id = uniqueId("market_estates", input.id || `${neighborhoodId}-${name}`);
  getDb()
    .prepare(`
      INSERT INTO market_estates (
        id, neighborhood_id, name, primary_use, status, developer, available_plots,
        total_land_sqm, description, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      neighborhoodId,
      name,
      String(input.primaryUse || input.primary_use || "").trim(),
      String(input.status || "").trim(),
      String(input.developer || "").trim(),
      String(input.availablePlots || input.available_plots || "").trim(),
      Number(input.totalLandSqm || input.total_land_sqm) || 0,
      String(input.description || "").trim(),
      now,
      now
    );
  return getMarketEstatesSync().find((estate) => estate.id === id);
}

export async function updateMarketEstate(id, patch = {}) {
  const existing = getMarketEstatesSync().find((estate) => estate.id === id);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  getDb()
    .prepare(`
      UPDATE market_estates
      SET neighborhood_id = ?, name = ?, primary_use = ?, status = ?, developer = ?,
          available_plots = ?, total_land_sqm = ?, description = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      normalizeId(next.neighborhoodId),
      String(next.name || "").trim(),
      String(next.primaryUse || "").trim(),
      String(next.status || "").trim(),
      String(next.developer || "").trim(),
      String(next.availablePlots || "").trim(),
      Number(next.totalLandSqm) || 0,
      String(next.description || "").trim(),
      nowIso(),
      id
    );
  return getMarketEstatesSync().find((estate) => estate.id === id);
}

export async function deleteMarketEstate(id) {
  const existing = getMarketEstatesSync().find((estate) => estate.id === id);
  if (!existing) return null;
  getDb().prepare("DELETE FROM market_price_points WHERE target_type = 'estate' AND target_id = ?").run(id);
  getDb().prepare("DELETE FROM market_estates WHERE id = ?").run(id);
  return existing;
}

export async function createPricePoint(input = {}) {
  const targetType = String(input.targetType || input.target_type || "").trim();
  const targetId = normalizeId(input.targetId || input.target_id || "");
  const year = Number(input.year);
  const value = Number(input.value);
  if (!["neighborhood", "estate"].includes(targetType)) throw new Error("Target type is required");
  if (!targetId) throw new Error("Target is required");
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("Valid year is required");
  if (!Number.isFinite(value) || value <= 0) throw new Error("Valid price value is required");
  const id = `${targetType}-${targetId}-${year}`;
  const now = nowIso();
  getDb()
    .prepare(`
      INSERT INTO market_price_points (id, target_type, target_id, year, value, currency, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(target_type, target_id, year) DO UPDATE SET
        value = excluded.value,
        currency = excluded.currency,
        source = excluded.source,
        updated_at = excluded.updated_at
    `)
    .run(id, targetType, targetId, year, value, input.currency || "NGN", input.source || "Manual", now, now);
  return getPricePointsSync({ targetType, targetId }).find((point) => point.year === year);
}

export async function deletePricePoint(id) {
  const existing = getPricePointsSync().find((point) => point.id === id);
  if (!existing) return null;
  getDb().prepare("DELETE FROM market_price_points WHERE id = ?").run(id);
  return existing;
}

export function dynamicEstateToBibleEstate(estate) {
  return {
    id: estate.id,
    neighborhood_id: normalizeId(estate.neighborhoodId),
    name: estate.name,
    location_label: estate.neighborhoodId,
    primary_use: estate.primaryUse,
    status: estate.status,
    developer: estate.developer,
    available_plots: estate.availablePlots,
    total_land_sqm: Number(estate.totalLandSqm) || 0,
    total_land_label: estate.totalLandSqm ? `${new Intl.NumberFormat("en-US").format(Number(estate.totalLandSqm))} sqm` : "",
    description: estate.description
  };
}

function uniqueId(table, value) {
  const base = slugify(value);
  let id = base;
  let suffix = 2;
  const exists = getDb().prepare(`SELECT 1 FROM ${table} WHERE id = ?`);
  while (exists.get(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function normalizeId(value = "") {
  return String(value).trim().replaceAll("_", "-");
}

function slugify(value) {
  return String(value || "record")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "record";
}
