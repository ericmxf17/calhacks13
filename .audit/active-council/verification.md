# Active Council verification

These observations come from the implementation session on 2026-10-25. This
file records real executions. Illustrative UI fixtures are not live model results.

## Existing tests and types

`cd web; node --test "tests/*.test.mjs"` completed with 32 passing tests and no
failures. These existing tests cover scene math. They do not cover Council tools.
The backend and UI implementers ran the full TypeScript compiler successfully.
The root also ran `node node_modules/typescript/bin/tsc --noEmit --pretty false
--incremental false` successfully on the integrated changes.

`pnpm build` failed while loading the existing Payload/Figma configuration.
It requires `FIGMA_EID` or an initialized backend environment. No environment
identifier was invented. Production build output remains unverified.

## Tool transport

`cd web; node scripts/council-sdk-probe.mjs --call` invoked the real sum handler
through Droid and returned `{"sum":42}`. After disabling other tool IDs, the CLI
reported the custom tool and its internal ToolSearch metadata command as allowed.
Shell, file, browser, and other native execution tools were disabled.

The native CLI truncated a long MCP server name. The first full submission
failed closed before sending a prompt. Short per-role server names fix this.

## Generated computation

The root invoked `scripts/council-compute-worker.mjs` directly with JSON stdin.
Its actual outputs were:

```json
{"ok":true,"result":{"total":3000,"process":"undefined","fetch":"undefined","require":"undefined","clock":"undefined"}}
{"ok":false,"error":"Calculation returned a nonfinite number"}
{"ok":false,"error":"interrupted"}
```

The inputs were price 25 and units 120. The other programs returned Infinity
and ran an infinite loop. No host capabilities or generated Python were supplied.

## Browser

The root used the real Council UI at `http://localhost:3001/demo/harbor-goods`.
It displayed `gpt-6-luna` from the setup response before submission. Submitted
job `c4947645-51da-400a-8e25-08cc063085cb` executed a QuickJS calculation, bar
chart, and Operations flowchart. Finance and Operations produced validated saved
turns. Skeptic was rejected for referencing the saved flow as discussion. That
failure led to separate discussion references and numerical support validation.

The illustrative gallery at `/demo/council` rendered bar and line charts, a
table, a flow, a map, and custom HTML. Its quantity slider changed from 30 and
$360 to 56 and $672. This establishes functional generated JavaScript in the
preview, not factual business results.

At a 390 by 844 viewport, the root measured `innerWidth=390`, page scroll width
390, six artifact cards, and one open iframe. The top-level page did not overflow.
The viewport override was reset afterward.

The frontend response returned `Content-Security-Policy: frame-src 'none';
object-src 'none'`. The srcdoc preview still loaded under this policy. Iframe
self-navigation was not attempted. The security reviewer established the
parent policy's navigation protection from the CSP specification. The browser
safety gate rejected that reviewer's data-URL experiment, so that experiment
was not repeated through another URL scheme.

## Legacy saved rounds

The root copied completed legacy job `94ef87a3-4149-40d6-bc2f-2548e6c0e081`
into the new worktree's local ledger. Reading its thread returned completed
status and four turns. The job file SHA-256 stayed unchanged. Opening legacy
data did not dispatch sessions or fabricate model metadata.

## Final live execution and recovery

Job `151f984e-2a59-4142-94ad-9cb925b9878b` completed all four roles through the
real browser UI. `live-public-job.json` contains its returned public state.
It has five saved artifacts. A repeated POST returned the same job and session
IDs, recorded in `replay-result.json`.

The first model-generated slider assigned `.value` to a strong element. The
root observed that changing quantity changed its label but left revenue stale.
The root sent this observation as a real follow-up rather than editing the
saved output. Follow-up `2c991874-a49b-421d-9571-f03b5fd45252` completed all
four roles with inherited `R1F1` evidence and four corrected HTML artifacts.
`live-public-thread.json` and `followup-result.json` contain the returned state.

The root opened Chair artifact `R2C1` and moved its quantity slider by keyboard.
Quantity changed from 120 to 121 and displayed revenue changed from 3000 to
3025. `browser-live-corrected-preview.png` records the observed result.

After a page reload and reopening Council, the browser reported two completed
rounds, nine artifact cards and four recorded `gpt-6-luna` seat labels. Reads did
not rerun sessions. The temporary desktop viewport override was reset.

The independent final reviewer reported PASS with no remaining source blockers.
Its source review and scoped audit limits are in `final-review.md`.

PR creation and attachment are recorded in the last decision-log row.

## Further checks

| Component | File exercised | Behavior | Method |
| --- | --- | --- | --- |
| Council runtime | `web/src/lib/council-droid.ts` | Real dedicated tool dispatch and cited output | Completed live UI round and follow-up. |
| Recovery | `web/src/lib/council.ts` | Replay and reload preserve identity | Same-session replay and browser reload completed. |
| Visual rendering | `web/src/components/business/CouncilArtifact.tsx` | Responsive cards and interactive custom output | Gallery, 390px layout, and corrected live slider checked. |
| Preview navigation | `web/next.config.ts` | Deny iframe self-navigation | Source/spec review only. A permitted browser exercise remains proposed. |
| Production build | `web/src/payload.config.ts` | Resolve backend environment and compile output | Rerun after the owner supplies the real Figma backend configuration. |
