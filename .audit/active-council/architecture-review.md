# Architecture cross-review

Verdict: use **A with the string-citation simplification**. Graft B's explicit configured-model fallback and source-input lineage, but do not adopt its separate artifact manifest/store or migrate claims to tagged citations. Both candidates describe supported SDK integration; neither has yet established real Droid discovery/permissions or the QuickJS worker boundary end to end.

| Rubric (1 weak, 5 strong) | A | B | Reason |
|---|---:|---:|---|
| Supported tool dispatch and fail-closed scope | 5 | 4 | Both use the shipped SDK MCP API; A distinguishes handler IDs from stream IDs and specifies rejecting mixed permission requests. B's read-only annotation wording risks treating persistence as read-only. |
| Single durable writer, reload, idempotency, legacy | 5 | 3 | A extends the existing atomic job writer. B introduces artifact records plus a manifest, requiring a multi-file crash protocol it does not specify. |
| Small understandable APIs and citation provenance | 4 | 3 | A's effect callback hides durable mutation. Both initially over-expand citation types; preserving sourceIds improves A further. B's context omits calculation evidence despite permitting calculation citations. |
| Achievable isolated computation/custom preview | 4 | 4 | Both choose trusted Python plus no-host-capability QuickJS and origin-isolated HTML. Worker packaging/limits still require execution evidence. A explicitly identifies preview CPU limitations. |
| Product completeness and verifiability | 5 | 4 | Both cover all requested visual kinds and truthful identity; A supplies durable visible activity and a clearer execution/verification path. B's proposed search provider is an unconfigured dependency. |
| Total | **23/25** | **18/25** | Architecture scores, not completion claims. |

## Grounded mechanism

`council.ts` already owns request reservation, the process owner map, sequential roles and atomic `job.json` replacement. `readCouncilThread` compares original source snapshots across rounds; appending new tool evidence into `job.sources` breaks that invariant. Keep optional `artifacts`, `toolCalls`, `toolEvidence` on each job and serialize every write, including session callbacks and turn/status saves, through the same owner. No second store is necessary for bounded artifacts. Candidate A's direct MCP transport probe is useful evidence, but I did not rerun it.

The installed `@factory/droid-sdk/examples/node/sdk-mcp-tool.ts:21-37` and `dist/node.d.ts:659,757` establish `createSdkMcpServer` and tool discovery as real supported APIs. The current `council-droid.ts` creates no MCP servers, cancels permission requests and disables all tools. Replace this with exact owned-tool discovery, disable everything else before any prompt, and permit only confirmed requests entirely within the owned server/tool set. Do not infer tool IDs from names, use annotations as authorization, or rely on prompts to forbid native shell access.

`CouncilClaim.sourceIds` and `validateCouncilClaims` already enforce membership plus exact quoted numeric excerpts. Retain that contract. A helper can derive supplementary `CouncilEvidence` from persisted research text and canonical computation results, then build a validation/prompt view combining immutable base sources, prior-round tool evidence and current committed tool evidence. Persist each executed result once; do not persist a second independently editable evidence copy. Use job-qualified IDs to prevent collisions, and resolve the same combined view in UI citation inspection. `CouncilHistoryRound` must carry the metadata necessary to derive earlier evidence; its current Pick excludes it.

A calculation establishes what the supplied program returned for its supplied inputs. It does not establish that model-selected inputs describe the company. Preserve engine, program, inputs, input evidence IDs, assumptions and warnings alongside the result. Derive result text from executed output, never from a model-authored quote. Display scenario status prominently in citations/artifacts whenever input lineage is incomplete; warnings alone buried in metadata are insufficient. Visual publication does not create independent factual evidence.

## Small grafts

- From B: retain `COUNCIL_MODEL_ID`/effort as explicit shared fallback; role-specific overrides are optional. Persist actual session settings, and display unknown identity for legacy turns.
- From B: make calculation input lineage inspectable. Avoid requiring exact machine-readable source fields where existing evidence is plain prose; unbound inputs remain clearly declared assumptions.
- From A: use one `publish_visual` union for built-in chart/table/flowchart/map and custom HTML; keep common renderers and custom iframe boundary separate internally. Use one finite role catalogue with distinct palette/avatar metadata.
- From A: public URL reader is an achievable initial research capability. Do not label it web search. A provider-backed search tool can be added only if an actual configured provider exists.

## Mandatory fixes before declaring complete

1. Exercise a real Droid turn invoking an owned tool with native tools disabled; observe actual model settings, persisted result and citation. Direct MCP HTTP success does not prove CLI discovery/permission behavior.
2. Route every job mutation through one serialized commit mechanism. A queue only around tool handlers can still race existing session/turn/status saves. Return tool IDs only after the corresponding result and success state have committed together.
3. On interruption, expose pending calls as interrupted without execution. Preserve request reservations, legacy request hashes and source snapshots; repeated POST/reload must not create another paid run.
4. Verify the actual deployed QuickJS worker rejects host globals/module access and bounds execution, allocation and serialized output. Runtime failure must fail closed, with no Node vm or arbitrary Python fallback.
5. Custom HTML must use an opaque-origin sandbox and host-first restrictive CSP, mounted on demand. Keep title, provenance and controls outside generated content. Do not claim hard CPU isolation for iframe scripts.
6. URL fetching must bind the validated public address to the actual connection, including every redirect; checking DNS then allowing a fresh uncontrolled resolution leaves a rebinding gap. Cap time/bytes/content and retain dated extracted text. Omit research if this cannot be implemented correctly.
7. Show distinct role palettes and actual model IDs in the working UI; show saved tool progress and all five visual kinds, including functional custom JS. A schema or tool name alone is not a demonstrated feature.

Read: candidate A and B end to end, `council.ts`, relevant `council-droid.ts` validation/session code, `council-types.ts`, and installed SDK declarations/example. No source edits, model sessions or runtime probes performed by this reviewer.
