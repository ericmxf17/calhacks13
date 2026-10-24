"""Calculate how a bill affects a company, for every strategy option under every scenario.

Usage:
    python3 impact.py company.json impact-plan.json forecast.json > impact-results.json

company.json:      the company's data (see company-schema in the README)
impact-plan.json:  Agent 3's output: scenarios, rules, options, and assumptions
forecast.json:     forecast.py's output (only "probability" is used)

Every number in the results is calculated here, never by an agent. Pure Python.
"""
import copy, json, sys, datetime as dt

WEEKS_PER_MONTH = 4.345
EFFECT_TYPES = {"component_cost_change", "price_change", "volume_change", "one_time_cost", "annual_cost_change"}
ACTION_TYPES = EFFECT_TYPES | {"supplier_certification", "sourcing_shift", "product_certification", "drop_product"}
RULE_TYPES = {"requires_supplier_certification", "requires_product_certification"}


class PlanError(Exception):
    pass


def money(x):
    return round(x, 2)


def months_between(a, b):
    return (b - a).days / 30.44


def index(company):
    products = {p["id"]: p for p in company["products"]}
    components = {c["id"]: (p, c) for p in company["products"] for c in p["components"]}
    suppliers = {s["id"]: s for s in company["suppliers"]}
    return products, components, suppliers


def unit_cost(product):
    parts = sum(c["qty"] * sum(s["unit_cost"] * s["share"] for s in c["sourcing"]) for c in product["components"])
    return parts + sum(product.get("other_costs_per_unit", {}).values())


def supplier_units(company):
    units = {}
    for p in company["products"]:
        for c in p["components"]:
            for s in c["sourcing"]:
                units[s["supplier_id"]] = units.get(s["supplier_id"], 0) + p["annual_units"] * c["qty"] * s["share"]
    return units


def pnl(company):
    rows, revenue, gp = [], 0.0, 0.0
    for p in company["products"]:
        uc = unit_cost(p)
        r = p["avg_net_price"] * p["annual_units"]
        g = (p["avg_net_price"] - uc) * p["annual_units"]
        revenue += r
        gp += g
        rows.append({"id": p["id"], "name": p["name"], "units": round(p["annual_units"]), "net_price": money(p["avg_net_price"]),
                     "unit_cost": money(uc), "gross_profit": money(g)})
    return {"products": rows, "revenue": money(revenue), "gross_profit": money(gp),
            "gross_margin": round(gp / revenue, 4) if revenue else 0.0}


def assumption_note(plan, item):
    aid = item.get("assumption_id")
    if not aid:
        return ""
    a = next((a for a in plan.get("assumptions", []) if a["id"] == aid), None)
    if a is None:
        raise PlanError(f"Unknown assumption_id {aid}")
    return f" [assumption {aid}: {a['statement']}]"


def check_shares(component):
    total = sum(s["share"] for s in component["sourcing"])
    if abs(total - 1) > 0.001:
        raise PlanError(f"Shares for {component['id']} add up to {total:.3f}, not 1.0")


def apply_effect(state, plan, effect, log, one_time, annual):
    products, components, _ = index(state)
    t = effect["type"]
    note = assumption_note(plan, effect)
    if t == "component_cost_change":
        for cid in effect["component_ids"]:
            _, comp = components[cid]
            for s in comp["sourcing"]:
                if not effect.get("supplier_ids") or s["supplier_id"] in effect["supplier_ids"]:
                    s["unit_cost"] *= 1 + effect["change_percent"] / 100
        log.append(f"{effect['change_percent']:+}% unit cost on {', '.join(effect['component_ids'])}{note}")
    elif t == "price_change":
        for pid in effect["product_ids"]:
            products[pid]["avg_net_price"] *= 1 + effect["change_percent"] / 100
        log.append(f"{effect['change_percent']:+}% price on {', '.join(effect['product_ids'])}{note}")
    elif t == "volume_change":
        for pid in effect["product_ids"]:
            products[pid]["annual_units"] *= 1 + effect["change_percent"] / 100
        log.append(f"{effect['change_percent']:+}% units on {', '.join(effect['product_ids'])}{note}")
    elif t == "one_time_cost":
        one_time.append({"item": effect["description"], "amount": money(effect["amount"]), "how": f"Given in plan{note}"})
    elif t == "annual_cost_change":
        annual.append({"item": effect["description"], "amount": money(effect["amount"]), "how": f"Given in plan{note}"})


