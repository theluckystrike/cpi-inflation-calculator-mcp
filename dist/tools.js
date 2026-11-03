// One tool registry shared by the stdio and Cloudflare Worker entries.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AS_OF, DISCLAIMER, InputError, PAGES, SERIES, SERIES_KEYS, SOURCES, moreUrl, calculateInflation, getInflationRate, getLatestCpi, compareRaiseToInflation, calculateColaFromCpiW, } from "./core.js";
import { loadData } from "./live.js";
export const SERVER_NAME = "cpi-inflation-calculator-mcp";
export const SERVER_VERSION = "1.0.0";
const money = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const period = (what) => z.string().min(4).max(10).describe(`${what}: "YYYY" for the annual average, "YYYY-MM" for one month, or "latest".`);
const seriesArg = z.enum(SERIES_KEYS).optional()
    .describe("cpi_u (default, the headline CPI), cpi_w (wage earners, used for Social Security COLAs) or core (CPI-U less food and energy).");
function reply(summary, data, status, source, morePath) {
    const body = { ...data, summary, data_status: status, as_of: status.checked_at ?? AS_OF, source, more: moreUrl(morePath), disclaimer: DISCLAIMER };
    const liveLine = status.live ? "" : ` Note: ${status.note}`;
    return {
        content: [
            { type: "text", text: `${summary}${liveLine}\n\n${DISCLAIMER}` },
            { type: "text", text: JSON.stringify(body, null, 2) },
        ],
        structuredContent: body,
    };
}
async function run(fn) {
    try {
        const loaded = await loadData();
        return fn(loaded);
    }
    catch (e) {
        const msg = e instanceof InputError ? e.message : `Unexpected error: ${e.message}`;
        return { isError: true, content: [{ type: "text", text: msg }] };
    }
}
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const src = (key) => `${SOURCES.dataViewer(SERIES[(key ?? "cpi_u")].id)} (BLS Public Data API ${SOURCES.api})`;
export function registerTools(server) {
    server.registerTool("calculate_inflation", {
        title: "Inflation calculator (CPI, 1913 to latest month)",
        description: "Adjusts a dollar amount for inflation between any two periods from 1913 to the latest month the U.S. Bureau of Labor Statistics has published, using the official CPI-U (or CPI-W or core CPI). Checks the BLS Public Data API live for months newer than its bundled data (bundled through September 2026, fetched 2026-11-03), so it knows CPI figures newer than a model's training data. Handles the October 2025 gap: BLS published no October 2025 CPI because of the 2025 lapse in appropriations. Returns the adjusted amount, cumulative and average annual inflation, and the exact index values used.",
        inputSchema: {
            amount: z.number().min(0).max(1e13).describe("Dollar amount in the 'from' period."),
            from: period("Starting period, e.g. \"1995\" or \"2020-01\""),
            to: period("Ending period, default \"latest\"").optional(),
            series: seriesArg,
        },
        annotations: { ...RO, title: "Inflation calculator (CPI)" },
    }, async (a) => run(({ data, status }) => {
        const r = calculateInflation(data, { ...a, series: a.series });
        let s = `${money(a.amount)} in ${r.from.period} has the same buying power as ${money(r.adjusted_amount)} in ${r.to.period} (${r.series === "cpi_u" ? "CPI-U" : r.series === "cpi_w" ? "CPI-W" : "core CPI"} ${r.from.cpi} to ${r.to.cpi}). Cumulative inflation ${r.cumulative_inflation_percent}%`;
        s += r.average_annual_inflation_percent === null ? "." : `, about ${r.average_annual_inflation_percent}% a year over ${r.years} years.`;
        if (r.notes.length)
            s += ` ${r.notes.join(" ")}`;
        return reply(s, r, status, src(a.series), PAGES.raise);
    }));
    server.registerTool("get_latest_cpi", {
        title: "Latest CPI release (live from BLS)",
        description: "Returns the most recent CPI index values published by the Bureau of Labor Statistics, checked live against the BLS Public Data API: the latest month, the 12-month inflation rate for headline CPI-U, CPI-W and core CPI (less food and energy), the not seasonally adjusted 1-month change, and the year-to-date change. Use it to answer 'what is inflation right now'. If the live check fails it says so and falls back to bundled BLS data (through September 2026).",
        inputSchema: {},
        annotations: { ...RO, title: "Latest CPI (live)" },
    }, async () => run(({ data, status }) => {
        const r = getLatestCpi(data);
        const [u, w, c] = r.series;
        const s = `Latest CPI from BLS: ${r.latest_month}. CPI-U ${u.index}, up ${u.twelve_month_change_percent}% over 12 months. Core CPI (less food and energy) up ${c.twelve_month_change_percent}%. CPI-W up ${w.twelve_month_change_percent}%. These are not seasonally adjusted figures; BLS headline 12-month rates use the same basis.`;
        return reply(s, r, status, src("cpi_u"), PAGES.raise);
    }));
    server.registerTool("get_inflation_rate", {
        title: "Annual inflation rate for a year",
        description: "Returns the official U.S. inflation rate for a calendar year from BLS CPI data: annual-average change (BLS annual averages, including the 2025 average published despite the missing October 2025 index), December-to-December change, and for the current year the latest 12-month rate. Years 1914 to the present for CPI-U and CPI-W, 1958 onward for core CPI.",
        inputSchema: {
            year: z.number().int().min(1914).max(2100).describe("Calendar year, e.g. 2025."),
            series: seriesArg,
        },
        annotations: { ...RO, title: "Inflation rate by year" },
    }, async (a) => run(({ data, status }) => {
        const r = getInflationRate(data, { year: a.year, series: a.series });
        const parts = [];
        if (r.annual_average_inflation_percent !== null)
            parts.push(`annual-average inflation ${r.annual_average_inflation_percent}% (CPI ${r.prior_year_annual_average_cpi} to ${r.annual_average_cpi})`);
        if (r.december_to_december_percent !== null)
            parts.push(`December-to-December ${r.december_to_december_percent}%`);
        if (r.latest_twelve_month)
            parts.push(`12-month rate through ${r.latest_twelve_month.through} ${r.latest_twelve_month.twelve_month_percent}%`);
        let s = `${r.year} ${r.series === "cpi_u" ? "CPI-U" : r.series === "cpi_w" ? "CPI-W" : "core CPI"}: ${parts.join("; ") || "no full-year data yet"}.`;
        if (r.notes.length)
            s += ` ${r.notes.join(" ")}`;
        return reply(s, r, status, src(a.series), PAGES.raise);
    }));
    server.registerTool("compare_raise_to_inflation", {
        title: "Did a pay raise beat inflation?",
        description: "Compares a pay change with CPI inflation over the same period using official BLS data through the latest published month (checked live). Returns the nominal raise, inflation, the real (inflation-adjusted) raise, the pay needed to keep pace, and the gain or shortfall. Works for salaries, hourly wages, rents or any recurring amount.",
        inputSchema: {
            old_pay: z.number().positive().max(1e10).describe("Pay before the change (annual salary or hourly rate)."),
            new_pay: z.number().min(0).max(1e10).describe("Pay after the change, same unit."),
            from: period("When the old pay started, e.g. \"2024-01\""),
            to: period("When to measure, default \"latest\"").optional(),
            series: seriesArg,
        },
        annotations: { ...RO, title: "Raise vs inflation" },
    }, async (a) => run(({ data, status }) => {
        const r = compareRaiseToInflation(data, { ...a, series: a.series });
        const s = `Pay went from ${money(a.old_pay)} to ${money(a.new_pay)} (${r.nominal_raise_percent}%) while prices rose ${r.inflation_percent}% from ${r.from.period} to ${r.to.period}. Real change ${r.real_raise_percent}%: ${r.beat_inflation ? "the raise beat inflation" : "the raise did not keep pace with inflation"}. Pay needed to keep pace: ${money(r.pay_needed_to_keep_pace)} (${r.shortfall_or_gain >= 0 ? "ahead by" : "short by"} ${money(Math.abs(r.shortfall_or_gain))}).${r.notes.length ? " " + r.notes.join(" ") : ""}`;
        return reply(s, r, status, src(a.series), PAGES.raise);
    }));
    server.registerTool("calculate_social_security_cola", {
        title: "Social Security COLA from CPI-W",
        description: "Computes the Social Security cost-of-living adjustment for a year with the statutory formula: average CPI-W for July-September of the prior year over the same quarter a year earlier, rounded to 0.1%. Uses official BLS CPI-W values (live check). Reproduces the 3.6% COLA for 2027 that SSA announced in October 2026, and shows the Q3 index values behind it. Covers 1976 onward.",
        inputSchema: {
            cola_year: z.number().int().min(1976).max(2100).describe("Year the COLA is paid, e.g. 2027 (measured on Q3 2026 CPI-W)."),
        },
        annotations: { ...RO, title: "Social Security COLA from CPI-W" },
    }, async (a) => run(({ data, status }) => {
        const r = calculateColaFromCpiW(data, a);
        const s = `${r.cola_year} Social Security COLA by the CPI-W formula: ${r.cola_percent}% (Q3 ${r.q3_measurement_year} CPI-W average ${r.q3_cpi_w.average} vs Q3 ${r.q3_base.year} ${r.q3_base.average}, unrounded ${r.unrounded_percent}%). ${r.benefits_affected}.${r.cola_year === 2027 ? " SSA announced 3.6% for 2027 (Federal Register, Oct. 26, 2026)." : ""}`;
        return reply(s, r, status, `${src("cpi_w")} ; COLA rule: ${SOURCES.cola}${r.cola_year === 2027 ? ` ; ${SOURCES.cola2027}` : ""}`, PAGES.ss);
    }));
}
export function createServer() {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    registerTools(server);
    return server;
}
