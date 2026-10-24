# Bill-impact dashboard

React + Vite + Tailwind CSS, with official shadcn/ui components (Radix): Button,
Badge, Accordion, Separator, Table, Select, and Skeleton. Component source lives
in `src/components/ui`; `components.json` configures future shadcn additions.

## Run the preview

Requires Node.js 20.19+ (or 22.12+) and Python 3.10+.

```sh
cd prototypes/bill-impact
npm ci
npm run build
python3 preview.py
```

Open http://127.0.0.1:5173. Stop the server with Ctrl+C. Use `--port 5175` for an
alternate Python preview port. Rebuild and restart after changing frontend files.

For hot reload, leave the Python preview running on 5173 and run `npm run dev` in
a second terminal in this directory. Open http://127.0.0.1:5174. Vite proxies
`/snapshot.json` to Python. No API keys or external assets are needed at runtime.

## Essential overview

1. **Understand the bill:** a plain-English summary, passage likelihood, and the
   official bill link. The saved analysis date and sample status are visible.
2. **See business implications:** two opportunities and two risks, with compact
   numbers. Assumed sales growth, conditional exposure, and contract penalties
   are labeled separately.
3. **Decide what to do:** a visible verdict, expected first-year profit change,
   the main caveat, and a “View strategies” link.

The layout experiment switcher was removed to keep one clear information order.
On mobile the columns stack. Supporting context and sources are expandable.

The strategy page preserves comparison across evaluated options, URL-based
strategy/scenario selection, outcome costs, readiness, supplier capacity, product
outcomes, next steps, switch signals, sources, and calculation limits. It explains
expected impact versus worst case. Detailed breakdowns use shadcn accordions.

## Data contract

This remains a fixture-backed prototype for [issue #1](https://github.com/ericmxf17/calhacks13/issues/1).
It reads the complete saved VoltRide analysis from 2026-10-23:

- `agents/hr973-expected-output.json`
- `company.json`
- `tests/hr973-{forecast,impact-plan,impact-results,brief}.json`

The newer research in `tests/agent2-hr973.json` is intentionally outside this
snapshot. The Python server reads fixtures once at startup and checks numeric
traceability using the existing brief checker. It serves only built frontend
assets and `/snapshot.json`, not arbitrary repository files.

`src/analysis.js` checks matching bill IDs, forecast/results consistency, and
complete numeric scenario outcomes. It joins strategies/scenarios by ID and
explicitly maps this sample’s findings; it does not parse numbers from prose.
The UI formats backend numbers without recalculating financial outcomes or odds.
For example, the recommended impact rounds to **−$88.5K** from **−$88,469**, while
the saved written brief rounds it to −$88K.

The overview copy and finding mapping are specific to H.R. 973/VoltRide. Before
accepting live agent output, define a structured risks/opportunities contract and
connect a live orchestration endpoint. Numeric traceability does not establish
factual accuracy or legal validity. Scenario probabilities use stored rounding.

## Validation

```sh
npm test
npm run build
```

The data tests cover conditional exposure versus weighted impact and rejection
of inconsistent forecasts or missing scenario outcomes. Also check overview →
strategies → back, option selection, scenario changes, expanded breakdowns,
keyboard navigation, and narrow-screen layout in the browser.

## Earlier prototype verification

The preceding vanilla-JavaScript prototype was browser-checked on 2026-10-24:
its two layouts, all 25 strategy/scenario combinations (75 financial readouts),
route restoration, keyboard controls, and 1280/390/320px layouts were checked.
Those observations describe the earlier implementation, not the React rewrite.
Local evidence was stored in ignored `.preview/` files.

The React rewrite was checked separately for overview/detail navigation, strategy
selection, scenario changes, expandable source context, and 1280/375/320px
layouts without page-wide overflow. The accessible finding-source disclosure
from the earlier prototype is retained inside the overview's context accordion.