def evaluate(company, plan, option, scenario, as_of):
    base = copy.deepcopy(company)
    state = copy.deepcopy(company)
    products, components, suppliers = index(state)
    log, one_time, annual, warnings, timing = [], [], [], [], []
    months_left = scenario.get("months_until_rule_applies")
    rule_weeks = months_left * WEEKS_PER_MONTH if months_left is not None else None

    baseline_pairs = {(c["id"], s["supplier_id"]) for p in base["products"] for c in p["components"] for s in c["sourcing"]}
    baseline_categories = {(c["category"], s["supplier_id"]) for p in base["products"] for c in p["components"] for s in c["sourcing"]}
    shift_start = {}          # component_id -> months until the shift happens
    inventory_first = set()   # component_ids where stock is used before new purchases
    fix_weeks = {}            # product_id -> weeks until its compliance fixes are in place
    reduced_by_option = set()

    # 1. Company actions
    for a in option.get("actions", []):
        t = a["type"]
        if t not in ACTION_TYPES:
            raise PlanError(f"Unknown action type {t}")
        if a.get("only_if_rule_applies") and months_left is None:
            continue
        lead_weeks = a.get("start_in_months", 0) * WEEKS_PER_MONTH
        if t in EFFECT_TYPES:
            apply_effect(state, plan, a, log, one_time, annual)
        elif t == "supplier_certification":
            sup = suppliers[a["supplier_id"]]
            if a["certification"] not in sup["certifications"]:
                sup["certifications"].append(a["certification"])
            pct = a.get("unit_cost_change_percent", 0)
            for p in state["products"]:
                for c in p["components"]:
                    for s in c["sourcing"]:
                        if s["supplier_id"] == sup["id"]:
                            s["unit_cost"] *= 1 + pct / 100
                            if s["share"] > 0:
                                fix_weeks[p["id"]] = max(fix_weeks.get(p["id"], 0), lead_weeks + a["weeks"])
            if a.get("one_time_cost"):
                one_time.append({"item": f"{sup['name']} gets {a['certification']}", "amount": money(a["one_time_cost"]), "how": "Given in plan" + assumption_note(plan, a)})
            log.append(f"{sup['name']} gets {a['certification']} in {a['weeks']} weeks, price {pct:+}%{assumption_note(plan, a)}")
        elif t == "sourcing_shift":
            start = a.get("start_in_months", 0)
            for cid in a["component_ids"]:
                p, comp = components[cid]
                old = {s["supplier_id"]: s for s in comp["sourcing"]}
                new = []
                for ns in a["new_shares"]:
                    cost = ns.get("unit_cost") or (old[ns["supplier_id"]]["unit_cost"] if ns["supplier_id"] in old else None)
                    if cost is None:
                        same_part = [s["unit_cost"] for _, c in components.values() if c["part"] == comp["part"]
                                     for s in c["sourcing"] if s["supplier_id"] == ns["supplier_id"]]
                        if not same_part:
                            raise PlanError(f"No unit_cost for {ns['supplier_id']} on {cid}")
                        cost = same_part[0]
                    new.append({"supplier_id": ns["supplier_id"], "unit_cost": cost, "share": ns["share"]})
                    if (comp["category"], ns["supplier_id"]) not in baseline_categories and ns["share"] > 0:
                        q = company["supplier_qualification"]
                        one_time.append({"item": f"Qualify {suppliers[ns['supplier_id']]['name']} for {comp['part']}", "amount": money(q["cost"]), "how": "Company supplier_qualification cost"})
                        fix_weeks[p["id"]] = max(fix_weeks.get(p["id"], 0), q["weeks"])
                for sid, s in old.items():
                    if s["share"] > next((n["share"] for n in new if n["supplier_id"] == sid), 0):
                        reduced_by_option.add(sid)
                comp["sourcing"] = new
                check_shares(comp)
                shift_start[cid] = start
                if a.get("use_inventory_first"):
                    inventory_first.add(cid)
                if start:
                    fix_weeks[p["id"]] = max(fix_weeks.get(p["id"], 0), start * WEEKS_PER_MONTH)
            log.append(f"Shift sourcing of {', '.join(a['component_ids'])} in {start} months: "
                       + ", ".join(f"{suppliers[n['supplier_id']]['name']} {n['share']:.0%}" for n in a["new_shares"]))
        elif t == "product_certification":
            prod = products[a["product_id"]]
            cc = next((c for c in company.get("certification_costs", []) if c["certification"] == a["certification"] and c["level"] == "product"), None)
            cost = a.get("cost", cc["cost"] if cc else None)
            weeks = a.get("weeks", cc["weeks"] if cc else None)
            if cost is None or weeks is None:
                raise PlanError(f"No cost or weeks for {a['certification']} on {prod['id']}")
            if a["certification"] not in prod["certifications"]:
                prod["certifications"].append(a["certification"])
            one_time.append({"item": f"{a['certification']} for {prod['name']}", "amount": money(cost), "how": "Company certification_costs" if "cost" not in a else "Given in plan"})
            fix_weeks[prod["id"]] = max(fix_weeks.get(prod["id"], 0), lead_weeks + weeks)
            log.append(f"Certify {prod['name']} to {a['certification']} ({weeks} weeks)")
        elif t == "drop_product":
            products[a["product_id"]]["annual_units"] = 0
            log.append(f"Stop selling {products[a['product_id']]['name']}")

    # 2. Things that happen to the market in this scenario, whatever the company does
    for e in scenario.get("market_effects", []):
        if e["type"] not in EFFECT_TYPES:
            raise PlanError(f"Unknown market effect type {e['type']}")
        apply_effect(state, plan, e, log, one_time, annual)

    units_before_rule = supplier_units(state)

    # 3. Compliance with the bill's rules
    issues, noncompliant, at_risk_suppliers = [], {}, {}
    if months_left is not None:
        for rule in scenario.get("rules", []):
            if rule["type"] not in RULE_TYPES:
                raise PlanError(f"Unknown rule type {rule['type']}")
            cert = rule["certification"]
            if rule["type"] == "requires_supplier_certification":
                for cid in rule["component_ids"]:
                    p, comp = components[cid]
                    for s in comp["sourcing"]:
                        if p["annual_units"] > 0 and s["share"] > 0 and cert not in suppliers[s["supplier_id"]]["certifications"]:
                            noncompliant.setdefault(p["id"], []).append(f"{comp['part']} from {suppliers[s['supplier_id']]['name']} lacks {cert}")
                    for s in base_sourcing(base, cid):
                        if cert not in base_supplier(base, s["supplier_id"])["certifications"]:
                            at_risk_suppliers.setdefault(s["supplier_id"], set()).add(cid)
            else:
                for pid in rule["product_ids"]:
                    if products[pid]["annual_units"] > 0 and cert not in products[pid]["certifications"]:
                        noncompliant.setdefault(pid, []).append(f"{products[pid]['name']} lacks {cert}")

    # Fixes that aren't ready when the rule starts cost sales during the gap
    transition = []
    if rule_weeks is not None:
        for pid, weeks in fix_weeks.items():
            prod = products[pid]
            if weeks > rule_weeks and pid not in noncompliant and prod["annual_units"] > 0:
                gap = weeks - rule_weeks
                weekly_gp = (prod["avg_net_price"] - unit_cost(prod)) * prod["annual_units"] / 52
                transition.append({"item": f"{prod['name']} can't be sold for {gap:.0f} weeks while fixes finish",
                                   "amount": money(weekly_gp * gap),
                                   "how": f"{gap:.1f} weeks x ${weekly_gp:,.0f} gross profit per week"})
                timing.append(f"{prod['name']}: fixes take {weeks:.0f} weeks, but the rule starts in {rule_weeks:.0f} weeks")

    for pid, reasons in noncompliant.items():
        issues.append({"product": products[pid]["name"], "problem": "; ".join(reasons),
                       "result": "Cannot be sold once the rule applies"})
        products[pid]["annual_units"] = 0

    # 4. Stock that can't be sold once the rule applies
    writeoffs = []
    if months_left is not None:
        for inv in state.get("inventory", []):
            if inv["supplier_id"] not in at_risk_suppliers:
                continue
            # Stock is used at the supplier's old share until a sourcing shift starts, then at its new share
            # (zero if the company stops buying from it), unless the plan says to use stock first.
            used = 0.0
            for cid in inv["usable_in_components"]:
                p, comp = index(base)[1][cid]
                per_month = p["annual_units"] * comp["qty"] / 12
                if cid in inventory_first:
                    used += per_month * months_left
                    continue
                share_of = lambda c: next((s["share"] for s in c["sourcing"] if s["supplier_id"] == inv["supplier_id"]), 0)
                old_share, new_share = share_of(comp), share_of(components[cid][1])
                switch = min(shift_start.get(cid, months_left), months_left)
                used += per_month * (old_share * switch + new_share * (months_left - switch))
            left = max(0.0, inv["units"] - used)
            if left > 0:
                writeoffs.append({"item": f"Unsellable stock: {inv['item']}", "amount": money(left * inv["unit_cost"]),
                                  "how": f"{inv['units']} units - {used:.0f} used in the {months_left} months before the rule = {left:.0f} left x ${inv['unit_cost']}"})

    # 5. Supplier contracts and capacity
    penalties = []
    units_after = supplier_units(state)
    units_base = supplier_units(base)
    for sid, sup in suppliers.items():
        c = sup.get("contract")
        if c and c.get("min_annual_units") and units_base.get(sid, 0) >= c["min_annual_units"] > units_after.get(sid, 0):
            months_to_end = months_between(as_of, dt.date.fromisoformat(c["ends"]))
            if sid in reduced_by_option:
                when = min((shift_start[cid] for cid in shift_start), default=0)
            else:
                when = months_left if months_left is not None else 0
            if when < months_to_end and c.get("early_exit_penalty"):
                penalties.append({"item": f"Early exit penalty, {sup['name']} contract", "amount": money(c["early_exit_penalty"]),
                                  "how": f"Volume drops below the {c['min_annual_units']}-unit minimum in month {when:.0f}, before the contract ends in month {months_to_end:.0f}. Check for a change-in-law clause."})
        cap = sup.get("available_capacity_units_per_year")
        if cap and units_after.get(sid, 0) > cap:
            warnings.append(f"Not feasible: needs {units_after[sid]:.0f} units a year from {sup['name']}, which can only supply {cap}")

    # 6. Totals
    before, after = pnl(base), pnl(state)
    annual_extra = sum(a["amount"] for a in annual)
    annual_change = after["gross_profit"] - before["gross_profit"] - annual_extra
    costs = one_time + penalties + writeoffs + transition
    one_time_total = sum(c["amount"] for c in costs)
    target = company["financials"].get("target_gross_margin")
    return {
        "scenario_id": scenario["id"],
        "compliant": not issues,
        "compliance_issues": issues,
        "feasible": not any(w.startswith("Not feasible") for w in warnings),
        "warnings": warnings,
        "timing_problems": timing,
        "annual_profit_change": money(annual_change),
        "gross_margin_after": after["gross_margin"],
        "below_target_margin": bool(target and after["gross_margin"] < target),
        "one_time_costs": costs,
        "one_time_total": money(one_time_total),
        "first_year_impact": money(annual_change - one_time_total),
        "products_after": after["products"],
        "added_annual_costs": annual,
        "changes_applied": log,
    }


