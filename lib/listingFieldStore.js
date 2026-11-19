import { getDb, nowIso, uniqueId } from "./database.js";
import { CUSTOM_TYPES } from "./listingFields.js";

// Fields staff add to listings, and the named views of the listings desk.

const types = new Set(CUSTOM_TYPES.map(([type]) => type));

export async function getListingFields({ includeArchived = false } = {}) {
  const rows = await (await getDb()).all(`
      SELECT id, label, type, options, show_to_buyers, sort_order, archived
      FROM listing_fields
      ${includeArchived ? "" : "WHERE archived = 0"}
      ORDER BY sort_order, created_at, id
    `);
  return rows.map(toField);
}

export async function createListingField(input = {}) {
  const label = cleanLabel(input.label);
  if (!label) throw new Error("Give the field a name");
  const type = types.has(input.type) ? input.type : "text";
  const options = type === "choice" ? cleanOptions(input.options) : [];
  if (type === "choice" && options.length < 2) throw new Error("Write at least two choices");
  const db = await getDb();
  const all = await getListingFields({ includeArchived: true });
  if (all.some((field) => !field.archived && field.label.toLowerCase() === label.toLowerCase())) throw new Error(`There is already a field called "${label}"`);
  const id = await uniqueId("listing_fields", slugify(label));
  const now = nowIso();
  await db.run(
    `INSERT INTO listing_fields (id, label, type, options, show_to_buyers, sort_order, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    id, label, type, JSON.stringify(options), input.showToBuyers ? 1 : 0, all.length, now, now
  );
  return (await getListingFields({ includeArchived: true })).find((field) => field.id === id);
}

// The type of a field cannot change once it holds values; everything else can.
export async function updateListingField(id, patch = {}) {
  const existing = (await getListingFields({ includeArchived: true })).find((field) => field.id === id);
  if (!existing) return null;
  const label = "label" in patch ? cleanLabel(patch.label) : existing.label;
  if (!label) throw new Error("Give the field a name");
  const options = existing.type === "choice" && "options" in patch ? cleanOptions(patch.options) : existing.options;
  if (existing.type === "choice" && options.length < 2) throw new Error("Write at least two choices");
  await (await getDb()).run(
    `UPDATE listing_fields SET label = ?, options = ?, show_to_buyers = ?, sort_order = ?, archived = ?, updated_at = ? WHERE id = ?`,
    label,
    JSON.stringify(options),
    ("showToBuyers" in patch ? patch.showToBuyers : existing.showToBuyers) ? 1 : 0,
    "sortOrder" in patch ? Number(patch.sortOrder) || 0 : existing.sortOrder,
    ("archived" in patch ? patch.archived : existing.archived) ? 1 : 0,
    nowIso(),
    id
  );
  return (await getListingFields({ includeArchived: true })).find((field) => field.id === id);
}

/* ---------- Saved views ---------- */

export async function getListingViews() {
  const rows = await (await getDb()).all("SELECT id, name, config FROM listing_views ORDER BY sort_order, created_at, id");
  return rows.map((row) => ({ id: row.id, name: row.name, config: parseJson(row.config, {}) }));
}

// The whole list is saved at once: views are few and are reordered and renamed together.
export async function saveListingViews(views = []) {
  const cleaned = (Array.isArray(views) ? views : [])
    .slice(0, 30)
    .map((view) => ({ name: cleanLabel(view?.name), config: view?.config && typeof view.config === "object" ? view.config : {} }))
    .filter((view) => view.name);
  const now = nowIso();
  await (await getDb()).transaction(async (tx) => {
    await tx.run("DELETE FROM listing_views");
    const used = new Set();
    for (const [index, view] of cleaned.entries()) {
      let id = slugify(view.name);
      for (let suffix = 2; used.has(id); suffix += 1) id = `${slugify(view.name)}-${suffix}`;
      used.add(id);
      await tx.run(
        "INSERT INTO listing_views (id, name, config, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        id, view.name, JSON.stringify(view.config).slice(0, 8000), index, now, now
      );
    }
  });
  return getListingViews();
}

function toField(row) {
  return {
    id: row.id,
    label: row.label,
    type: row.type,
    options: parseJson(row.options, []),
    showToBuyers: Boolean(Number(row.show_to_buyers)),
    sortOrder: Number(row.sort_order) || 0,
    archived: Boolean(Number(row.archived))
  };
}

function cleanLabel(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 60);
}

function cleanOptions(value) {
  const seen = new Set();
  return (Array.isArray(value) ? value : String(value || "").split("\n"))
    .map((option) => String(option).replace(/\s+/g, " ").trim().slice(0, 60))
    .filter((option) => option && !seen.has(option.toLowerCase()) && seen.add(option.toLowerCase()))
    .slice(0, 40);
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function slugify(value) {
  return String(value || "field")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "field";
}
