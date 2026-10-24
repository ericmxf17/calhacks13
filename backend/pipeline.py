"""Run the whole pipeline for one bill: four CREAO agents with the scripts between them.

Usage:
    python3 backend/pipeline.py hr 973 --companion s389     # live: calls the four CREAO agents
    python3 backend/pipeline.py hr 973 --demo               # demo: uses saved agent outputs, no API calls
    python3 backend/pipeline.py --resume runs/hr973-119-20261024-153000

Every step saves its output in a run folder under runs/. If a step fails, fix the problem
and rerun with --resume: finished steps are skipped.

Live mode needs each agent's appId and capi_ key in backend/.env (see backend/.env.example).
Pure Python, no packages needed.
"""
import argparse, datetime as dt, json, os, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for sub in ("backend", "forecast", "impact"):
    sys.path.insert(0, os.path.join(ROOT, sub))

import creao, forecast as forecast_model, impact, slim_inputs, brief_inputs, verify_brief  # noqa: E402

AGENTS = {
    "bill_analyst": "CREAO_BILL_ANALYST",
    "researcher": "CREAO_RESEARCHER",
    "impact_planner": "CREAO_IMPACT_PLANNER",
    "brief_writer": "CREAO_BRIEF_WRITER",
}

# Saved real outputs from the CREAO agents, used by --demo
DEMO = {
    "hr973-119": {
        "1-bill-analysis.json": "tests/agent1-hr973.json",
        "2-research.json": "tests/agent2-hr973.json",
        "5-impact-plan.json": "tests/agent3-hr973.json",
        "8-brief.json": "tests/agent4-hr973-brief.json",
    },
    "hr9615-119": {
        "1-bill-analysis.json": "tests/agent1-hr9615.json",
        "2-research.json": "tests/agent2-hr9615.json",
    },
}

STAGES = ["introduced", "in_committee", "reported_by_committee", "passed_one_chamber",
          "passed_both_chambers", "enacted", "failed"]


class PipelineError(Exception):
    pass


def load_env():
    path = os.path.join(ROOT, "backend", ".env")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def agent_credentials(name):
    prefix = AGENTS[name]
    app_id, key = os.environ.get(f"{prefix}_APP_ID"), os.environ.get(f"{prefix}_KEY")
    if not app_id or not key:
        raise PipelineError(f"Missing {prefix}_APP_ID or {prefix}_KEY in backend/.env")
    return app_id, key


class Run:
    def __init__(self, folder, demo=False):
        self.folder, self.demo = folder, demo
        os.makedirs(folder, exist_ok=True)
        self.summary_path = os.path.join(folder, "summary.json")
        self.summary = json.load(open(self.summary_path)) if os.path.exists(self.summary_path) else {"steps": {}}

    def path(self, name):
        return os.path.join(self.folder, name)

    def has(self, name):
        return os.path.exists(self.path(name))

    def read(self, name):
        return json.load(open(self.path(name)))

    def write(self, name, data):
        json.dump(data, open(self.path(name), "w"), indent=2, ensure_ascii=False)

    def note(self, step, **info):
        self.summary["steps"].setdefault(step, {}).update(info)
        json.dump(self.summary, open(self.summary_path, "w"), indent=2, ensure_ascii=False)


def log(msg):
    print(msg, flush=True)


def call_agent(run, step, agent, inputs, out_name, expected_file, required):
    """Run one CREAO agent (or copy its saved output in demo mode) and save the JSON.

    If an earlier attempt already started this step's CREAO run, that run is reused
    instead of starting (and paying for) a new one."""
    if run.has(out_name):
        log(f"  {step}: already done, skipping")
        return run.read(out_name)
    started = time.time()
    if run.demo:
        saved = DEMO.get(run.summary["bill_id"], {}).get(out_name)
        if not saved:
            raise PipelineError(f"No saved output for {out_name} on {run.summary['bill_id']}. Run it live instead.")
        data = slim_inputs.load(os.path.join(ROOT, saved))
        run.note(step, mode="demo", source=saved)
    else:
        app_id, key = agent_credentials(agent)
        tick = lambda state, secs: print(f"\r  {step}: {state} ({secs // 60}m{secs % 60:02d}s)   ", end="", flush=True)
        earlier = run.summary["steps"].get(step, {}).get("run_id")
        if earlier:
            log(f"  {step}: reusing CREAO run {earlier}")
        else:
            run_id = creao.start_run(app_id, key, inputs)
            run.note(step, mode="live", run_id=run_id)  # saved first, so a crash never pays twice
        data, run_id = creao.run_agent(app_id, key, inputs, expected_file, required, on_tick=tick,
                                       run_id=earlier or run_id)
        print()
    run.write(out_name, data)
    run.note(step, seconds=round(time.time() - started), done=True)
    log(f"  {step}: done")
    return data


def check_bill_analysis(a, bill_id):
    missing = [k for k in ("bill", "status", "provisions") if k not in a]
    if missing:
        raise PipelineError(f"Bill Analyst output is missing {missing}")
    if a["bill"].get("id") != bill_id:
        raise PipelineError(f"Bill Analyst analyzed {a['bill'].get('id')}, not {bill_id}")
    if a["status"].get("stage") not in STAGES:
        raise PipelineError(f"Bill Analyst gave an unknown stage: {a['status'].get('stage')}")


