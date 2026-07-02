import { getDb, nowIso } from "./database.js";
import { confidenceLevel, confidenceScore } from "./metrics.js";

export async function getReports() {
  const rows = getDb()
    .prepare(`
      SELECT reports.*, neighborhoods.name AS neighborhood_name, neighborhoods.data AS neighborhood_data
      FROM reports
      JOIN neighborhoods ON neighborhoods.id = reports.neighborhood_id
      ORDER BY reports.rowid
    `)
    .all();
  return rows.map(toReport);
}

export async function getReport(id) {
  const row = getDb()
    .prepare(`
      SELECT reports.*, neighborhoods.name AS neighborhood_name, neighborhoods.data AS neighborhood_data
      FROM reports
      JOIN neighborhoods ON neighborhoods.id = reports.neighborhood_id
      WHERE reports.id = ?
    `)
    .get(id);
  return row ? toReport(row) : null;
}

export async function createReport(input = {}) {
  const neighborhood = getDb().prepare("SELECT id, name, data FROM neighborhoods WHERE id = ?").get(input.neighborhoodId);
  if (!neighborhood) throw new Error("Neighborhood is required");

  const siteTitle = String(input.siteTitle || "New Client Brief").trim();
  const id = uniqueReportId(input.id || siteTitle);
  const status = input.status || "Draft";
  const now = nowIso();
  const existingCount = getDb().prepare("SELECT COUNT(*) AS count FROM reports").get().count;
  const report = {
    id,
    neighborhoodId: neighborhood.id,
    siteTitle,
    client: String(input.client || "Client").trim(),
    use: String(input.use || "Development review").trim(),
    status,
    activity: "just now",
    changes: Number(input.changes) || 0,
    ref: input.ref || `CW-CLNT-${String(existingCount + 1).padStart(3, "0")}`,
    clientVisible: Boolean(input.clientVisible || ["Shared", "Client viewed"].includes(status)),
    data: {
      changeNotes: normalizeLines(input.changeNotes) || [],
      recommendationOverride: input.recommendationOverride || null
    }
  };

  getDb()
    .prepare(`
      INSERT INTO reports (
        id, neighborhood_id, site_title, client, use_case, status, activity,
        changes, ref, client_visible, data, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      report.id,
      report.neighborhoodId,
      report.siteTitle,
      report.client,
      report.use,
      report.status,
      report.activity,
      report.changes,
      report.ref,
      report.clientVisible ? 1 : 0,
      JSON.stringify(report.data),
      now,
      now
    );
  upsertClient(report.client);
  logReportEvent(report.id, "create", report);
  return getReport(report.id);
}

export async function updateReport(id, patch = {}) {
  const existing = await getReport(id);
  if (!existing) return null;
  const next = {
    ...existing,
    ...patch,
    data: {
      ...(existing.data || {}),
      ...(patch.data || {})
    }
  };
  if (patch.changeNotes !== undefined) {
    next.data.changeNotes = normalizeLines(patch.changeNotes);
  }
  if (patch.recommendationOverride !== undefined) {
    next.data.recommendationOverride = patch.recommendationOverride;
  }
  const now = nowIso();
  getDb()
    .prepare(`
      UPDATE reports
      SET neighborhood_id = ?, site_title = ?, client = ?, use_case = ?, status = ?,
          activity = ?, changes = ?, ref = ?, client_visible = ?, data = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      next.neighborhoodId,
      next.siteTitle,
      next.client,
      next.use,
      next.status,
      next.activity,
      Number(next.changes) || 0,
      next.ref,
      next.clientVisible ? 1 : 0,
      JSON.stringify(next.data || {}),
      now,
      id
    );
  upsertClient(next.client);
  logReportEvent(id, "update", patch);
  return getReport(id);
}

export async function deleteReport(id) {
  const existing = await getReport(id);
  if (!existing) return null;
  logReportEvent(id, "delete", { id });
  getDb().prepare("DELETE FROM reports WHERE id = ?").run(id);
  return existing;
}

function toReport(row) {
  const neighborhood = JSON.parse(row.neighborhood_data);
  const score = confidenceScore(neighborhood);
  const data = row.data ? JSON.parse(row.data) : {};
  return {
    id: row.id,
    neighborhoodId: row.neighborhood_id,
    neighborhoodName: row.neighborhood_name,
    neighborhood,
    siteTitle: row.site_title,
    client: row.client,
    use: row.use_case,
    status: row.status,
    activity: row.activity,
    changes: row.changes,
    ref: row.ref,
    clientVisible: Boolean(row.client_visible),
    data,
    score,
    level: confidenceLevel(score),
    verdict: data.recommendationOverride || (score >= 70 ? "Proceed" : score >= 40 ? "Proceed with conditions" : "Hold")
  };
}

function uniqueReportId(value) {
  const base = slugify(value);
  let id = base;
  let suffix = 2;
  const exists = getDb().prepare("SELECT 1 FROM reports WHERE id = ?");
  while (exists.get(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function slugify(value) {
  return String(value || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "report";
}

function normalizeLines(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value).split("\n").map((line) => line.trim()).filter(Boolean);
}

function logReportEvent(reportId, action, payload, actor = "Admin") {
  getDb()
    .prepare(`
      INSERT INTO report_events (report_id, action, actor, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(reportId, action, actor, JSON.stringify(payload || {}), nowIso());
}

function upsertClient(name) {
  const clientName = String(name || "").trim();
  if (!clientName) return;
  const now = nowIso();
  getDb()
    .prepare(`
      INSERT INTO clients (id, name, status, data, created_at, updated_at)
      VALUES (?, ?, 'Active', '{}', ?, ?)
      ON CONFLICT(name) DO UPDATE SET updated_at = excluded.updated_at
    `)
    .run(slugify(clientName), clientName, now, now);
}
