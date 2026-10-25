# Candidate A: one durable council workspace, capability-backed tools

Status: **PASS for architecture; ISSUES for environment verification**. Ground and sketch complete. Agree/implement belong to synthesis. No source edits or billable model session were performed.

## Problem

The Council must visibly work on a question, return text and useful visuals, and support genuinely custom HTML/JavaScript. Today it only produces validated final JSON: `web/src/lib/council-droid.ts:136` creates a session without MCP, `:141` disables every discovered tool, and `:124` forbids calculations/research. `web/src/lib/council.ts:132` executes Finance, Operations, Skeptic, Chair sequentially, saving each final result. This ordering is valuable: later roles can inspect earlier evidence and challenge it. Keep it, but give each turn a bounded tool capability whose committed results the next role receives.

The existing job owner and reservation ledger prevent duplicate paid submissions (`web/src/lib/council.ts:155-204`); preserve that contract. Evidence snapshots are frozen across follow-ups (`:90`, `:105`, `:192`). Research must therefore add immutable, dated observations, rather than replace the original `sources`. Existing saved jobs remain inspectable without migration writes.

## Usage (caller's view)

The browser submits the existing request, then continues polling the same thread. It sees Finance's actual configured model, a public tool card saying “Calculating product exposure,” a saved chart, then Finance's final claim citing the computed result. Operations sees that result and can publish a flowchart or a custom interactive scenario preview. Reloading reconstructs the same cards from disk; it does not rerun anything.

```ts
// council.ts: existing orchestration owns the entire round.
const tools = councilTools(saved.job, recordCouncilEffect)
const result = await runCouncilRole(saved.job, role, history, {
  tools,
  onSession: saveSession,
  onActivity: recordCouncilEffect,
})
// runCouncilRole owns SDK types, transport and permission policy.
```

```ts
// Handler call the model can actually make through MCP, not JSON pretending to call a tool.
publish_visual({
  title: 'Product revenue comparison',
  evidenceIds: ['calculation-...'],
  visual: { kind: 'chart', chart: 'bar', x: 'product', y: 'revenue', rows: [...] },
})
// Result: { artifactId, title, evidenceIds }. Saved before returning to Droid.

calculate_javascript({
  title: 'Revenue scenario', inputEvidenceIds: ['profile'],
  inputs: { units: 100, price: 40 },
  code: '(input) => ({ revenue: input.units * input.price })',
  assumptions: ['Units and price are the selected scenario inputs'],
})
// Result: durable calculation evidence ID, canonical JSON result and provenance.
```

```tsx
// CouncilPanel: model metadata and committed activity come from saved state.
<CouncilTurnView turn={turn} activity={round.activity} artifacts={round.artifacts} />
<CouncilArtifact artifact={selectedArtifact} />
// The artifact renderer owns built-in cards and the separate custom-preview boundary.
```

## Grounded SDK mechanism

Installed `@factory/droid-sdk` is 0.10.0 (`web/node_modules/@factory/droid-sdk/package.json:3`). It **already supports application-defined tools**. Exact exports and signatures live in `dist/node.d.ts:621-659`: `tool(name, description, zodShape, handler, options)`, `createSdkMcpServer({ name, version?, tools })`, and a handler returning `string | CallToolResult`. `CreateSessionOptions` accepts `mcpServers: DroidMcpServerConfig[]` (`:672-700`). The shipped example `examples/node/sdk-mcp-tool.ts:18-38` demonstrates this path.

“In-process” describes handlers, not a direct CLI function call. `dist/node.mjs:3770-3897` starts an HTTP server at a random `127.0.0.1` port, generates a bearer token, and serves MCP at `/mcp`. `:3900-3923` starts SDK server instances and registers cleanup; `:4314-4333` places the resulting HTTP configuration into session creation. Session close cleans it up. The correct implementation is therefore an SDK MCP server whose handlers close over the job/role capability, passed into `createSession`. No custom tool-call dispatcher or shell MCP process is necessary.

