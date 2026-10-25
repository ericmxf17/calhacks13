# Candidate B: Council-owned artifact tools

## Problem

The current council is a durable four-role discussion over frozen evidence, but each role explicitly has all tools disabled and returns only validated JSON (`web/src/lib/council-droid.ts:124-155`). The live UI already renders four distinct seats and polls a saved thread (`web/src/components/business/CouncilPanel.tsx:25-61, 278-289`); it needs to display actual model identities and durable tool results without weakening the current claim/source checks. The shape is non-obvious because Droid SDK 0.10.0 supports first-party in-process MCP tools, while charts, maps, tables, and arbitrary HTML previews have different trust and rendering needs. Existing on-disk jobs and old turns must remain readable.

## Usage (caller's view)

```ts
const result = await runCouncilRole({ job, role, history, evidence }, saveSession, trace)
// result.turn contains public prose and source/research/calculation citations.
// Each tool artifact was persisted before its SDK handler returned.
```

An implementation call site in the durable runner remains one role at a time:

```ts
const evidence = councilEvidenceContext(await readCouncilThread(saved.job.id))
const result = await runCouncilRole({ job: saved.job, role, history, evidence }, saveSession, trace)
saved.job.turns.push(result.turn)
await save(saved)
```

The UI reads the same `CouncilThread` as before and renders each turn's actual model label, distinct seat identity, citations, and artifact cards. Opening an artifact fetches it by job and artifact ID; it never interprets artifact text as ordinary React markup.

```ts
const thread = await readCouncilThread(jobId)
const evidence = councilEvidenceContext(thread) // original sources plus saved public research, in round order
const artifact = await readCouncilArtifact(jobId, artifactId)
```

## Shape

### Data first

```ts
type CouncilSeat = {
  role: CouncilRole
  name: string
  avatar: 'finance' | 'operations' | 'skeptic' | 'chair'
  modelId: string
  reasoningEffort: ReasoningEffort
}

type CouncilCitation =
  | { kind: 'source'; sourceId: string }
  | { kind: 'research'; artifactId: string }
  | { kind: 'calculation'; artifactId: string; resultKey: string }

type CouncilClaim = { text: string; citations: CouncilCitation[] }

type CouncilTurn = {
  role: CouncilRole
  sessionId: string
  modelId?: string // optional only for legacy saved turns
  summary: string
  claims: CouncilClaim[]
  challenges: CouncilClaim[]
  uncertainties: string[]
}

type CouncilArtifact =
  | { id: string; kind: 'chart' | 'table' | 'flowchart' | 'map'; title: string; spec: VisualizationSpec; provenance: CouncilCitation[]; createdBy: CouncilRole }
  | { id: string; kind: 'calculation'; title: string; inputs: CalculationInput[]; result: CalculationResult; formula: string; provenance: { sourceId: string; field: string }[]; createdBy: CouncilRole }
  | { id: string; kind: 'research'; title: string; url: string; exactText: string; retrievedAt: string; digest: string; warnings: string[]; createdBy: CouncilRole }
  | { id: string; kind: 'html-preview'; title: string; html: string; provenance: CouncilCitation[]; createdBy: CouncilRole }

type CouncilJob = ExistingCouncilJob & {
  artifacts?: CouncilArtifact[] // hydrated read shape; legacy jobs have none
}
type StoredCouncilJob = Omit<CouncilJob, 'artifacts'> & { artifactIds?: string[] } // old job.json files have no manifest
type NewCouncilArtifact = Omit<CouncilArtifact, 'id' | 'createdBy'>
interface CouncilArtifactStore {
  add(jobId: string, role: CouncilRole, artifact: NewCouncilArtifact): Promise<CouncilArtifact>
  list(jobId: string): Promise<CouncilArtifact[]>
  read(jobId: string, artifactId: string): Promise<CouncilArtifact>
}
type CouncilEvidenceContext = {
  sources: readonly CouncilEvidence[] // original user-selected immutable snapshots
  research: readonly Extract<CouncilArtifact, { kind: 'research' }>[] // public web evidence inherited across rounds
}
type CouncilHistoryRound = ExistingCouncilHistoryRound & { artifacts?: CouncilArtifact[] }
type CouncilRoleInput = { job: CouncilJob; role: CouncilRole; history: readonly CouncilHistoryRound[]; evidence: CouncilEvidenceContext }

function councilEvidenceContext(thread: CouncilThread): CouncilEvidenceContext
function readCouncilArtifact(jobId: string, artifactId: string): Promise<CouncilArtifact>
function councilTools(jobId: string, role: CouncilRole, store: CouncilArtifactStore): SdkMcpServer
function runCouncilRole(input: CouncilRoleInput, onSession: (id: string) => Promise<void>, trace: (event: CouncilRuntimeEvent) => Promise<void>): Promise<{ turn: CouncilTurn; decision: CouncilDecision | null }>
```

