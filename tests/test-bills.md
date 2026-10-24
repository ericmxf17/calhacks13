# Test bills

Four real 119th Congress bills of different types and stages. Run each one through Agent 1, then Agent 2, then `forecast.py`. If the pipeline handles all four well, it isn't tuned to one bill.

| Bill | Type | Stage (as of 2026-10-23) | Why it's a good test |
|---|---|---|---|
| **H.R. 973**, Setting Consumer Standards for Lithium-Ion Batteries Act | Mandatory safety standard | Passed House 365–42; Senate companion S. 389 on the calendar | Has a companion, a big vote, and a clear business impact |
| **H.R. 9615**, BRACE Act | Environmental rule (EPA battery recycling) | Passed House by voice vote 2026-09-15; in Senate committee | Different agency, no companion, passed without a recorded vote |
| **H.R. 9041**, America Bikes Act | Funding and incentives | Introduced 2026-05-26; in two committees | An opportunity bill, not a threat. Early stage |
| **H.R. 7839**, Safe SPEEDS Act | Classification and labeling standard | Introduced 2026-03-05; in committee | Early stage, bipartisan cosponsors |

`hr973-expected-output.json` (in `agents/`) is a full Agent 1 answer. The `*-status.json` files here only contain the status fields, which is enough to test `forecast.py`.

## Forecast results (no research adjustments)

| Bill | Starting point | Final | Main reasons |
|---|---|---|---|
| H.R. 973 | 9.4% | **22.5%** | Bipartisan (x1.52), has a Senate companion (x2.02) |
| H.R. 9615 | 9.4% | **11.3%** | Bipartisan (x1.52), sponsor's party controls the Senate (x1.19), but House-majority bills do worse after passing (x0.67) |
| H.R. 9041 | 0.1% | **0.3%** | Bipartisan (x6.28), but still in committee with 72 days left |
| H.R. 7839 | 0.1% | **0.3%** | Same as above |

## Impact samples

| Files | What they show |
|---|---|
| `hr973-impact-plan.json` → `hr973-impact-results.json` → `hr973-brief.json` | A threat bill: 5 scenarios, 5 options, contract penalties, certification timing |
| `hr9041-impact-plan.json` → `hr9041-impact-results.json` | An opportunity bill: duty-free parts and a commuter tax benefit, no rules |

The H.R. 9041 plan uses a **placeholder** for how much of each part's cost is duties (8%), because `company.json` doesn't list duties separately. Replace it with real duties paid to make that result exact.

## Checklist for Agent 3's output
- [ ] Every provision is marked relevant or not, with company IDs
- [ ] Every number not from company data or the bill is an assumption with a basis and confidence
- [ ] Pass and fail branches each have shares that add up to 1.0
- [ ] Includes `do_nothing`, a "prepare now" option, and a "wait and react" option when a rule is involved
- [ ] `impact.py` runs without an "Invalid plan" error

## Checklist for Agent 4's output
- [ ] `verify_brief.py` passes. It flags any number that isn't in the inputs, even correct arithmetic like 1 - 22.5% = 77.5%
- [ ] The recommendation names the tradeoff and gives "switch if" signals
- [ ] Reads in under 2 minutes

## Checklist for Agent 2's output

**For every bill:**
- [ ] 4 to 8 sources, mostly primary (CRS, CBO, committee, agency, law firms, trade groups)
- [ ] Every claim has a URL, and every quote is exact and 25 words or fewer
- [ ] Lobbying search was run, and only filings that mention the bill are kept
- [ ] At least one comparable past law, or a clear note that none was found
- [ ] Alternative paths were checked (agency rule, state laws, larger package)
- [ ] Adjustments only use factors from the allowed table, each with a dated source
- [ ] No adjustment for things the script already counts (stage, cosponsors, party, companion, days left)

**Bill-specific things a good run should find or look for:**
- **H.R. 973:** the House committee report (H. Rept. 119-77). Lobbying filings that mention H.R. 973 (for example, one filed for LG Electronics). New York City's 2023 law requiring certified e-bike batteries as a comparable law. Whether the CPSC is already writing its own battery rule.
- **H.R. 9615:** whether EPA is already working on a lithium-ion battery recycling rule, and how state battery recycling laws have worked.
- **H.R. 9041:** the earlier federal bicycle commuter tax benefit and what happened to it.
- **H.R. 7839:** state laws that already sort e-bikes into classes, which many states have adopted.

Check each of these yourself before the demo. They are leads to look for, not confirmed findings.
