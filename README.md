# Consul

Consul turns federal policy evidence into a business decision. It combines a company workspace, a bill-analysis pipeline, and a council of AI advisers that debate the evidence before a Chair recommends an action.

[Open the live demo](https://consul-calhacks13.vercel.app) to explore VoltRide, a fictional e-bike company facing battery-policy decisions. The public deployment opens the saved workspace without signup. It serves recorded results; reading a page does not start a paid agent run.

## Explore the demo

- `/` opens the VoltRide workspace, its interactive 3D building, and business departments.
- `/demo` lists the available company examples.
- `/demo/voltride` opens VoltRide directly.


Open **Consul** in a workspace to inspect the saved debate, decision, and cited evidence. Open the agent cards to read archived CREAO conversations and download their artifacts. The public agent API serves the reviewed dataset in [`web/src/demo-data/agent-evidence.json`](web/src/demo-data/agent-evidence.json), never the provider's full account history.

The demo separates example inputs from actual execution. Company profiles, supplier assumptions, and some department figures are fictional samples. Other workspace figures derive from the entered company setup. The archive includes six completed CREAO runs with thirteen artifacts, plus saved responses from actual Factory Droid sessions. Model-generated output is still a claim to inspect, even when its execution is real. Saved examples do not establish current legislative status.

## Bill analysis architecture

The pipeline divides language work from calculation. CREAO agents extract requirements, research context, propose company strategies, and write a brief. Python calculates passage probabilities and the financial effects of each strategy.

```mermaid
flowchart TD
    Bill["Federal bill and company profile"] --> Analyst["CREAO: Bill Analyst"]
    Analyst --> Researcher["CREAO: Bill Researcher"]
    Researcher --> Forecast["Python: forecast/forecast.py"]
    Forecast --> Planner["CREAO: Impact Planner"]
    Planner --> Impact["Python: impact/impact.py"]
    Impact --> Writer["CREAO: Brief Writer"]
    Writer --> Verify["Python: impact/verify_brief.py"]
    Verify --> Brief["Saved brief, scenarios, and calculations"]
    Company["company.json"] --> Planner
    Company --> Impact
    Model["Historical bill-status model"] --> Forecast
```

[`backend/pipeline.py`](backend/pipeline.py) runs this chain and saves each stage. The brief verifier checks numerical support against the supplied analysis and calculation outputs. It does not verify the truth of the original sources or the completeness of an agent's interpretation.

The forecast model uses bill-status snapshots from the 117th and 118th Congresses, covering 31,268 House and Senate bills and 627 enactments. It learns separate models for three legislative stages and uses a fixed estimate after both chambers pass a bill. Signals include time remaining, cosponsors, party control, and companion bills. Historical performance does not establish calibration for every future Congress. Text enacted inside another bill also falls outside the model's bill-level success label.

The impact calculator compares annual profit changes, one-time costs, supplier capacity, certification timing, and readiness across scenarios. Its expected value depends on the forecast and the company's assumptions. It treats products as unsellable while required fixes remain incomplete and omits costs before the rule applies. These are scenario calculations, not verified company accounts.

## Council, persistence, and deployment

The Council asks four Factory Droid sessions to speak in order. Finance develops a position, Operations responds, Skeptic challenges the preceding positions, and Chair publishes a cited decision. Each later role receives the earlier public responses. The optional CREAO Scene Designer produces the workspace's building design independently of this debate.

```mermaid
flowchart TD
    Browser["Browser: company workspace and reviewed evidence"] --> Web["Next.js server on Vercel"]
    Web --> Curated["Read-only reviewed CREAO archive"]
    Web --> Archive["Private SpacetimeDB snapshots"]
    Web -->|"Signed owner and authenticated worker request"| Sandbox["Persistent Vercel Sandbox"]
    subgraph Runner["Linux Sandbox: Node.js 24, Python 3.14, Factory Droid 0.249.0"]
        Sources["Company profile and selected CREAO evidence"] --> Finance["Droid: Finance"]
        Finance --> Operations["Droid: Operations"]
        Operations --> Skeptic["Droid: Skeptic"]
        Skeptic --> Chair["Droid: Chair"]
        Tools["Restricted calculation, URL research, and visual tools"] --- Finance
        Tools --- Operations
        Tools --- Skeptic
        Tools --- Chair
        Chair --> Ledger["Sandbox job ledger and source snapshots"]
    end
    Sandbox --> Runner
    Ledger -->|"Publisher saves ordered snapshots"| Archive
    Archive -->|"Saved results through server"| Web
```

The SDK runner gives each seat dedicated tools for JavaScript calculations, trusted Python calculations, public HTTPS source reads, and visual artifacts. Native shell, file, and browser capabilities are disabled. JavaScript runs in QuickJS with memory and execution limits. Provider credentials stay on the execution host.

Council validation checks output structure, known citation IDs, and literal supporting excerpts for numeric claims. Those checks establish traceability, not semantic truth. Source text remains available for inspection. Follow-ups retain frozen evidence and require the exact company profile, so a citation cannot silently refer to a different source or company.

The hosted runner uses four named persistent Vercel Sandbox slots. The app rotates slots every 20 minutes, and each sandbox has a 45-minute timeout. A new round gets at least 24.5 minutes before its selected sandbox can stop. Four role calls have a combined 16-minute timeout. The saved snapshot contains the worker source, dependencies, Node.js 24, Python 3.14, and Factory Droid 0.249.0. The Next.js server starts or resumes the worker through Vercel's SDK and sends it authenticated requests. The worker keeps the Council ledger on the persistent sandbox filesystem and publishes private snapshots to SpacetimeDB. The SDK uses Vercel OIDC in hosted deployments. A Vercel token is optional when provisioning from a local shell.

Each hosted browser receives a signed, HTTP-only session cookie that lasts 30 days. The server derives a private `user:` owner scope from that cookie and forwards it to the worker. The worker and SpacetimeDB restrict job reads to that owner. Same-origin checks protect Council submissions. The worker token and session signing secret stay on the server.

SpacetimeDB reserves each new hosted request before the worker makes provider calls. The reservation binds the request ID to its payload, so a retry with the same ID and payload returns the existing job. The default limit is 40 new rounds per UTC day, with at most two active hosted jobs overall and one active job per owner. These are request-count limits, not dollar-cost limits. A Council thread allows four rounds. If the sandbox stops, the named sandbox resumes its filesystem with a new worker process. A job whose saved state has not changed for 20 minutes is marked interrupted. The system does not automatically retry paid work.

Hosted live Council uses only the reviewed CREAO conversations and artifacts in the static archive. It does not fetch private CREAO account data or use CREAO provider keys. New Council runs use the Factory API key. Vercel serves the interface, proxies live requests to the sandbox, and reads private snapshots. The public release uses `CONSUL_JUDGE_DEMO=true`; signup and private-account deployment require separate backend configuration. ElevenLabs supplies offline narration for the demo video, rather than runtime voice interaction.

## Run locally

Use Node.js 24.22.1 or newer, pnpm 10.26 or 11, and Python 3. From the repository root:

```powershell
Set-Location web
pnpm install --frozen-lockfile
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
pnpm dev
```

If `web/.env` already exists, keep it instead of copying over it. Open `http://127.0.0.1:3000`. The local development routes `/demo/council` and `/demo/scenes` preview Council layouts and building designs; production disables those routes. The example environment enables the saved-demo entry. Configure the three server-only `SPACETIMEDB_*` values to read a hosted Council archive. Set `COUNCIL_EXECUTION_MODE=local` to use local execution in development, with `ENABLE_LOCAL_AGENT_PREVIEW=true`. Vercel production always uses the hosted worker; set `COUNCIL_EXECUTION_MODE=sandbox` in Preview when you want to exercise the hosted path there.

To run the saved bill pipeline without provider calls, use a second terminal at the repository root:

```powershell
python backend/pipeline.py hr 973 --companion s389 --demo
```

This command reuses saved CREAO outputs and writes a new `runs/` folder. To call the live bill agents, configure the per-agent credentials in `backend/.env` from its example and omit `--demo`.

For local Council execution, configure `FACTORY_API_KEY`, `DROID_EXECUTABLE`, `COUNCIL_MODEL_ID`, `COUNCIL_REASONING_EFFORT`, and `ENABLE_LOCAL_AGENT_PREVIEW=true` in the ignored `web/.env`. Hosted Council uses the Vercel Sandbox snapshot and server-only variables described in [deployment settings and boundaries](DEPLOYMENT.md). Keep credentials out of browser variables and Git. Follow the [backend and Council setup guide](backend/README.md#consul-council) for model discovery, source selection, API commands, and recovery rules.

## Maintain the project

| Location | Responsibility |
| --- | --- |
| [`web/`](web/) | Next.js interface, 3D workspace, agent API, and Council runner |
| [`agents/`](agents/) | CREAO instructions and JSON contracts |
| [`backend/`](backend/) | Python pipeline orchestration and provider client |
| [`forecast/`](forecast/) | Passage model, training code, and model data |
| [`impact/`](impact/) | Scenario calculations and brief verification |
| [`spacetimedb/`](spacetimedb/README.md) | Private snapshot module, adapter contracts, and archive tools |
| [`company.json`](company.json) | Fictional VoltRide calculation inputs |

Read [deployment settings and boundaries](DEPLOYMENT.md) before publishing. Use the [backend guide](backend/README.md) for live agent operations and the [archive guide](spacetimedb/README.md) for persistence changes.
