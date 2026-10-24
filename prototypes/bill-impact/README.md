# Explore the bill-impact prototype

Run this from the repository root with Python 3.10 or newer.

```powershell
python prototypes/bill-impact/preview.py
```

Open [the local preview](http://127.0.0.1:5173). Stop the server with Ctrl+C.
If port 5173 is occupied, pass `--port 5174` and open the printed URL.
There are no packages to install, external assets to load, or API keys to configure.

Use **01 Brief** to read the opportunities and risks before the recommendation.
Use **02 Decision first** to read the same recommendation before the findings.
Select **View strategies**, choose a strategy, and change its scenario.
Use **Back to overview** or browser Back to return. The URL retains the selected
layout, strategy, and scenario across reloads.

This is a throwaway design study for [issue #1](https://github.com/ericmxf17/calhacks13/issues/1).
The two information orders, wording, palette, and detail density are proposals.
The prototype does not define the final product specification.

## Saved inputs

The preview reads one complete fictional VoltRide analysis from 2026-10-23.
It uses `agents/hr973-expected-output.json`, `company.json`, and
`tests/hr973-{forecast,impact-plan,impact-results,brief}.json`.
The newer `tests/agent2-hr973.json` research is outside that complete snapshot.
Mixing its research adjustments into the header without updating the strategy
calculations and brief would show conflicting results.

The preview server reads its snapshot at startup. Restart the server after
changing fixtures. HTML, CSS, and JavaScript reload from disk on refresh.
The server binds to loopback and serves only the prototype's three static assets,
index page, and `/snapshot.json`. It does not expose the repository directory.

| Display | Source | Meaning |
| --- | --- | --- |
| Chance of passage | `forecast.probability` | Saved forecast, 22.5%. |
| Recommended impact | Result option matching `brief.recommendation.option_id` | Expected first-year impact across scenarios. |
| Sales opportunity | Impact-plan assumption A5 | Assumed e-bike unit growth, not forecast revenue. |
| Annual exposure | `do_nothing` pass outcome's `annual_profit_change` | Conditional annual gross profit exposed if a rule applies. |
| Early-exit penalty | PowerCell contract's `early_exit_penalty` | One-time contract term, not the cost of waiting. |
| Scenario costs | Selected option's `by_scenario` entry | Its actual calculated costs, timing problems, and product outcomes. |

The frontend formats amounts. It does not calculate financial outcomes or
forecast odds. Numeric traceability uses the existing brief checker. That check
does not establish factual accuracy or legal validity. Scenario probabilities
retain the stored rounding and may not sum to exactly 100%.

## Design choices

We compared a browser-owned view model with a generated display document.
The browser-owned model won because one launcher loads the existing fixtures
without a generated copy that can drift. The independent review agreed.
The prototype keeps the fixture field names inside one browser module.
It joins records by option and scenario IDs and maps the few overview findings
explicitly instead of extracting numbers from prose.

Bean Mode's **Model the Domain** principle put navigation and selection in the URL.
**Experience First** kept both information orders available at every width.
**Exhaust the Design Space** led to two layouts with identical content.
**Build the Lever** produced the repeatable preview command.
**Prove It Works** requires direct browser checks of each layout and interaction.

System Segoe UI and Georgia fonts keep this offline preview independent of font
downloads. No frontend framework, live agent connection, or production API was added.

## Browser verification

Checked in the Codex in-app Browser on 2026-10-24.

| Component | Code exercised | Behavior | Result |
| --- | --- | --- | --- |
| Overview layouts | `app.js`, `styles.css` | Switch information order without changing content. | Both orders inspected at desktop and narrow widths. |
| Scenario explorer | `app.js` | Select every strategy and scenario. | All 25 combinations displayed. All 75 rounded financial readouts matched the saved results. |
| Navigation | `app.js` | Reload, browser Back and Forward, and overview link. | The selected route and scenario restored. |
| Keyboard | `index.html`, `app.js` | Skip link, scenario select, table region, and finding-source disclosure. | Focus and the selected layout remained correct. |
| Responsive layout | `styles.css` | Fit 1280px, 390px, and 320px viewports. | No page-wide overflow. Narrow tables scroll inside their regions. |

Body copy is 15px, finding headings are 19px, and supporting labels are at least
12px after the requested type-size increase. Browser viewport overrides were reset
after the responsive checks. Sampled text colors meet a 4.5:1 contrast ratio.
Source data, external source claims, and live CREAO calls were not independently
verified by these UI checks. Browser observations and screenshots are local artifacts
under `.preview/`, which Git ignores.

## Review before a production build

Decide whether the recommendation belongs before or after the findings.
Review which scenario details matter for the first release.
Agree on a structured risks-and-opportunities contract before accepting live agent
output. The explicit finding mapping here is specific to the saved H.R. 973 sample.
