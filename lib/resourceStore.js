import { getDb, nowIso } from "./database.js";

const targetTypes = new Set(["neighborhood", "estate"]);
const resourceTypes = new Set(["Research", "Attachment", "Planning memo", "Market report", "Comparable"]);
const visibilityTypes = new Set(["Client", "Internal"]);

export async function getResources(filter = {}) {
  const clauses = [];
  const values = [];
  if (filter.targetType) {
    clauses.push("target_type = ?");
    values.push(normalizeTargetType(filter.targetType));
  }
  if (filter.targetId) {
    clauses.push("target_id = ?");
    values.push(normalizeTargetId(filter.targetId));
  }
  if (filter.visibility) {
    clauses.push("visibility = ?");
    values.push(filter.visibility);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return getDb()
    .prepare(`
      SELECT id, target_type AS targetType, target_id AS targetId, resource_type AS resourceType,
             title, summary, url, file_name AS fileName, mime_type AS mimeType,
             file_size AS fileSize, source, visibility, author, created_at AS createdAt, updated_at AS updatedAt
      FROM intelligence_resources
      ${where}
      ORDER BY created_at DESC
    `)
    .all(...values);
}

export async function getClientResources(filter = {}) {
  return getResources({ ...filter, visibility: "Client" });
}

export async function createResource(input = {}, actor = "Admin") {
  const resource = normalizeResource(input, actor);
  const now = nowIso();
  getDb()
    .prepare(`
      INSERT INTO intelligence_resources (
        id, target_type, target_id, resource_type, title, summary, url,
        file_name, mime_type, file_size, file_data,
        source, visibility, author, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      resource.id,
      resource.targetType,
      resource.targetId,
      resource.resourceType,
      resource.title,
      resource.summary,
      resource.url,
      resource.fileName,
      resource.mimeType,
      resource.fileSize,
      resource.fileData,
      resource.source,
      resource.visibility,
      resource.author,
      now,
      now
    );
  logResourceActivity(resource, "posted");
  return getResource(resource.id);
}

export async function updateResource(id, patch = {}, actor = "Admin") {
  const existing = await getResource(id);
  if (!existing) return null;
  const next = normalizeResource({ ...existing, ...patch, id }, actor, true);
  getDb()
    .prepare(`
      UPDATE intelligence_resources
      SET target_type = ?, target_id = ?, resource_type = ?, title = ?, summary = ?,
          url = ?, source = ?, visibility = ?, author = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      next.targetType,
      next.targetId,
      next.resourceType,
      next.title,
      next.summary,
      next.url,
      next.source,
      next.visibility,
      next.author,
      nowIso(),
      id
    );
  logResourceActivity(next, "updated");
  return getResource(id);
}

export async function deleteResource(id, actor = "Admin") {
  const existing = await getResource(id);
  if (!existing) return null;
  getDb().prepare("DELETE FROM intelligence_resources WHERE id = ?").run(id);
  logResourceActivity({ ...existing, author: actor }, "removed");
  return existing;
}

export async function getResource(id) {
  const rows = await getResources();
  return rows.find((resource) => resource.id === id) || null;
}

export async function getResourceFile(id) {
  const row = getDb()
    .prepare(`
      SELECT id, title, visibility, file_name AS fileName, mime_type AS mimeType,
             file_size AS fileSize, file_data AS fileData
      FROM intelligence_resources
      WHERE id = ?
    `)
    .get(id);
  if (!row || !row.fileData) return null;
  return row;
}

function normalizeResource(input, actor, keepId = false) {
  const targetType = normalizeTargetType(input.targetType || input.target_type || "neighborhood");
  const targetId = normalizeTargetId(input.targetId || input.target_id || "");
  const title = String(input.title || input.fileName || "").trim();
  if (!targetId) throw new Error("Target is required");
  if (!title) throw new Error("Resource title is required");
  const resourceType = resourceTypes.has(input.resourceType || input.resource_type) ? input.resourceType || input.resource_type : "Research";
  const visibility = visibilityTypes.has(input.visibility) ? input.visibility : "Client";
  return {
    id: keepId ? input.id : uniqueId(`${targetId}-${title}`),
    targetType,
    targetId,
    resourceType,
    title,
    summary: String(input.summary || "").trim(),
    url: String(input.url || "").trim(),
    fileName: String(input.fileName || "").trim(),
    mimeType: String(input.mimeType || "").trim(),
    fileSize: Number(input.fileSize) || 0,
    fileData: input.fileData || null,
    source: String(input.source || "Internal").trim(),
    visibility,
    author: String(actor || "Admin").trim()
  };
}

function normalizeTargetType(value) {
  const type = String(value || "").toLowerCase();
  if (!targetTypes.has(type)) throw new Error("Target type must be neighborhood or estate");
  return type;
}

function normalizeTargetId(value) {
  return String(value || "").trim().replaceAll("_", "-");
}

function uniqueId(value) {
  const base = slugify(value || "resource");
  let id = base;
  let suffix = 2;
  const exists = getDb().prepare("SELECT 1 FROM intelligence_resources WHERE id = ?");
  while (exists.get(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function logResourceActivity(resource, action) {
  const id = uniqueActivityId(`${resource.id}-${action}`);
  getDb()
    .prepare(`
      INSERT INTO team_activity (id, initials, text, activity, highlight, created_at, updated_at)
      VALUES (?, ?, ?, 'just now', ?, ?, ?)
    `)
    .run(
      id,
      initials(resource.author),
      `${resource.author} ${action} ${resource.resourceType.toLowerCase()} for ${displayTarget(resource)}`,
      resource.visibility === "Client" ? 1 : 0,
      nowIso(),
      nowIso()
    );
}

function uniqueActivityId(value) {
  const base = slugify(value || "activity");
  let id = base;
  let suffix = 2;
  const exists = getDb().prepare("SELECT 1 FROM team_activity WHERE id = ?");
  while (exists.get(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function displayTarget(resource) {
  return String(resource.targetId || "a location").replaceAll("-", " ");
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
  return String(value || "record")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "record";
}
