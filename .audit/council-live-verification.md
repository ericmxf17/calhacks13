# Live council verification

The user authorized a real frontend run using the cheapest available Droid
model and its lowest supported reasoning setting. Vercel deployment is a
separate, unverified path. This run uses the Harbor Goods illustrative company
profile, not independently verified commercial evidence.

## Model and runtime

The authenticated SDK catalog returned GPT-6 Luna and Haiku 5.5 tied at the
lowest listed multiplier, 0.04. Haiku was tried with reasoning `off`; subsequent
trials use GPT-6 Luna with reasoning `none`. These are account catalog values,
not a dollar estimate. The runner checks actual session settings before sending
any prompt. Missing model or reasoning configuration fails without a default.

The key is held in ignored `web/.env`. It was never printed or committed.

## Diagnosed failures

- The isolated child exited at startup because an empty `SHELL` prevented
  Droid's nullish fallback. A direct child-process probe captured the shell
  resolution error. `council-environment.mjs` now shares the corrected isolated
  environment between the runtime and model-discovery command.
- Haiku emitted numerical claims without supporting literal quotations. Its
  rejection remains correct under the current validator.
- GPT replies used the internal citation label `S0` in claims and summaries.
  The old digit checks treated that identifier as a numerical statement.
  Known source IDs are now excluded by exact token identity. Unknown IDs and
  other numbers retain their original evidence requirements.
- Exact copying of a prior claim or summary rejected valid attributed replies
  that paraphrased a prior position. The role already receives that complete
  saved position. The contract now requires an attributed, cited response;
  semantic engagement must be inspected rather than inferred from copying.

## Debugging tools

`web/scripts/council-models.mjs` lists account models without generation and
collects redacted SDK startup diagnostics on failure.

`web/scripts/council-validate.mjs` loads the actual production validator and
checks the recorded public assistant JSON for a saved rejected role. It does
not read thinking blocks, start a model, revise a job or resume execution.
Offline inspection accepts the citation-label and paraphrase cases while the
unsupported numeric response remains rejected.

`web/scripts/council.mjs trace <job-uuid>` reads lifecycle events saved next to
the job. The server emits the same events. They identify model settings,
startup, tool disabling, structured result receipt, validation and closure,
without storing prompts, provider error bodies, credentials or private thought.

## Completion checks

- [x] Real key configuration and authenticated model discovery.
- [x] Startup error reproduced and fixed.
- [x] Offline validation of the actual rejected public outputs.
- [x] TypeScript check after the runtime and validator changes.
- [x] Complete real Finance, Operations, Skeptic and Chair through the UI.
- [x] Inspect the actual discussion, decision and citation source.
- [x] Refresh recovery without a new job or additional model sessions.
- [x] Record final outcome and remaining deployment limitations.

## Observed successful run

Job `94ef87a3-4149-40d6-bc2f-2548e6c0e081` completed four real SDK sessions.
Every `session_ready` trace reports `gpt-6-luna` and reasoning `none`, matching
the pinned settings. Every role disabled the available tools, received a
structured result and passed validation. All sessions closed.

The frontend shows all four public turns and the Chair's structured decision.
Operations addresses Finance's missing-evidence point; Skeptic explains that
candidate-product costs alone would not settle the choice without demand and
current-product performance evidence; Chair carries that distinction into the
decision. The result explicitly uses `insufficient_evidence` and asks for
comparative evidence before choosing expansion or improvement.

Clicking the decision's source button opened the actual saved `S0` profile,
including its user-supplied, illustrative status. A browser refresh and reentry
into Consul recovered the completed discussion. Job identity, session IDs,
updated timestamp, trace-event count and job-directory count were unchanged.
No new generation occurred during recovery.

The screenshot is saved as `council-live-completed.png` in this chat's local
visualization folder. It contains real model output over illustrative company
data. No evidence from a CREAO run was selected for this first low-cost trial.

## Remaining scope

- A live follow-up round and a live run over selected CREAO artifacts have not
  been exercised. The prior HTTP rejection and history-read checks still stand.
- Vercel CLI is installed and authenticated, but the repository is not linked
  to a Vercel project. No hosted build or deployment has been verified.
- The current API is deliberately development-only and loopback-only. Hosted
  authentication, durable execution and storage still require deployment work.
