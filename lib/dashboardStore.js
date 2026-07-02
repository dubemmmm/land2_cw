import { getDb, nowIso } from "./database.js";

export async function getDashboardData() {
  const db = getDb();
  const tasks = db
    .prepare(`
      SELECT id, icon, subject, meta, action_label AS action, tone, href
      FROM dashboard_tasks
      WHERE status = 'Open'
      ORDER BY sort_order ASC, created_at DESC
      LIMIT 12
    `)
    .all();

  const signals = db
    .prepare(`
      SELECT id, icon, text, neighborhood AS hood, activity AS "when", tone
      FROM dashboard_signals
      ORDER BY created_at DESC
      LIMIT 12
    `)
    .all();

  const activity = db
    .prepare(`
      SELECT id, initials AS who, text, activity AS "when", highlight AS gold
      FROM team_activity
      ORDER BY created_at DESC
      LIMIT 12
    `)
    .all()
    .map((row) => ({ ...row, gold: Boolean(row.gold) }));

  const clientCount = db.prepare("SELECT COUNT(*) AS count FROM clients WHERE status = 'Active'").get().count;
  const openTaskCount = db.prepare("SELECT COUNT(*) AS count FROM dashboard_tasks WHERE status = 'Open'").get().count;
  const newSignalCount = db.prepare("SELECT COUNT(*) AS count FROM dashboard_signals").get().count;

  return {
    tasks,
    signals,
    activity,
    clientCount,
    openTaskCount,
    newSignalCount
  };
}

export async function createDashboardTask(input = {}) {
  const now = nowIso();
  const id = uniqueId("dashboard_tasks", input.id || input.subject || "task");
  getDb()
    .prepare(`
      INSERT INTO dashboard_tasks (id, icon, subject, meta, action_label, tone, href, status, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      input.icon || "alert",
      String(input.subject || "New task").trim(),
      String(input.meta || "").trim(),
      String(input.action || input.actionLabel || "Review").trim(),
      input.tone || "gold",
      input.href || "/",
      input.status || "Open",
      Number(input.sortOrder) || 0,
      now,
      now
    );
  return (await getDashboardData()).tasks.find((task) => task.id === id);
}

export async function createDashboardSignal(input = {}) {
  const now = nowIso();
  const id = uniqueId("dashboard_signals", input.id || input.text || "signal");
  getDb()
    .prepare(`
      INSERT INTO dashboard_signals (id, icon, text, neighborhood, activity, tone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      input.icon || "minus",
      String(input.text || "New intelligence signal").trim(),
      String(input.neighborhood || input.hood || "Portfolio").trim(),
      String(input.activity || input.when || "just now").trim(),
      input.tone || "flat",
      now,
      now
    );
  return (await getDashboardData()).signals.find((signal) => signal.id === id);
}

export async function createTeamActivity(input = {}) {
  const now = nowIso();
  const id = uniqueId("team_activity", input.id || input.text || "activity");
  getDb()
    .prepare(`
      INSERT INTO team_activity (id, initials, text, activity, highlight, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      String(input.initials || input.who || "CW").trim().slice(0, 3).toUpperCase(),
      String(input.text || "New team activity").trim(),
      String(input.activity || input.when || "just now").trim(),
      input.highlight || input.gold ? 1 : 0,
      now,
      now
    );
  return (await getDashboardData()).activity.find((item) => item.id === id);
}

export async function createClient(input = {}) {
  const now = nowIso();
  const name = String(input.name || "New Client").trim();
  getDb()
    .prepare(`
      INSERT INTO clients (id, name, status, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET status = excluded.status, data = excluded.data, updated_at = excluded.updated_at
    `)
    .run(slugify(input.id || name), name, input.status || "Active", JSON.stringify(input.data || {}), now, now);
  return { id: slugify(input.id || name), name, status: input.status || "Active" };
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

function slugify(value) {
  return String(value || "record")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "record";
}
