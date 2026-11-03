// Pure CPI inflation logic. No I/O: the BLS data comes in as an argument (bundled data, optionally
// merged with newer months fetched live by src/live.ts).
import { DATA, BUNDLED_FETCHED, type SeriesData } from "./data.js";

export { DATA, BUNDLED_FETCHED };
export type { SeriesData };
export type Dataset = Record<string, SeriesData>;

export const AS_OF = "2026-11-03";
export const SITE = "https://statewage.com";
export const REPO = "cpi-inflation-calculator-mcp";
export const PAGES = {
  raise: "/pay-raise-calculator/",
  salary: "/salary-to-hourly/",
  ss: "/social-security-tax-calculator/",
};
export function moreUrl(path: string): string {
  return `${SITE}${path}?utm_source=mcp&utm_medium=${REPO}`;
}

export const SERIES = {
  cpi_u: { id: "CUUR0000SA0", name: "CPI-U, all items, U.S. city average, not seasonally adjusted (1982-84=100)" },
  cpi_w: { id: "CWUR0000SA0", name: "CPI-W, all items, U.S. city average, not seasonally adjusted (1982-84=100)" },
  core: { id: "CUUR0000SA0L1E", name: "CPI-U, all items less food and energy (core), not seasonally adjusted (1982-84=100)" },
} as const;
export type SeriesKey = keyof typeof SERIES;
export const SERIES_KEYS = Object.keys(SERIES) as SeriesKey[];

export const SOURCES = {
  api: "https://api.bls.gov/publicAPI/v1/timeseries/data/",
  dataViewer: (id: string) => `https://data.bls.gov/timeseries/${id}`,
  cpiHome: "https://www.bls.gov/cpi/",
  cola: "https://www.law.cornell.edu/uscode/text/42/415",
  cola2027: "https://www.federalregister.gov/documents/2026/10/26/2026-21796/cost-of-living-increase-and-other-determinations-for-2027",
};

export const DISCLAIMER = "Index values from the U.S. Bureau of Labor Statistics. General information, not financial advice.";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export class InputError extends Error {}

export interface Period { year: number; month?: number }

export function parsePeriod(s: string): Period | "latest" {
  const t = s.trim().toLowerCase();
  if (t === "latest" || t === "now" || t === "today") return "latest";
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(t);
  if (!m) throw new InputError(`Period "${s}" is not valid. Use YYYY (annual average), YYYY-MM (one month) or "latest".`);
  const year = Number(m[1]);
  const month = m[2] === undefined ? undefined : Number(m[2]);
  if (month !== undefined && (month < 1 || month > 12)) throw new InputError(`Month in "${s}" must be 01-12.`);
  return { year, month };
}

export function label(p: Period): string {
  return p.month ? `${MONTHS[p.month - 1]} ${p.year}` : `${p.year} annual average`;
}

function idx(d: SeriesData, year: number, month: number): number {
  return (year - d.start[0]) * 12 + (month - d.start[1]);
}

/** Monthly index value, or null if not published. Throws if outside the series. */
export function monthly(d: SeriesData, year: number, month: number): number | null {
  const i = idx(d, year, month);
  if (i < 0) throw new InputError(`No index before ${MONTHS[d.start[1] - 1]} ${d.start[0]} for this series.`);
  if (i >= d.monthly.length) return undefined as unknown as null;
  return d.monthly[i];
}

export function latest(d: SeriesData): Period {
  return { year: d.end[0], month: d.end[1] };
}

export function series(data: Dataset, key: SeriesKey): SeriesData {
  const d = data[SERIES[key].id];
  if (!d) throw new InputError(`Series ${key} is not loaded.`);
  return d;
}

/** Merge newer monthly values (from the live BLS API) into a copy of the bundled data. */
export function mergeLive(base: Dataset, live: Record<string, Array<{ year: number; month: number; value: number | null }>>): Dataset {
  const out: Dataset = {};
  for (const [id, d] of Object.entries(base)) {
    const copy: SeriesData = { start: [...d.start] as [number, number], end: [...d.end] as [number, number], monthly: [...d.monthly], annual: { ...d.annual } };
    for (const pt of live[id] ?? []) {
      const i = idx(copy, pt.year, pt.month);
      if (i < 0) continue;
      while (copy.monthly.length <= i) copy.monthly.push(null);
      copy.monthly[i] = pt.value;
    }
    // trim trailing nulls and set end
    while (copy.monthly.length && copy.monthly[copy.monthly.length - 1] === null) copy.monthly.pop();
    const n = copy.monthly.length - 1;
    copy.end = [copy.start[0] + Math.floor((copy.start[1] - 1 + n) / 12), ((copy.start[1] - 1 + n) % 12) + 1];
    out[id] = copy;
  }
  return out;
}

