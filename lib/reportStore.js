import { getDb, nowIso } from "./database.js";
import { confidenceLevel, confidenceScore } from "./metrics.js";
import { getEstateMarketProfile, getLandBibleInventory, getLandMarketProfile, toEstateSlug } from "./landBible.js";
import { REPORT_SEEDS } from "./reportSeeds.js";

export async function getReports() {
  const seedIds = new Set(REPORT_SEEDS.map((seed) => seed.id));
  const customRows = getDb()
    .prepare(`
      SELECT reports.*, neighborhoods.name AS neighborhood_name, neighborhoods.data AS neighborhood_data
      FROM reports
      JOIN neighborhoods ON neighborhoods.id = reports.neighborhood_id
      ORDER BY reports.rowid DESC
    `)
    .all()
    .filter((row) => !seedIds.has(row.id))
    .map(toReport);
  const customIds = new Set(customRows.map((report) => report.id));
  return getInventoryReports().filter((report) => !customIds.has(report.id)).concat(customRows);
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
  if (row) return toReport(row);

  return getInventoryReports().find((report) => report.id === id) || null;
}

export async function createReport(input = {}) {
  const neighborhood = getDb().prepare("SELECT id, name, data FROM neighborhoods WHERE id = ?").get(input.neighborhoodId);
  if (!neighborhood) throw new Error("Neighborhood is required");

  const siteTitle = String(input.siteTitle || "New Client Brief").trim();
  const id = uniqueReportId(input.id || siteTitle);
  const status = normalizeReportStatus(input.status || "Draft");
  const targetType = normalizeReportTargetType(input.targetType);
  const targetId = targetType === "estate"
    ? String(input.targetId || input.estateId || "").trim()
    : String(input.targetId || input.neighborhoodId || neighborhood.id).trim();
  if (targetType === "estate" && !targetId) throw new Error("Estate is required for estate reports");
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
    clientVisible: Boolean(input.clientVisible || isPublishedStatus(status)),
    data: {
      reportType: String(input.reportType || "Client brief").trim(),
      targetType,
      targetId,
      publishDate: String(input.publishDate || "").trim(),
      reviewDate: String(input.reviewDate || "").trim(),
      confidenceOverride: normalizeScore(input.confidenceOverride),
      riskLevel: String(input.riskLevel || "Unknown").trim(),
      executiveSummary: String(input.executiveSummary || "").trim(),
      recommendationRationale: String(input.recommendationRationale || "").trim(),
      changeNotes: normalizeLines(input.changeNotes) || [],
      recommendationOverride: input.recommendationOverride || null,
      keyRisks: normalizeLines(input.keyRisks) || [],
      opportunityNotes: normalizeLines(input.opportunityNotes) || [],
      internalNotes: String(input.internalNotes || "").trim()
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
  const existsInDb = Boolean(getDb().prepare("SELECT 1 FROM reports WHERE id = ?").get(id));
  const next = {
    ...existing,
    ...patch,
    data: {
      ...(existing.data || {}),
      ...(patch.data || {})
    }
  };
  next.status = normalizeReportStatus(next.status);
  next.clientVisible = Boolean(next.clientVisible || isPublishedStatus(next.status));
  if (patch.changeNotes !== undefined) {
    next.data.changeNotes = normalizeLines(patch.changeNotes);
  }
  if (patch.recommendationOverride !== undefined) {
    next.data.recommendationOverride = patch.recommendationOverride;
  }
  if (patch.reportType !== undefined) next.data.reportType = String(patch.reportType || "").trim();
  if (patch.targetType !== undefined) next.data.targetType = normalizeReportTargetType(patch.targetType);
  if (patch.targetId !== undefined || patch.estateId !== undefined) {
    next.data.targetId = String(patch.targetId || patch.estateId || "").trim();
  }
  if (patch.publishDate !== undefined) next.data.publishDate = String(patch.publishDate || "").trim();
  if (patch.reviewDate !== undefined) next.data.reviewDate = String(patch.reviewDate || "").trim();
  if (patch.confidenceOverride !== undefined) next.data.confidenceOverride = normalizeScore(patch.confidenceOverride);
  if (patch.riskLevel !== undefined) next.data.riskLevel = String(patch.riskLevel || "Unknown").trim();
  if (patch.executiveSummary !== undefined) next.data.executiveSummary = String(patch.executiveSummary || "").trim();
  if (patch.recommendationRationale !== undefined) next.data.recommendationRationale = String(patch.recommendationRationale || "").trim();
  if (patch.keyRisks !== undefined) next.data.keyRisks = normalizeLines(patch.keyRisks);
  if (patch.opportunityNotes !== undefined) next.data.opportunityNotes = normalizeLines(patch.opportunityNotes);
  if (patch.internalNotes !== undefined) next.data.internalNotes = String(patch.internalNotes || "").trim();
  if (normalizeReportTargetType(next.data.targetType) === "estate" && !next.data.targetId) {
    throw new Error("Estate is required for estate reports");
  }
  if (normalizeReportTargetType(next.data.targetType) === "neighborhood" && !next.data.targetId) {
    next.data.targetId = next.neighborhoodId;
  }
  const now = nowIso();
  if (!existsInDb) {
    getDb()
      .prepare(`
        INSERT INTO reports (
          id, neighborhood_id, site_title, client, use_case, status, activity,
          changes, ref, client_visible, data, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        next.neighborhoodId,
        next.siteTitle,
        next.client,
        next.use,
        next.status,
        next.activity || "just now",
        Number(next.changes) || 0,
        next.ref,
        next.clientVisible ? 1 : 0,
        JSON.stringify(next.data || {}),
        now,
        now
      );
    upsertClient(next.client);
    logReportEvent(id, "override", patch);
    return getReport(id);
  }
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
  const data = row.data ? JSON.parse(row.data) : {};
  const hasScoreOverride = data.confidenceOverride !== null && data.confidenceOverride !== undefined && data.confidenceOverride !== "";
  const score = hasScoreOverride && Number.isFinite(Number(data.confidenceOverride)) ? Number(data.confidenceOverride) : confidenceScore(neighborhood);
  const sourceType = normalizeReportTargetType(data.targetType);
  const sourceId = data.targetId || row.neighborhood_id;
  const resources = resourcesFor(sourceType, sourceId);
  return withReportDefaults({
    id: row.id,
    sourceType,
    sourceId,
    neighborhoodId: row.neighborhood_id,
    neighborhoodName: row.neighborhood_name,
    neighborhood,
    siteTitle: row.site_title,
    client: row.client,
    use: row.use_case,
    status: normalizeReportStatus(row.status),
    activity: row.activity,
    changes: row.changes,
    ref: row.ref,
    clientVisible: Boolean(row.client_visible) || isPublishedStatus(row.status),
    data,
    resources,
    score,
    level: confidenceLevel(score),
    verdict: data.recommendationOverride || (score >= 70 ? "Proceed" : score >= 40 ? "Proceed with conditions" : "Hold")
  });
}

function getInventoryReports() {
  const neighborhoods = getDb()
    .prepare("SELECT id, name, data FROM neighborhoods ORDER BY rowid")
    .all()
    .map((row) => JSON.parse(row.data));
  const byId = new Map(neighborhoods.map((record) => [record.id, record]));
  const inventory = getLandBibleInventory();
  const estateReports = inventory.estates.map((estate, index) => estateToReport(estate, byId, index)).filter(Boolean);
  const estateNeighborhoodIds = new Set(inventory.estates.map((estate) => estate.neighborhood_id).filter(Boolean));
  const neighborhoodReports = neighborhoods.map((record, index) => neighborhoodToReport(record, index, estateNeighborhoodIds.has(toBibleId(record.id))));
  return neighborhoodReports.concat(estateReports);
}

function neighborhoodToReport(neighborhood, index, hasEstates) {
  const score = confidenceScore(neighborhood);
  const market = getLandMarketProfile(neighborhood.id);
  const resources = resourcesFor("neighborhood", neighborhood.id);
  const priceRow = market?.priceLabel ? { label: `${market.currentYear || 2026} avg price`, value: market.priceLabel, sourceType: "Historical" } : null;
  const build = [
    priceRow,
    ...(neighborhood.intelligence?.buildParameters || []).slice(0, priceRow ? 3 : 4)
  ].filter(Boolean);
  const rules = [
    market?.asOfLabel ? { label: market.asOfLabel, sourceType: "Historical" } : null,
    ...(neighborhood.intelligence?.constraints || []).slice(0, 2)
  ].filter(Boolean);

  return withReportDefaults({
    id: `land-${neighborhood.id}`,
    sourceType: "neighborhood",
    sourceId: neighborhood.id,
    neighborhoodId: neighborhood.id,
    neighborhoodName: neighborhood.name,
    neighborhood,
    siteTitle: neighborhood.name,
    client: "CW Real Estate Intelligence",
    use: hasEstates ? "Neighborhood + estate intelligence" : "Neighborhood intelligence",
    status: reportStatus(index),
    activity: reportActivity(index),
    changes: market ? 1 : 0,
    ref: `CW-LAND-${String(index + 1).padStart(3, "0")}`,
    clientVisible: index % 3 !== 0,
    data: {
      changeNotes: market ? [
        `${market.currentYear || 2026} estimate added from land bible source pricing`,
        `${market.estateSummary?.total || 0} estate records linked to this market`
      ] : ["Neighborhood planning brief generated from current intelligence data"],
      recommendationOverride: null,
      buildParameters: build,
      constraints: rules,
      notes: neighborhood.notes || []
    },
    resources,
    score,
    level: confidenceLevel(score),
    verdict: score >= 70 ? "Proceed" : score >= 40 ? "Proceed with conditions" : "Hold"
  });
}

function estateToReport(estate, neighborhoodsById, index) {
  const parentId = toLocationId(estate.neighborhood_id);
  const estateSlug = toEstateSlug(estate.id);
  const neighborhood = neighborhoodsById.get(parentId) || fallbackNeighborhoodForEstate(estate);
  const market = getEstateMarketProfile(estateSlug);
  const score = estateScore(estate, market);
  const sourceYear = market?.sourcePriceYear || 2023;
  const currentYear = market?.currentYear || 2026;
  const resources = resourcesFor("estate", estateSlug);

  return withReportDefaults({
    id: `estate-${estateSlug}`,
    sourceType: "estate",
    sourceId: estate.id,
    neighborhoodId: parentId,
    neighborhoodName: market?.parentName || neighborhood.name,
    neighborhood,
    siteTitle: estate.name,
    client: "CW Real Estate Intelligence",
    use: estate.primary_use || "Estate intelligence",
    status: reportStatus(index + 1),
    activity: reportActivity(index + 2),
    changes: market?.priceValue && market?.sourcePriceValue ? 2 : 1,
    ref: `CW-EST-${String(index + 1).padStart(3, "0")}`,
    clientVisible: index % 4 !== 0,
    data: {
      changeNotes: [
        `${currentYear} estimate derived from ${sourceYear} source price`,
        `${market?.status || estate.status || "Estate"} status and land metrics added`
      ],
      recommendationOverride: null,
      buildParameters: [
        { label: `${currentYear} price/sqm`, value: market?.priceLabel || estate.current_price_label || "Contact for pricing", sourceType: "Historical" },
        { label: `${sourceYear} source price`, value: market?.sourcePriceLabel || estate.current_price_label || "Unavailable", sourceType: "Historical" },
        { label: "Mapped land", value: market?.totalLandLabel || estate.total_land_label || "Not mapped", sourceType: "Internal" },
        { label: "Primary use", value: market?.primaryUse || estate.primary_use || "Mixed use", sourceType: "Manual" }
      ],
      constraints: [
        { label: `${estate.name} is tracked under ${market?.parentName || neighborhood.name}`, sourceType: "Internal" },
        { label: `Estate status: ${market?.status || estate.status || "Unknown"}`, sourceType: "Manual" },
        market?.developer && market.developer !== "Not specified" ? { label: `Developer: ${market.developer}`, sourceType: "Manual" } : null
      ].filter(Boolean),
      notes: [
        { author: "CW Market Desk", date: "2026-07-02", text: market?.asOfLabel || `${currentYear} market estimate generated from land bible data.` },
        { author: "Planning Team", date: "2026-07-02", text: "Verify title, survey, estate rules, and live availability before advising a client." }
      ]
    },
    resources,
    score,
    level: confidenceLevel(score),
    verdict: score >= 70 ? "Proceed" : score >= 40 ? "Proceed with conditions" : "Hold"
  });
}

function resourcesFor(targetType, targetId) {
  return getDb()
    .prepare(`
      SELECT id, target_type AS targetType, target_id AS targetId, resource_type AS resourceType,
             title, summary, url, file_name AS fileName, mime_type AS mimeType,
             file_size AS fileSize, source, visibility, author, created_at AS createdAt, updated_at AS updatedAt
      FROM intelligence_resources
      WHERE target_type = ? AND target_id = ? AND visibility = 'Client'
      ORDER BY created_at DESC
      LIMIT 6
    `)
    .all(targetType, targetId);
}

function reportStatus(index) {
  return ["Draft", "Published", "Client viewed"][index % 3];
}

function normalizeReportStatus(status) {
  const value = String(status || "Draft").trim();
  if (value === "Shared") return "Published";
  return value || "Draft";
}

function withReportDefaults(report) {
  const n = report.neighborhood || {};
  const constraints = report.data?.constraints?.length ? report.data.constraints : n.intelligence?.constraints || [];
  const changeNotes = report.data?.changeNotes || [];
  const summary = report.data?.executiveSummary
    || n.recommendation?.summary
    || n.recommendation?.confidenceReason
    || `${report.siteTitle} is tracked as ${report.use || "development intelligence"} in ${report.neighborhoodName}.`;
  const rationale = report.data?.recommendationRationale
    || n.recommendation?.confidenceReason
    || "Verify planning rules, market data, title, survey, estate requirements, and approval precedents before committing capital.";
  const keyRisks = report.data?.keyRisks?.length
    ? report.data.keyRisks
    : constraints.slice(0, 3).map((row) => row.label).filter(Boolean);
  const opportunityNotes = report.data?.opportunityNotes?.length
    ? report.data.opportunityNotes
    : changeNotes.slice(0, 2).filter(Boolean);

  return {
    ...report,
    data: {
      ...(report.data || {}),
      reportType: report.data?.reportType || (report.sourceType === "estate" ? "Estate brief" : "Neighborhood brief"),
      targetType: report.data?.targetType || report.sourceType || "neighborhood",
      targetId: report.data?.targetId || (report.sourceType === "estate" ? toEstateSlug(report.sourceId) : report.sourceId) || report.neighborhoodId,
      publishDate: report.data?.publishDate || "2026-07-02",
      reviewDate: report.data?.reviewDate || "",
      confidenceOverride: report.data?.confidenceOverride ?? null,
      riskLevel: report.data?.riskLevel || n.recommendation?.riskLevel || riskLevelFromScore(report.score),
      executiveSummary: summary,
      recommendationRationale: rationale,
      keyRisks,
      opportunityNotes,
      internalNotes: report.data?.internalNotes || ""
    }
  };
}

function riskLevelFromScore(score) {
  const value = Number(score) || 0;
  if (value >= 75) return "Low";
  if (value >= 55) return "Medium";
  if (value >= 35) return "High";
  return "Critical";
}

function normalizeReportTargetType(type) {
  return String(type || "").trim() === "estate" ? "estate" : "neighborhood";
}

function normalizeScore(value) {
  if (value === "" || value === null || value === undefined) return null;
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function isPublishedStatus(status) {
  return ["Published", "Shared", "Client viewed"].includes(String(status || ""));
}

function reportActivity(index) {
  return ["2h ago", "yesterday", "3d ago", "4d ago", "1w ago", "2w ago"][index % 6];
}

function estateScore(estate, market) {
  let score = 48;
  if (market?.priceValue || estate.current_price_per_sqm || estate.current_price_usd) score += 16;
  if (market?.totalLandSqm || estate.total_land_sqm) score += 12;
  if (/built/i.test(estate.status || "")) score += 8;
  if (/develop/i.test(estate.status || "")) score += 4;
  if (estate.developer) score += 6;
  if (estate.available_plots) score += 4;
  return Math.max(0, Math.min(100, score));
}

function fallbackNeighborhoodForEstate(estate) {
  const name = estate.location_label || estate.neighborhood_id || "Lagos";
  return {
    id: toLocationId(estate.neighborhood_id || name),
    name,
    jurisdiction: name,
    recommendation: {
      confidence: 50,
      confidenceReason: "Estate-level report generated from land bible data."
    },
    intelligence: {
      buildParameters: [],
      constraints: []
    },
    approvals: [],
    notes: []
  };
}

function toBibleId(value = "") {
  return String(value).replaceAll("-", "_");
}

function toLocationId(value = "") {
  return String(value).replaceAll("_", "-");
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
