<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Consul UI

Keep ordinary actions consistent across Council, Agents and workspace controls. Use the owned-source native `src/components/ui/button.tsx` Button and shared tokens in `src/components/ui/button.css`, loaded globally through frontend styles. Reserve scene-specific controls for scene navigation. Do not add one-off tiny button rules or broad button resets: action text is at least 14px, conversation/composer text 16px, and metadata at least 12px. Preserve cream surfaces, navy borders and blue accents with shared hover, focus and disabled states.