An unbilled local probe ran `createSdkMcpServer` with a typed `sum` tool, called initialize, tools/list and tools/call over its actual HTTP transport, and observed HTTP 200 for all three plus `{"sum":5}`. This checks schema registration and real execution, not Droid discovery or permissions. A normal `import {z} from 'zod'` failed from web because zod is only transitive under pnpm; add zod as a direct dependency rather than importing the SDK's private dependency layout. The corrected probe used createRequire solely to locate the SDK's own installed zod.

Keep `AutonomyLevel.Off`, disable builtin skills, cancel AskUser, and replace `autoRejectPermissionRequests:true` with a narrowly checking permission handler. Native tools are disabled before sending any prompt; retain only the exact discovered IDs belonging to this server. There is no `enabledToolIds` in the Node session interface (`dist/index-DWBA4zgW.d.ts:124661-124668`). Discovery must resolve actual IDs rather than invent `mcp__...` spelling. `session.listMcpTools()` exposes MCP metadata (`dist/node.d.ts:757`); `listTools()` exposes `source` and SDK IDs (`dist/index-DWBA4zgW.d.ts:50256-50265`). Fail closed if discovery cannot prove the intended set.

Permission requests expose `details.type === ToolConfirmationType.McpTool`, `serverName`, `actualToolName` and `toolName` (`dist/index-DWBA4zgW.d.ts:152708-152727`). Approve once only if **every** requested tool matches the owned server and an allowed tool; cancel mixed/native/unidentified requests. Runtime discovery and this predicate both need a real paid-session check before claiming the end-to-end integration works. Annotation hints are descriptive, not authorization. Artifact publishing writes the local ledger and should not be disguised as read-only to bypass permissions.

## Shape

Three owners suffice: `council.ts` owns durable job/effect state, `council-droid.ts` owns model interaction and transport, and `council-tools.ts` owns tool capability and validation. `CouncilArtifact.tsx` owns visual rendering. A small QuickJS worker owns generated calculations. Avoid a registry framework, event bus, second job queue or parallel council scheduler.

```ts
type CouncilSpeaker = {
  role: CouncilRole
  modelId: string       // actual SDK settings, persisted once session is ready
  reasoningEffort: string
}
type CouncilEvidenceRef =
  | { kind: 'source'; id: string }
  | { kind: 'observation'; jobId: string; id: string }

type CouncilObservation =
  | { kind: 'research'; id: string; invocationId: string; title: string
      url: string; fetchedAt: string; text: string; warnings: string[] }
  | { kind: 'calculation'; id: string; invocationId: string; title: string
      engine: 'policy-python' | 'quickjs'; inputRefs: CouncilEvidenceRef[]
      inputs: JsonObject; assumptions: string[]; program: string
      result: JsonValue; createdAt: string }

type CouncilVisual =
  | { kind: 'chart'; chart: 'bar' | 'line'; x: string; y: string; rows: JsonObject[] }
  | { kind: 'table'; columns: string[]; rows: JsonValue[][] }
  | { kind: 'flowchart'; nodes: { id: string; label: string }[]
      edges: { from: string; to: string; label?: string }[] }
  | { kind: 'map'; markers: { label: string; latitude: number; longitude: number }[] }
  | { kind: 'html'; html: string }
type CouncilArtifact = {
  id: string; invocationId: string; role: CouncilRole; title: string
  evidenceRefs: CouncilEvidenceRef[]; visual: CouncilVisual; createdAt: string
}
type CouncilActivity =
  | { kind: 'started'; id: string; role: CouncilRole; tool: CouncilToolName; title: string; at: string }
  | { kind: 'succeeded'; id: string; resultIds: string[]; at: string }
  | { kind: 'failed'; id: string; code: string; message: string; at: string }
type CouncilEffect =
  | { kind: 'tool-start'; activity: Extract<CouncilActivity, { kind: 'started' }> }
  | { kind: 'tool-result'; activity: Extract<CouncilActivity, { kind: 'succeeded' }>
      observations: CouncilObservation[]; artifacts: CouncilArtifact[] }
  | { kind: 'tool-failure'; activity: Extract<CouncilActivity, { kind: 'failed' }> }
type RecordCouncilEffect = (effect: CouncilEffect) => Promise<void>

function councilTools(job: CouncilJob, record: RecordCouncilEffect): CouncilToolCapability {
  throw new Error('not implemented')
}
function runCouncilRole(job: CouncilJob, role: CouncilRole, history: CouncilHistoryRound[],
  runtime: CouncilRoleRuntime): Promise<{ turn: CouncilTurn; decision: CouncilDecision | null }> {
  throw new Error('not implemented')
}
function renderPreviewDocument(html: string): string {
  // Host prepends restrictive CSP; untrusted HTML never enters the parent DOM.
  throw new Error('not implemented')
}
```