export interface Resolved { period: Period; label: string; value: number; basis: "annual_average" | "monthly"; note?: string }

/** Resolve a period to an index value. Years without an annual average fall back to the latest month of that year. */
export function resolve(d: SeriesData, p: Period | "latest"): Resolved {
  if (p === "latest") {
    const l = latest(d);
    return { period: l, label: label(l), value: monthly(d, l.year, l.month!)!, basis: "monthly" };
  }
  if (p.month === undefined) {
    const a = d.annual[String(p.year)];
    if (a !== undefined) return { period: p, label: label(p), value: a, basis: "annual_average" };
    if (p.year < d.start[0]) throw new InputError(`No CPI data for ${p.year}. This series starts in ${d.start[0]}.`);
    if (p.year > d.end[0]) throw new InputError(`No CPI data for ${p.year} yet. Latest published month is ${label(latest(d))}.`);
    const l = p.year === d.end[0] ? latest(d) : { year: p.year, month: 12 };
    return {
      period: l, label: label(l), value: monthly(d, l.year, l.month!)!, basis: "monthly",
      note: `${p.year} has no annual average yet (BLS publishes it with the December index in January), so ${label(l)} is used.`,
    };
  }
  const v = monthly(d, p.year, p.month);
  if (v === undefined) throw new InputError(`${label(p)} is not published yet. Latest published month is ${label(latest(d))}.`);
  if (v === null) {
    if (p.year === 2025 && p.month === 10) {
      throw new InputError("BLS did not publish an October 2025 CPI. Data were not collected during the 2025 lapse in appropriations. Use 2025-09 or 2025-11 instead.");
    }
    throw new InputError(`BLS has no index value for ${label(p)}.`);
  }
  return { period: p, label: label(p), value: v, basis: "monthly" };
}

