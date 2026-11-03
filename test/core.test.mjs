// Fixtures: index values from the BLS Public Data API (fetched 2026-11-03) and SSA's announced COLAs
// (8.7% 2023, 3.2% 2024, 2.5% 2025, 2.8% 2026, 3.6% 2027), or hand-checked arithmetic on those values.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DATA, calculateInflation as inf, getInflationRate as rate, getLatestCpi, compareRaiseToInflation as raise,
  calculateColaFromCpiW as cola, mergeLive, parsePeriod, InputError,
} from "../dist/core.js";

test("F1 BLS: CPI-U Sept 2026 = 336.940, Jan 2020 = 257.971", () => {
  const r = inf(DATA, { amount: 100, from: "2020-01", to: "2026-09" });
  assert.equal(r.from.cpi, 257.971);
  assert.equal(r.to.cpi, 336.94);
  assert.equal(r.adjusted_amount, 130.61); // 100 * 336.94 / 257.971 = 130.612
});

test("F2 BLS annual averages: 2024 313.689, 2025 321.943 -> 2025 inflation 2.6%", () => {
  const r = rate(DATA, { year: 2025 });
  assert.equal(r.annual_average_cpi, 321.943);
  assert.equal(r.prior_year_annual_average_cpi, 313.689);
  assert.equal(r.annual_average_inflation_percent, 2.6);
});

test("F3 2022 annual-average inflation 8.0%", () => {
  assert.equal(rate(DATA, { year: 2022 }).annual_average_inflation_percent, 8);
});

test("F4 October 2025 not published: clear error naming the lapse", () => {
  assert.throws(() => inf(DATA, { amount: 1, from: "2025-10" }), /lapse in appropriations/);
});

test("F5 2025 Dec-Dec: 324.054 vs Dec 2024", () => {
  const r = rate(DATA, { year: 2025 });
  assert.equal(r.december_cpi, 324.054);
  assert.equal(r.december_to_december_percent, 2.7);
});

test("F6 SSA COLA reproduced from CPI-W: 2027 3.6%", () => {
  const r = cola(DATA, { cola_year: 2027 });
  assert.equal(r.cola_percent, 3.6);
  assert.equal(r.q3_base.months.July, 316.349);
  assert.equal(r.q3_base.months.September, 318.139);
});

test("F7 SSA COLAs 2023-2026: 8.7, 3.2, 2.5, 2.8", () => {
  assert.deepEqual([2023, 2024, 2025, 2026].map((y) => cola(DATA, { cola_year: y }).cola_percent), [8.7, 3.2, 2.5, 2.8]);
});

test("F8 2028 COLA not computable yet (Q3 2027 missing)", () => {
  assert.throws(() => cola(DATA, { cola_year: 2028 }), /not complete yet/);
});

test("F9 latest CPI: September 2026, CPI-U 12-month 3.7% (336.940 / 324.800)", () => {
  const r = getLatestCpi(DATA);
  assert.equal(r.latest_month, "September 2026");
  const u = r.series.find((s) => s.series === "cpi_u");
  assert.equal(u.year_ago_index, 324.8);
  assert.equal(u.twelve_month_change_percent, 3.7);
});

test("F10 core CPI Sept 2026 339.287, 12-month 2.6%", () => {
  const c = getLatestCpi(DATA).series.find((s) => s.series === "core");
  assert.equal(c.index, 339.287);
  assert.equal(c.twelve_month_change_percent, 2.6);
});

test("F11 1913 annual average 9.9 -> 1914 inflation 1.0%", () => {
  const r = rate(DATA, { year: 1914 });
  assert.equal(r.prior_year_annual_average_cpi, 9.9);
  assert.equal(r.annual_average_inflation_percent, 1);
});

test("F12 raise vs inflation: 50,000 (2024-09) -> 52,000 (2026-09) is a real cut", () => {
  const r = raise(DATA, { old_pay: 50000, new_pay: 52000, from: "2024-09", to: "2026-09" });
  // 50,000 * 336.940 / 315.301 = 53,431.48
  assert.equal(r.pay_needed_to_keep_pace, 53431.48);
  assert.equal(r.beat_inflation, false);
  assert.equal(r.nominal_raise_percent, 4);
});

test("F13 year without annual average falls back to latest month with a note", () => {
  const r = inf(DATA, { amount: 100, from: "2025", to: "2026" });
  assert.equal(r.from.basis, "annual_average");
  assert.equal(r.to.period, "September 2026");
  assert.match(r.notes.join(" "), /no annual average yet/);
});

test("F14 future month refused with latest month named", () => {
  assert.throws(() => inf(DATA, { amount: 1, from: "2026-11" }), /not published yet.*September 2026/);
});

test("F15 bad period format rejected", () => {
  assert.throws(() => parsePeriod("Jan 2020"), InputError);
  assert.throws(() => parsePeriod("2020-13"), InputError);
});

test("F16 mergeLive adds a newer month and moves the end", () => {
  const m = mergeLive(DATA, { CUUR0000SA0: [{ year: 2026, month: 10, value: 338.0 }] });
  assert.deepEqual(m.CUUR0000SA0.end, [2026, 10]);
  assert.equal(inf(m, { amount: 100, from: "2026-09", to: "latest" }).to.period, "October 2026");
  assert.deepEqual(DATA.CUUR0000SA0.end, [2026, 9]); // bundled data untouched
});

test("F17 core CPI before 1957 refused", () => {
  assert.throws(() => inf(DATA, { amount: 1, from: "1950-01", series: "core" }), /No index before/);
});
