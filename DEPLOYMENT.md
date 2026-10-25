# Vercel hosted Council deployment

Live Council chat is deployed at [consul-calhacks13.vercel.app](https://consul-calhacks13.vercel.app). Production OIDC, a real browser follow-up through all four models, and restoration after reload were verified on October 25, 2026. Seven worker admission checks and six production API checks also passed, including owner isolation and replay without new model sessions.

## Deployment boundary

Deploy `web/` as a Next.js project. Set `CONSUL_JUDGE_DEMO=true` in Preview and Production before building. The root page opens the saved VoltRide workspace without an account. `/demo/voltride` and other demo profiles remain available. Demo edits last for the current visit. Account mutations return an explicit unavailable response in judge mode.

In Vercel Production, the Next.js server always proxies new Council requests to the hosted worker. Set `COUNCIL_EXECUTION_MODE=sandbox` in Preview to use the same path there. Set `COUNCIL_EXECUTION_MODE=local` only for local development, and set `ENABLE_LOCAL_AGENT_PREVIEW=true` to allow local live runs. Production ignores the local execution path.

The worker runs in one of four named persistent Vercel Sandbox slots created from `COUNCIL_SANDBOX_SNAPSHOT_ID`. The app rotates slots every 20 minutes. Each sandbox has a 45-minute timeout, leaving roughly 25 minutes for a new round before request overhead. The four role calls have a combined 16-minute generation timeout, plus setup and persistence work. The snapshot includes the worker source and dependencies, Node.js 24, Python 3.14, and Factory Droid 0.249.0. The Vercel SDK uses OIDC credentials in hosted deployments. `COUNCIL_SANDBOX_VERCEL_TOKEN` is optional for local provisioning and is not needed in Vercel when OIDC is configured.

The app sends requests to the worker with `COUNCIL_WORKER_TOKEN`. The worker accepts only authenticated requests and a server-derived owner ID. The app signs a 30-day HTTP-only browser cookie with `COUNCIL_SESSION_SECRET`, then maps it to a private `user:` scope. Same-origin checks protect submissions. SpacetimeDB stores private snapshots, and the app reads snapshots only for the current owner.

Hosted Council sources come from the reviewed static CREAO conversation and artifact archive. The hosted runner does not read private CREAO accounts and does not use CREAO provider keys. New Council runs use `FACTORY_API_KEY` and the configured Council models.

The app reserves each new hosted request in SpacetimeDB before it calls a provider. Reusing the same request ID and payload recovers the saved job. The default limits are 40 new rounds per UTC day, two active jobs across all owners, and one active job per owner. These limits count rounds and do not estimate provider charges. Each thread allows four rounds. The sandbox has a 45-minute run timeout and may stop after that timeout. Its named persistent filesystem resumes with a new worker. A job with no saved update for 20 minutes is marked interrupted. The system does not retry interrupted paid work automatically.

Do not upload local environment files, `.backend`, `.tools`, logs, or Droid authentication. Keep provider keys, the worker token, the session secret, and the SpacetimeDB publisher token in server-only environment variables.

## Project settings and environment

| Setting | Value |
| --- | --- |
| Root Directory for Git import | `web` |
| Framework | Next.js |
| Node.js | 24.x; package requires at least 24.22.1 |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` |
| Output directory | Leave the framework default |
| Public entry | `/` |

`web/vercel.json` records install and build settings. `web/.vercelignore` excludes local state from CLI uploads. Deploy from `web`, not the repository root. Vercel supports Node 24.x and selects patch updates automatically. See [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [project settings](https://vercel.com/docs/project-configuration/project-settings), and [deployment exclusions](https://vercel.com/docs/deployments/vercel-ignore).

Configure these values in Vercel. Do not add a `NEXT_PUBLIC_` prefix to a secret.

| Variable | Purpose | Needed |
| --- | --- | --- |
| `CONSUL_JUDGE_DEMO=true` | Enables the public saved-demo entry | Build and runtime |
| `COUNCIL_EXECUTION_MODE=sandbox` | Selects the hosted runner in Preview; Production always uses hosted mode | Preview runtime |
| `COUNCIL_SANDBOX_SNAPSHOT_ID` | Selects the provisioned Vercel Sandbox snapshot | Preview and Production runtime |
| `COUNCIL_WORKER_TOKEN` | Authenticates app-to-worker requests; use a random value with at least 32 characters | Preview and Production runtime |
| `COUNCIL_SESSION_SECRET` | Signs browser owner cookies; use a random value with at least 32 characters | Preview and Production runtime |
| `FACTORY_API_KEY` | Authenticates new Factory Droid sessions | Preview and Production runtime |
| `COUNCIL_FINANCE_MODEL_ID` | Model for Finance | Preview and Production runtime |
| `COUNCIL_FINANCE_REASONING_EFFORT` | Reasoning effort for Finance | Preview and Production runtime |
| `COUNCIL_OPERATIONS_MODEL_ID` | Model for Operations | Preview and Production runtime |
| `COUNCIL_OPERATIONS_REASONING_EFFORT` | Reasoning effort for Operations | Preview and Production runtime |
| `COUNCIL_SKEPTIC_MODEL_ID` | Model for Skeptic | Preview and Production runtime |
| `COUNCIL_SKEPTIC_REASONING_EFFORT` | Reasoning effort for Skeptic | Preview and Production runtime |
| `COUNCIL_CHAIR_MODEL_ID` | Model for Chair | Preview and Production runtime |
| `COUNCIL_CHAIR_REASONING_EFFORT` | Reasoning effort for Chair | Preview and Production runtime |
| `COUNCIL_DAILY_ROUND_LIMIT` | Optional daily reservation limit; defaults to 40 and accepts values up to 1000 | Optional |
| `COUNCIL_CONCURRENT_LIMIT` | Optional global active-job limit; defaults to two and accepts values up to eight | Optional |
| `SPACETIMEDB_URL` | HTTPS origin of the private archive database, with no path | Preview and Production runtime |
| `SPACETIMEDB_DATABASE` | Published archive database name | Preview and Production runtime |
| `SPACETIMEDB_TOKEN` | Server-only publisher identity token for the private archive | Preview and Production runtime |
| `NEXT_PUBLIC_SITE_URL` | Canonical public site URL; Vercel URL is the fallback | Optional |

The four role-specific model settings in `web/.env.example` are the current example values. Confirm each model and reasoning effort with `scripts/council-models.mjs` before changing them. `COUNCIL_MODEL_ID` and `COUNCIL_REASONING_EFFORT` are optional shared fallbacks when a role setting is omitted. The app uses `COUNCIL_SANDBOX_VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID` only when a local process provisions the sandbox with a token. Hosted Vercel deployments use OIDC instead.

The SpacetimeDB module must be published, seeded with the private publisher identity, and configured with the matching token. The app uses this database for both new reservations and saved Council snapshots. Missing settings make the archive and live Council unavailable. They do not produce simulated results.

Private accounts require a separate backend setup. The Payload adapter uses the Figma Content API. Do not disable judge mode until its project, content system, credentials, and account persistence are configured and checked. `web/.env.example` lists `PAYLOAD_SECRET`, `FIGMA_EID`, `FIGMA_CONTENT_API_URL`, `FIGMA_CONTENT_API_CONTENT_SYSTEM_ID`, and `FIGMA_CONTENT_API_ACCESS_KEY`. The Figma/Payload admin and generic content endpoints remain unverified without that backend.

## Check the deployment before publishing

From PowerShell at the repository root, build the app and start it locally:

```powershell
Set-Location web
$env:CONSUL_JUDGE_DEMO = 'true'
$env:COUNCIL_EXECUTION_MODE = 'sandbox'
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open `/`, `/demo`, and `/demo/voltride`. Check that unknown demo IDs return 404. Confirm that `/api/council?view=setup` reports the live runner as available. Submit a live Council request with reviewed evidence, then confirm the browser can read its job and thread. Confirm that an unrelated browser session cannot read them. Do not treat a successful build as proof of hosted execution. Check the preview run before publishing.

| Component | File or interface | Behavior to check | Method |
| --- | --- | --- | --- |
| Judge entry | `src/app/(frontend)/page.tsx` | Opens VoltRide without signup | Browser at `/` after build |
| Demo workspace | `src/components/Workspace.tsx` | Saved-demo notice and visit-only settings | Browser, edit settings, then reload |
| Account boundary | `/api/workspace` | GET demo-only response and POST 503 | HTTP requests in judge mode |
| Hosted setup | `/api/council?view=setup` | Reports the live runner and reviewed roles | Browser and Vercel function logs |
| Hosted Council | `/api/council` | Runs reviewed evidence and saves owner-scoped results | Browser with a configured preview |
| Owner boundary | `/api/council?view=job` and `view=thread` | Rejects reads from another session | Browser with two independent sessions |
| Build | `next.config.ts`, `package.json` | Build completes with type checking | `pnpm build` |

## Add environment variables and publish

Run these commands inside `web/`. Link the intended Vercel project first. Enter each value at the interactive prompt.

```powershell
vercel link
vercel env add CONSUL_JUDGE_DEMO preview
vercel env add CONSUL_JUDGE_DEMO production
vercel env add COUNCIL_EXECUTION_MODE preview
vercel env add COUNCIL_SANDBOX_SNAPSHOT_ID preview
vercel env add COUNCIL_SANDBOX_SNAPSHOT_ID production
vercel env add COUNCIL_WORKER_TOKEN preview
vercel env add COUNCIL_WORKER_TOKEN production
vercel env add COUNCIL_SESSION_SECRET preview
vercel env add COUNCIL_SESSION_SECRET production
vercel env add FACTORY_API_KEY preview
vercel env add FACTORY_API_KEY production
vercel env add COUNCIL_FINANCE_MODEL_ID preview
vercel env add COUNCIL_FINANCE_MODEL_ID production
vercel env add COUNCIL_FINANCE_REASONING_EFFORT preview
vercel env add COUNCIL_FINANCE_REASONING_EFFORT production
vercel env add COUNCIL_OPERATIONS_MODEL_ID preview
vercel env add COUNCIL_OPERATIONS_MODEL_ID production
vercel env add COUNCIL_OPERATIONS_REASONING_EFFORT preview
vercel env add COUNCIL_OPERATIONS_REASONING_EFFORT production
vercel env add COUNCIL_SKEPTIC_MODEL_ID preview
vercel env add COUNCIL_SKEPTIC_MODEL_ID production
vercel env add COUNCIL_SKEPTIC_REASONING_EFFORT preview
vercel env add COUNCIL_SKEPTIC_REASONING_EFFORT production
vercel env add COUNCIL_CHAIR_MODEL_ID preview
vercel env add COUNCIL_CHAIR_MODEL_ID production
vercel env add COUNCIL_CHAIR_REASONING_EFFORT preview
vercel env add COUNCIL_CHAIR_REASONING_EFFORT production
vercel env add SPACETIMEDB_URL preview
vercel env add SPACETIMEDB_DATABASE preview
vercel env add SPACETIMEDB_TOKEN preview
vercel env add SPACETIMEDB_URL production
vercel env add SPACETIMEDB_DATABASE production
vercel env add SPACETIMEDB_TOKEN production
vercel deploy
```

Enter `true` for `CONSUL_JUDGE_DEMO` and `sandbox` for `COUNCIL_EXECUTION_MODE`. Review the preview with the checks above. Publish with `vercel deploy --prod` only as a separate authorized step. Do not run `vercel env pull` over local credential files or pass secret values on the command line.
