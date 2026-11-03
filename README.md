# cpi-inflation-calculator-mcp

An MCP server that gives an AI assistant the official U.S. Consumer Price Index from the Bureau of Labor Statistics, from 1913 to the latest published month, so it can adjust any dollar amount for inflation, report the current inflation rate, check whether a raise kept pace, and compute the Social Security COLA. It checks the BLS API live for months newer than its training data.

Hosted endpoint, no sign-in and no token:

```
https://cpi-inflation-calculator-mcp.lipmichal.workers.dev/mcp
```

## Tools

| Tool | What it does |
|---|---|
| `calculate_inflation` | Adjusts an amount between any two months (`YYYY-MM`) or years (`YYYY`, annual average) from 1913 to the latest month. CPI-U by default, or CPI-W or core CPI. Returns the adjusted amount, cumulative and average annual inflation, and the index values used. |
| `get_latest_cpi` | The latest CPI month from BLS with the 12-month change for CPI-U, core CPI and CPI-W, the 1-month change and the year-to-date change. |
| `get_inflation_rate` | Annual-average and December-to-December inflation for any year since 1914, plus the latest 12-month rate for the current year. |
| `compare_raise_to_inflation` | Nominal raise, inflation, real raise, the pay needed to keep pace and the gain or shortfall. |
| `calculate_social_security_cola` | The COLA from Q3 CPI-W with the statutory formula, with the index values behind it. |

Every result has structured JSON, a plain-English summary, `data_status` (live or bundled, latest month), `as_of`, `source` (the BLS series) and `more` (a pay raise calculator on statewage.com).

## What it knows that your model does not

- CPI index values through September 2026 (CPI-U 336.940), with a live check for anything newer.
- Inflation was 3.7% over the 12 months to September 2026 (CPI-U, not seasonally adjusted). Core CPI was 2.6%.
- BLS published no October 2025 CPI. Data were not collected during the 2025 lapse in appropriations. The tools say so instead of inventing a value, and still use the official 2025 annual average (321.943, 2.6% inflation).
- The 2027 Social Security COLA is 3.6%. The tool reproduces it from Q3 2026 CPI-W (average 328.746 against 317.265), and also reproduces 2023 to 2026.

## Install

### Claude.ai custom connector or ChatGPT developer mode

Add a custom connector and paste the URL. No token is needed.

```
https://cpi-inflation-calculator-mcp.lipmichal.workers.dev/mcp
```

### Claude Code

```
claude mcp add --transport http cpi-inflation https://cpi-inflation-calculator-mcp.lipmichal.workers.dev/mcp
```

Or run it locally:

```
claude mcp add cpi-inflation -- npx -y github:theluckystrike/cpi-inflation-calculator-mcp
```

### Claude Desktop

