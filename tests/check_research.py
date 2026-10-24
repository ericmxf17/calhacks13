"""Check Agent 2's output: format, sources, quotes, and forecast adjustments.

Usage:
    python3 check_research.py research.json [bill-analysis.json]

- FAIL: missing fields, broken rules (bad factor IDs, multipliers out of range,
  old or missing evidence, long quotes), or links that return "not found".
- WARN: things worth a human look, like a site that blocks automated checks or a
  quote that couldn't be found on its page.
- If a bill analysis is given, also runs forecast.py with the research adjustments.

The research can be raw JSON or a reply with a ```json code block in it.
"""
import datetime as dt, html, json, os, re, subprocess, sys, urllib.error, urllib.request

FACTORS = {
    "admin_support": (1.3, 1.5), "admin_opposition": (0.5, 0.7),
    "floor_vote_scheduled": (1.5, 2.0), "must_pass_package": (1.5, 2.0),
    "member_hold": (0.6, 0.8), "industry_opposition": (0.7, 0.9),
    "broad_coalition": (1.1, 1.3), "competing_bill": (0.7, 0.9),
}
REQUIRED = ["bill_id", "expert_analysis", "stakeholders", "lobbying", "comparable_past_laws",
            "alternative_paths", "political_context", "forecast_adjustments", "key_uncertainties", "sources"]
STANCES = {"support", "oppose", "neutral", "mixed", "unknown"}
HERE = os.path.dirname(os.path.abspath(__file__))


def load(path):
    raw = open(path).read()
    block = re.search(r"```json\s*(\{.*\})\s*```", raw, re.S)
    return json.loads(block.group(1) if block else raw)


def fetch(url):
    """Returns (status, text). status is an HTTP code, or 0 if the site couldn't be reached."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read(3_000_000).decode("utf-8", "ignore")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        # Some Mac Python installs lack SSL certificates; curl uses the system ones.
        r = subprocess.run(["curl", "-sL", "-m", "20", "-A", "Mozilla/5.0", "-w", "\n%{http_code}", url],
                           capture_output=True, text=True, errors="ignore")
        body, _, code = r.stdout.rpartition("\n")
        return (int(code) if code.isdigit() else 0), body


def squash(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return " ".join(s.lower().split())


def main():
    r = load(sys.argv[1])
    analysis_path = sys.argv[2] if len(sys.argv) > 2 else None
    fails, warns, passes = [], [], []

    missing = [k for k in REQUIRED if k not in r]
    (fails if missing else passes).append(f"missing fields: {missing}" if missing else "all fields present")

    experts = r.get("expert_analysis", [])
    n = len(experts)
    (passes if 4 <= n <= 8 else warns).append(f"{n} expert sources" + ("" if 4 <= n <= 8 else " (aim for 4 to 8)"))
    primary = sum(e.get("source_type") != "news" for e in experts)
    (passes if primary >= n / 2 else warns).append(f"{primary} of {n} expert sources are primary (not news)")

    for e in experts:
        q = e.get("short_quote", "")
        words = len(q.split())
        if words > 25:
            fails.append(f"quote from {e.get('organization')} is {words} words (max 25)")
        if e.get("stance") not in STANCES:
            fails.append(f"bad stance '{e.get('stance')}' for {e.get('organization')}")

    lob = r.get("lobbying", {})
    (passes if lob.get("searched") else fails).append("lobbying search was run" if lob.get("searched") else "lobbying search was NOT run")

    laws = r.get("comparable_past_laws", [])
    (passes if laws else warns).append(f"{len(laws)} comparable past laws")
    for law in laws:
        for eff in law.get("what_happened", []):
            if not eff.get("evidence_url"):
                fails.append(f"effect of {law.get('name')} has no source: {eff.get('effect', '')[:60]}")

    adj = r.get("forecast_adjustments", [])
    if len(adj) > 4:
        fails.append(f"{len(adj)} forecast adjustments (max 4)")
    generated = r.get("generated_at")
    for a in adj:
        f, m = a.get("factor"), a.get("multiplier")
        if f not in FACTORS:
            fails.append(f"adjustment uses unknown factor '{f}'")
            continue
        lo, hi = FACTORS[f]
        if not isinstance(m, (int, float)) or not lo <= m <= hi:
            fails.append(f"{f} multiplier {m} is outside {lo} to {hi}")
        if not a.get("evidence_url"):
            fails.append(f"{f} has no evidence_url")
        try:
            age = (dt.date.fromisoformat(generated) - dt.date.fromisoformat(a.get("evidence_date", ""))).days
            (fails if age > 366 else passes).append(f"{f} evidence is {age} days old" + (" (max 12 months)" if age > 366 else ""))
        except (TypeError, ValueError):
            fails.append(f"{f} has no valid evidence_date")
    if not adj:
        passes.append("no forecast adjustments (allowed)")

    # Every link: does it load, and does the quote appear on its page?
    quotes = {e.get("url"): e.get("short_quote") for e in experts if e.get("url")}
    urls = set(r.get("sources", [])) | set(quotes)
    for group in ("stakeholders", "alternative_paths", "political_context", "forecast_adjustments"):
        urls |= {x.get("evidence_url") for x in r.get(group, []) if x.get("evidence_url")}
    for law in laws:
        urls |= {e.get("evidence_url") for e in law.get("what_happened", []) if e.get("evidence_url")}
    urls.discard(None)
    print(f"Checking {len(urls)} links...", file=sys.stderr)
    for url in sorted(urls):
        status, body = fetch(url)
        if status in (404, 410):
            fails.append(f"link not found ({status}): {url}")
        elif status == 0:
            warns.append(f"couldn't reach: {url}")
        elif status >= 400:
            warns.append(f"site blocked the automated check ({status}), open it yourself: {url}")
        elif url in quotes and quotes[url]:
            if url.lower().endswith(".pdf"):
                warns.append(f"PDF, check the quote by hand: {url}")
            elif squash(quotes[url]) in squash(body):
                passes.append(f"quote found on page: {url}")
            else:
                warns.append(f"quote not found on page (could be loaded by script, or wrong): {url}")
        else:
            passes.append(f"link works: {url}")

    for p in passes:
        print(f"  PASS  {p}")
    for w in warns:
        print(f"  WARN  {w}")
    for f in fails:
        print(f"  FAIL  {f}")
    print(f"\n{len(passes)} passed, {len(warns)} warnings, {len(fails)} failed")

    if analysis_path:
        out = subprocess.run([sys.executable, os.path.join(HERE, "..", "forecast", "forecast.py"), analysis_path, sys.argv[1]],
                             capture_output=True, text=True)
        if out.returncode == 0:
            fc = json.loads(out.stdout)
            print(f"\nForecast: {fc['model_probability']:.1%} from the model, {fc['probability']:.1%} after research ({fc['research_adjustment_total']})")
        else:
            print("\nForecast failed:", out.stderr.strip()[-300:])
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