def base_sourcing(base, cid):
    return next(c for p in base["products"] for c in p["components"] if c["id"] == cid)["sourcing"]


def base_supplier(base, sid):
    return next(s for s in base["suppliers"] if s["id"] == sid)


def scenario_probabilities(plan, p_pass):
    probs = {}
    for branch, p in (("pass", p_pass), ("fail", 1 - p_pass)):
        group = [s for s in plan["scenarios"] if s["branch"] == branch]
        total = sum(s["share_of_branch"] for s in group)
        if group and abs(total - 1) > 0.001:
            raise PlanError(f"'{branch}' scenario shares add up to {total}, not 1.0")
        for s in group:
            probs[s["id"]] = p * s["share_of_branch"]
    return probs


def run(company, plan, forecast):
    as_of = dt.date.fromisoformat(plan["as_of"])
    p_pass = forecast["probability"]
    probs = scenario_probabilities(plan, p_pass)
    options = plan["options"]
    if not any(o["id"] == "do_nothing" for o in options):
        options = [{"id": "do_nothing", "name": "Do nothing", "actions": []}] + options

    results = []
    for o in options:
        by_s = [evaluate(company, plan, o, s, as_of) for s in plan["scenarios"]]
        for r in by_s:
            r["probability"] = round(probs[r["scenario_id"]], 4)
        expected = sum(r["first_year_impact"] * r["probability"] for r in by_s)
        results.append({
            "option_id": o["id"], "option_name": o["name"], "description": o.get("description", ""),
            "expected_first_year_impact": money(expected),
            "worst_case": money(min(r["first_year_impact"] for r in by_s)),
            "best_case": money(max(r["first_year_impact"] for r in by_s)),
            "compliant_in_every_pass_scenario": all(r["compliant"] and not r["timing_problems"] for r in by_s
                                                    if next(s for s in plan["scenarios"] if s["id"] == r["scenario_id"])["branch"] == "pass"),
            "feasible": all(r["feasible"] for r in by_s),
            "by_scenario": by_s,
        })

    ranked = sorted([r for r in results if r["feasible"]], key=lambda r: r["expected_first_year_impact"], reverse=True)
    return {
        "bill_id": plan["bill_id"],
        "as_of": plan["as_of"],
        "pass_probability": p_pass,
        "probability_any_rule_applies": round(sum(probs[s["id"]] for s in plan["scenarios"]
                                                  if s.get("months_until_rule_applies") is not None), 4),
        "baseline": pnl(company),
        "scenarios": [{"id": s["id"], "name": s["name"], "branch": s["branch"], "probability": round(probs[s["id"]], 4),
                       "months_until_rule_applies": s.get("months_until_rule_applies")} for s in plan["scenarios"]],
        "options": results,
        "ranking_by_expected_impact": [r["option_id"] for r in ranked],
        "method_notes": [
            "Annual profit change is the yearly gross profit change once the rule applies, minus any added yearly costs.",
            "First-year impact = annual profit change - one-time costs (certifications, penalties, unsellable stock, lost sales while fixes finish).",
            "Expected impact weights each scenario by its probability. Pass probability comes from forecast.py.",
            "Products that break a rule are treated as unsellable once the rule applies.",
            "While fixes are still finishing, the whole product is treated as unsellable (no partial sales from already-compliant suppliers), so gap losses are a worst case.",
            "Costs before the rule applies (for example, paying more for certified parts early) are not counted.",
        ],
    }


if __name__ == "__main__":
    company = json.load(open(sys.argv[1]))
    plan = json.load(open(sys.argv[2]))
    forecast = json.load(open(sys.argv[3]))
    try:
        print(json.dumps(run(company, plan, forecast), indent=2))
    except (PlanError, KeyError) as e:
        print(json.dumps({"error": f"Invalid plan: {e}"}), file=sys.stderr)
        sys.exit(1)
