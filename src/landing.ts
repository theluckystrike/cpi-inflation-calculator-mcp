// GET / page for the hosted Worker.
const TOOLS: Array<[string, string]> = [
  ["calculate_inflation", "Adjust a dollar amount between any two months or years from 1913 to the latest BLS release (CPI-U, CPI-W or core CPI)."],
  ["get_latest_cpi", "Latest CPI month from BLS, checked live: 12-month inflation for CPI-U, core CPI and CPI-W."],
  ["get_inflation_rate", "Annual-average and December-to-December inflation for any year, plus the current 12-month rate."],
  ["compare_raise_to_inflation", "Whether a raise beat inflation: real raise, pay needed to keep pace, gain or shortfall."],
  ["calculate_social_security_cola", "Social Security COLA from Q3 CPI-W with the statutory formula (3.6% for 2027)."],
];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function landingPage(origin: string): string {
  const mcp = `${origin}/mcp`;
  const rows = TOOLS.map(([n, d]) => `<tr><td><code>${n}</code></td><td>${esc(d)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CPI Inflation Calculator MCP</title>
<meta name="description" content="MCP server with official BLS CPI data from 1913 to the latest month: inflation calculator, latest CPI, inflation rate by year, raise vs inflation and Social Security COLA.">
<style>:root{--bg:#fff;--fg:#1a1a1a;--muted:#555;--line:#ddd;--code:#f4f4f4}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--muted:#aaa;--line:#333;--code:#222}}
body{background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:24px 16px}
code,pre{background:var(--code);border-radius:4px;font-size:14px}pre{padding:10px;overflow-x:auto}code{padding:1px 4px}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:8px 6px;vertical-align:top}p.small{color:var(--muted);font-size:14px}a{color:inherit}</style></head>
<body><h1>CPI Inflation Calculator MCP server</h1>
<p>Gives an AI assistant the official U.S. Consumer Price Index from the Bureau of Labor Statistics, from 1913 to the latest published month, checked live against the BLS API. It knows CPI releases newer than its training data, and that BLS published no October 2025 CPI. Every result shows the index values used.</p>
<h2>Connect</h2>
<p>Hosted endpoint (Streamable HTTP, no sign-in, no token). Paste it into Claude.ai custom connectors or ChatGPT developer mode.</p>
<pre>${esc(mcp)}</pre>
<p>Claude Code</p><pre>claude mcp add --transport http cpi-inflation ${esc(mcp)}</pre>
<p>Local (stdio)</p><pre>npx -y github:theluckystrike/cpi-inflation-calculator-mcp</pre>
<h2>Tools</h2><table>${rows}</table>
<p>Check a raise after taxes: <a href="https://statewage.com/pay-raise-calculator/?utm_source=mcp&amp;utm_medium=cpi-inflation-calculator-mcp">pay raise calculator on statewage.com</a>.
Source: <a href="https://github.com/theluckystrike/cpi-inflation-calculator-mcp">github.com/theluckystrike/cpi-inflation-calculator-mcp</a>.</p>
<p class="small">Data: U.S. Bureau of Labor Statistics. General information, not financial advice. Part of the Zovo MCP collection: <a href="https://mcp.zovo.one">mcp.zovo.one</a>.</p>
</body></html>`;
}
