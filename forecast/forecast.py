"""Score any US federal bill's chance of becoming law this Congress.

Usage:
    python3 forecast.py bill-analysis.json [research.json] > forecast.json

bill-analysis.json is Agent 1's output. research.json is Agent 2's output; only its
"forecast_adjustments" list is used. Pure Python, no packages needed.
"""
import json, math, os, sys, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = json.load(open(os.path.join(HERE, "forecast-model.json")))
CONGRESSES = json.load(open(os.path.join(HERE, "congresses.json")))

# Research can move the odds, but only within these limits.
MIN_ADJUSTMENT, MAX_ADJUSTMENT = 0.5, 2.0

STAGE_MAP = {
    "introduced": "introduced", "in_committee": "introduced",
    "reported_by_committee": "reported",
    "passed_one_chamber": "passed_one",
    "passed_both_chambers": "passed_both",
}

LABELS = {
    "bipartisan": "Has cosponsors from both parties",
    "origin_chamber_control": "Sponsor's party controls the chamber where it started",
    "other_chamber_control": "Sponsor's party controls the other chamber",
    "companion_bill": "Has a matching bill in the other chamber",
    "many_cosponsors": "Has many cosponsors (20+ House, 5+ Senate)",
}


def sigmoid(z):
    return 1 / (1 + math.exp(-max(min(z, 30), -30)))


def caucus(party):
    return "D" if party == "I" else party


def build_features(analysis):
    bill, status = analysis["bill"], analysis["status"]
    info = CONGRESSES[str(bill["congress"])]
    own = "house" if bill["type"] in ("hr", "hjres") else "senate"
    other = "senate" if own == "house" else "house"
    sponsor = caucus(status["sponsor"]["party"])
    by_party = status["cosponsors"]["by_party"]

    days_left = status.get("days_until_congress_ends")
    if days_left is None:
        days_left = (dt.date.fromisoformat(info["ends"]) - dt.date.today()).days

    return days_left, {
        "intercept": 1.0,
        "log_days_left": math.log(max(days_left, 1)),
        "bipartisan": float(any(caucus(p) != sponsor and n > 0 for p, n in by_party.items())),
        "origin_chamber_control": float(sponsor == info["majority"][own]),
        "other_chamber_control": float(sponsor == info["majority"][other]),
        "companion_bill": float(len(status.get("companion_bills") or []) > 0),
        "many_cosponsors": float(status["cosponsors"]["total"] >= (20 if own == "house" else 5)),
    }


def apply_adjustments(probability, adjustments):
    applied, product = [], 1.0
    for a in adjustments:
        m = min(max(float(a["multiplier"]), MIN_ADJUSTMENT), MAX_ADJUSTMENT)
        product *= m
        applied.append({**a, "multiplier_used": round(m, 2)})
    total = min(max(product, MIN_ADJUSTMENT), MAX_ADJUSTMENT)
    odds = probability / (1 - probability) * total if probability < 1 else float("inf")
    return (odds / (1 + odds) if odds != float("inf") else 1.0), applied, round(total, 2)


def forecast(analysis, research=None):
    stage_name = analysis["status"]["stage"]
    if stage_name == "enacted":
        return {"probability": 1.0, "explanation": "Already law."}
    if stage_name == "failed":
        return {"probability": 0.0, "explanation": "Already failed."}

    stage = STAGE_MAP[stage_name]
    days_left, feats = build_features(analysis)
    m = MODEL["stages"][stage]

    factors = []
    if "fixed_probability" in m:
        model_p = m["fixed_probability"]
        start_p = model_p
    else:
        w = m["weights"]
        start_z = w["intercept"] + w["log_days_left"] * feats["log_days_left"]
        start_p = sigmoid(start_z)
        z = start_z
        for name, label in LABELS.items():
            effect = math.exp(w[name])
            factors.append({
                "factor": label,
                "applies": bool(feats[name]),
                "effect_on_odds": f"x{effect:.2f}" if feats[name] else "no effect",
            })
            z += w[name] * feats[name]
        model_p = sigmoid(z)

    adjustments = (research or {}).get("forecast_adjustments", [])
    final_p, applied, total = apply_adjustments(model_p, adjustments)

    notes = []
    if days_left < 120 and stage != "passed_both":
        notes.append(f"Only {days_left} days are left in this Congress. If it doesn't pass both chambers by then, the bill dies and must be reintroduced.")
    if stage == "introduced":
        notes.append("Most bills never leave committee. Watch for a committee markup, which raises the odds sharply.")

    return {
        "probability": round(final_p, 3),
        "model_probability": round(model_p, 3),
        "starting_point": {
            "stage": stage,
            "days_left": days_left,
            "probability": round(start_p, 3),
            "explanation": f"A typical bill at this stage with {days_left} days left, before looking at its other signals.",
        },
        "factors": factors,
        "research_adjustments": applied,
        "research_adjustment_total": f"x{total:.2f} (limited to x{MIN_ADJUSTMENT}-x{MAX_ADJUSTMENT})",
        "notes": notes,
        "model_info": {
            "trained_on_congresses": MODEL["trained_on_congresses"],
            "method": "Logistic regression per stage, trained on every House and Senate bill in those Congresses.",
        },
    }


if __name__ == "__main__":
    analysis = json.load(open(sys.argv[1]))
    research = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
    print(json.dumps(forecast(analysis, research), indent=2))
