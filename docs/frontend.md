# Run and deploy the dashboard

The repository root is the Next.js project. Use Node.js 20.9 or newer.
The app retains the saved VoltRide overview, strategy comparison, scenario
selection, product outcomes, costs, next steps, assumptions, and source disclosures.

## Develop locally

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Next.js provides hot reload. Stop the process with Ctrl+C.

For the production server, run:

```sh
npm run build
npm start
```

Pass `-- --port 5175` to the dev or start script to use another port.
Run `npm test` to exercise the data contract and numeric traceability checks.

## Deploy on Vercel

Import the GitHub repository into Vercel. Select the branch you want to preview.
Use these project settings:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | Repository root, `.` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Next.js default |

The saved example needs no environment variables, API keys, separate Python
service, or Vite proxy. Deploy the whole repository so the JSON fixtures are
available to the build. This migration prepares the app for Vercel; it does not
publish a deployment or connect live CREAO agents.

## Routes and ownership

| Path | Owner | Behavior |
| --- | --- | --- |
| `/` | `src/app/page.jsx` | Server-render the bill overview. |
| `/strategies?option=…&scenario=…` | `src/app/strategies/page.jsx` | Render a selected strategy and scenario. |
| `/api/analysis` | `src/app/api/analysis/route.js` | Return the same saved analysis as JSON. |
| Loading and error states | `src/app/loading.jsx`, `src/app/error.jsx` | Show navigation progress and allow retry after a render failure. |

`src/app/layout.jsx` owns the shared header, footer, metadata, and global CSS.
`src/components/dashboard.jsx` owns the analysis presentation and shadcn interactions.
Navigation uses Next.js links and query parameters, so direct links, reloads, and
browser Back and Forward retain the selected strategy and scenario. Unknown
selection IDs display the recommended strategy and first scenario.

`src/lib/snapshot.js` imports a fixed set of JSON files on the server. Pages and
the API use that same loader. The overview does not wait for a client-side fetch.
`src/analysis.js` validates matching bill IDs, forecast consistency, and complete
scenario outcomes, then joins records by ID. Financial outcomes and forecast
odds remain the saved backend calculations. The UI only formats them.

The [Next.js App Router](https://nextjs.org/docs/app) owns routing and serving.
The [shadcn/ui configuration](https://ui.shadcn.com/docs/installation/next) is in
`components.json`, with React Server Component support enabled. Component source
is in `src/components/ui`, and Tailwind CSS uses the PostCSS integration.

## Saved data and numeric traceability

The app reads the complete fictional sample dated 2026-10-23:

- `agents/hr973-expected-output.json`
- `company.json`
- `tests/hr973-forecast.json`
- `tests/hr973-impact-plan.json`
- `tests/hr973-impact-results.json`
- `tests/hr973-brief.json`

Newer research in `tests/agent2-hr973.json` is not mixed into that snapshot.
The overview findings are explicit mappings for H.R. 973 and VoltRide. Before
connecting live agent outputs, define a structured risk/opportunity contract.

`src/verify-brief.js` ports the rules in `impact/verify_brief.py` to JavaScript,
including display rounding, ignored bill and standard references, and numeric
provenance checks. The Node server uses it to report whether the brief's numbers
trace to the saved inputs. That does not verify the underlying facts or legal
validity. The Python verifier remains part of the offline analysis pipeline.

The Vite entry point, Vite configuration, Python preview server, hash router,
and nested frontend package have been removed. The root package and lockfile
are the single application dependency entry point.