function yearsBetween(a: Period, b: Period): number {
  const am = a.month ?? 6.5; // annual average is centred mid-year
  const bm = b.month ?? 6.5;
  return (b.year - a.year) + (bm - am) / 12;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export function calculateInflation(data: Dataset, a: { amount: number; from: string; to?: string; series?: SeriesKey }) {
  const key = a.series ?? "cpi_u";
  const d = series(data, key);
  const from = resolve(d, parsePeriod(a.from));
  const to = resolve(d, parsePeriod(a.to ?? "latest"));
  const ratio = to.value / from.value;
  const years = yearsBetween(from.period, to.period);
  const annualized = years > 0.0001 || years < -0.0001 ? (Math.pow(ratio, 1 / years) - 1) * 100 : null;
  const notes = [from.note, to.note].filter(Boolean) as string[];
  return {
    amount: a.amount,
    adjusted_amount: r2(a.amount * ratio),
    from: { period: from.label, cpi: from.value, basis: from.basis },
    to: { period: to.label, cpi: to.value, basis: to.basis },
    cumulative_inflation_percent: r2((ratio - 1) * 100),
    average_annual_inflation_percent: annualized === null ? null : r2(annualized),
    years: r2(years),
    purchasing_power_of_amount_then: r2(a.amount / ratio),
    series: key,
    series_id: SERIES[key].id,
    series_name: SERIES[key].name,
    formula: `amount x (CPI ${to.label} / CPI ${from.label}) = ${a.amount} x (${to.value} / ${from.value})`,
    notes,
  };
}

export function getInflationRate(data: Dataset, a: { year: number; series?: SeriesKey }) {
  const key = a.series ?? "cpi_u";
  const d = series(data, key);
  const y = a.year;
  if (y <= d.start[0]) throw new InputError(`Need the prior year too; this series starts in ${d.start[0]}. Use ${d.start[0] + 1} or later.`);
  if (y > d.end[0]) throw new InputError(`No CPI data for ${y} yet. Latest published month is ${label(latest(d))}.`);
  const cur = d.annual[String(y)];
  const prev = d.annual[String(y - 1)];
  const annual = cur !== undefined && prev !== undefined ? r1((cur / prev - 1) * 100) : null;
  const dec = monthly(d, y, 12);
  const decPrev = monthly(d, y - 1, 12);
  const decDec = dec != null && decPrev != null ? r1((dec / decPrev - 1) * 100) : null;
  let ytd: null | { through: string; twelve_month_percent: number } = null;
  if (y === d.end[0] && d.end[1] < 12) {
    const l = latest(d);
    const v = monthly(d, l.year, l.month!)!;
    const pv = monthly(d, l.year - 1, l.month!);
    if (pv != null) ytd = { through: label(l), twelve_month_percent: r1((v / pv - 1) * 100) };
  }
  return {
    year: y,
    series: key,
    series_id: SERIES[key].id,
    annual_average_cpi: cur ?? null,
    prior_year_annual_average_cpi: prev ?? null,
    annual_average_inflation_percent: annual,
    december_cpi: dec ?? null,
    december_to_december_percent: decDec,
    latest_twelve_month: ytd,
    notes: [
      ...(y === 2025 ? ["October 2025 CPI was not collected (2025 lapse in appropriations). BLS still published a 2025 annual average."] : []),
      ...(annual === null ? [`${y} annual average not published yet; it comes out with the December index in January.`] : []),
    ],
  };
}

export function getLatestCpi(data: Dataset) {
  const rows = SERIES_KEYS.map((key) => {
    const d = series(data, key);
    const l = latest(d);
    const v = monthly(d, l.year, l.month!)!;
    const yAgo = monthly(d, l.year - 1, l.month!);
    let prevM = { year: l.month === 1 ? l.year - 1 : l.year, month: l.month === 1 ? 12 : l.month! - 1 };
    let pm = monthly(d, prevM.year, prevM.month);
    const dec = monthly(d, l.year - 1, 12);
    return {
      series: key,
      series_id: SERIES[key].id,
      name: SERIES[key].name,
      latest_month: label(l),
      index: v,
      twelve_month_change_percent: yAgo != null ? r1((v / yAgo - 1) * 100) : null,
      one_month_change_percent_nsa: pm != null ? r1((v / pm - 1) * 100) : null,
      year_to_date_change_percent: dec != null && l.month !== 12 ? r1((v / dec - 1) * 100) : null,
      year_ago_index: yAgo ?? null,
    };
  });
  return { latest_month: rows[0].latest_month, series: rows };
}

export function compareRaiseToInflation(data: Dataset, a: { old_pay: number; new_pay: number; from: string; to?: string; series?: SeriesKey }) {
  if (a.old_pay <= 0) throw new InputError("old_pay must be greater than 0.");
  const inf = calculateInflation(data, { amount: a.old_pay, from: a.from, to: a.to, series: a.series });
  const nominal = (a.new_pay / a.old_pay - 1) * 100;
  const ratio = inf.to.cpi / inf.from.cpi;
  const real = (a.new_pay / (a.old_pay * ratio) - 1) * 100;
  return {
    old_pay: a.old_pay,
    new_pay: a.new_pay,
    from: inf.from,
    to: inf.to,
    nominal_raise_percent: r2(nominal),
    inflation_percent: inf.cumulative_inflation_percent,
    real_raise_percent: r2(real),
    pay_needed_to_keep_pace: inf.adjusted_amount,
    shortfall_or_gain: r2(a.new_pay - inf.adjusted_amount),
    new_pay_in_from_period_dollars: r2(a.new_pay / ratio),
    beat_inflation: a.new_pay >= inf.adjusted_amount,
    series: inf.series,
    notes: inf.notes,
  };
}

/** Social Security COLA rule (42 U.S.C. 415(i)): Q3 average CPI-W of the prior year over the Q3 average of the last COLA computation year, rounded to 0.1%. */
export function calculateColaFromCpiW(data: Dataset, a: { cola_year: number }) {
  const d = series(data, "cpi_w");
  const y = a.cola_year - 1; // measurement year
  const q3 = (yr: number) => {
    const vals = [7, 8, 9].map((m) => monthly(d, yr, m));
    if (vals.some((v) => v == null)) return null;
    return { months: vals as number[], average: r3((vals as number[]).reduce((s, v) => s + v, 0) / 3) };
  };
  if (a.cola_year < 1976) throw new InputError("The automatic CPI-W COLA formula applies from 1975; use 1976 or later for this tool.");
  const cur = q3(y);
  if (!cur) {
    const l = latest(d);
    throw new InputError(`Q3 ${y} CPI-W (July-September) is not complete yet. Latest published month is ${label(l)}. The ${a.cola_year} COLA is announced in October ${y}.`);
  }
  const base = q3(y - 1);
  if (!base) throw new InputError(`Q3 ${y - 1} CPI-W is not available.`);
  const raw = (cur.average / base.average - 1) * 100;
  const cola = Math.max(0, Math.round(raw * 10) / 10);
  return {
    cola_year: a.cola_year,
    benefits_affected: `Payable for December ${y} (received in January ${a.cola_year})`,
    q3_measurement_year: y,
    q3_cpi_w: { year: y, months: { July: cur.months[0], August: cur.months[1], September: cur.months[2] }, average: cur.average },
    q3_base: { year: y - 1, months: { July: base.months[0], August: base.months[1], September: base.months[2] }, average: base.average },
    unrounded_percent: r3(raw),
    cola_percent: cola,
    method: "Average CPI-W for July-September of the measurement year divided by the same average for the prior year, minus 1, rounded to the nearest 0.1%. Assumes a COLA was paid the prior year (true every year since 2016).",
  };
}