`artifacts` and `modelId` are optional in the persisted-read type solely to admit older `job.json` files. New writes always include them. The read boundary normalizes missing artifact arrays to `[]`, and it does not invent model IDs for old turns. Seat identity is a single role-keyed configuration used by prompts, model selection, labels, and avatar selection rather than separate hand-maintained lists.

### Droid transport and tool execution

Use the SDK's actual Node API, not model-authored JSON pretending to be a tool call and not a generic MCP child process. The installed example `web/node_modules/@factory/droid-sdk/examples/node/sdk-mcp-tool.ts:11-37` defines a tool with `tool(name, description, zodShape, handler, options)`, groups it with `createSdkMcpServer({ name, tools })`, and passes that server as `mcpServers: [sdkTools]` to `createSession`. Its stream emits `DroidMessageType.ToolCall` (`:41-45`). This is a real MCP protocol session wired in process by `@factory/droid-sdk/node`.

Provide a narrow `councilTools(job, role)` registry with only domain operations:

```ts
function councilTools(jobId: string, role: CouncilRole, store: CouncilArtifactStore): SdkMcpServer
// tools:
// calculate(source-bound operations) -> persisted calculation artifact ID + result
// run_javascript(bounded source + structured input) -> persisted result artifact ID
// research_readonly(query) -> persisted exact-text research artifact IDs
// publish_visualization(typed VisualizationSpec) -> persisted artifact ID
// publish_html_preview(bounded HTML/JS) -> persisted preview artifact ID
```

`tool(...)` handlers validate bounded Zod input, call these operations, persist the artifact before returning, and return the artifact ID plus safe summary. No generic `Execute`, shell, filesystem, arbitrary network, or browser-control tool is registered. `research_readonly` performs dedicated web search through a safe search provider and fetches selected public HTTPS pages. The fetch path rejects local/private destinations, validates DNS and every redirect, caps bytes/time/content types, and persists exact extracted text, URL, retrieval time, digest, and warnings as a per-round research artifact. This makes research visible in the evidence panel with its source link, retrieval metadata, and exact excerpt. It never mutates the user's original selected `job.sources`. The append-only artifact record is the sole stored copy of this tool evidence; `councilEvidenceContext(thread)` derives original selected sources plus saved research artifacts in round order. Every continuation role receives those excerpts through `CouncilRoleInput.evidence`; it does not refresh them. Source-quote validation resolves citations against either the frozen original source or exact text in a saved research artifact. `calculate` uses the existing trusted Python domain implementation over caller-selected numeric source fields; it stores formula/version and exact input fields, and does not accept model-authored Python source. For generated-code calculations, use pinned QuickJS-WASM (`quickjs-emscripten`) with no host callbacks, explicit memory limits, an interrupt/time budget, bounded structured inputs, and bounded JSON output. Persist the result with its code digest and inputs. If the WASM runtime or limits are unavailable, omit that tool rather than falling back to `child_process`, Node's `vm`, or a working-directory sandbox. The existing trusted Python calculation surface plus WASM JavaScript execution meets the authorized calculation and isolated-code uses without a Docker dependency. The local Docker CLI exists but its daemon is stopped, so Docker cannot be the first-release prerequisite. `DroidMessageType.ToolCall` events are persisted as public tool-call metadata (tool name and artifact ID); tool arguments/results are not emitted to diagnostics or logs because they may contain evidence text.

