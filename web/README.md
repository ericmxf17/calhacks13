# Business Health Dashboard

Imported from the supplied “Interactive Business Health Dashboard” Figma export.
The design and application source are preserved, including the interactive 3D
business scene, sign-in screens, file uploads, and business setup flow.

## Run locally

Requires Node.js >=24.22.1 and pnpm 10.26+ (10.x) or 11.x.
The versions recorded in `.mise.toml` are Node.js 24.22.1 and pnpm 10.34.3.

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000.

The signup/sign-in screen includes **Explore demo**, which opens `/demo` without
an account. It skips signup and starts with existing company, product, and
supplier details already filled in. Edit the defaults or select **Continue**
to keep them and reach the sample dashboard. The demo does not save a real
workspace. **Sign out** returns to the account screen.

Three company shortcuts below **Explore demo** open a populated workspace
immediately, without signup or setup:

| Company | Sample business | Route |
| --- | --- | --- |
| VoltRide | E-bike manufacturing | `/demo/voltride` |
| Harbor Goods | Retail | `/demo/harbor-goods` |
| Beacon Studio | Agency and services | `/demo/beacon-studio` |

Each fictional company has its own room metrics, charts, and lists in
`src/lib/demo-companies.ts`. **Business settings** edits the preview locally.
The building sign follows the current company name in both rendering paths.
The original `/demo` still opens the three setup steps.

To build and serve production output:

```sh
pnpm build
pnpm start
```

The Figma backend must be configured before signing up, signing in, saving
business data, or building production output. The sign-in page can render
without that connection; that alone does not verify the backend.

## Windows / PowerShell

Run the commands above in PowerShell from the repository root. They use your
existing Node installation; WSL and Git Bash are not required. Check the
active tools with:

```powershell
node --version
node -p "process.execPath"
pnpm --version
```

The package scripts call the installed Next.js and Payload CLIs through Node,
so they work without Unix `NODE_OPTIONS=...` assignments or `${PORT:-3000}`
expansion. Next.js defaults to port 3000. To use a different port:

```powershell
# Run inside web/
pnpm dev --port 3001
```

Alternatively, set `$env:PORT = '3001'` before `pnpm dev`. Set `PORT` in the
shell, not `.env`, because Next.js opens the port before loading `.env`.
Stop the server with Ctrl+C.

If PowerShell blocks `pnpm.ps1`, use `pnpm.cmd` for the same commands, such as
`pnpm.cmd install --frozen-lockfile` and `pnpm.cmd dev`. No execution-policy
change is needed.

`pnpm-workspace.yaml` explicitly allows the existing `esbuild`, `sharp`, and
`unrs-resolver` dependency build scripts. This replaces the old
`package.json` setting that pnpm 11 ignores. Dependency versions remain
locked in `pnpm-lock.yaml`.

## Connect the existing Figma backend

Use the original project's configuration from its owner, or authenticate
with an account that has access to that project. Do not invent a
`FIGMA_EID`: it identifies a real backend environment.

For an account with access, run the already-installed Figma CLI inside `web/`:

```powershell
pnpm exec payloadcms-figma login
```

Complete the browser login yourself. Add the original CMS resource ID to
`web/.env` (edit an existing file rather than overwriting it):

```dotenv
FIGMA_PROJECT_ID=<original-cms-resource-id>
FIGMA_PUBLIC_URL=http://localhost:3000
```

Then select the existing development environment:

```powershell
pnpm exec payloadcms-figma env
```

The CLI writes `FIGMA_ENVIRONMENT_NAME` to `.env` and caches that project's
environment IDs and OAuth configuration in its encrypted credential store.
Restart `pnpm dev` afterward. These commands use an existing project and do
not run the `init` scaffolder or replace the application's Payload config.
Login and environment selection require your account access and have not
been performed for this checkout.

If the owner instead supplies environment configuration, place it in
`web/.env`, which Git already ignores. Keep secrets out of chat and commits.
The error `Environment ID could not be resolved. Set FIGMA_EID or initialize
the project.` means the backend configuration is still missing. Setting only
the public URL will not resolve it.

## Integration status

This is the Figma-generated application. Its authentication and workspace API
use Payload CMS through `@payloadcms/figma`, and require the corresponding
Figma content service configuration to persist accounts and business data.
The original configuration reads `FIGMA_EID`, `FIGMA_PUBLIC_URL`,
`FIGMA_CONTENT_API_CONTENT_SYSTEM_ID`, `FIGMA_CONTENT_API_URL`,
`FIGMA_OAUTH_CLIENT_ID`, `FIGMA_OAUTH_CLIENT_SECRET`, and
`FIGMA_CONTENT_API_ACCESS_KEY` from the environment. Keep credentials in a
local `.env` file; never commit them.

