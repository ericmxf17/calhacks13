# Business Health Dashboard

Imported from the supplied “Interactive Business Health Dashboard” Figma export.
The design and application source are preserved, including the interactive 3D
business scene, sign-in screens, file uploads, and business setup flow.

## Run locally

The export requires Node.js >=24.22.1 and pnpm 9, 10, or 11.

```sh
cd web
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:3000.

The signup/sign-in screen includes **Explore demo**, which opens `/demo` without
an account using only illustrative business data. The demo does not access or
save a real workspace, and includes a link back to sign in.

To build and serve production output:

```sh
pnpm build
pnpm start
```

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

## Import verification

- Dependency installation completed.
- `npx tsc --noEmit` passed.
- `npm run build` stops because `FIGMA_EID` is missing. A working Figma
  environment configuration is required to build this export as supplied.
- The local Node.js version was 24.16.0, below the export's declared minimum.