Add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cpi-inflation": {
      "command": "npx",
      "args": ["-y", "github:theluckystrike/cpi-inflation-calculator-mcp"]
    }
  }
}
```

### Cursor

Add this to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cpi-inflation": {
      "url": "https://cpi-inflation-calculator-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

### VS Code

Add this to `.vscode/mcp.json`:

```json
{
  "servers": {
    "cpi-inflation": {
      "type": "http",
      "url": "https://cpi-inflation-calculator-mcp.lipmichal.workers.dev/mcp"
    }
  }
}
```

Node 20 or newer is needed for the local `npx` version. Optional: set `BLS_API_KEY` to a free BLS registration key for a higher live-data quota.

## Example prompts

- "What is $1,000 from 2000 worth today?"
- "What is the current inflation rate, and what was core inflation?"
- "What was inflation in 2025? Was any month missing?"
- "My salary went from $60,000 in January 2025 to $63,000 now. Did I beat inflation?"
- "How is the 2027 Social Security COLA calculated?"
- "Convert $50 in 1970 to 2026 dollars using CPI-W."

## Data sources

U.S. Bureau of Labor Statistics CPI series CUUR0000SA0, CWUR0000SA0 and CUUR0000SA0L1E, fetched from the BLS Public Data API on 2026-11-03, plus a live check on each call. The COLA rule is 42 U.S.C. 415(i). See [DATA_SOURCES.md](DATA_SOURCES.md).

## Limitations

- General information, not financial advice.
- U.S. city average, not seasonally adjusted. No regional or item-level indexes (food, rent, gas).
- The keyless BLS API caps daily requests per IP address. When the cap is hit, the hosted server answers from bundled data through September 2026 and says so in `data_status`.
- Periods with no annual average yet (the current year) use the latest month of that year, with a note.

## More

Check a raise after taxes with the [pay raise calculator](https://statewage.com/pay-raise-calculator/?utm_source=mcp&utm_medium=cpi-inflation-calculator-mcp) and the [Social Security tax calculator](https://statewage.com/social-security-tax-calculator/?utm_source=mcp&utm_medium=cpi-inflation-calculator-mcp) on statewage.com.

Part of the Zovo MCP collection: https://mcp.zovo.one

## Development

```
npm install
npm run build
npm test
```

`src/core.ts` holds the CPI math and has no I/O. `src/data.ts` is the bundled BLS data. `src/live.ts` checks the BLS API for newer months. `src/stdio.ts` is the local entry and `src/worker.ts` is the Cloudflare Worker entry. Both use the same tool registry in `src/tools.ts`.

## License

MIT

<!-- data-servers:start -->
## More data servers from the same author

Each one is free, needs no API key and has a hosted URL you can paste into Claude or ChatGPT.

| server | tools | hosted URL |
|---|---|---|
| [cups-to-grams-mcp](https://github.com/theluckystrike/cups-to-grams-mcp) | convert_ingredient, search_ingredients, scale_recipe, convert_oven_temperature | `https://cups-to-grams-mcp.lipmichal.workers.dev/mcp` |
| [dscr-loan-calculator-mcp](https://github.com/theluckystrike/dscr-loan-calculator-mcp) | calculate_dscr, max_loan_for_target_dscr, rent_needed_for_target_dscr, compare_scenarios, amortization_summary | `https://dscr-loan-calculator-mcp.lipmichal.workers.dev/mcp` |
| [gold-price-per-gram-mcp](https://github.com/theluckystrike/gold-price-per-gram-mcp) | get_gold_price_per_gram, get_metal_prices, calculate_jewelry_value, convert_gold_units | `https://gold-price-per-gram-mcp.lipmichal.workers.dev/mcp` |
| [lake-level-mcp](https://github.com/theluckystrike/lake-level-mcp) | search_lakes, get_lake_level, get_lake_history, compare_lakes | `https://lake-level-mcp.lipmichal.workers.dev/mcp` |
| [minimum-wage-mcp](https://github.com/theluckystrike/minimum-wage-mcp) | get_minimum_wage, list_upcoming_increases, compare_states, annual_income_at_minimum_wage | `https://minimum-wage-mcp.lipmichal.workers.dev/mcp` |
| [no-tax-on-overtime-mcp](https://github.com/theluckystrike/no-tax-on-overtime-mcp) | calculate_overtime_deduction, calculate_tips_deduction, calculate_senior_deduction, estimate_tax_savings, explain_eligibility | `https://no-tax-on-overtime-mcp.lipmichal.workers.dev/mcp` |
| [paycheck-calculator-mcp](https://github.com/theluckystrike/paycheck-calculator-mcp) | calculate_take_home_pay, compare_states_take_home, salary_to_hourly, hourly_to_salary, get_federal_tax_brackets | `https://paycheck-calculator-mcp.lipmichal.workers.dev/mcp` |
| [uk-income-tax-salary-mcp](https://github.com/theluckystrike/uk-income-tax-salary-mcp) | calculate_uk_take_home, get_uk_tax_bands, compare_salaries, marginal_rate_at_income | `https://uk-income-tax-salary-mcp.lipmichal.workers.dev/mcp` |
| [us-federal-holidays-business-days-mcp](https://github.com/theluckystrike/us-federal-holidays-business-days-mcp) | list_federal_holidays, is_business_day, add_business_days, count_business_days, invoice_due_date | `https://us-federal-holidays-business-days-mcp.lipmichal.workers.dev/mcp` |
| [ab-test-sample-size-calculator-mcp](https://github.com/theluckystrike/ab-test-sample-size-calculator-mcp) | calculate_sample_size, estimate_test_duration, test_ab_significance, fisher_exact_test, check_peeking_risk | `https://ab-test-sample-size-calculator-mcp.lipmichal.workers.dev/mcp` |
| [aca-premium-tax-credit-calculator-mcp](https://github.com/theluckystrike/aca-premium-tax-credit-calculator-mcp) | get_federal_poverty_level, calculate_premium_tax_credit, check_subsidy_cliff, get_aptc_repayment_cap | `https://aca-premium-tax-credit-calculator-mcp.lipmichal.workers.dev/mcp` |
| [ap-score-distributions-mcp](https://github.com/theluckystrike/ap-score-distributions-mcp) | get_ap_score_distribution, estimate_ap_percentile, compare_ap_exams, list_ap_exams, estimate_ap_score_from_composite | `https://ap-score-distributions-mcp.lipmichal.workers.dev/mcp` |
| [car-loan-interest-deduction-calculator-mcp](https://github.com/theluckystrike/car-loan-interest-deduction-calculator-mcp) | calculate_car_loan_interest_deduction, calculate_salt_deduction, get_tax_brackets_and_standard_deduction, calculate_child_tax_credit | `https://car-loan-interest-deduction-calculator-mcp.lipmichal.workers.dev/mcp` |
| [estate-gift-tax-exemption-calculator-mcp](https://github.com/theluckystrike/estate-gift-tax-exemption-calculator-mcp) | get_exemption_amounts, calculate_estate_tax, check_gift, compare_years | `https://estate-gift-tax-exemption-calculator-mcp.lipmichal.workers.dev/mcp` |
| [irs-mileage-rate-per-diem-mcp](https://github.com/theluckystrike/irs-mileage-rate-per-diem-mcp) | get_mileage_rate, calculate_mileage_deduction, get_per_diem_rates, calculate_trip_per_diem, get_high_low_per_diem | `https://irs-mileage-rate-per-diem-mcp.lipmichal.workers.dev/mcp` |
| [recipe-nutrition-calculator-mcp](https://github.com/theluckystrike/recipe-nutrition-calculator-mcp) | lookup_ingredient_nutrition, calculate_recipe_nutrition, round_nutrition_label, scale_recipe_nutrition | `https://recipe-nutrition-calculator-mcp.lipmichal.workers.dev/mcp` |
| [retirement-contribution-limits-2027-mcp](https://github.com/theluckystrike/retirement-contribution-limits-2027-mcp) | get_contribution_limits, calculate_max_contribution, get_social_security_cola, compare_years | `https://retirement-contribution-limits-2027-mcp.lipmichal.workers.dev/mcp` |
| [section-179-deduction-calculator-mcp](https://github.com/theluckystrike/section-179-deduction-calculator-mcp) | calculate_section_179, calculate_bonus_depreciation, get_vehicle_depreciation_limits, calculate_asset_loan_payment | `https://section-179-deduction-calculator-mcp.lipmichal.workers.dev/mcp` |
| [student-loan-repayment-assistance-plan-calculator-mcp](https://github.com/theluckystrike/student-loan-repayment-assistance-plan-calculator-mcp) | calculate_rap_payment, compare_rap_vs_standard, get_federal_loan_limits, get_plan_transition_dates | `https://student-loan-repayment-assistance-plan-calculator-mcp.lipmichal.workers.dev/mcp` |
| [subdomain-finder-mcp](https://github.com/theluckystrike/subdomain-finder-mcp) | find_subdomains, resolve_subdomains, get_certificate_history, summarize_attack_surface | `https://subdomain-finder-mcp.lipmichal.workers.dev/mcp` |
| [uk-statutory-sick-pay-maternity-pay-calculator-mcp](https://github.com/theluckystrike/uk-statutory-sick-pay-maternity-pay-calculator-mcp) | calculate_statutory_sick_pay, calculate_statutory_maternity_pay, get_minimum_wage_rates, check_eligibility | `https://uk-statutory-sick-pay-maternity-pay-calculator-mcp.lipmichal.workers.dev/mcp` |

The paid back-office collection (invoices, VAT, PDFs, spreadsheets) is at https://mcp.zovo.one
<!-- data-servers:end -->
