import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { REPORT_SEEDS } from "./reportSeeds.js";

const dbPath = path.join(process.cwd(), "data", "app.db");
let db;

export function getDb() {
  if (db) return db;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
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
  `);
  seedFromJsonIfEmpty();
  seedReportsIfEmpty();
  seedClientsIfEmpty();
  seedDashboardIfEmpty();
  return db;
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
      const clientVisible = ["Shared", "Client viewed"].includes(seed.status) ? 1 : 0;
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

function slugify(value) {
  return String(value || "record")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "record";
}
