# Policy impact agent (CalHacks, CREAO track)

Reads any US federal bill, forecasts whether it will pass, calculates what it would cost or save a specific company under each strategy, and writes a one-page brief.

## How it works

```
bill number
  → Agent 1: Bill Analyst      reads the bill, pulls out each requirement          (CREAO)
  → Agent 2: Researcher        experts, lobbying, past laws, alternatives          (CREAO)
  → forecast.py                passage probability from real data                  (backend)
  → Agent 3: Impact Planner    scenarios, rules, and options for this company      (CREAO)
  → impact.py                  dollars for every option in every scenario          (backend)
  → Agent 4: Brief Writer      one-page brief with a recommendation                (CREAO)
  → verify_brief.py            rejects any number not traced to the calculations   (backend)
```

Rule: **AI reads and writes, code calculates.** Agents never invent probabilities or dollar figures, and `verify_brief.py` checks that they didn't.

## Run the whole pipeline on the sample files

```bash
python3 forecast/forecast.py agents/hr973-expected-output.json > tests/hr973-forecast.json
python3 impact/impact.py company.json tests/hr973-impact-plan.json tests/hr973-forecast.json > tests/hr973-impact-results.json
python3 impact/verify_brief.py tests/hr973-brief.json tests/hr973-forecast.json tests/hr973-impact-results.json company.json tests/hr973-impact-plan.json agents/hr973-expected-output.json
```

In the real app, the `*-expected-output.json`, `*-impact-plan.json`, and `*-brief.json` files come from the agents instead.

## Folders

| Path | What it is |
|---|---|
| `company.json` | Fictional demo company (VoltRide e-bikes). Replace with any company in the same format |
| `agents/bill-analyst-instructions.md` | Paste into CREAO to make Agent 1 |
| `agents/bill-analysis-schema.json` | Agent 1's output format |
| `agents/researcher-instructions.md` | Paste into CREAO to make Agent 2 |
| `agents/research-schema.json` | Agent 2's output format |
| `agents/impact-planner-instructions.md` | Paste into CREAO to make Agent 3 |
| `agents/impact-plan-schema.json` | Agent 3's output format, including every allowed rule, effect, and action |
| `agents/brief-writer-instructions.md` | Paste into CREAO to make Agent 4 |
| `agents/brief-schema.json` | Agent 4's output format (what the front end shows) |
| `agents/hr973-expected-output.json` | A known-correct Agent 1 answer, for testing |
| `impact/impact.py` | Calculates every option under every scenario. No packages needed |
| `impact/verify_brief.py` | Flags any number in a brief that didn't come from the inputs |
| `forecast/forecast.py` | Scores any bill. No packages needed |
| `forecast/forecast-model.json` | The trained model |
| `forecast/train_forecast.py` | Retrains the model and backtests it |
| `forecast/congresses.json` | Which party controls each chamber, per Congress |
| `tests/` | Four test bills of different types, plus a checklist |

## Run a forecast

```bash
python3 forecast/forecast.py agents/hr973-expected-output.json
```

Add Agent 2's output as a second argument to include research adjustments. Research can move the odds by at most x0.5 to x2.0 in total.

## The forecast model

Trained on **every House and Senate bill from the 117th and 118th Congresses** (31,268 bills, 627 enacted), using official bill status data from govinfo.gov. For each bill, it looks at snapshots at different points in the Congress, so it learns how the odds change as time runs out.

It uses one model per stage (introduced, reported by committee, passed one chamber). Signals:
- days left in the Congress
- cosponsors from both parties
- whether the sponsor's party controls each chamber
- a matching bill in the other chamber
- number of cosponsors

**Backtest:** trained on one Congress and tested on the other, it beat the stage-only baseline both times. For bills past committee, its predictions roughly matched reality (for example, bills it gave 5–15% passed 9.5–10.3% of the time). It was overconfident in the 30–50% range for the 117th Congress (predicted 38%, actual 25%).

**Surprising findings from the data:**
- Bipartisan cosponsors matter most early: x6 odds for bills still in committee.
- After passing one chamber, a matching bill in the other chamber about doubles the odds.
- Bills from the House majority party do *worse* after passing the House. Many pass on party lines, then stall in the Senate.
- Lots of cosponsors stops helping once other signals are counted.

**Limits:**
- Only counts a bill as enacted if *that bill* becomes law. Bill text that passes inside a larger package counts as a failure, so the model undercounts real policy outcomes.
- The 119th Congress has one party controlling both chambers, which matches the 117th but not the 118th.

**To retrain** (for example, after adding the 116th Congress), download `BILLSTATUS-{congress}-hr.zip` and `-s.zip` from https://www.govinfo.gov/bulkdata/BILLSTATUS, unzip, and run:

```bash
python3 forecast/train_forecast.py --data 117=path/to/117 --data 118=path/to/118
```

## The impact calculator

`impact.py` takes Agent 3's plan and calculates, for every option under every scenario:
- annual profit change once the rule applies
- one-time costs: certifications, supplier qualification, contract penalties, unsellable stock, and lost sales while fixes finish
- whether the company is compliant in time, and whether suppliers have enough capacity
- gross margin compared with the company's target

It then weights the scenarios by probability (from `forecast.py`) to get each option's **expected first-year impact**, plus its **worst case** and whether it's **ready in every pass scenario**.

It handles threat bills (rules the company must meet) and opportunity bills (lower costs, higher demand). Plans can include "wait and react" options that only act if a rule actually arrives.

**Limits:** costs before the rule applies aren't counted, and while fixes finish, a whole product is treated as unsellable (a worst case).

## Company data format

Any company works if its file has the same structure as `company.json`:

| Section | What it needs |
|---|---|
| `products` | `id`, price, annual units, `certifications`, and `components` |
| `components` | `id`, `part`, `category`, `qty`, and `sourcing`: a list of suppliers, each with unit cost and share (shares add up to 1.0) |
| `suppliers` | `id`, `certifications`, capacity, and optional `contract` (end date, minimum units, exit penalty) |
| `inventory` | supplier, which components it can be used in, units, and unit cost |
| `certification_costs` | cost and weeks to certify a product |
| `supplier_qualification` | cost and weeks to add a new supplier to a part |
| `financials` | including `target_gross_margin` |

## Sample results (H.R. 973, VoltRide)

| Option | Expected first-year impact | Worst case | Ready if it passes? |
|---|---|---|---|
| Wait, then certify if it passes | -$88K | -$509K | No, too slow in the 7-month case |
| Pay PowerCell to get certified now | -$217K | -$266K | Yes |
| Switch after the PowerCell contract ends | -$374K | -$402K | Yes |
| Switch to certified suppliers now | -$449K | -$477K | Yes ($75K penalty) |
| Do nothing | -$2.4M | -$5.6M | No |

For H.R. 9041 (an opportunity bill with a 0.3% chance), the calculator correctly says not to spend money now: an employer sales program has a slightly negative expected value.

## Data sources (all free)

- Congress.gov API, needs a free key from api.congress.gov (the test key hits its limit fast)
- govinfo.gov bill status files, no key needed and a good backup when Congress.gov is rate-limited
- Lobbying Disclosure API at lda.gov/api/v1, no key needed

## Website (Figma export)

The local backend stores agent jobs, dispatches CREAO runs with per-agent keys,
and exposes the Python calculations through the web server.
See [backend setup](backend/README.md) for credentials, job commands, and limits.

The current business health dashboard design lives in [`web/`](web/README.md),
with its Next.js app, interactive 3D scene, sign-in, and business setup flow.
The Python forecast and impact pipeline remains in the folders above.
