"""Check Agent 1's output: format, facts, and quotes.

Usage:
    python3 check_bill_analysis.py agent-output.json [expected.json]

- Checks that every required field is present.
- Checks that every provision's quote appears word for word in the official bill text (from govinfo).
- If an expected file is given, compares the status facts and provisions against it.
  The expected file can be a full answer (agents/hr973-expected-output.json) or
  status only (tests/hr9615-status.json).

The agent output can be raw JSON or a reply with a ```json code block in it.
"""
import html, json, re, subprocess, sys, urllib.request

REQUIRED = {
    "bill": ["id", "congress", "type", "number", "title", "url", "text_version_used"],
    "status": ["stage", "latest_action", "sponsor", "cosponsors", "committees", "chamber_votes",
               "companion_bills", "congress_ends", "days_until_congress_ends"],
    "provision": ["id", "section", "type", "plain_english", "who_must_act", "affected_products",
                  "standards_referenced", "timing", "business_relevance", "quote", "confidence"],
}
VERSIONS = ["enr", "eh", "es", "rh", "rs", "ih", "is"]


def load(path):
    raw = open(path).read()
    block = re.search(r"```json\s*(\{.*\})\s*```", raw, re.S)
    return json.loads(block.group(1) if block else raw)


def squash(s):
    return " ".join(html.unescape(s).replace("``", '"').replace("''", '"').split())


def fetch(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        return urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    except Exception:
        # Some Mac Python installs lack SSL certificates; curl uses the system ones.
        r = subprocess.run(["curl", "-sf", "-A", "Mozilla/5.0", url], capture_output=True, text=True, errors="ignore")
        return r.stdout if r.returncode == 0 else None


def bill_texts(congress, btype, number):
    texts = []
    for v in VERSIONS:
        body = fetch(f"https://www.govinfo.gov/content/pkg/BILLS-{congress}{btype}{number}{v}/html/BILLS-{congress}{btype}{number}{v}.htm")
        if body:
            texts.append(squash(re.sub(r"<[^>]+>", " ", body)))
    return texts


def main():
    out = load(sys.argv[1])
    expected = load(sys.argv[2]) if len(sys.argv) > 2 else None
    fails, passes = [], []

    for key in ("bill", "status"):
        missing = [f for f in REQUIRED[key] if f not in out.get(key, {})]
        (fails if missing else passes).append(f"{key} fields" + (f": missing {missing}" if missing else ""))
    provisions = out.get("provisions", [])
    if not provisions:
        fails.append("no provisions")
    for p in provisions:
        missing = [f for f in REQUIRED["provision"] if f not in p]
        if missing:
            fails.append(f"provision {p.get('id')}: missing {missing}")

    b = out["bill"]
    texts = bill_texts(b["congress"], b["type"], b["number"])
    if not texts:
        fails.append("could not download the bill text from govinfo to check quotes")
    else:
        for p in provisions:
            q = squash(p.get("quote", ""))
            ok = bool(q) and any(q in t for t in texts)
            (passes if ok else fails).append(f"quote {p.get('id')} found in bill text" if ok else f"quote {p.get('id')} NOT found word for word: {q[:80]}...")

    if expected:
        es, os_ = expected["status"], out["status"]
        checks = [
            ("stage", es.get("stage"), os_.get("stage")),
            ("sponsor party", es.get("sponsor", {}).get("party"), os_.get("sponsor", {}).get("party")),
            ("cosponsor total", es.get("cosponsors", {}).get("total"), os_.get("cosponsors", {}).get("total")),
        ]
        for party in ("D", "R", "I"):
            checks.append((f"cosponsors {party}", es.get("cosponsors", {}).get("by_party", {}).get(party, 0),
                           os_.get("cosponsors", {}).get("by_party", {}).get(party, 0)))
        for ev in es.get("chamber_votes", []):
            match = next((v for v in os_.get("chamber_votes", []) if v.get("chamber") == ev["chamber"]), {})
            checks.append((f"{ev['chamber']} vote", (ev.get("yeas"), ev.get("nays")), (match.get("yeas"), match.get("nays"))))
        exp_comp = {c["id"] for c in es.get("companion_bills", [])}
        got_comp = {c.get("id") for c in os_.get("companion_bills", [])}
        if exp_comp or got_comp:
            checks.append(("companion bills", sorted(exp_comp), sorted(got_comp & exp_comp) if exp_comp else sorted(got_comp)))
        for name, want, got in checks:
            (passes if want == got else fails).append(f"{name}: {got}" if want == got else f"{name}: expected {want}, got {got}")

        if "provisions" in expected:
            want_std = {s for p in expected["provisions"] for s in p["standards_referenced"]}
            got_std = {s for p in provisions for s in p.get("standards_referenced", [])}
            (passes if want_std <= got_std else fails).append(
                f"standards found: {sorted(got_std)}" if want_std <= got_std else f"standards: missing {sorted(want_std - got_std)}")
            want_high = sum(p["business_relevance"] == "high" for p in expected["provisions"])
            got_high = sum(p.get("business_relevance") == "high" for p in provisions)
            note = f"high-relevance provisions: expected {want_high}, got {got_high}"
            (passes if abs(want_high - got_high) <= 1 else fails).append(note)
            unknown = any(not p.get("timing", {}).get("compliance_date_known", True) for p in provisions)
            (passes if unknown else fails).append("flags the unknown compliance date" if unknown else "did NOT flag the unknown compliance date")

    for p in passes:
        print(f"  PASS  {p}")
    for f in fails:
        print(f"  FAIL  {f}")
    print(f"\n{len(passes)} passed, {len(fails)} failed")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
