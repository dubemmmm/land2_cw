import { getDb, nowIso } from "./database.js";
import { getReports } from "./reportStore.js";

export async function getDashboardData() {
  const db = getDb();
  const reports = await getReports();
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
  const clientUpdates = buildClientUpdates(db, reports, activity);
  const clientStats = buildClientStats(db, reports);

  const clientCount = db.prepare("SELECT COUNT(*) AS count FROM clients WHERE status = 'Active'").get().count;
  const openTaskCount = db.prepare("SELECT COUNT(*) AS count FROM dashboard_tasks WHERE status = 'Open'").get().count;
  const newSignalCount = db.prepare("SELECT COUNT(*) AS count FROM dashboard_signals").get().count;

  return {
    tasks,
    signals,
    activity,
    clientUpdates,
    clientStats,
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

function buildClientUpdates(db, reports, teamActivity) {
  const reportMap = new Map(reports.map((report) => [report.id, report]));
  const reportEvents = db
    .prepare(`
      SELECT id, report_id AS reportId, action, actor, payload, created_at AS createdAt
      FROM report_events
      ORDER BY created_at DESC
      LIMIT 16
    `)
    .all()
    .map((event) => {
      const report = reportMap.get(event.reportId);
      const payload = parsePayload(event.payload);
      const title = report?.siteTitle || payload?.siteTitle || event.reportId || "Client brief";
      const verb = event.action === "create" ? "posted" : ["update", "override"].includes(event.action) ? "edited" : event.action;
      return {
        id: `report-event-${event.id}`,
        who: initials(event.actor),
        text: `${event.actor} ${verb} ${title}`,
        when: relativeTime(event.createdAt),
        gold: event.action === "create",
        href: report ? `/reports?report=${report.id}` : "/reports",
        createdAt: event.createdAt
      };
    });

  const dataEvents = db
    .prepare(`
      SELECT data_events.id, data_events.neighborhood_id AS neighborhoodId, data_events.action, data_events.actor,
             data_events.created_at AS createdAt, neighborhoods.name AS neighborhoodName
      FROM data_events
      LEFT JOIN neighborhoods ON neighborhoods.id = data_events.neighborhood_id
      ORDER BY data_events.created_at DESC
      LIMIT 16
    `)
    .all()
    .map((event) => ({
      id: `data-event-${event.id}`,
      who: initials(event.actor),
      text: `${event.actor} ${event.action === "update" ? "updated" : event.action} ${event.neighborhoodName || "a land record"} intelligence`,
      when: relativeTime(event.createdAt),
      gold: false,
      href: event.neighborhoodId ? `/locations/${event.neighborhoodId}` : "/data",
      createdAt: event.createdAt
    }));

  const postedReports = reports
    .filter((report) => report.clientVisible || ["Published", "Shared", "Client viewed"].includes(report.status))
    .slice(0, 10)
    .map((report, index) => ({
      id: `posted-${report.id}`,
      who: report.sourceType === "estate" ? "ES" : "LD",
      text: `New ${report.sourceType === "estate" ? "estate" : "land"} report posted for ${report.siteTitle}`,
      when: report.activity || (index ? `${index + 1}d ago` : "just now"),
      gold: index === 0,
      href: `/reports?report=${report.id}`,
      createdAt: syntheticDate(index)
    }));

  const resources = db
    .prepare(`
      SELECT id, target_type AS targetType, target_id AS targetId, resource_type AS resourceType,
             title, source, author, created_at AS createdAt
      FROM intelligence_resources
      WHERE visibility = 'Client'
      ORDER BY created_at DESC
      LIMIT 16
    `)
    .all()
    .map((resource) => ({
      id: `resource-${resource.id}`,
      who: initials(resource.author),
      text: `${resource.resourceType} added: ${resource.title}`,
      when: relativeTime(resource.createdAt),
      gold: true,
      href: resource.targetType === "estate" ? `/estates/${resource.targetId}` : `/locations/${resource.targetId}`,
      createdAt: resource.createdAt
    }));

  const estates = db
    .prepare(`
      SELECT id, neighborhood_id AS neighborhoodId, name, primary_use AS primaryUse,
             created_at AS createdAt
      FROM market_estates
      ORDER BY created_at DESC
      LIMIT 12
    `)
    .all()
    .map((estate) => ({
      id: `estate-created-${estate.id}`,
      who: "ES",
      text: `New estate added: ${estate.name}${estate.primaryUse ? ` · ${estate.primaryUse}` : ""}`,
      when: relativeTime(estate.createdAt),
      gold: false,
      href: `/estates/${estate.id}`,
      createdAt: estate.createdAt
    }));

  const manualActivity = teamActivity.map((item, index) => ({
    id: `manual-${item.id || index}`,
    who: item.who,
    text: item.text,
    when: item.when,
    gold: item.gold,
    href: "/reports",
    createdAt: syntheticDate(index + 20)
  }));

  return reportEvents
    .concat(resources, estates, dataEvents, postedReports, manualActivity)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))
    .slice(0, 8);
}

function buildClientStats(db, reports) {
  const publishedReports = reports.filter((report) => report.clientVisible || ["Published", "Client viewed"].includes(report.status));
  const reportEvents = db
    .prepare("SELECT action, created_at AS createdAt FROM report_events ORDER BY created_at DESC LIMIT 80")
    .all();
  const dataEvents = db
    .prepare("SELECT action, created_at AS createdAt FROM data_events ORDER BY created_at DESC LIMIT 80")
    .all();
  const estateCount = db.prepare("SELECT COUNT(*) AS count FROM market_estates").get().count;
  const resourceCount = db.prepare("SELECT COUNT(*) AS count FROM intelligence_resources WHERE visibility = 'Client'").get().count;
  return {
    publishedReports: publishedReports.length,
    reportsPublishedThisWeek: reportEvents.filter((event) => event.action === "create" && isRecent(event.createdAt, 7)).length,
    reportsEditedThisWeek: reportEvents.filter((event) => ["update", "override"].includes(event.action) && isRecent(event.createdAt, 7)).length,
    dataUpdatesThisWeek: dataEvents.filter((event) => isRecent(event.createdAt, 7)).length,
    estateCount,
    resourceCount
  };
}

function isRecent(value, days) {
  const time = Date.parse(value);
  if (!time) return false;
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function parsePayload(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
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

function relativeTime(value) {
  const time = Date.parse(value);
  if (!time) return "just now";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function syntheticDate(offset) {
  return new Date(Date.now() - offset * 60 * 60 * 1000).toISOString();
}
