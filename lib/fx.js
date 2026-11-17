import { getMeta, setMeta } from "./database.js";

// US dollar to naira, for listings priced in dollars. The rate is the published
// market rate from open.er-api.com (free, refreshed daily), not the
// parallel-market rate. Rates By Exchange Rate API: https://www.exchangerate-api.com
const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const META_KEY = "usd_ngn_rate";

let memory;
let pending;
let lastAttempt = 0;

// Fresh rate if one can be had, otherwise the last one known. Null only when no
// rate has ever been fetched and USD_NGN_FALLBACK is not set.
export async function getUsdNgnRate() {
  let known = await stored();
  if (!known || !isFresh(known)) {
    await refresh();
    known = await stored();
  }
  if (known) return { rate: known.rate, asOf: known.asOf, source: "live" };
  const fallback = Number(process.env.USD_NGN_FALLBACK);
  return fallback > 0 ? { rate: fallback, asOf: null, source: "fallback" } : null;
}

function refresh() {
  if (pending) return pending;
  if (Date.now() - lastAttempt < RETRY_MS) return Promise.resolve();
  lastAttempt = Date.now();
  pending = fetch(RATE_URL, { cache: "no-store", signal: AbortSignal.timeout(4000) })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
    .then(async (body) => {
      const rate = Number(body?.rates?.NGN);
      if (body?.result !== "success" || !(rate > 0)) throw new Error("no NGN rate in response");
      memory = {
        rate,
        asOf: body.time_last_update_unix ? new Date(body.time_last_update_unix * 1000).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        fetchedAt: Date.now()
      };
      await setMeta(META_KEY, JSON.stringify(memory));
    })
    .catch((error) => {
      console.warn(`[fx] Could not refresh the USD/NGN rate: ${error.message}`);
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

// The last rate fetched: from memory, else from the database (another instance
// may have fetched it), so a cold start rarely has to call the rate service.
async function stored() {
  if (memory) return memory;
  try {
    const saved = JSON.parse((await getMeta(META_KEY)) || "null");
    if (saved?.rate > 0) memory = saved;
  } catch {
    // An unreadable saved rate is the same as none.
  }
  return memory || null;
}

function isFresh(known) {
  return Date.now() - (known.fetchedAt || 0) < MAX_AGE_MS;
}
