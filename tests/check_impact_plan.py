"""Check Agent 3's plan, run the calculator on it, and show the results.

Usage:
    python3 check_impact_plan.py impact-plan.json company.json forecast.json [bill-analysis.json] [research.json]

- FAIL: anything impact.py rejects (bad IDs, shares, types), a missing do_nothing option,
  assumptions without a basis or source, or provisions left out of the relevance lists.
- WARN: plan choices worth a human look, like no "wait and react" option or no scenario
  for an alternative path the research found.
The plan can be raw JSON or a reply with a ```json code block in it.
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "impact"))
import impact  # noqa: E402

BASES = {"company_data", "bill_text", "research", "estimate"}


def load(path):
    raw = open(path).read()
    block = re.search(r"```json\s*(\{.*\})\s*```", raw, re.S)
    return json.loads(block.group(1) if block else raw)


def main():
    plan, company, forecast = load(sys.argv[1]), load(sys.argv[2]), load(sys.argv[3])
    analysis = load(sys.argv[4]) if len(sys.argv) > 4 else None
    research = load(sys.argv[5]) if len(sys.argv) > 5 else None
    fails, warns, passes = [], [], []

    # Assumptions
    for a in plan.get("assumptions", []):
        problems = [f for f in ("statement", "basis", "source", "confidence") if not a.get(f)]
        if a.get("basis") and a["basis"] not in BASES:
            problems.append(f"basis '{a['basis']}'")
        if problems:
            fails.append(f"assumption {a.get('id')}: missing or bad {problems}")
    estimates = [a["id"] for a in plan.get("assumptions", []) if a.get("basis") == "estimate"]
    passes.append(f"{len(plan.get('assumptions', []))} assumptions ({len(estimates)} are estimates)")

    # Relevance covers every provision
    if analysis:
        listed = {p["provision_id"] for p in plan.get("relevance", {}).get("relevant_provisions", [])}
        listed |= {p["provision_id"] for p in plan.get("relevance", {}).get("not_relevant", [])}
        missing = [p["id"] for p in analysis.get("provisions", []) if p["id"] not in listed]
        (fails if missing else passes).append(
            f"provisions not marked relevant or not relevant: {missing}" if missing else "every provision is accounted for")

    # Options
    options = plan.get("options", [])
    ids = [o.get("id") for o in options]
    (passes if "do_nothing" in ids else fails).append("do_nothing option included" if "do_nothing" in ids else "no do_nothing option")
    has_rules = any(s.get("rules") for s in plan.get("scenarios", []))
    if has_rules:
        react = [o["id"] for o in options if any(a.get("only_if_rule_applies") for a in o.get("actions", []))]
        prepare = [o["id"] for o in options if o.get("actions") and not all(a.get("only_if_rule_applies") for a in o["actions"])]
        (passes if react else warns).append(f"wait-and-react options: {react}" if react else "no wait-and-react option")
        (passes if prepare else warns).append(f"prepare-now options: {prepare}" if prepare else "no prepare-now option")

    # One-time costs the calculator already adds on its own
    auto = re.compile(r"penalt|exit|inventory|stock|certif|qualif", re.I)
    for o in options:
        for a in o.get("actions", []):
            if a.get("type") == "one_time_cost" and auto.search(a.get("description", "")):
                fails.append(f"{o['id']}: one_time_cost '{a['description'][:60]}' looks like something impact.py already "
                             "adds (penalties, stock, certification), so it would be counted twice")

    # Alternative paths from research should show up as a fail-branch scenario with a rule
    if research and research.get("alternative_paths"):
        alt = [s["id"] for s in plan.get("scenarios", []) if s.get("branch") == "fail" and s.get("rules")]
        (passes if alt else warns).append(
            f"fail-branch scenarios with rules (alternative paths): {alt}" if alt
            else "research found alternative paths, but no fail-branch scenario applies a rule")

    # Run the calculator
    results = None
    try:
        results = impact.run(company, plan, forecast)
        passes.append("impact.py ran the plan without errors")
        for o in results["options"]:
            problems = sorted({w for s in o["by_scenario"] for w in s["warnings"]})
            for w in problems:
                fails.append(f"{o['option_id']}: {w}")
    except (impact.PlanError, KeyError, TypeError, ValueError) as e:
        fails.append(f"impact.py rejected the plan: {e}")

    for p in passes:
        print(f"  PASS  {p}")
    for w in warns:
        print(f"  WARN  {w}")
    for f in fails:
        print(f"  FAIL  {f}")
    print(f"\n{len(passes)} passed, {len(warns)} warnings, {len(fails)} failed")

    if results:
        print(f"\nPass probability: {results['pass_probability']:.1%}")
        print("Scenarios:")
        for s in results["scenarios"]:
            when = f"rule in {s['months_until_rule_applies']} months" if s["months_until_rule_applies"] is not None else "no rule"
            print(f"  {s['id']:4s} {s['probability']:6.1%}  {s['name']} ({when})")
        print("\nOptions (first-year impact):")
        print(f"  {'option':44s} {'expected':>12s} {'worst case':>12s}  ready if it passes?")
        for o in results["options"]:
            print(f"  {o['option_name'][:44]:44s} {o['expected_first_year_impact']:>12,.0f} {o['worst_case']:>12,.0f}  "
                  f"{'yes' if o['compliant_in_every_pass_scenario'] else 'no'}{'' if o['feasible'] else '  (NOT FEASIBLE)'}")
        print("\nBest expected:", results["ranking_by_expected_impact"][0] if results["ranking_by_expected_impact"] else "none feasible")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