def run_pipeline(run, congress, bill_type, number, companion, company_path):
    bill_id = run.summary["bill_id"]
    as_of = run.summary["as_of"]
    company = json.load(open(company_path))

    log("[1/4] Bill Analyst")
    analysis = call_agent(run, "1 bill analyst", "bill_analyst",
                          {"congress": congress, "bill_type": bill_type, "bill_number": number,
                           "companion_bill": companion or ""},
                          "1-bill-analysis.json", "bill-analysis.json", ("bill", "status", "provisions"))
    check_bill_analysis(analysis, bill_id)

    log("[2/4] Researcher")
    research = call_agent(run, "2 researcher", "researcher",
                          {"bill_analysis": json.dumps(analysis, ensure_ascii=False)},
                          "2-research.json", "research.json", ("bill_id", "expert_analysis", "forecast_adjustments"))

    log("      Forecast")
    fc = forecast_model.forecast(analysis, research)
    run.write("3-forecast.json", fc)
    run.note("3 forecast", probability=fc["probability"], done=True)
    log(f"  forecast: {fc['probability']:.1%} chance of becoming law")

    planner_inputs = {"bill_analysis": slim_inputs.slim_analysis(analysis),
                      "research": slim_inputs.slim_research(research),
                      "forecast": slim_inputs.slim_forecast(fc)}
    run.write("4-planner-inputs.json", planner_inputs)

    log("[3/4] Impact Planner")
    plan = call_agent(run, "5 impact planner", "impact_planner",
                      {**{k: json.dumps(v, ensure_ascii=False) for k, v in planner_inputs.items()}, "as_of": as_of},
                      "5-impact-plan.json", "impact-plan.json", ("scenarios", "options", "assumptions"))

    log("      Impact calculator")
    try:
        results = impact.run(company, plan, fc)
    except (impact.PlanError, KeyError, TypeError, ValueError) as e:
        raise PipelineError(f"The calculator rejected Agent 3's plan: {e}. "
                            f"Delete {run.path('5-impact-plan.json')} and rerun with --resume.")
    run.write("6-impact-results.json", results)
    warnings = sorted({w for o in results["options"] for s in o["by_scenario"] for w in s["warnings"]})
    best = results["ranking_by_expected_impact"][0] if results["ranking_by_expected_impact"] else None
    run.note("6 impact", best_option=best, probability_any_rule_applies=results.get("probability_any_rule_applies"),
             warnings=warnings, done=True)
    log(f"  impact: best option is {best}" + (f" ({len(warnings)} warnings)" if warnings else ""))

    bundle = {"bill": brief_inputs.bill(analysis), "forecast": brief_inputs.forecast(fc),
              "research": brief_inputs.research(research), "plan": brief_inputs.plan(plan),
              "impact_results": brief_inputs.results(results), "names": brief_inputs.names(company)}
    run.write("7-brief-inputs.json", bundle)

    log("[4/4] Brief Writer")
    brief = call_agent(run, "8 brief writer", "brief_writer",
                       {"brief_inputs": json.dumps(bundle, ensure_ascii=False)},
                       "8-brief.json", "brief.json", ("headline", "recommendation", "options_compared"))

    log("      Number check")
    allowed = set(verify_brief.numbers(bundle)) | set(verify_brief.numbers(company))
    problems = verify_brief.check(brief, allowed)
    run.note("9 number check", verified=not problems,
             untraced_numbers=[{"number": n, "in": c} for n, c in problems], done=True)
    if problems:
        log(f"  number check: {len(problems)} number(s) could not be traced. See summary.json before showing this brief.")
    else:
        log("  number check: every number traces back to the calculations")
    return brief


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("bill_type", nargs="?", help="hr, s, hjres, or sjres")
    ap.add_argument("number", nargs="?", type=int)
    ap.add_argument("--congress", type=int, default=119)
    ap.add_argument("--companion", default="", help="matching bill in the other chamber, e.g. s389")
    ap.add_argument("--company", default=os.path.join(ROOT, "company.json"))
    ap.add_argument("--demo", action="store_true", help="use saved agent outputs instead of calling CREAO")
    ap.add_argument("--resume", help="a run folder to continue")
    args = ap.parse_args()
    load_env()

    if args.resume:
        run = Run(args.resume)
        run.demo = run.summary.get("demo", False)
        s = run.summary
        congress, bill_type, number, companion = s["congress"], s["bill_type"], s["number"], s.get("companion", "")
    else:
        if not args.bill_type or not args.number:
            ap.error("give a bill type and number, like: hr 973")
        congress, bill_type, number, companion = args.congress, args.bill_type.lower(), args.number, args.companion.lower()
        bill_id = f"{bill_type}{number}-{congress}"
        stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
        run = Run(os.path.join(ROOT, "runs", f"{bill_id}-{stamp}{'-demo' if args.demo else ''}"), demo=args.demo)
        run.summary.update({"bill_id": bill_id, "congress": congress, "bill_type": bill_type, "number": number,
                            "companion": companion, "as_of": dt.date.today().isoformat(), "demo": args.demo})
        run.note("0 start", started_at=dt.datetime.now().isoformat(timespec="seconds"))

    log(f"Run folder: {run.folder}")
    try:
        run_pipeline(run, congress, bill_type, number, companion, args.company)
    except (PipelineError, creao.CreaoError) as e:
        run.note("error", message=str(e))
        log(f"\nStopped: {e}\nFix the problem, then continue with:\n  python3 backend/pipeline.py --resume {run.folder}")
        sys.exit(1)
    run.note("done", finished_at=dt.datetime.now().isoformat(timespec="seconds"))
    log(f"\nDone. The brief is in {run.path('8-brief.json')}")


if __name__ == "__main__":
    main()