All payloads enter bounded parsers at tools. Validate unique node IDs, existing edge endpoints, finite numeric values, coordinate ranges, row/column lengths, text/HTML byte limits, valid evidence references and per-round count limits. The renderer never interprets arbitrary chart config, URLs or React component names. A map uses a bundled outline/grid and labelled points; it does not fetch remote tiles or silently geocode labels. Named-location coordinates must come from cited evidence or a separate explicit lookup result. Every artifact has a text title and accessible fallback table/list.

The deep surface is `councilTools(job, record)`: it hides argument validation, capability checks, execution limits, provenance and commit-before-return. The caller only supplies durable ownership. Do not export SDK schemas/server configs to `council-types.ts` or client code. This follows boundary-discipline, separate-before-serializing-shared-state and single-source-of-truth principles from the architect references.

### Tool surface and execution

Expose `publish_visual`, `calculate_policy`, `calculate_javascript`, and `research_url`. `publish_visual` accepts the discriminated visual union, including custom HTML/JS. `calculate_policy` accepts only the existing trusted operation enum and parsed JSON data. It calls `calculate()` in `web/src/lib/backend.ts:55-94`, which executes fixed `backend/worker.py`; this is Python calculation capability without arbitrary Python source. `backend/worker.py:39-65` implements forecast, impact and verify-brief over known functions. It does not make generated Python safe.

