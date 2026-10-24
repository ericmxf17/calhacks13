# Agent execution backend

The Next.js server owns local jobs and calls CREAO to execute agents. Python
owns forecast, impact, and numeric brief verification. The dashboard and
Payload configuration are unchanged.

## Configure agents

Keep secrets in the ignored `web/.env`. Each agent needs its own `capi_` key
from its agent page. A key for Test Agent does not authorize Bill Analyst.
The [CREAO API Paths reference](https://docs.creao.ai/developer-api/api-paths)
documents the scoped API and its separate Developer Console API.

| Role | Agent ID variable | API key variable |
|---|---|---|
| `test-agent` | `CREAO_TEST_AGENT_ID` | `CREAO_TEST_AGENT_API_KEY` |
| `bill-analyst` | `CREAO_BILL_ANALYST_ID` | `CREAO_BILL_ANALYST_API_KEY` |
| `researcher` | `CREAO_RESEARCHER_ID` | `CREAO_RESEARCHER_API_KEY` |
| `impact-planner` | `CREAO_IMPACT_PLANNER_ID` | `CREAO_IMPACT_PLANNER_API_KEY` |
| `brief-writer` | `CREAO_BRIEF_WRITER_ID` | `CREAO_BRIEF_WRITER_API_KEY` |
| `scene-designer` | `CREAO_SCENE_DESIGNER_ID` | `CREAO_SCENE_DESIGNER_API_KEY` |

`BACKEND_API_TOKEN` is a separate secret for local backend callers. Never give
frontend JavaScript a CREAO key or the backend token. Browser access still
needs the existing Payload authentication integration. These endpoints serve
trusted tools and server callers.

An agent reported as configured has local credentials. That does not prove the
key is accepted or has the right scope. The connection check contacts CREAO.

## Use the CLI

Run commands from `web/` with `pnpm dev` running in another terminal.
The CLI loads `.env` and sends `BACKEND_API_TOKEN` to the local server.

```powershell
pnpm backend health
pnpm backend calculation-health
pnpm backend agents
pnpm backend connection test-agent
pnpm backend history test-agent
pnpm backend jobs
```

`history` reads CREAO API execution records. It does not import older chat
sessions shown on the agent website. Our live probe found an API-created run
in this list while a pre-existing website session remained absent.

Create a request file with one stable `requestId`.

```powershell
$request = @{
    requestId = [guid]::NewGuid().ToString()
    agent = 'test-agent'
    inputs = @{
        topic = 'Summarize the supplied company information'
        depth = 'summary'
    }
}
$request | ConvertTo-Json -Depth 100 | Set-Content "$env:TEMP/consul-job.json"
pnpm backend submit "$env:TEMP/consul-job.json"
```

Submission starts an agent and can consume credits. Use input fields defined
by that agent. The backend validates a JSON object but does not invent the
agent's input schema.

```powershell
pnpm backend job YOUR_REQUEST_ID
pnpm backend refresh YOUR_REQUEST_ID
```

The same request ID and contents return the existing local job. Reusing the
ID with different contents returns a conflict. Replaying a request never sends
a second execution request to CREAO.

## Job lifecycle

A job saves its inputs and `dispatching` state before contacting CREAO. After
acceptance it stores the remote run ID and observed state. `refresh` reads
that run and saves current output. No background worker polls or dispatches.

A timeout, network failure, invalid acceptance response, or server error can
leave `dispatch_unknown`. CREAO might already have started the run. A process
crash can also leave `dispatching`. Neither state is retried automatically.
Inspect CREAO before deliberately creating a different request. A job without
a saved remote run ID cannot be refreshed automatically.

A rejected request is distinct from a failed agent execution. A failed refresh
keeps the last known execution state and records a separate refresh error.
Terminal jobs retain their results.

## HTTP reference

Paths start with `/api/backend`. All except health require
`Authorization: Bearer <BACKEND_API_TOKEN>`. Responses disable caching.

| Method | Path | Behavior |
|---|---|---|
| GET | `/health` | HTTP server liveness. No remote run. |
| GET | `/agents` | Local registry with credential readiness. |
| GET | `/connection?agent=test-agent` | Read-only CREAO access check. |
| GET | `/agents/{role}/runs` | CREAO API history for that agent. |
| POST | `/jobs` | `requestId`, `agent`, `inputs`, optional `threadId`. |
| GET | `/jobs` | Local jobs with pagination. |
| GET | `/jobs/{id}` | Saved record. Does not contact CREAO. |
| POST | `/jobs/{id}/refresh` | Read CREAO and update the saved record. |
| POST | `/calculations/forecast` | `analysis`, optional `research`. |
| POST | `/calculations/impact` | `analysis`, `company`, `plan`, optional `research`. |
| POST | `/calculations/verify-brief` | Impact input plus `brief`. |
| POST | `/calculations/health` | Installed Python and supported operations. |

The CLI exposes `forecast FILE`, `impact FILE`, and `verify-brief FILE`.
Full input examples are `agents/hr973-expected-output.json`, `company.json`,
`tests/hr973-impact-plan.json`, and `tests/hr973-brief.json`. The shorter
onboarding form is not a complete company input for these calculations.
Brief verification checks numeric traceability, not the truth of prose claims.

## Storage and deployment limits

Local jobs live in ignored `web/.backend/jobs`. They contain inputs and outputs
but no credentials. Keep that directory private and back it up if records
matter. `BACKEND_DATA_DIR` selects another persistent directory.

This store supports one running backend process on one machine. Atomic file
replacement prevents partial JSON reads. Refreshes serialize within that
process. It is not a distributed queue or a multi-user database. It does not
guarantee durability against power loss. Hosted deployment needs persistent
storage and authenticated user ownership before browser users access jobs.

Payload was considered as the job store. It requires the missing Figma
configuration. Independent design reviews agreed that local files keep
execution usable without changing that integration. Request IDs prevent a
lost HTTP response from starting another billed execution on caller retry.

Python defaults to the installed `python` command. `PYTHON_BINARY` can select
another existing interpreter. `BACKEND_REPO_ROOT` defaults to the parent of
`web/`. Deployment must include Python, calculation scripts, and model files.
`BACKEND_URL` selects the CLI server and defaults to `http://localhost:3000`.

The bill agents need their own credentials before an automatic bill pipeline
can run. Artifact download, webhooks, automatic stage chaining, and dashboard
job controls are not implemented here.

## Verification

The live HTTP API completed Test Agent job `2ab86752-77a5-4e7d-8ea3-f7b1df996d12`
with remote run ID `788b2a71-823b-4946-801a-b70a2a563b96`. Two concurrent
replays returned that same run ID. CREAO history contained one execution for
this submission. The saved JSON file contained the output and no API key.

| Component | Observed through the live interface |
|---|---|
| Jobs | Submitted, refreshed to completion, read back from disk and HTTP. |
| Replay | Same request returned the existing run. Changed inputs returned HTTP 409. |
| Access | Missing token returned HTTP 401. Invalid UUID returned HTTP 400. |
| Readiness | Bill Analyst job was rejected locally for missing credentials. |
| Calculations | Brief fixture returned HTTP 200, `valid: true`, no problems. |
| TypeScript | `pnpm exec tsc --noEmit` passed. |

Independent review found no blocking gaps. Process-crash recovery, ambiguous
network dispatch, storage failure, and failed-refresh paths were inspected in
code but were not fault-injected. No test suite was added or run.

## Browser run dialog

Selecting an agent in the Agents grid opens a modal with CREAO API history,
run status, timestamps, returned output, and artifacts. Opening or refreshing
this view never starts an agent. Placeholders and agents without credentials
have explicit informational states.

This local demo uses an opted-in API at `/api/agent-runs`. Set
`ENABLE_LOCAL_AGENT_PREVIEW=true` in `web/.env`. The `dev` command binds to
`127.0.0.1` so the preview is not exposed on the network. The API also requires
development mode, a loopback Host, and same-origin browser requests. Production
access is closed until authenticated user ownership is implemented. Keep the
existing bearer-protected `/api/backend` API for trusted server callers.

| GET path | Result |
|---|---|
| `/api/agent-runs/agents` | Agent roles and verified connection state. Reads one history page per configured agent; never starts runs. |
| `/api/agent-runs/{role}` | Paginated history and connection state. |
| `/api/agent-runs/{role}/{runId}` | Selected run information and artifact metadata. |
| `/api/agent-runs/{role}/{runId}/artifacts/{index}` | Authenticated file download. |
| Same artifact path with `?preview=1` | Safe text preview, limited to 256 KiB. |
| `/api/agent-runs/brief-writer/example` | Labelled fictional VoltRide / H.R. 973 analysis pack from repository fixtures. |
| `/api/agent-runs/brief-writer/jobs/{requestId}` | Saved Brief Writer job and refreshed provider status; never dispatches another run. |

Brief Writer also has `POST /api/agent-runs/brief-writer/jobs`. The body is
`{ "requestId": "UUID", "briefInputs": { ... } }`. The pack must contain
non-empty `names`, `bill`, `forecast`, `research`, `plan`, and `impact_results`
objects, and serialize to at most 240 KiB. The server passes it as the deployed
agent's single text input, `inputs.brief_inputs`. The browser POST requires
JSON, an explicit same-origin Origin, and `Sec-Fetch-Site: same-origin`, as
well as the existing development/loopback/opt-in gate.

In Brief Writer's dialog, choose **Run Brief Writer**, paste an analysis pack
or load **Use VoltRide example**, and choose **Run brief**. That last button
starts a run and consumes CREAO credits. The browser stores only the request
ID in local storage before submission. The existing job ledger reserves that
ID before dispatch, so repeated submissions of the same request cannot bill a
second run. Reusing an ID with different inputs is rejected. The dialog polls
saved status every four seconds, selects the submitted run, and refreshes its
output and artifacts when the status changes. Closing and reopening the
dialog recovers the same saved request without submitting it again. Ambiguous
dispatches and refresh failures require an explicit status check; there is no
automatic execution retry. Completed or definitively rejected requests allow
**Write another brief** to reserve a new ID for a new deliberate submission.

The browser receives no CREAO key, backend bearer token, or signed storage URL.
The grid and server share `web/src/lib/agent-catalog.ts`, including Brief Writer.
Each card shows `Connected` only after CREAO accepts a read with its own scoped
key. Missing credentials show `Needs setup`; rejected keys or service failures
show `Connection unavailable`. Refresh connections repeats these reads. An
agent can be connected with no API runs yet. Opening it shows an empty history;
older website chat sessions are not imported by this API.

The server resolves artifacts from the selected authenticated run. It sends the
key only to CREAO and follows the verified storage redirect without credentials.
Downloads use attachment disposition. Markdown, JSON, and text previews render
as escaped text. Generated HTML is not executed inside the application.

During initial read-only verification, Bill Analyst, Bill Researcher, Bill Impact
Planner, Brief Writer, and Test Agent all passed scoped history reads. The four production agents returned empty
API histories. Test Agent returned two existing runs; the older run returned a
Markdown acknowledgement. Its preview and download both succeeded.
Cross-site and non-local Host requests returned HTTP 403.
The popup was checked on desktop and phone, including Escape, focus return,
and the unconfigured-agent state. No new CREAO executions were needed.

The Brief Writer launch flow was subsequently exercised through the frontend
with one labelled VoltRide example. Job `53ef855e-eaf3-441d-b4df-ec93a7ada513`
created CREAO run `e36cb8c0-2f57-4f47-956e-c325269f54ac`, which completed and
returned one `brief.json` artifact. Preview and attachment download both
succeeded, and the downloaded file parsed as JSON. Replaying the same saved
request returned the same run ID; closing and reopening the dialog recovered
the completed job. Malformed input and cross-site submission were rejected
before dispatch. No additional agent executions were needed for these checks.

The popup layout is recorded in the
[editable Figma design](https://www.figma.com/design/mD2dLj2EvZDrdfv6wpAfLK?node-id=1-2).

## Consul council

The local council runs four actual Factory SDK sessions in order: Finance,
Operations responding to Finance, Skeptic responding to Operations, and Chair
responding to Skeptic. The Chair publishes a cited decision only after all four
complete and pass output validation. Opening the council, reading a saved job,
and discovering sources never start a Droid session.

Set `FACTORY_API_KEY` in `web/.env` and install the official Factory CLI. On
Windows, set `DROID_EXECUTABLE` to the absolute native `droid.exe` path, rather
than a shell shim. Restart the local server after changing environment values.
`GET /api/council?view=setup` checks local configuration and executable presence;
it does not verify a paid remote request or claim the credentials are valid.
The existing development-only `ENABLE_LOCAL_AGENT_PREVIEW=true` loopback gate
applies to every endpoint. POST also requires the application's explicit Origin,
`Sec-Fetch-Site: same-origin`, and JSON content type.

Source discovery uses existing app-scoped CREAO API Trigger credentials only,
never an account credential. Choose an agent and page through completed API run
conversations and text artifacts. Website chat sessions are not included. The
server re-fetches each selected run, checks artifact membership, downloads only
the selected known artifact, and snapshots its UTF-8 text. Client source text and
download URLs are never used. Source bounds are eight selections, 128 KiB per
source and 512 KiB total; the request body limit is 1 MiB. Explicit assignment to
the active company is required. A structured conflicting company identity is
rejected; unidentified general bill analysis remains visibly unidentified.

`S0` is the full current company profile. With no selected run evidence, the
council may discuss that profile but cannot establish bill impact. The optional
saved sample is restricted to VoltRide at `voltride.example`. It loads the
coherent `tests/agent1-hr973.json`, `agent2-hr973.json`, `agent3-hr973.json`,
`agent3-hr973-results.json`, and `agent4-hr973-brief.json` fixtures. These are
fictional saved analyses, not a live or latest legislative update.

Each session uses an empty isolated temporary working directory and isolated
Factory home, a replacement role prompt, no configured MCP servers, disabled
builtin skills, autonomy Off, cancelled permissions and cancelled user prompts.
The SDK's complete available tool list is disabled before the first message.
Inherited environment values are shadowed with empty strings, restoring only OS
plumbing and the Factory API key. CREAO, Figma and backend credentials are not
passed to the child. Only complete structured results are saved; partial text,
private reasoning and provider error bodies are not exposed.

Output is checked against the JSON contract at runtime. Every claim needs known
source IDs; numeric statements additionally need literal supporting excerpts
from a cited source. Later roles must include an inspectable response to a prior
claim. These checks establish shape, citation membership and excerpt presence,
not semantic truth or current legislative status. The UI exposes saved source
text so the user can assess the actual reasoning and evidence.

Council jobs live in `web/.backend/council/<UUID>/job.json` by default; override
with `COUNCIL_DATA_DIR`. A UUID directory is reserved before provider work, and
state is published by atomic rename. Repeating the same normalized request ID
and payload returns the same job; changing the payload returns HTTP 409. Keep a
saved request's UUID after timeouts or unknown outcomes. Completed turns and
session IDs survive a later failure. This is a local ledger, not a durable
worker: after process restart, reading unfinished work marks it interrupted and
never resumes or reruns a potentially executed turn. Inspect it before
intentionally starting a new council with a new UUID.

Follow-ups are new rounds linked with `previousJobId`. The server reads prior
questions, public turns and decisions from its own ledger, then sends them to
each role alongside the current question and current round's turns. Client
transcripts are never trusted as history. The parent must be completed and its
full validated company profile must match exactly. Each child inherits the
root's frozen evidence text, provenance and source IDs; send `sources: []` for
follow-ups. New evidence or an edited company starts a new thread, so an old
`S1` citation can never point to newly selected text. Saved excerpts remain the
record even if their original download URL changes.

Threads allow four rounds, at most 256 KiB of serialized prior public history,
and at most 2 MiB for each exact serialized role message. Exceeding a limit
fails explicitly without dropping history or retrying paid work. Every round
has its own stable request UUID, saved before POST. Replaying an accepted UUID
recovers its job before rechecking new-submission parent eligibility. Legacy
jobs read as first rounds without changing their original request hashes.
`GET /api/council?view=thread&jobId=<leaf UUID>` returns its root-to-leaf branch;
reads never execute work. Different deliberate children of one completed
parent form separate branches, rather than a globally serialized chat head.

From `web`, use the real local API with:

```sh
node scripts/council.mjs setup
node scripts/council.mjs sources brief-writer 0
node scripts/council.mjs submit saved-council-request.json
node scripts/council.mjs inspect <job-uuid>
node scripts/council.mjs read <job-uuid>
node scripts/council.mjs thread <leaf-job-uuid>
```

Set `COUNCIL_URL` for another local port. `submit` reads a request containing
`requestId` (stable UUID), `business` (the complete BusinessInput), `question`,
`assignToCompany: true`, and `sources`. Source references are
`{kind:"conversation",role,runId}`, `{kind:"artifact",role,runId,index}`, or
`{kind:"sample",id:"voltride-hr973"}`. An empty sources array is allowed for a
clearly limited profile-only council. `read` includes the saved source text,
complete turns, citations and decision; `inspect` omits source bodies.
