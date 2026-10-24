"""Bundle everything Agent 4 (Brief Writer) needs into one small JSON input.

Usage:
    python3 brief_inputs.py bill-analysis.json research.json forecast.json impact-plan.json impact-results.json company.json > writer-inputs.json

Keeps the numbers the brief may use and drops long quotes and per-product detail.
verify_brief.py checks the finished brief against this file plus company.json.
"""
import json, re, sys


def load(path):
    raw = open(path).read()
    block = re.search(r"```json\s*(\{.*\})\s*```", raw, re.S)
    return json.loads(block.group(1) if block else raw)


def bill(a):
    s = a["status"]
    return {
        "id": a["bill"]["id"], "title": a["bill"]["title"], "url": a["bill"].get("url"),
        "stage": s.get("stage"), "latest_action": s.get("latest_action"),
        "chamber_votes": s.get("chamber_votes", []),
        "companion_bills": [c.get("id") for c in s.get("companion_bills", [])],
        "congress_ends": s.get("congress_ends"), "days_until_congress_ends": s.get("days_until_congress_ends"),
        "plain_summary": a.get("plain_summary"),
        "provisions": [{k: p.get(k) for k in ("id", "section", "plain_english", "business_relevance")} for p in a.get("provisions", [])],
        "open_questions": a.get("open_questions", []),
    }


def research(r):
    return {
        "stakeholders": [{k: x.get(k) for k in ("name", "type", "stance")} for x in r.get("stakeholders", [])],
        "comparable_past_laws": [{k: x.get(k) for k in ("name", "jurisdiction", "year_enacted", "lessons_for_businesses")}
                                 for x in r.get("comparable_past_laws", [])],
        "alternative_paths": r.get("alternative_paths", []),
        "political_context": r.get("political_context", []),
        "key_uncertainties": r.get("key_uncertainties", []),
        "sources": r.get("sources", [])[:12],
    }


def forecast(f):
    return {
        "probability": f.get("probability"), "model_probability": f.get("model_probability"),
        "starting_point": f.get("starting_point"),
        "factors_that_apply": [x for x in f.get("factors", []) if x.get("applies")],
        "research_adjustments": [{k: x.get(k) for k in ("factor", "multiplier_used", "reason")} for x in f.get("research_adjustments", [])],
        "notes": f.get("notes", []),
    }


def plan(p):
    return {"assumptions": [{k: a.get(k) for k in ("id", "statement", "basis", "confidence")} for a in p.get("assumptions", [])]}


def results(r):
    return {
        "pass_probability": r["pass_probability"],
        "probability_any_rule_applies": r.get("probability_any_rule_applies"),
        "baseline": {k: r["baseline"][k] for k in ("revenue", "gross_profit", "gross_margin")},
        "scenarios": r["scenarios"],
        "options": [{
            **{k: o[k] for k in ("option_id", "option_name", "description", "expected_first_year_impact", "worst_case",
                                  "best_case", "compliant_in_every_pass_scenario", "feasible")},
            "by_scenario": [{
                **{k: s[k] for k in ("scenario_id", "probability", "annual_profit_change", "one_time_total",
                                      "first_year_impact", "gross_margin_after", "below_target_margin", "timing_problems")},
                "not_compliant": [i["product"] for i in s["compliance_issues"]],
                "one_time_costs": [{"item": c["item"], "amount": c["amount"]} for c in s["one_time_costs"]],
            } for s in o["by_scenario"]],
        } for o in r["options"]],
        "ranking_by_expected_impact": r["ranking_by_expected_impact"],
        "method_notes": r["method_notes"],
    }


def names(company):
    """ID-to-name map so the brief can say "Shenzhen PowerCell" instead of "SUP-BAT-01"."""
    out = {"company": company["company"]["name"]}
    out.update({p["id"]: p["name"] for p in company["products"]})
    out.update({s["id"]: s["name"] for s in company["suppliers"]})
    return out


if __name__ == "__main__":
    a, rs, f, p, ir = (load(x) for x in sys.argv[1:6])
    bundle = {"bill": bill(a), "forecast": forecast(f), "research": research(rs), "plan": plan(p), "impact_results": results(ir)}
    if len(sys.argv) > 6:
        bundle["names"] = names(load(sys.argv[6]))
    print(json.dumps(bundle, indent=1, ensure_ascii=False))