Build the server fresh per role/session. Pass it in `createSession({ ..., mcpServers: [server], autonomyLevel: AutonomyLevel.Off, ... })`. Keep permission requests canceled by default; mark only pure read-only calculations with the SDK's `readOnlyHint: true`, and explicitly permit the council's own narrow artifact tools through the role-scoped permission callback. Do not copy the current blanket `disabledToolIds: tools.map(...)` logic: `council-droid.ts:140-142` disables the just-added council tools too. Enumerate tools after session creation and fail closed unless the enabled set is exactly the role's SDK MCP tool IDs. The package's local example establishes API support; the runtime's qualified IDs and permission behavior should be confirmed against the installed CLI before UI work proceeds.

### Persistence, citation, and display

The filesystem job ledger remains authoritative. Store artifacts below each job directory, keyed by stable generated ID, and add a compact manifest/reference list to `job.json`. Make `CouncilArtifactStore.add()` the only writer for artifact records; serialize concurrent tool handler writes per job and only return success after the record and manifest are durable. Keep the existing `requestHash` reservation, atomic `job.json` replacement, completed-turn save, frozen source snapshots, and interrupted-job behavior (`web/src/lib/council.ts:13, 64-72, 141-152, 194-204`). Tool failure fails the active role/job with a safe message; already durable turns and artifacts remain inspectable, and a replay of the same request ID never dispatches a second paid run.

Claims cite a tagged `CouncilCitation`, not an unqualified string: `{ kind: 'source'; sourceId } | { kind: 'research'; artifactId } | { kind: 'calculation'; artifactId; resultKey }`. `source` citations retain the existing source-ID membership rule and literal-quote check for numeric source claims. `research` resolves only to exact text in a persisted research artifact; numeric claims still include an exact quote from that text. `calculation` resolves to a stored result key whose inputs identify exact source or research artifact fields and whose formula and unit are stored by the calculation tool. Numeric claims backed by calculations must cite the calculation artifact and match its persisted result value; they are not forced to quote an input excerpt that cannot contain a derived number. A visualization's provenance links it to source, research, or calculation citations but the visualization itself never proves a fact. A model-authored map location without linked factual evidence is rejected or labeled illustrative, never presented as verified. Old string `sourceIds` are read as source citations and remain unchanged on disk until an ordinary save.

Render `VisualizationSpec` as known first-party components: chart series; table columns/rows; flowchart nodes/edges; map markers/paths with coordinates and source references. Validate bounds and links on the server before persistence and again at the renderer boundary. Keep their accessible text and citations visible in the artifact card. For custom previews, present raw content only in a dedicated `iframe` using `sandbox="allow-scripts"` without `allow-same-origin`, with a restrictive CSP (`default-src 'none'`; permit only inline script/style required by the preview; block network, forms, navigation, frames, and workers). Escape the preview title and never put preview HTML into the parent DOM. This isolates page origin/storage and disallows external resource access; do not claim it is a defense against browser-engine vulnerabilities.

Configure per-role `modelId`/reasoning effort and avatar in the seat registry. Persist the actual `session.settings.modelId` on the turn after checking it equals that seat's configured model, and show the stored value as the model label beside the role name. Keep legacy `COUNCIL_MODEL_ID` as the explicit fallback for all four seats during migration; the rendered label can truthfully repeat if operators configured one model for every role. Add role-specific overrides without silently inventing distinct models.

The existing browser polling/read path needs no parallel artifact state machine: `readCouncilThread()` returns durable artifacts with each round, including fetched excerpts the user can inspect; any oversized HTML can be fetched via a same-origin, job-scoped artifact GET. Polling continues to discover appended turns/artifacts from the saved thread (`CouncilPanel.tsx:278-289`). Saved demos can omit artifacts and model labels.

