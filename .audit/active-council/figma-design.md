# Active Council Figma design

Status: PASS for editable concept and screenshot QA; ISSUES for original destination access and source display-font availability.

## Deliverable

New editable Figma Design file: https://www.figma.com/design/aXEIyZZIeUK4mSZq4Fb4MJ

- Desktop conversation: node `2:30`, https://www.figma.com/design/aXEIyZZIeUK4mSZq4Fb4MJ?node-id=2-30
- Visual artifacts and isolated custom preview: node `4:26`, https://www.figma.com/design/aXEIyZZIeUK4mSZq4Fb4MJ?node-id=4-26
- Reusable Council identity component: node `2:23`.
- Session: `6069a286-6993-456d-a51d-d29696b47f25`.

The existing README file denied both session creation and screenshot access. No nodes in that file were changed. A new file was created in the connected account's only team, George Gong's team. This preserves the old design.

## Evidence and checks

I downloaded and visually inspected the final screenshots at normal review scale:

- `.audit/active-council/figma-active-council.png`: desktop, 1440 × 1100.
- `.audit/active-council/figma-visual-artifacts.png`: companion design, 1440 × 1023.

Desktop readback: 99 native descendants, consisting of 26 frames, 66 text nodes, 4 component instances, and 3 chart rectangles. No image-filled nodes. Companion: 63 native descendants, 24 frames and 39 text nodes, no image-filled nodes. These are editable Figma layers, not screenshots imported into Figma. Initial QA caught wrapped copy height errors; targeted fixes removed overlap. Final screenshots have no material clipping or overlapping content.

Source typography is DM Sans body plus Trebuchet MS display override (`consul-theme.css`). Figma lists DM Sans Regular/Bold but no Trebuchet MS. The proposal uses DM Sans for every rendered text node, including bold headings, and explicitly treats this as a proposed display-font change. Do not claim source display-font fidelity. File search found no Code Connect files; new canvas was empty. Design-system search returned no Consul Council components, colors, or DM Sans styles. Local Council identity component and light color variables were therefore created.

## Implementation guidance

Use cool Council identities instead of reusing CREAO's warm animated bots. The concept intentionally uses compact role-initial sigils: F, O, S, C. Their meaning remains in visible role text. Use the backend model identifier immediately below the role and in each message byline; do not invent a vendor/model label from the role. The concept says `Configured model` because it has no live configured response. Production should render the actual returned value and show `Unavailable` when absent. `council-droid.ts` requires explicit `COUNCIL_MODEL_ID`; there is no chargeable default.

Palette: ink `#243957`, muted `#526B82`, canvas `#EFFAFF`, white cards, border `#BDD7E7`, Council violet `#6750A4`, soft violet `#EFEAF8`, execution teal `#087F8C`, soft teal `#E0F4F1`, citation blue `#2468D2`. Desktop uses 24 px outer padding and gaps; left roster 224 px, conversation 788 px, evidence 332 px within 1440 px. Card radii 10 px, body 14–15 px, identity 14 px bold, metadata 11–12 px. The current code has a narrower 190/center/300 grid; adapt widths responsively rather than forcing fixed desktop widths into the app.

The conversation is the main surface. Place generated chart, decision flow, map, and comparison table beside the explanation that uses them. Every artifact needs a visible classification (`SOURCE-BASED` or `COMPUTED`), assigned source IDs, assumptions, and a path to inspect inputs or calculation. The map example is explicitly schematic; it must not imply precise geography.

Show bounded execution as user-facing tool activity, with waiting/running/complete/failed state, tool name, call budget, duration limit, source count, and an actual stop affordance when supported. Numerical limits in this design are illustrative; use server policy values in production. This is tool execution status, never private chain-of-thought. Do not display a tool as complete before the backend event confirms it.

Custom HTML/JS belongs in an isolated preview with an explicit supplied dataset and visible provenance. The mock shows interactive demand analysis as an illustrative output, not a functioning Figma program. Dedicated data/visual tools and isolated code execution satisfy the requested scope; no general shell/repository tool is implied. Boundary restrictions need actual runtime enforcement and cannot be created by UI copy.

All mock data is marked illustrative at frame level. No job data or source code changed in this workstream. No tests were created or run. Remaining scope limits: desktop concept only, no mobile frame, no Figma interactive prototype wiring, no live backend execution claimed.
