# Data sources

All index values come from the U.S. Bureau of Labor Statistics (BLS). They were fetched on 2026-11-03 and are bundled in `src/data.ts`. At run time the server also asks the BLS API for newer months.

| Data | Source | URL |
|---|---|---|
| CPI-U all items, U.S. city average, NSA, 1982-84=100 (series CUUR0000SA0), monthly Jan. 1913 to Sept. 2026 and annual averages 1913-2025 | BLS Public Data API v1 and v2 (`annualaverage=true`), no key | https://api.bls.gov/publicAPI/v2/timeseries/data/ |
| CPI-W all items (series CWUR0000SA0), same range | BLS Public Data API | https://data.bls.gov/timeseries/CWUR0000SA0 |
| CPI-U less food and energy (series CUUR0000SA0L1E), Jan. 1957 to Sept. 2026 | BLS Public Data API | https://data.bls.gov/timeseries/CUUR0000SA0L1E |
| October 2025 has no value. The API footnote reads "Data unavailable due to the 2025 lapse in appropriations". BLS still published a 2025 annual average (CPI-U 321.943) | BLS Public Data API | https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0 |
| Live refresh: latest three years of each series, checked on each call (cached up to 6 hours at the edge, successful answers only) | BLS Public Data API v1 (keyless), or v2 when `BLS_API_KEY` is set | https://api.bls.gov/publicAPI/v1/timeseries/data/CUUR0000SA0 |
| Social Security COLA formula: CPI-W average for the third calendar quarter over the same average for the last COLA computation quarter, rounded to the nearest 0.1% | 42 U.S.C. 415(i) | https://www.law.cornell.edu/uscode/text/42/415 |
| 2027 COLA of 3.6% announced by SSA (used as a test fixture, together with 8.7% 2023, 3.2% 2024, 2.5% 2025 and 2.8% 2026) | SSA notice, Federal Register doc. 2026-21796 | https://www.federalregister.gov/documents/2026/10/26/2026-21796/cost-of-living-increase-and-other-determinations-for-2027 |

## Notes

- Values are not seasonally adjusted. BLS headline 12-month rates use NSA data, so the 12-month figures match the news release. The 1-month change here is NSA and can differ from the seasonally adjusted headline monthly change.
- The keyless BLS API has a small daily request cap per IP address. When the cap is hit, results say `live: false` and use the bundled data. A free BLS registration key (https://data.bls.gov/registrationEngine/) set as `BLS_API_KEY` raises the cap.
- The COLA tool reproduces SSA's announced COLAs for 2023 to 2027 from the BLS CPI-W values (see `test/core.test.mjs`).
