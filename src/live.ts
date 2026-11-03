// Live refresh from the BLS Public Data API v1 (no key). Adds months newer than the bundled data.
// On any failure the tools keep working from the bundled data and say so in data_status.
import { DATA, BUNDLED_FETCHED, mergeLive, label, latest, type Dataset } from "./core.js";

const IDS = ["CUUR0000SA0", "CWUR0000SA0", "CUUR0000SA0L1E"];
const TTL_MS = 3 * 60 * 60 * 1000;

export interface DataStatus {
  live: boolean;
  latest_month: string;
  bundled_through: string;
  bundled_fetched: string;
  checked_at?: string;
  note: string;
}

let memo: { at: number; data: Dataset; status: DataStatus } | null = null;


type Row = { year: number; month: number; value: number | null };
type BlsJson = { status?: string; message?: string[]; Results?: { series?: Array<{ data: Array<{ year: string; period: string; value: string }> }> } };

interface EdgeCache { match(url: string): Promise<Response | undefined>; put(url: string, res: Response): Promise<void> }

// Workers edge cache (Cache API). Only successful BLS answers are stored, for 6 hours.
function edgeCache(): EdgeCache | null {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches;
  return c && c.default ? c.default : null;
}

let blsKey: string | undefined;
/** Optional free BLS registration key (Worker secret BLS_API_KEY or env var). Without it the keyless v1 API is used. */
export function setBlsKey(key: string | undefined): void {
  blsKey = key && key.trim() ? key.trim() : undefined;
}

async function fetchSeries(id: string): Promise<Row[]> {
  const url = blsKey
    ? `https://api.bls.gov/publicAPI/v2/timeseries/data/${id}?registrationkey=${encodeURIComponent(blsKey)}`
    : `https://api.bls.gov/publicAPI/v1/timeseries/data/${id}`;
  const cache = edgeCache();
  let j: BlsJson | null = null;
  if (cache) {
    const hit = await cache.match(url).catch(() => undefined);
    if (hit) j = (await hit.json()) as BlsJson;
  }
  if (!j) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": "cpi-inflation-calculator-mcp (+https://github.com/theluckystrike/cpi-inflation-calculator-mcp)" },
      });
      if (!res.ok) throw new Error(`BLS API HTTP ${res.status}`);
      j = (await res.json()) as BlsJson;
    } finally {
      clearTimeout(timer);
    }
    if (j.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS API ${j.status ?? "error"}: ${(j.message ?? []).join(" ").slice(0, 200)}`);
    if (cache) {
      await cache.put(url, new Response(JSON.stringify(j), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=21600" } })).catch(() => undefined);
    }
  }
  const rows = j.Results?.series?.[0]?.data ?? [];
  if (!rows.length) throw new Error("BLS API returned no data");
  return rows
    .filter((r) => /^M(0[1-9]|1[0-2])$/.test(r.period))
    .map((r) => ({ year: Number(r.year), month: Number(r.period.slice(1)), value: /^\d/.test(r.value) ? Number(r.value) : null }));
}

export function bundledStatus(note: string): DataStatus {
  const l = label(latest(DATA["CUUR0000SA0"]));
  return { live: false, latest_month: l, bundled_through: l, bundled_fetched: BUNDLED_FETCHED, note };
}

/** Bundled data merged with the live BLS API. Never throws. */
export async function loadData(): Promise<{ data: Dataset; status: DataStatus }> {
  if (memo && Date.now() - memo.at < TTL_MS) return { data: memo.data, status: memo.status };
  const bundledThrough = label(latest(DATA["CUUR0000SA0"]));
  try {
    const parts = await Promise.all(IDS.map((id) => fetchSeries(id)));
    const live: Record<string, Array<{ year: number; month: number; value: number | null }>> = {};
    IDS.forEach((id, i) => { live[id] = parts[i]; });
    const data = mergeLive(DATA, live);
    const l = label(latest(data["CUUR0000SA0"]));
    const status: DataStatus = {
      live: true, latest_month: l, bundled_through: bundledThrough, bundled_fetched: BUNDLED_FETCHED,
      checked_at: new Date().toISOString(),
      note: l === bundledThrough ? `Checked the BLS API live; ${l} is still the latest published month.` : `Checked the BLS API live; months after ${bundledThrough} added.`,
    };
    memo = { at: Date.now(), data, status };
    return { data, status };
  } catch (e) {
    const status = bundledStatus(`Live BLS API check failed (${(e as Error).message}). Using bundled BLS data through ${bundledThrough}, fetched ${BUNDLED_FETCHED}. Newer months, if any, are not included.`);
    // Back off for 10 minutes before asking BLS again (the keyless API has a daily request cap).
    memo = { at: Date.now() - TTL_MS + 10 * 60 * 1000, data: DATA, status };
    return { data: DATA, status };
  }
}
