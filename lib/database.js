import fs from "fs";
import os from "os";
import path from "path";
import { REPORT_SEEDS } from "./reportSeeds.js";
import { isPostgresUrl, openStore } from "./sql.js";

// Bump when a table or column is added, so PostgreSQL databases pick it up.
const SCHEMA_VERSION = "2";
// The listings desk's tables and columns, tracked on their own so the version
// above (which the live site also checks) does not have to change with them.
const DESK_SCHEMA = "1";
// Rows per INSERT when seeding. Keeps a remote database to a few round trips.
const CHUNK = 50;
// Held while one instance sets the database up, so two cold starts do not both seed it.
const SETUP_LOCK = 41740001;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS neighborhoods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  jurisdiction TEXT,
  confidence INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS data_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  neighborhood_id TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'Admin',
  payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE SET NULL
)`,
  `CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  site_title TEXT NOT NULL,
  client TEXT NOT NULL,
  use_case TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
  activity TEXT NOT NULL DEFAULT 'just now',
  changes INTEGER NOT NULL DEFAULT 0,
  ref TEXT NOT NULL,
  client_visible INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS report_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'Admin',
  payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL
)`,
  `CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Active',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS dashboard_tasks (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL DEFAULT 'alert',
  subject TEXT NOT NULL,
  meta TEXT NOT NULL,
  action_label TEXT NOT NULL,
  tone TEXT NOT NULL DEFAULT 'gold',
  href TEXT NOT NULL DEFAULT '/',
  status TEXT NOT NULL DEFAULT 'Open',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS dashboard_signals (
  id TEXT PRIMARY KEY,
  icon TEXT NOT NULL DEFAULT 'minus',
  text TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  activity TEXT NOT NULL DEFAULT 'just now',
  tone TEXT NOT NULL DEFAULT 'flat',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS team_activity (
  id TEXT PRIMARY KEY,
  initials TEXT NOT NULL,
  text TEXT NOT NULL,
  activity TEXT NOT NULL DEFAULT 'just now',
  highlight INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS intelligence_resources (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'Research',
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  file_data BLOB,
  source TEXT NOT NULL DEFAULT 'Internal',
  visibility TEXT NOT NULL DEFAULT 'Client',
  author TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS market_estates (
  id TEXT PRIMARY KEY,
  neighborhood_id TEXT NOT NULL,
  name TEXT NOT NULL,
  primary_use TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  developer TEXT NOT NULL DEFAULT '',
  available_plots TEXT NOT NULL DEFAULT '',
  total_land_sqm INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  `CREATE TABLE IF NOT EXISTS market_price_points (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  value REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  source TEXT NOT NULL DEFAULT 'Manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(target_type, target_id, year)
)`,
  `CREATE TABLE IF NOT EXISTS land_listings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  neighborhood_id TEXT NOT NULL,
  estate TEXT NOT NULL DEFAULT '',
  size_value REAL NOT NULL DEFAULT 0,
  size_unit TEXT NOT NULL DEFAULT 'sqm',
  size_sqm REAL NOT NULL DEFAULT 0,
  land_use TEXT NOT NULL DEFAULT 'Residential',
  asking_price REAL NOT NULL DEFAULT 0,
  title_document TEXT NOT NULL DEFAULT 'C of O',
  listing_status TEXT NOT NULL DEFAULT 'Available',
  workflow_status TEXT NOT NULL DEFAULT 'Draft',
  description TEXT NOT NULL DEFAULT '',
  photos TEXT NOT NULL DEFAULT '[]',
  author TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE CASCADE
)`,
  `CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  // Fields staff add to listings themselves. Values live in land_listings.custom.
  `CREATE TABLE IF NOT EXISTS listing_fields (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  options TEXT NOT NULL DEFAULT '[]',
  show_to_buyers INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`,
  // One row per field changed on a listing, so any change can be put back.
  `CREATE TABLE IF NOT EXISTS listing_changes (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL,
  field TEXT NOT NULL,
  before_value TEXT NOT NULL DEFAULT '',
  after_value TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL
)`,
  // Named sets of columns, filters and sort order for the listings desk.
  `CREATE TABLE IF NOT EXISTS listing_views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`
];

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_neighborhoods_name ON neighborhoods(name)`,
  `CREATE INDEX IF NOT EXISTS idx_neighborhoods_confidence ON neighborhoods(confidence)`,
  `CREATE INDEX IF NOT EXISTS idx_data_events_created ON data_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_neighborhood ON reports(neighborhood_id)`,
  `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)`,
  `CREATE INDEX IF NOT EXISTS idx_report_events_created ON report_events(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status)`,
  `CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_status ON dashboard_tasks(status, sort_order)`,
  `CREATE INDEX IF NOT EXISTS idx_dashboard_signals_created ON dashboard_signals(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_team_activity_created ON team_activity(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_intelligence_resources_target ON intelligence_resources(target_type, target_id)`,
  `CREATE INDEX IF NOT EXISTS idx_intelligence_resources_created ON intelligence_resources(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_market_estates_neighborhood ON market_estates(neighborhood_id)`,
  `CREATE INDEX IF NOT EXISTS idx_market_price_points_target ON market_price_points(target_type, target_id, year)`,
  `CREATE INDEX IF NOT EXISTS idx_land_listings_neighborhood ON land_listings(neighborhood_id)`,
  `CREATE INDEX IF NOT EXISTS idx_land_listings_workflow ON land_listings(workflow_status, listing_status)`,
  `CREATE INDEX IF NOT EXISTS idx_listing_changes_listing ON listing_changes(listing_id, created_at)`
];

// Columns added after a table first shipped. [table, column, definition]
const ADDED_COLUMNS = [
  ["intelligence_resources", "file_name", "TEXT NOT NULL DEFAULT ''"],
  ["intelligence_resources", "mime_type", "TEXT NOT NULL DEFAULT ''"],
  ["intelligence_resources", "file_size", "INTEGER NOT NULL DEFAULT 0"],
  ["intelligence_resources", "file_data", "BLOB"],
  ["land_listings", "source_id", "TEXT NOT NULL DEFAULT ''"],
  ["land_listings", "source_url", "TEXT NOT NULL DEFAULT ''"],
  ["land_listings", "address", "TEXT NOT NULL DEFAULT ''"],
  ["land_listings", "offer_type", "TEXT NOT NULL DEFAULT 'Sale'"],
  // What the seller quoted, before any conversion: amount, NGN or USD, and
  // whether it is for the whole plot or per sqm. Empty basis = legacy row
  // whose asking_price is a naira total.
  ["land_listings", "price_amount", "REAL NOT NULL DEFAULT 0"],
  ["land_listings", "price_currency", "TEXT NOT NULL DEFAULT 'NGN'"],
  ["land_listings", "price_basis", "TEXT NOT NULL DEFAULT ''"],
  ["land_listings", "agent_name", "TEXT NOT NULL DEFAULT ''"],
  ["land_listings", "agent_phone", "TEXT NOT NULL DEFAULT ''"],
  ["land_listings", "listed_at", "TEXT NOT NULL DEFAULT ''"],
  ["land_listings", "snapshot", "TEXT NOT NULL DEFAULT ''"],
  // Values of staff-added fields, as JSON keyed by listing_fields.id.
  ["land_listings", "custom", "TEXT NOT NULL DEFAULT '{}'"],
  // Set when a listing is moved to the bin; it is hidden everywhere until restored.
  ["land_listings", "deleted_at", "TEXT"]
];

let ready;

// The app's database, set up on first use: tables created, seed data loaded,
// listings brought in line with data/listings.json. See lib/sql.js for the methods.
export function getDb() {
  if (!ready) {
    ready = open().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function open() {
  const store = await openStore(resolveDbUrl());
  const seed = readListingSeed();
  if (store.dialect === "postgres") {
    // The usual cold start: one query shows the database is already current.
    // A missing app_meta table (42P01) means a new database. Anything else,
    // such as no connection, is a real failure and should not start a setup.
    const meta = await readMeta(store).catch((error) => {
      if (error?.code === "42P01") return null;
      throw error;
    });
    if (meta?.schema_version === SCHEMA_VERSION && meta.desk_schema === DESK_SCHEMA && (!seed || meta.listings_snapshot === seed.snapshot)) return store;
    await store.transaction(async (tx) => {
      await tx.get("SELECT pg_advisory_xact_lock(?)", SETUP_LOCK);
      await setUp(tx, seed);
    });
    return store;
  }
  await setUp(store, seed);
  return store;
}

async function setUp(db, seed) {
  for (const table of TABLES) await db.exec(forDialect(table, db.dialect));
  await addColumns(db);
  for (const index of INDEXES) await db.exec(index);
  await seedNeighborhoodsIfEmpty(db);
  await seedReportsIfEmpty(db);
  await syncListingsFromSeed(db, seed);
  await seedClientsIfEmpty(db);
  await seedDashboardIfEmpty(db);
  await writeMeta(db, "schema_version", SCHEMA_VERSION);
  await writeMeta(db, "desk_schema", DESK_SCHEMA);
}

// The schema is written for SQLite; PostgreSQL needs three types renamed and,
// in place of SQLite's rowid, a column that records insertion order.
function forDialect(sql, dialect) {
  if (dialect !== "postgres") return sql;
  return sql
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, "BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY")
    .replace(/\bBLOB\b/g, "BYTEA")
    .replace(/\bREAL\b/g, "DOUBLE PRECISION")
    .replace(/^(CREATE TABLE IF NOT EXISTS (?:neighborhoods|reports) \()/, "$1\n  seq BIGINT GENERATED BY DEFAULT AS IDENTITY,");
}

async function addColumns(db) {
  if (db.dialect === "postgres") {
    for (const [table, name, definition] of ADDED_COLUMNS) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${name} ${forDialect(definition, "postgres")}`);
    }
    return;
  }
  const existing = new Map();
  for (const [table, name, definition] of ADDED_COLUMNS) {
    if (!existing.has(table)) {
      existing.set(table, new Set((await db.all(`PRAGMA table_info(${table})`)).map((column) => column.name)));
    }
    if (!existing.get(table).has(name)) await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

// INSERT many rows in as few statements as possible. `rows` are arrays in column order.
async function insertMany(db, table, columns, rows, suffix = "") {
  const one = `(${columns.map(() => "?").join(", ")})`;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    await db.run(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${chunk.map(() => one).join(", ")} ${suffix}`,
      ...chunk.flat()
    );
  }
}

async function isEmpty(db, table) {
  return !(await db.get(`SELECT 1 AS found FROM ${table} LIMIT 1`));
}

function readNeighborhoodSeed() {
  const seedFile = path.join(process.cwd(), "data", "neighborhoods.json");
  return fs.existsSync(seedFile) ? JSON.parse(fs.readFileSync(seedFile, "utf8")) : [];
}

function neighborhoodRow(record, now) {
  return [record.id, record.name, record.jurisdiction || "", confidence(record), JSON.stringify(record), now, now];
}

const NEIGHBORHOOD_COLUMNS = ["id", "name", "jurisdiction", "confidence", "data", "created_at", "updated_at"];

async function seedNeighborhoodsIfEmpty(db) {
  if (!(await isEmpty(db, "neighborhoods"))) return;
  const records = readNeighborhoodSeed();
  if (!records.length) return;
  const now = new Date().toISOString();
  await insertMany(db, "neighborhoods", NEIGHBORHOOD_COLUMNS, records.map((record) => neighborhoodRow(record, now)));
  await insertMany(
    db,
    "data_events",
    ["neighborhood_id", "action", "actor", "payload", "created_at"],
    records.map((record) => [record.id, "seed", "System", JSON.stringify({ source: "data/neighborhoods.json" }), now])
  );
}

async function seedReportsIfEmpty(db) {
  if (!(await isEmpty(db, "reports"))) return;
  const neighborhoods = await db.all("SELECT id, name FROM neighborhoods");
  if (!neighborhoods.length) return;

  const byName = new Map(neighborhoods.map((row) => [row.name, row.id]));
  const now = new Date().toISOString();
  const rows = REPORT_SEEDS.map((seed, index) => {
    const neighborhoodId = byName.get(seed.neighborhood) || neighborhoods[index % neighborhoods.length].id;
    const ref = `CW-GLOV-${String(index + 20).padStart(2, "0")}`;
    const clientVisible = ["Published", "Shared", "Client viewed"].includes(seed.status) ? 1 : 0;
    const data = JSON.stringify({
      changeNotes: [
        "Max height revised 8 -> 6 floors",
        "Design-review sign-off now required on heritage frontages"
      ],
      recommendationOverride: seed.id === "glover-road" ? "Proceed with conditions" : null
    });
    return [seed.id, neighborhoodId, seed.siteTitle, seed.client, seed.use, seed.status, seed.activity, seed.changes, ref, clientVisible, data, now, now];
  });
  await insertMany(
    db,
    "reports",
    ["id", "neighborhood_id", "site_title", "client", "use_case", "status", "activity", "changes", "ref", "client_visible", "data", "created_at", "updated_at"],
    rows
  );
  await insertMany(
    db,
    "report_events",
    ["report_id", "action", "actor", "payload", "created_at"],
    REPORT_SEEDS.map((seed) => [seed.id, "seed", "System", JSON.stringify({ source: "seed" }), now])
  );
}

async function seedClientsIfEmpty(db) {
  if (!(await isEmpty(db, "clients"))) return;
  const names = [
    "Adebayo Holdings",
    "H. Danjuma (private)",
    "Meridian Estates",
    "Palm Ridge Developments",
    "Lagoon Capital",
    "Civicstone Partners",
    "Northcourt Advisory",
    "Greyline Capital",
    "Avenue Habitat",
    "Harbourfield Estates",
    "Primewaters Development",
    "Urban Acre Partners"
  ];
  const now = new Date().toISOString();
  await insertMany(
    db,
    "clients",
    ["id", "name", "status", "data", "created_at", "updated_at"],
    names.map((name) => [slugify(name), name, "Active", "{}", now, now])
  );
}

// Listings come from data/listings.json, written by scripts/import-listings.mjs.
// When that file carries a snapshot this database has not loaded, every listing
// the system put in is replaced by it. Listings an admin created or edited stay.
function readListingSeed() {
  const seedFile = path.join(process.cwd(), "data", "listings.json");
  if (!fs.existsSync(seedFile)) return null;
  const seed = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  // generatedAt changes on every import run, so a corrected re-import of the
  // same export is picked up too.
  const snapshot = [seed.snapshotDate, seed.generatedAt].filter(Boolean).join(" ");
  return snapshot ? { snapshot, snapshotDate: String(seed.snapshotDate || ""), listings: seed.listings || [] } : null;
}

const LISTING_COLUMNS = [
  "id", "title", "neighborhood_id", "estate", "size_value", "size_unit", "size_sqm",
  "land_use", "asking_price", "title_document", "listing_status", "workflow_status",
  "description", "photos", "author", "created_at", "updated_at", "published_at",
  "source_id", "source_url", "address", "offer_type", "price_amount", "price_currency",
  "price_basis", "agent_name", "agent_phone", "listed_at", "snapshot"
];

async function syncListingsFromSeed(db, seed) {
  if (!seed || (await readMeta(db)).listings_snapshot === seed.snapshot) return;
  const now = new Date().toISOString();
  const apply = async (tx) => {
    // Locations added to data/neighborhoods.json after this database was first seeded.
    await insertMany(tx, "neighborhoods", NEIGHBORHOOD_COLUMNS, readNeighborhoodSeed().map((record) => neighborhoodRow(record, now)), "ON CONFLICT DO NOTHING");
    const known = new Set((await tx.all("SELECT id FROM neighborhoods")).map((row) => row.id));
    await tx.run("DELETE FROM land_listings WHERE author = 'System'");
    const rows = seed.listings
      .filter((item) => known.has(item.neighborhoodId))
      .map((item) => {
        const size = Number(item.sizeSqm) || 0;
        const amount = Number(item.priceAmount) || 0;
        const listedAt = item.listedAt ? `${item.listedAt}T00:00:00.000Z` : now;
        return [
          item.id, item.title, item.neighborhoodId, item.estate || "", size, "sqm", size,
          item.landUse || "", nairaTotal(item, size, amount), item.titleDocument || "", "Available", "Published",
          item.description || "", "[]", "System", listedAt, now, listedAt,
          item.sourceId || "", item.sourceUrl || "", item.address || "", item.offerType || "Sale",
          amount, item.priceCurrency || "NGN", item.priceBasis || "unknown",
          item.agentName || "", item.agentPhone || "", item.listedAt || "", seed.snapshotDate
        ];
      });
    // A listing an admin has edited keeps its id and is left as the admin saved it.
    await insertMany(tx, "land_listings", LISTING_COLUMNS, rows, "ON CONFLICT DO NOTHING");
    await writeMeta(tx, "listings_snapshot", seed.snapshot);
  };
  // On PostgreSQL this already runs inside the set-up transaction.
  if (db.dialect === "postgres") await apply(db);
  else await db.transaction(apply);
}

// asking_price keeps a naira plot total where one is known without a conversion.
function nairaTotal(item, size, amount) {
  if (item.priceCurrency !== "NGN") return 0;
  if (item.priceBasis === "total") return amount;
  if (item.priceBasis === "per_sqm") return Math.round(amount * size);
  return 0;
}

async function readMeta(db) {
  return Object.fromEntries((await db.all("SELECT key, value FROM app_meta")).map((row) => [row.key, row.value]));
}

async function writeMeta(db, key, value) {
  await db.run(
    `INSERT INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    String(value),
    new Date().toISOString()
  );
}

// `base`, or `base-2`, `base-3`... : the first that is not yet an id in `table`.
export async function uniqueId(table, base) {
  const db = await getDb();
  let id = base;
  for (let suffix = 2; await db.get(`SELECT 1 AS found FROM ${table} WHERE id = ?`, id); suffix += 1) {
    id = `${base}-${suffix}`;
  }
  return id;
}

// Small named values kept in the database (the exchange rate, the loaded snapshot).
export async function getMeta(key) {
  return (await (await getDb()).get("SELECT value FROM app_meta WHERE key = ?", key))?.value ?? null;
}

export async function setMeta(key, value) {
  await writeMeta(await getDb(), key, value);
}

async function seedDashboardIfEmpty(db) {
  for (const table of ["dashboard_tasks", "dashboard_signals", "team_activity"]) {
    if (!(await isEmpty(db, table))) return;
  }

  const now = new Date().toISOString();
  const tasks = [
    { id: "banana-waterfront-reshare", icon: "alert", subject: "Banana Island Waterfront", meta: "Client viewed a brief that has since changed 3x", action: "Re-share", tone: "low", href: "/reports?report=banana-waterfront" },
    { id: "glover-road-review", icon: "alert", subject: "Plot 1841, Glover Road", meta: "Max height revised 8 -> 6 after the 18 Apr ruling", action: "Review", tone: "med", href: "/locations/ikoyi" },
    { id: "adeola-odeku-confirm", icon: "clock", subject: "Adeola Odeku Tower", meta: "Approval moved to Pending review", action: "Confirm", tone: "med", href: "/locations/victoria-island" },
    { id: "ondo-close-send", icon: "file", subject: "24 Ondo Close", meta: "Draft ready - not yet sent to Adebayo Holdings", action: "Send", tone: "gold", href: "/reports?report=ondo-close" },
    { id: "ikoyi-confidence-review", icon: "refresh", subject: "Ikoyi confidence review", meta: "Last reviewed 09 Jun - 3 weeks ago", action: "Re-score", tone: "gold", href: "/locations/ikoyi" }
  ];
  const signals = [
    { id: "banana-confidence-lowered", icon: "down", text: "Confidence lowered 86 -> 82 after the 5-floor variance denial", neighborhood: "Banana Island", activity: "2d ago", tone: "down" },
    { id: "ikoyi-heritage-signoff", icon: "minus", text: "New rule: design-review sign-off now required on heritage frontages", neighborhood: "Ikoyi", activity: "3d ago", tone: "flat" },
    { id: "lekki-residential-approved", icon: "up", text: "5-floor residential block approved", neighborhood: "Lekki Phase 1", activity: "4d ago", tone: "up" },
    { id: "emerald-court-shared", icon: "minus", text: "Brief shared with Palm Ridge Developments", neighborhood: "Emerald Court", activity: "5d ago", tone: "flat" }
  ];
  const activities = [
    { id: "co-banana-note", initials: "CO", text: "Chidubem O. added a note on Banana Island", activity: "3 days ago", highlight: 1 },
    { id: "an-glover-shared", initials: "AN", text: "Adaeze N. shared the Glover Road brief with Meridian Estates", activity: "3 days ago", highlight: 0 },
    { id: "ta-ocean-generated", initials: "TA", text: "Tunde A. generated Ocean Breeze Estate", activity: "4 days ago", highlight: 0 },
    { id: "an-vi-rescored", initials: "AN", text: "Adaeze N. re-scored Victoria Island", activity: "1 week ago", highlight: 0 }
  ];
  await insertMany(
    db,
    "dashboard_tasks",
    ["id", "icon", "subject", "meta", "action_label", "tone", "href", "sort_order", "created_at", "updated_at"],
    tasks.map((item, index) => [item.id, item.icon, item.subject, item.meta, item.action, item.tone, item.href, index, now, now])
  );
  await insertMany(
    db,
    "dashboard_signals",
    ["id", "icon", "text", "neighborhood", "activity", "tone", "created_at", "updated_at"],
    signals.map((item) => [item.id, item.icon, item.text, item.neighborhood, item.activity, item.tone, now, now])
  );
  await insertMany(
    db,
    "team_activity",
    ["id", "initials", "text", "activity", "highlight", "created_at", "updated_at"],
    activities.map((item) => [item.id, item.initials, item.text, item.activity, item.highlight, now, now])
  );
}

export function nowIso() {
  return new Date().toISOString();
}

export function confidence(record) {
  return Math.max(0, Math.min(100, Number(record?.recommendation?.confidence) || 0));
}

// Where the app's data lives:
//   APP_DB_URL, when set (postgres://... for AWS RDS, or file:./path for SQLite);
//   otherwise the accounts database, when that is PostgreSQL, so one RDS database serves both;
//   otherwise a SQLite file: data/app.db locally, a temporary file on Vercel.
function resolveDbUrl() {
  const own = String(process.env.APP_DB_URL || "").trim();
  if (own) return own;
  const accounts = String(process.env.ACCOUNTS_DB_URL || "").trim();
  if (isPostgresUrl(accounts)) return accounts;
  if (process.env.SQLITE_DB_PATH) return process.env.SQLITE_DB_PATH;
  if (process.env.VERCEL) return path.join(os.tmpdir(), "cw-real-estate-app.db");
  return path.join(process.cwd(), "data", "app.db");
}

function slugify(value) {
  return String(value || "record")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "record";
}
