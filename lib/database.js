import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { REPORT_SEEDS } from "./reportSeeds.js";

const dbPath = resolveDbPath();
let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS neighborhoods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      jurisdiction TEXT,
      confidence INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS data_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      neighborhood_id TEXT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'Admin',
      payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
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
    );

    CREATE TABLE IF NOT EXISTS report_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'Admin',
      payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Active',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_tasks (
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
    );

    CREATE TABLE IF NOT EXISTS dashboard_signals (
      id TEXT PRIMARY KEY,
      icon TEXT NOT NULL DEFAULT 'minus',
      text TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      activity TEXT NOT NULL DEFAULT 'just now',
      tone TEXT NOT NULL DEFAULT 'flat',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS team_activity (
      id TEXT PRIMARY KEY,
      initials TEXT NOT NULL,
      text TEXT NOT NULL,
      activity TEXT NOT NULL DEFAULT 'just now',
      highlight INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS intelligence_resources (
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
    );

    CREATE TABLE IF NOT EXISTS market_estates (
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
    );

    CREATE TABLE IF NOT EXISTS market_price_points (
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
    );

    CREATE TABLE IF NOT EXISTS land_listings (
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
    );

    CREATE INDEX IF NOT EXISTS idx_neighborhoods_name ON neighborhoods(name);
    CREATE INDEX IF NOT EXISTS idx_neighborhoods_confidence ON neighborhoods(confidence);
    CREATE INDEX IF NOT EXISTS idx_data_events_created ON data_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_reports_neighborhood ON reports(neighborhood_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
    CREATE INDEX IF NOT EXISTS idx_report_events_created ON report_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
    CREATE INDEX IF NOT EXISTS idx_dashboard_tasks_status ON dashboard_tasks(status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_dashboard_signals_created ON dashboard_signals(created_at);
    CREATE INDEX IF NOT EXISTS idx_team_activity_created ON team_activity(created_at);
    CREATE INDEX IF NOT EXISTS idx_intelligence_resources_target ON intelligence_resources(target_type, target_id);
    CREATE INDEX IF NOT EXISTS idx_intelligence_resources_created ON intelligence_resources(created_at);
    CREATE INDEX IF NOT EXISTS idx_market_estates_neighborhood ON market_estates(neighborhood_id);
    CREATE INDEX IF NOT EXISTS idx_market_price_points_target ON market_price_points(target_type, target_id, year);
    CREATE INDEX IF NOT EXISTS idx_land_listings_neighborhood ON land_listings(neighborhood_id);
    CREATE INDEX IF NOT EXISTS idx_land_listings_workflow ON land_listings(workflow_status, listing_status);
  `);
  migrateResourceColumns();
  seedFromJsonIfEmpty();
  seedReportsIfEmpty();
  seedLandListingsIfEmpty();
  backfillLandListingPhotos();
  seedClientsIfEmpty();
  seedDashboardIfEmpty();
  return db;
}

function migrateResourceColumns() {
  const columns = new Set(
    db.prepare("PRAGMA table_info(intelligence_resources)").all().map((column) => column.name)
  );
  const additions = [
    ["file_name", "TEXT NOT NULL DEFAULT ''"],
    ["mime_type", "TEXT NOT NULL DEFAULT ''"],
    ["file_size", "INTEGER NOT NULL DEFAULT 0"],
    ["file_data", "BLOB"]
  ];
  additions.forEach(([name, definition]) => {
    if (!columns.has(name)) db.exec(`ALTER TABLE intelligence_resources ADD COLUMN ${name} ${definition}`);
  });
}

function seedFromJsonIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM neighborhoods").get().count;
  if (count > 0) return;

  const seedFile = path.join(process.cwd(), "data", "neighborhoods.json");
  if (!fs.existsSync(seedFile)) return;

  const records = JSON.parse(fs.readFileSync(seedFile, "utf8"));
  const insert = db.prepare(`
    INSERT INTO neighborhoods (id, name, jurisdiction, confidence, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = db.prepare(`
    INSERT INTO data_events (neighborhood_id, action, actor, payload, created_at)
    VALUES (?, 'seed', 'System', ?, ?)
  `);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    for (const record of records) {
      insert.run(record.id, record.name, record.jurisdiction || "", confidence(record), JSON.stringify(record), now, now);
      insertEvent.run(record.id, JSON.stringify({ source: "data/neighborhoods.json" }), now);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedReportsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM reports").get().count;
  if (count > 0) return;

  const neighborhoods = db.prepare("SELECT id, name FROM neighborhoods").all();
  if (!neighborhoods.length) return;

  const byName = new Map(neighborhoods.map((row) => [row.name, row.id]));
  const insert = db.prepare(`
    INSERT INTO reports (
      id, neighborhood_id, site_title, client, use_case, status, activity,
      changes, ref, client_visible, data, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEvent = db.prepare(`
    INSERT INTO report_events (report_id, action, actor, payload, created_at)
    VALUES (?, 'seed', 'System', ?, ?)
  `);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    REPORT_SEEDS.forEach((seed, index) => {
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
      insert.run(seed.id, neighborhoodId, seed.siteTitle, seed.client, seed.use, seed.status, seed.activity, seed.changes, ref, clientVisible, data, now, now);
      insertEvent.run(seed.id, JSON.stringify({ source: "seed" }), now);
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedClientsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM clients").get().count;
  if (count > 0) return;

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
  const insert = db.prepare(`
    INSERT INTO clients (id, name, status, data, created_at, updated_at)
    VALUES (?, ?, 'Active', '{}', ?, ?)
  `);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    names.forEach((name) => insert.run(slugify(name), name, now, now));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedLandListingsIfEmpty() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM land_listings").get().count;
  if (count > 0) return;

  const neighborhoods = db.prepare("SELECT id, name FROM neighborhoods").all();
  if (!neighborhoods.length) return;
  const byName = new Map(neighborhoods.map((row) => [row.name, row.id]));
  const byId = new Set(neighborhoods.map((row) => row.id));
  const fallbackId = neighborhoods[0].id;
  const seeds = [
    ["plot-14b-bourdillon-close", "Plot 14B, Bourdillon Close", "Banana Island", "Banana Island Estate", 1200, "Residential", 850000000, "C of O", "Available", "#1f6f5a"],
    ["5-ocean-parade", "5 Ocean Parade", "Banana Island", "Banana Island Estate", 950, "Residential", 610000000, "Governor's Consent", "Under offer", "#b9852f"],
    ["plot-22-parkview-estate", "Plot 22, Parkview Estate", "Ikoyi", "Parkview Estate", 1800, "Mixed-use", 1200000000, "C of O", "Available", "#567c6f"],
    ["9-bourdillon-road", "9 Bourdillon Road", "Ikoyi", "Osborne Estate", 700, "Residential", 420000000, "Excision", "Sold", "#8660a8"],
    ["plot-6-ademola-adetokunbo", "Plot 6, Ademola Adetokunbo", "Victoria Island", "", 2000, "Commercial", 1650000000, "Gazette", "Available", "#5b84b1"],
    ["14-akin-adesola-street", "14 Akin Adesola Street", "Victoria Island", "Chevron Drive Estate", 1100, "Mixed-use", 780000000, "Governor's Consent", "Off-market", "#a85f43"],
    ["plot-7-admiralty-way", "Plot 7, Admiralty Way", "Lekki Phase 1", "Admiralty Estate", 900, "Commercial", 540000000, "C of O", "Available", "#2f7d5c"],
    ["18-freedom-way", "18 Freedom Way", "Lekki Phase 1", "Lekki Gardens Estate", 1600, "Mixed-use", 730000000, "Governor's Consent", "Coming soon", "#9a6b13"],
    ["32-fola-osibo-street", "32 Fola Osibo Street", "Lekki Phase 1", "", 780, "Residential", 390000000, "Excision", "Available", "#6f746c"]
  ];
  const insert = db.prepare(`
    INSERT INTO land_listings (
      id, title, neighborhood_id, estate, size_value, size_unit, size_sqm,
      land_use, asking_price, title_document, listing_status, workflow_status,
      description, photos, author, created_at, updated_at, published_at
    )
    VALUES (?, ?, ?, ?, ?, 'sqm', ?, ?, ?, ?, ?, 'Published', ?, ?, 'System', ?, ?, ?)
  `);
  const now = new Date().toISOString();
  db.exec("BEGIN");
  try {
    seeds.forEach((seed, index) => {
      const [id, title, neighborhoodName, estate, sizeSqm, landUse, price, titleDocument, listingStatus, accent] = seed;
      const neighborhoodId = byName.get(neighborhoodName) || (byId.has(slugify(neighborhoodName)) ? slugify(neighborhoodName) : fallbackId);
      insert.run(
        id,
        title,
        neighborhoodId,
        estate,
        sizeSqm,
        sizeSqm,
        landUse,
        price,
        titleDocument,
        listingStatus,
        `Seeded listing ${index + 1} for ${neighborhoodName}.`,
        JSON.stringify([fakeListingPhoto(title, neighborhoodName, accent, index)]),
        now,
        now,
        now
      );
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function backfillLandListingPhotos() {
  const rows = db.prepare("SELECT id, title, photos, rowid FROM land_listings").all();
  const update = db.prepare("UPDATE land_listings SET photos = ?, updated_at = ? WHERE id = ?");
  rows.forEach((row, index) => {
    const photos = parseJson(row.photos, []);
    if (Array.isArray(photos) && photos.length && !String(photos[0]).includes("CW%20Real%20Estate%20placeholder%20image")) return;
    const accent = ["#1f6f5a", "#b9852f", "#567c6f", "#8660a8", "#5b84b1", "#a85f43"][index % 6];
    update.run(JSON.stringify([fakeListingPhoto(row.title, "Lagos", accent, index)]), nowIso(), row.id);
  });
}

function fakeListingPhoto(title, location, accent, index = 0) {
  const safeLocation = escapeSvg(location);
  const sky = index % 2 ? "#dfe8de" : "#e8e3d8";
  const ground = index % 3 ? "#bfc8b9" : "#c9c2b2";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${sky}"/>
          <stop offset="1" stop-color="#f7f5ef"/>
        </linearGradient>
        <pattern id="grid" width="72" height="72" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="72" height="72" fill="transparent"/>
          <rect width="18" height="72" fill="${accent}" opacity="0.09"/>
        </pattern>
      </defs>
      <rect width="1200" height="700" fill="url(#g)"/>
      <rect width="1200" height="700" fill="url(#grid)"/>
      <path d="M0 505 C170 445 250 475 410 420 C570 365 705 385 850 335 C1000 285 1090 295 1200 250 L1200 700 L0 700 Z" fill="${ground}"/>
      <path d="M95 525 L430 404 L860 532 L520 650 Z" fill="${accent}" opacity="0.82"/>
      <path d="M110 523 L430 418 L842 536 L524 636 Z" fill="#f7f5ef" opacity="0.28"/>
      <path d="M430 418 L524 636" stroke="#ffffff" stroke-width="7" opacity="0.42"/>
      <path d="M252 478 L675 589" stroke="#ffffff" stroke-width="7" opacity="0.32"/>
      <circle cx="944" cy="172" r="54" fill="${accent}" opacity="0.16"/>
      <rect x="78" y="76" width="220" height="38" rx="19" fill="#ffffff" opacity="0.72"/>
      <text x="102" y="101" fill="#17201b" font-family="Arial, sans-serif" font-size="18" font-weight="700">${safeLocation} parcel</text>
      <text x="86" y="626" fill="#17201b" font-family="Arial, sans-serif" font-size="18" font-weight="700" opacity="0.72">CW placeholder image</text>
    </svg>
  `.trim().replace(/\s+/g, " ");
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function escapeSvg(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function seedDashboardIfEmpty() {
  const taskCount = db.prepare("SELECT COUNT(*) AS count FROM dashboard_tasks").get().count;
  const signalCount = db.prepare("SELECT COUNT(*) AS count FROM dashboard_signals").get().count;
  const activityCount = db.prepare("SELECT COUNT(*) AS count FROM team_activity").get().count;
  if (taskCount + signalCount + activityCount > 0) return;

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
  const insertTask = db.prepare(`
    INSERT INTO dashboard_tasks (id, icon, subject, meta, action_label, tone, href, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSignal = db.prepare(`
    INSERT INTO dashboard_signals (id, icon, text, neighborhood, activity, tone, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActivity = db.prepare(`
    INSERT INTO team_activity (id, initials, text, activity, highlight, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  db.exec("BEGIN");
  try {
    tasks.forEach((item, index) => insertTask.run(item.id, item.icon, item.subject, item.meta, item.action, item.tone, item.href, index, now, now));
    signals.forEach((item) => insertSignal.run(item.id, item.icon, item.text, item.neighborhood, item.activity, item.tone, now, now));
    activities.forEach((item) => insertActivity.run(item.id, item.initials, item.text, item.activity, item.highlight, now, now));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function confidence(record) {
  return Math.max(0, Math.min(100, Number(record?.recommendation?.confidence) || 0));
}

function resolveDbPath() {
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
