# Active Council final review

Status: **PASS for reviewed source and durable execution contracts**. No remaining source blocker found. Integrated TypeScript, repaired live artifact interaction, replay, follow-up and reload observations are recorded. Root still owns new PR creation/attachment and its final audit row.

## Resolved findings

The failed-write rollback now restores `saved.job` fields in place (`web/src/lib/council.ts`, `commit`). Active role/tool closures retain the authoritative object, and the queue recovers after a failed operation. The earlier orphan-evidence path is closed by source inspection; no filesystem failure injection was run.

`validateCouncilClaims` now accepts known artifact IDs as discussion references while numerical support comes only from original/executed tool evidence. Exact cited evidence-ID tokens are not mistaken for numerical quantities. Inherited artifacts and tool evidence reach follow-up validation. The inspector labels generated output as discussion, not independent factual evidence. The formerly rejected Skeptic interaction is superseded by completed four-role run `151f984e-2a59-4142-94ad-9cb925b9878b`.

The renderer now normalizes chart values before subtraction, draws directed SVG flow graphs with textual paths, exposes research/calculation evidence IDs, distinguishes source-free illustrative output, and labels pending setup model identity as configured. These changes resolve the reviewed UI findings. Generated custom HTML remains separate from the host DOM.

The earlier security report's public IPv6 false-negative and poisoned commit queue findings are also fixed. `ipaddr.process(...).range()` classifies destinations, and the next commit recovers from an earlier rejection.

## Execution and recovery evidence

Read `.audit/active-council/live-public-job.json`: completed round one, four saved role outputs and five artifacts. Read `.audit/active-council/replay-result.json`: same ID, same session IDs, five artifacts, completed state. These establish a real completed dedicated-tool round and replay without another dispatch, rather than an illustrative fixture alone.

Read local public ledger for follow-up `2c991874-a49b-421d-9571-f03b5fd45252`: completed round two and all four saved `gpt-6-luna` turns. Its Chair artifact `R2C1` updates `r.textContent` from `Number(q.value) * price`. The parent diagnosed the first generated slider's incorrect assignment and explicitly requested this correction through the real UI. The root subsequently observed keyboard interaction changing quantity from 120 to 121 and displayed revenue from 3000 to 3025, recorded in `verification.md` and `browser-live-corrected-preview.png`. This reviewer checked the saved follow-up and recorded observation rather than independently repeating the browser interaction. Reload/reopen retained two completed rounds, nine artifacts and four saved model labels.

Every active mutation routes through the serialized owner and atomic snapshot replacement. Reservations retain request idempotency. Mount/poll performs GET and exact request identity survives retry. Restart recovery marks pending calls interrupted instead of executing them. Original source snapshots stay immutable; prior tool evidence and artifact metadata are included in follow-ups. The root's legacy read/hash check is documented in `verification.md`.

## Security and provenance review

Generated computation runs in QuickJS inside a bounded child process, with no host callbacks or module loader and host-side finite JSON checking. The worker captures its parser/serializer before generated execution. Python tools permit only the fixed trusted domain operations; arbitrary generated Python is outside the feature.

Public research validates HTTPS, credentials, port, public DNS classification and every redirect; the actual connection is pinned to the validated address. Deadline, content type/encoding and byte limits are present. This is URL reading, not provider-backed search. Research retains dated extracted text. Calculations retain inputs, code, assumptions, outputs and evidence lineage; a program result does not verify model-selected inputs. Numeric quote checks establish membership/literal support, not semantic truth.

Custom HTML uses an opaque `allow-scripts` iframe, host-first restrictive CSP and explicit open/reload controls. The parent response additionally sets `frame-src 'none'; object-src 'none'`. Root observed srcdoc rendering and interactive fixture behavior under that policy. **Self-navigation denial was not experimentally exercised**; the mitigation rests on source/specification reasoning. Iframe scripts do not have the computation worker's hard CPU isolation. Keep these limits explicit.

The current Council API retains the local development preview gate and same-origin POST check. This review does not establish production deployment suitability or authorize deployment.

## Decision-trail audit

Coverage: supplied task/session digests plus repository artifacts, not the unavailable full chat transcript. Read `run-digest.md`, `verification.md`, `workflow.md`, `decisions.tsv`, architecture candidates/selected design/cross-review, security report, Figma report and the public rejected Finance output. Read all tracked source diffs plus the new worker, SDK probe, tool implementation, URL reader and artifact renderer. Ran only the existing read-only public-result validator during the first pass; no paid model calls, tests, source edits or commits.

The audit coherently records the user's product choices, competing architectures, dedicated-tool permissions, actual runtime failures and resulting corrections. Public rejected output directly supports the UUID-copying and discussion-reference diagnoses; completed public job and replay artifacts now substantiate the final runtime path. Figma report documents native editable layers and the original-file access limitation.

Earlier decision rows link probe source/input rather than captured stdout/error, but `verification.md` now records concrete public outputs and scopes observations. This is sufficient as a session record, not an independent rerun. Appended decision rows now record successful four-role/follow-up execution, discussion references, removal of the wording gate, replay/reload/legacy verification, TypeScript and existing tests, and the production-build limitation. They reconcile the earlier chronological in-progress entries without rewriting history. Honest unfinished entries were not treated as fabricated evidence. The PR creation/attachment row remains the root's final handoff step.

## Handoff attention

- Production build is unverified: `pnpm build` stopped in the existing Payload/Figma environment configuration because `FIGMA_EID` was missing, before Next compilation. Integrated `tsc` passed; 32 existing scene-math tests passed, but they do not cover Council tools.
- Self-navigation denial was not experimentally exercised; iframe CPU isolation is not claimed.
- Feature scope remains local preview, public URL reading and fixed trusted Python operations; generated computation is JavaScript in QuickJS.
- Root must create/attach the requested PR and record the resulting URL. The current verification sentence referring to the last PR row is forward-looking until that row exists.

