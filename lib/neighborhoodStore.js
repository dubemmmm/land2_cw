import { confidence, getDb, nowIso } from "./database.js";

export async function getNeighborhoods() {
  const rows = getDb().prepare("SELECT data FROM neighborhoods ORDER BY rowid").all();
  return rows.map((row) => JSON.parse(row.data));
}

export async function getNeighborhood(id) {
  const row = getDb().prepare("SELECT data FROM neighborhoods WHERE id = ?").get(id);
  return row ? JSON.parse(row.data) : null;
}

export async function createNeighborhood(input) {
  const records = await getNeighborhoods();
  const record = defaultRecord(input, records);
  const now = nowIso();
  getDb()
    .prepare(`
      INSERT INTO neighborhoods (id, name, jurisdiction, confidence, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(record.id, record.name, record.jurisdiction || "", confidence(record), JSON.stringify(record), now, now);
  logEvent(record.id, "create", record);
  return record;
}

export async function updateNeighborhood(id, patch) {
  const existing = await getNeighborhood(id);
  if (!existing) return null;
  const record = mergeDeep(clone(existing), patch);
  record.id = id;
  record.metadata = {
    ...(record.metadata || {}),
    lastReviewed: record.metadata?.lastReviewed || new Date().toISOString().slice(0, 10)
  };
  const now = nowIso();
  getDb()
    .prepare(`
      UPDATE neighborhoods
      SET name = ?, jurisdiction = ?, confidence = ?, data = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(record.name, record.jurisdiction || "", confidence(record), JSON.stringify(record), now, id);
  logEvent(id, "update", patch);
  return record;
}

export async function deleteNeighborhood(id) {
  const record = await getNeighborhood(id);
  if (!record) return null;
  logEvent(id, "delete", { id });
  getDb().prepare("DELETE FROM neighborhoods WHERE id = ?").run(id);
  return record;
}

export async function getDataEvents(limit = 50) {
  return getDb()
    .prepare(`
      SELECT id, neighborhood_id AS neighborhoodId, action, actor, payload, created_at AS createdAt
      FROM data_events
      ORDER BY id DESC
      LIMIT ?
    `)
    .all(limit)
    .map((event) => ({
      ...event,
      payload: event.payload ? JSON.parse(event.payload) : null
    }));
}

function logEvent(neighborhoodId, action, payload, actor = "Admin") {
  getDb()
    .prepare(`
      INSERT INTO data_events (neighborhood_id, action, actor, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(neighborhoodId, action, actor, JSON.stringify(payload || {}), nowIso());
}

function defaultRecord(input = {}, records = []) {
  const name = String(input.name || "New Neighborhood").trim();
  const baseId = slugify(input.id || name);
  let id = baseId;
  const used = new Set(records.map((record) => record.id));
  let suffix = 2;
  while (used.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return mergeDeep({
    id,
    name,
    jurisdiction: input.jurisdiction || "Lagos",
    geometry: {
      center: [6.45, 3.44],
      polygon: [[6.454, 3.434], [6.456, 3.444], [6.448, 3.448], [6.444, 3.438]]
    },
    recommendation: {
      headline: "Needs planning intelligence review",
      summary: "New record created from the admin interface.",
      bestNextAction: "Add source documents, planning constraints, and approval history.",
      riskLevel: "Unknown",
      confidence: 0,
      confidenceReason: "No verified source coverage has been entered yet."
    },
    intelligence: {
      buildParameters: [
        { label: "Permitted use", value: "To verify", sourceType: "Manual" },
        { label: "Height limit", value: "To verify", sourceType: "Manual" },
        { label: "Setback review", value: "Required", sourceType: "Manual" },
        { label: "Approval path", value: "Unknown", sourceType: "Manual" }
      ],
      constraints: [{ label: "No constraints have been verified yet", sourceType: "Manual" }],
      redFlags: ["Source coverage missing"],
      documentsToRequest: ["Survey plan", "Land-use confirmation", "Planning guidance"]
    },
    approvals: [],
    notes: [],
    metadata: {
      lastReviewed: new Date().toISOString().slice(0, 10),
      reviewedBy: "Admin",
      freshness: "Needs review",
      reviewStatus: "Draft",
      datasets: ["manual-entry"]
    }
  }, input);
}

function slugify(value) {
  return String(value || "neighborhood")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "neighborhood";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDeep(target, patch) {
  Object.keys(patch || {}).forEach((key) => {
    if (patch[key] && typeof patch[key] === "object" && !Array.isArray(patch[key])) {
      target[key] = mergeDeep(target[key] || {}, patch[key]);
    } else {
      target[key] = patch[key];
    }
  });
  return target;
}