The web server exposes the Python forecast and impact calculator and has a
server-side CREAO connector with persistent local jobs. See
[backend setup](../backend/README.md). Each agent uses its own scoped `capi_`
key. Trusted backend callers use a separate `BACKEND_API_TOKEN`.
Dashboard figures remain design/demo data; these endpoints have not changed the UI.

Figma's agent instructions, sandbox scripts, and build caches were omitted
from the import. The small `.figma/make/site.json` file is retained because
the application imports it for site metadata.

## Local verification (Windows, 2026-10-24)

- Active Node.js: 24.22.1, in the existing installation. pnpm: 11.9.0.
- `pnpm install --frozen-lockfile` completed, including esbuild's postinstall.
- `pnpm exec tsc --noEmit` passed.
- `pnpm dev` starts on port 3000 and `GET /` returns HTTP 200.
- Signed-out `GET /api/workspace` returns HTTP 200 with `{"user":null}`.
  Payload also reports the missing Figma environment ID. This response does
  not establish that sign-in or persistence works.
- `pnpm build` reaches Payload and exits with the missing environment ID
  error. Production output was not built.
- Sign-up, sign-in, and saving business data remain unverified until the
  Figma backend is connected. No replacement database or authentication was added.

## Profile scene rendering

Start the development server, then run this command from `web` in a second terminal.

```powershell
node scripts/profile-browser.mjs --tag capture --repeat 5 --seconds 3 --trace --interactions --out "$env:TEMP/consul-performance"
```

The script uses an installed Chrome through the Chrome DevTools Protocol. It creates
an isolated headless profile and removes that profile on exit. It records actual
WebGL draw calls, React commits, layout reads, DOM mutations and animated SVG
transforms. CPU profiles and timeline JSON files open in Chrome DevTools. Traced
windows are marked separately because profiling adds overhead. Use untraced windows
for comparisons. `--chrome` overrides the Chrome executable path. `--width` and
`--height` select the viewport.

The probe warms the scene before measuring Home idle, Home pointer movement, Agents
idle and Agents pointer movement. `--interactions` also exercises camera reversals, room navigation, resize
and reduced motion. These are development diagnostics, not production FPS or page
load benchmarks. Chrome needs to render a real WebGL canvas for a valid capture.

## Building designs (Scene Designer)

Each company's 3D building comes from a small design file, not from code written by AI.
The file picks one of five building types (storefront, workshop, cafe, studio,
warehouse), its colors, sign tagline, roof and ground props, and 3 to 6 rooms. Code
builds the building from it and fills every room number from the setup details.

- `src/lib/scene-spec.ts` lists the allowed values and checks every design. It repairs
  bad values instead of failing, and falls back to a keyword-picked "quick design".
- `src/components/business/scene/` holds the building parts, the layout math, and one
  file per building type in `archetypes/`.
- `src/lib/starter-rooms.ts` fills rooms from products and supplier parts.
- `src/lib/demo-scenes.ts` holds the saved designs for the three demo companies.
- After setup, `useSceneDesign` asks the CREAO Scene Designer agent for a design
  (through `/api/agent-runs/scene-designer/jobs`) and shows a construction site while it
  works. The request ID is saved in the browser first, so a reload resumes the same
  run. Without `ENABLE_LOCAL_AGENT_PREVIEW=true` and the Scene Designer keys, the quick
  design shows at once.

Preview any building type during development at
`/demo/scenes?archetype=cafe&rooms=5` (add `&props=chimney;cafe_tables,planters` to
choose roof and ground props). The page returns 404 outside development.

## Talk to the council

Open **Consul** from a company workspace. The camera swings to the council before
the conversation appears. The left roster shows Finance, Operations, Skeptic,
and Chair; the current role reports its public focus. **Context & sources**
shows the company setup and selected CREAO evidence. Each round ends with the
Chair's synthesis and a decision card inside the conversation.

The composer sends a new question or a follow-up to the existing Factory
backend. Follow-ups retain the original evidence snapshots and source IDs.
Choose **New conversation** to change evidence. Company edits also start a
separate context. Reading or reloading a saved conversation does not start a
model run. See the [council backend guide](../backend/README.md#consul-council)
for credentials, round limits, and recovery.

The conversation and message primitives are adapted from
[Vercel AI Elements](https://elements.ai-sdk.dev/components/conversation).
Their source and license are kept in `src/components/ai-elements/`. The composer
uses the existing council API; it does not require another model provider.

During development, `/demo/council` shows the production renderer with an
explicitly illustrative conversation and Chair decision. Use
`/demo/council?stage=skeptic` to inspect the active-role state. These previews
perform no provider calls or browser-storage writes and return 404 outside
development.

