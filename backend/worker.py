"""JSON stdin/stdout bridge to the existing policy calculations."""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from forecast.forecast import forecast
from impact.impact import PlanError, run as calculate_impact
from impact.verify_brief import check, numbers


def document(payload, name):
    value = payload.get(name)
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object.")
    return value


def score(payload):
    analysis = document(payload, "analysis")
    research = payload.get("research")
    if research is not None and not isinstance(research, dict):
        raise ValueError("research must be a JSON object.")
    return forecast(analysis, research)


def impacts(payload):
    analysis = document(payload, "analysis")
    company = document(payload, "company")
    plan = document(payload, "plan")
    if plan.get("bill_id") != analysis.get("bill", {}).get("id"):
        raise ValueError("plan.bill_id must match analysis.bill.id.")
    prediction = score(payload)
    return prediction, calculate_impact(company, plan, prediction)


def execute(operation, payload):
    if operation == "health":
        return {"python_version": sys.version.split()[0], "operations": ["forecast", "impact", "verify-brief"]}
    if operation == "forecast":
        return score(payload)
    if operation == "impact":
        prediction, impact = impacts(payload)
        return {"forecast": prediction, "impact": impact}
    if operation == "verify-brief":
        brief = document(payload, "brief")
        prediction, impact = impacts(payload)
        bill_id = document(payload, "analysis").get("bill", {}).get("id")
        if brief.get("bill_id") != bill_id:
            raise ValueError("brief.bill_id must match analysis.bill.id.")
        # Recompute trusted numeric sources rather than accepting agent-supplied totals.
        sources = [payload["analysis"], payload["company"], payload["plan"], prediction, impact]
        allowed = {number for source in sources for number in numbers(source)}
        problems = check(brief, allowed)
        return {
            "valid": not problems,
            "problems": [{"number": number, "context": context} for number, context in problems],
            "forecast": prediction,
            "impact": impact,
        }
    raise ValueError("Unknown calculation operation.")


def reject_constant(value):
    raise ValueError(f"{value} is not a finite JSON number.")


def main():
    try:
        payload = json.load(sys.stdin, parse_constant=reject_constant)
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        result = execute(sys.argv[1], payload)
        print(json.dumps({"ok": True, "result": result}, allow_nan=False))
        return 0
    except (ValueError, TypeError, KeyError, IndexError, ZeroDivisionError, OverflowError, PlanError) as error:
        print(json.dumps({"ok": False, "error": {"code": "INVALID_INPUT", "message": str(error)}}))
        return 1


if __name__ == "__main__":
    sys.exit(main())
