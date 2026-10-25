# Active Council architecture

## Decision

Use candidate A as the base. Keep one existing ledger writer and the real SDK in-process MCP tool server. Keep string sourceIds for saved claims. Add immutable tool evidence, activity, and artifacts as optional fields for legacy compatibility. Supplementary evidence uses unique IDs and carries computation or research provenance. Never modify the initial source snapshots.

## Data contracts

CouncilJob gets optional artifacts: CouncilArtifact[], toolCalls: CouncilToolCall[], toolEvidence: CouncilEvidence[], speakers: Partial<Record<CouncilRole, CouncilModel>>.
CouncilTurn gets optional modelId and reasoningEffort recorded from the actual session.
CouncilHistoryRound includes artifacts and toolEvidence. It need not send custom HTML bodies back to the model.
CouncilSetup gets optional members with role, modelId, reasoningEffort, plus capabilities. Existing roles remains the CREAO source catalogue.
CouncilModel is modelId: string and reasoningEffort: string.
CouncilToolCall is id, role, name, title, status (running/completed/failed/interrupted), startedAt, optional completedAt, artifactIds, optional error.
CouncilArtifact is id, role, title, createdAt, sourceIds, illustrative, assumptions, plus one discriminated payload.
Payload kinds are chart, table, flowchart, map, html, calculation, research.
Chart is chartType bar/line, labels string[], series {label, values number[]}[], optional unit.
Table is columns string[], rows (string|number|null)[][].
Flowchart is nodes {id,label}[], edges {from,to,label?}[].
Map is markers {label,latitude,longitude}[] on a bundled local geographic grid. No tiles or geocoding.
HTML is html: string. The generated document never enters the parent DOM. Preview opens explicitly.
Calculation is engine python/quickjs, input JSON object, code string, result JSON value.
Research is url, text, retrievedAt.
Keep optional fields only where legacy data requires them. Prefer one exported CouncilArtifact type over framework types in client modules.

## Tool contract

Dedicated tools are publish_visual, calculate_policy, calculate_javascript, research_url. All tool handlers validate bounded arguments. The SDK transport is a role-scoped in-process server. Disable every other discovered tool. Permit only verified tools from that server.

The orchestrator owns persistence and serializes tool commits. Save running activity before work and completed activity, artifact, and supplementary evidence before returning. Tool IDs come from the host, not provider events.

Calculator results are derived evidence, not independently verified facts. Persist exact inputs, code, assumptions, engine, results, and input evidence IDs. Require nonempty assumptions for hypothetical inputs. Visuals must link known evidence or explicitly say illustrative. Retain exact-quote numeric validation against original or tool-generated evidence.

Use trusted backend/worker.py for fixed policy calculations. Generated JavaScript runs in QuickJS WebAssembly with no host capabilities and bounded execution/memory/output. No arbitrary Python source execution.

Read-only web research fetches bounded public HTTPS URLs. Validate DNS and redirects, block private destinations, pin the validated address, cap time/content/size. No fake search provider or native unrestricted browser tool.

## UI

Follow editable Figma design aXEIyZZIeUK4mSZq4Fb4MJ. Keep cream/navy source tokens and shared Button. Council uses violet #6750A4 and teal #087F8C. CREAO avatar assets remain untouched. Render model metadata honestly, including unknown for legacy turns. Show activity and inline artifacts for each role even before its final response arrives. Inspector includes tool evidence and citation links. Render charts, tables, flows and maps as first-party accessible views. Custom HTML uses opaque-origin iframe sandbox allow-scripts with host-prepended CSP, no network or parent bridge, explicit open/close.

## Verification

Direct MCP protocol grounding succeeded. A real Droid session invoked the dedicated sum handler and returned 42. The full UI round and follow-up completed with saved tools and artifact output. QuickJS probes returned computed values, unavailable host globals and interruption of an infinite loop. The root verified the corrected custom slider, legacy reads, POST replay and reload recovery. See verification.md for the actual outputs and remaining build/browser limitations.

Model-facing artifact/evidence references use short round, seat and invocation IDs such as R1F1. Host activity IDs remain UUIDs. Known generated artifacts can identify discussion, but only original or executed tool evidence supports numerical quotes. This distinction followed a real rejected qualitative response about a saved diagram. No exact wording prefix is required to respond to earlier roles.
