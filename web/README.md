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

The website has not yet been connected to the repository's Python forecast,
impact calculator, or CREAO agents. Dashboard figures remain design/demo data.

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
