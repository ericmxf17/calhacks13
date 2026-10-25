# Vercel saved-demo release

Prepared 2026-10-25. No deployment, project linking, environment upload or public URL was created by this preparation.

## Deployment boundary

Deploy `web/` as a Next.js project. Set `CONSUL_JUDGE_DEMO=true` in both Preview and Production **before building**. The root page then opens the saved VoltRide workspace without an account; `/demo/voltride` and other demo profiles remain available. Demo edits last for the current visit. Account mutations return an explicit unavailable response in judge mode.

Vercel serves the web interface and reads saved Council results from SpacetimeDB. Python analysis, the Droid CLI and new paid Council runs stay on the local development machine. A page read must never start those jobs. Do not upload provider API keys, Droid authentication, `.backend`, `.tools`, local environment files or logs.

## Project settings and environment

| Setting | Value |
| --- | --- |
| Root Directory for Git import | `web` |
| Framework | Next.js |
| Node.js | 24.x; package requires at least 24.22.1 |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` (runs `next build`, including TypeScript checking) |
| Output directory | Leave framework default |
| Public entry | `/` |

`web/vercel.json` records install/build settings. `web/.vercelignore` excludes local state from CLI uploads. Deploy from `web`, not the repository root. Vercel supports Node 24.x and selects patch updates automatically: [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions). See [project settings](https://vercel.com/docs/project-configuration/project-settings) and [deployment exclusions](https://vercel.com/docs/deployments/vercel-ignore).

| Variable | Purpose | Needed |
| --- | --- | --- |
| `CONSUL_JUDGE_DEMO=true` | Public entry and account API mode | Build and runtime |
| `SPACETIMEDB_URL` | HTTPS origin of the archive database host, with no path | Saved Council archive |
| `SPACETIMEDB_DATABASE` | Published archive database name | Saved Council archive |
| `SPACETIMEDB_TOKEN` | Server-only token authorized to read saved results | Saved Council archive |
| `NEXT_PUBLIC_SITE_URL` | Canonical public site URL | Optional; Vercel URL is the fallback |

SpacetimeDB variables must remain server-only. Never give them a `NEXT_PUBLIC_` prefix. The archive requires a published module, seeded saved sessions, and a read-authorized token. Empty variables produce an unavailable archive, not fabricated live results. The separate SpacetimeDB preparation report records module/seed status.

Private accounts are a separate deployment capability. The existing Payload adapter uses Figma Content API. Do not disable judge mode until its project, content system, credentials and account persistence have been configured and checked. `web/.env.example` lists the relevant Figma settings, including `PAYLOAD_SECRET`, `FIGMA_EID`, `FIGMA_CONTENT_API_URL`, `FIGMA_CONTENT_API_CONTENT_SYSTEM_ID` and `FIGMA_CONTENT_API_ACCESS_KEY`. The Figma/Payload admin and generic content endpoints are not part of the judge demo and remain unverified without that backend.

## Local check before publishing

From PowerShell at the repository root:

```powershell
Set-Location web
$env:CONSUL_JUDGE_DEMO = 'true'
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open `/`, `/demo`, and `/demo/voltride`. `/demo/<profile>` accepts configured demo IDs; unknown profiles correctly return 404. In judge mode `/demo` lists the saved companies without setup. Check the saved Council archive after setting its three server-side variables. POST `/api/workspace` must return 503 in judge mode. Browser network responses and static assets must contain no provider token.

| Component | File/interface | Behavior to check | Method |
| --- | --- | --- | --- |
| Judge entry | `src/app/(frontend)/page.tsx` | Opens VoltRide without signup | Browser at `/` after production build |
| Demo workspace | `src/components/Workspace.tsx` | Saved-demo notice and visit-only settings | Browser, edit settings then reload |
| Account boundary | `/api/workspace` | GET demo-only response, POST 503 | HTTP requests with judge mode enabled |
| Council archive | `/api/council` and history endpoints | Reads existing sessions without starting a run | Browser plus server logs |
| Production build | `next.config.ts`, `package.json` | Types checked; build completes | `pnpm build` |

## Release commands, for an authorized publishing step

CLI identity was checked separately as `coffeecoder1015`. These commands are instructions, not actions performed during preparation. Run inside `web/`, choose the intended Vercel project/scope, and enter secrets only at interactive prompts:

```powershell
vercel link
vercel env add CONSUL_JUDGE_DEMO preview
vercel env add CONSUL_JUDGE_DEMO production
vercel env add SPACETIMEDB_URL preview
vercel env add SPACETIMEDB_DATABASE preview
vercel env add SPACETIMEDB_TOKEN preview
vercel env add SPACETIMEDB_URL production
vercel env add SPACETIMEDB_DATABASE production
vercel env add SPACETIMEDB_TOKEN production
vercel deploy
```

Enter `true` for judge mode. Review the preview URL through the checks above, then publish with `vercel deploy --prod` only when publishing is authorized. Do not run `vercel env pull` over local credential files or pass secret values on the command line.