Generated JavaScript runs in QuickJS WASM inside a terminable worker, with only JSON inputs, no host function callbacks, no module loader, bounded result bytes, interpreter memory limit and interrupt deadline. The [maintainer's QuickJS documentation](https://github.com/justjake/quickjs-emscripten#usage) documents a separate interpreter, context environments and evaluation memory/deadline options. This avoids exposing Node globals and gives useful general calculations while Docker is absent. Package installation and the worker bridge still need verification here; only the docs were inspected. Do not use `node:vm` as a security boundary.

Docker CLI exists but `docker info --format '{{.ServerVersion}}'` failed because the Docker Desktop Linux engine pipe is absent. Arbitrary Python is therefore unavailable in this release unless an isolated runtime is provisioned. If later added, use a fixed image without credentials/network, read-only root, bounded writable tmpfs, unprivileged user, no host mounts, process/memory/CPU limits, timeout and container cleanup. Do not fall back to `python -c`, a temp cwd or environment scrubbing. Existing trusted policy Python remains immediately usable.

Read-only research should first ship as bounded public URL fetch, not a fake search tool or use of this development agent's connectors at runtime. Validate URL and each redirect, reject private/loopback/link-local targets after DNS resolution, cap time/bytes/type, extract plain text, and retain URL/date/excerpts. If search is required, a configured provider is a separate explicit dependency. Research error is a saved tool failure, not invented evidence. No SDK native browser/shell tool is enabled.

### Durable effects and backward compatibility

Extend jobs with optional versioned `activity`, `observations`, `artifacts` and turn speaker metadata. Decode absent fields as empty read views; never rewrite legacy files merely to add these fields. Existing request hashes, legacy session records, source snapshots and decisions stay valid. New structured turn output uses observation references; legacy output continues rendering `sourceIds`. Normalize legacy citations at the read/render boundary, not through a second ongoing claim writer.

The ledger owner applies each effect and saves a snapshot atomically using the existing temporary-file/rename mechanism (`council.ts:32-37`). A single per-job commit queue protects handlers that finish concurrently; SDK handlers never mutate saved state directly. Persist start before computation and persist observation/artifact plus success together before returning its ID to the model. This means a later role cannot receive a result that only existed in memory. If persistence fails, return a tool failure and fail the round if the ledger itself is unavailable. On restart, open invocations become interrupted without automatic execution. Existing owners semantics apply.

Host invocation IDs are distinct from SDK `toolUseId`. The SDK tool handler receives only parsed input (`dist/node.d.ts:635`), while stream events include toolUseId (`dist/index-DWBA4zgW.d.ts:161959`). Do not pretend the handler receives tool-call context or invent a mutable “current tool ID.” Host IDs returned in tool results provide the durable link. SDK tool-call events may enrich diagnostics, but persisted handler effects prove actual execution.

Follow-up context includes prior observations and artifact metadata, with bounded text/results, rather than embedding entire HTML documents again. Citation IDs remain scoped to their originating job. Initial `sources` remain identical across the thread, preserving the existing chain comparison. New research is visibly dated supplementary evidence. Budget both history and current message bytes; never truncate silently to make a run fit.

### Computed evidence and claims

The existing digit validator (`council-droid.ts:53-71`) only accepts literal quoted numbers from sources; it would reject every legitimate computed total. Keep exact source-quote validation for source-backed numeric claims. Add explicit computed references whose quoted support must match canonical persisted calculation result excerpts, and distinguish observed, assumed and derived inputs in the inspector. A result can be computationally correct while its inputs are hypothetical. Validating reference membership and numerical occurrence proves provenance, not semantic relevance or arithmetic correctness of arbitrary model programs. The skeptic should inspect inputs, program and result.

The same provenance applies to numeric chart/table values and labels. A generic visual publishing tool must not elevate model-written numbers into new independent evidence. Accept visual cells from cited result paths or validated source excerpts, or label an artifact explicitly as an illustrative scenario with its assumptions. Never allow an artifact to cite itself. Custom interactive slider results remain local scenarios; they cannot silently become saved authoritative evidence or send authenticated requests to the server.

### Browser boundary

Render built-in chart/table/flowchart/map components from validated data. Render HTML only in `<iframe sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={...}>`, without allow-same-origin, forms, popups, downloads or top navigation. Host-controlled CSP precedes generated content: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`. Do not permit external libraries/CDNs. No parent bridge, cookies, SDK credentials, window access grants or backend callback are supplied. Parent never uses dangerouslySetInnerHTML for the artifact.

This isolates browser authority, not CPU availability: a busy loop can still harm the tab. Keep Stop/Reload outside the iframe and do not claim hard execution quotas for preview JavaScript. For hard CPU isolation, a separate site/process or remote renderer is an additional deployment requirement. Mount expensive custom previews on user opening their artifact, not all saved previews during polling. Parent-owned title/provenance remain visible outside generated content so it cannot replace the council identity.

### UI identity and liveness

Move the existing `seats` metadata from `CouncilPanel.tsx:25-54` into one shared role catalogue; derive role ordering, names, purpose, avatar and stage labels. Distinct avatar assets already exist. Persist actual model ID/effort from the SDK before role output and display them per turn/activity. Do not show the current environment's model for an old turn; show “model not recorded” for legacy jobs. Four roles can use the same configured model while still being distinct seats. Separate model selection is optional, not necessary to invent personas.

The existing 1.8-second polling (`CouncilPanel.tsx:348`) can reveal persisted tool activity and cards during a role, with no SSE route or fake token stream. Show only public tool name/status, validated artifacts and final summary. Do not publish thinking deltas, arbitrary raw provider outputs or unsanitized tool results. Keep the existing shared Button and cream/navy/blue tokens required by `web/AGENTS.md`.

## Synthesis decision

For orchestrator synthesis. Candidate A proposes retaining sequential discussion and one ledger owner, with application-owned MCP capabilities and atomic effect commits.

## Tradeoffs accepted

- We accept sequential roles in exchange for inspectable discussion that genuinely responds to the prior position.
- We accept a finite built-in visual vocabulary in exchange for stable rendering; custom HTML supplies the independent escape hatch behind a real browser boundary.
- We accept trusted policy Python plus generated QuickJS in exchange for useful calculation capability before Docker is running; arbitrary Python remains explicitly unavailable.
- We accept snapshot polling and bounded payloads in exchange for fewer recovery paths and compatibility with saved local jobs.

## Alternatives considered

**One external sandbox MCP service per role.** A container owns tools, observations, generated files and Python; the application only stores references and renders results. This hides more execution plumbing than the chosen shape but exposes deployment, authentication, health and remote artifact retrieval to every council run. It is attractive when arbitrary Python is mandatory and a sandbox service already exists. Here Docker is down and the application already owns local recovery; it would make basic charts depend on a new service.

**One model response containing text and artifact specifications.** This hides transport entirely and makes rendering easy, but the model never actually calls application tools. It cannot establish that a calculation or research happened, and the caller must infer evidence provenance from generated content. It fails the active-tool requirement.

## Open questions and risks

- Can the installed native Droid executable discover this SDK HTTP server, report stable MCP identity and permit only these tools under Off autonomy? A paid-session probe must answer before completion, since the successful direct MCP probe does not establish that link.
- Does the implementation preserve source-versus-derived-versus-scenario status in every numeric visual and claim? This is the central evidence risk; a calculator must not launder invented inputs into facts.
- Will QuickJS worker packaging load WASM correctly under this Next version and terminate excessive allocation/loops? Inspect installed Next guidance and exercise the actual worker before choosing the final import/worker shape.
- Does the user require arbitrary generated Python specifically, or is trusted Python plus isolated generated JavaScript sufficient for first release? The latter can work with the observed environment; the former needs an isolated runtime.

## Red-flag screen and next implementation step

No large public registry, stage pipeline, wire-type leakage, duplicate tool dispatcher or second job owner is introduced. The finite role catalogue replaces the current repeated list. Durable effects have one writer; raw tool messages and generated HTML never bypass their validation/render boundaries. The remaining hard dependency is the real Droid permission/discovery probe, not a missing design pattern.

First build one real `calculate_policy` SDK MCP handler that commits an observation through the existing job owner, then inspect its persisted activity and final cited result through the Council UI before adding visual variants.

| Component | Function/file exercised | Behavior to verify | Existing/proposed method |
|---|---|---|---|
| SDK MCP | `createSdkMcpServer` | Initialize, list and execute actual tool | Direct protocol probe completed: HTTP 200; result sum 5 |
| Droid integration | `runCouncilRole` | Dedicated tool succeeds; native tool remains unavailable | One explicit paid-session probe; not yet run |
| Persistence | `recordCouncilEffect` | Saved card survives reload; interrupted call never reruns | Real API/UI operation and ledger inspection |
| Computation | QuickJS worker | Finite result, no host capability, interrupt and memory bounds | Actual worker probes after dependency install |
| Preview | `CouncilArtifact` | Custom JS works; network/parent access denied | Browser interaction and network inspection |
| Compatibility | saved legacy job | Original citations/identity render without rewritten history | Open an existing saved job through GET/UI |
