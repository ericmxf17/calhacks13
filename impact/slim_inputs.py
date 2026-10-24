"""Shrink Agent 1 and Agent 2 outputs to what Agent 3 (Impact Planner) needs.

Usage:
    python3 slim_inputs.py bill-analysis.json research.json forecast.json > planner-inputs.json

Drops long quotes, source lists, and lobbying detail, so Agent 3's input stays small
and it reads faster. Output: {"bill_analysis": ..., "research": ..., "forecast": ...}
"""
import json, re, sys

PROVISION_FIELDS = ["id", "section", "type", "plain_english", "who_must_act", "regulator", "affected_products",
                    "standards_referenced", "amounts", "timing", "business_relevance", "relevance_reason"]


def load(path):
    raw = open(path).read()
    block = re.search(r"```json\s*(\{.*\})\s*```", raw, re.S)
    return json.loads(block.group(1) if block else raw)


def slim_analysis(a):
    s = a["status"]
    return {
        "bill": {k: a["bill"].get(k) for k in ("id", "title", "url")},
        "status": {
            "stage": s.get("stage"),
            "latest_action": s.get("latest_action"),
            "companion_bills": [c.get("id") for c in s.get("companion_bills", [])],
            "congress_ends": s.get("congress_ends"),
            "days_until_congress_ends": s.get("days_until_congress_ends"),
        },
        "plain_summary": a.get("plain_summary"),
        "provisions": [{k: p.get(k) for k in PROVISION_FIELDS} for p in a.get("provisions", [])],
        "open_questions": a.get("open_questions", []),
    }


def slim_research(r):
    return {
        "bill_id": r.get("bill_id"),
        "expert_analysis": [{k: e.get(k) for k in ("organization", "source_type", "date", "stance", "key_points", "url")}
                            for e in r.get("expert_analysis", [])],
        "comparable_past_laws": r.get("comparable_past_laws", []),
        "alternative_paths": r.get("alternative_paths", []),
        "political_context": r.get("political_context", []),
        "key_uncertainties": r.get("key_uncertainties", []),
    }


def slim_forecast(f):
    return {"probability": f.get("probability"), "notes": f.get("notes", [])}


if __name__ == "__main__":
    print(json.dumps({
        "bill_analysis": slim_analysis(load(sys.argv[1])),
        "research": slim_research(load(sys.argv[2])),
        "forecast": slim_forecast(load(sys.argv[3])),
    }, indent=1, ensure_ascii=False))