### Interface depth and boundaries

`CouncilArtifactStore` owns artifact validation, atomic persistence, legacy normalization, and ID-scoped reads; SDK wire objects stay inside `council-droid.ts`. `CouncilPanel` consumes domain artifact unions only. Calculation provenance is checked in the server validation boundary; rendering validates representation but does not claim semantic verification. The role loop remains explicit in `council.ts`, which already owns sequencing and checkpoints. This adds one artifact ownership module and a small execution boundary behind narrow operations instead of exposing MCP message plumbing to the UI. Avoid a general artifact framework or plug-in registry: this task has a small, fixed set of dedicated tool families.

## Synthesis decision

Independent candidate B favors role-scoped, in-process SDK MCP tools and a persisted artifact union. The decisive evidence is the installed SDK's runnable `createSdkMcpServer` example; a subprocess MCP layer would duplicate transport and configuration the dependency already provides. There is no cross-candidate synthesis in this artifact.

## Tradeoffs accepted

- We accept a small role-scoped MCP adapter and a pinned WASM runtime in exchange for actual tool calls and bounded generated JavaScript execution. Python stays limited to trusted domain calculations.
- We accept typed visualization specs alongside one sandboxed HTML escape hatch in exchange for keeping common artifacts inspectable and custom previews origin-isolated.
- We accept source-field-level calculation lineage and more precise claim citations in exchange for honest numeric provenance without weakening existing source quote validation.
- We accept that browser iframe sandboxing is defense in depth, not a hostile-code proof, and that old saved turns have unknown model identity.

## Alternatives considered

- A separate generic MCP subprocess can offer process isolation, but exposes command/config/process supervision and a second protocol owner while the installed SDK already provides an in-process typed MCP server. It adds infrastructure without useful isolation for the narrow reviewed calculation and artifact handlers.
- Keep tools disabled and have the model emit visualization JSON in its final structured response. This is smaller to wire, but it is not actual tool calling, has no tool-call/result lifecycle, and entangles an optional artifact with the validated turn schema.
- Let Droid `Execute` arbitrary Python/JavaScript and parse files it creates. This is broad capability with difficult filesystem/process containment and gives prose an ambiguous path to unverified data; the trusted calculation surface, no-host-callback WASM runner, typed records, and sandboxed browser previews constrain execution and provenance.

## Open questions and risks

- Does the configured Factory CLI version expose SDK MCP tools under stable IDs and honor the intended per-tool permission callback when session autonomy is `Off`? The SDK example shows the supported API, but this local setup has no credential-backed runtime probe in the repository evidence.
- Is mapping a source-authorized role to a sandboxed custom HTML preview an acceptable visible action without another user prompt? The backend should never fetch or execute remote preview resources.
- Which role-specific model IDs will operators configure? Until supplied, retain the single explicit model configuration and label its actual model honestly.

## Next implementation step

Build the role-scoped in-process MCP server and durable artifact store first, exercise a real SDK tool call against a chart and source-bound Python calculation, and only expose generated JavaScript execution after the QuickJS-WASM limits are verified.

## Grounding evidence

- `web/AGENTS.md:1-11` governs local Next docs and shared UI controls; no repository-root `AGENTS.md` exists.
- `web/src/lib/council-droid.ts:53-99, 110-165` validates role output and currently disables all listed tools before one structured result.
- `web/src/lib/council-types.ts:4-17` defines current role, evidence, claim, turn, job, and thread contracts.
- `web/src/lib/council.ts:13, 64-95, 129-152, 156-204` owns atomic saved jobs, thread reads, sequential role execution, snapshots, and idempotent request reservations.
- `web/src/components/business/CouncilPanel.tsx:25-61, 278-289` maps seats to shared illustrations and merges newly polled turn identities.
- `web/node_modules/@factory/droid-sdk/examples/node/sdk-mcp-tool.ts:11-57` is the installed SDK 0.10.0 runnable source for an in-process MCP tool and its real `ToolCall` stream event; `web/package.json` pins 0.10.0.
