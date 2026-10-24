"""Train the bill passage model from past Congresses and test it on a held-out one.

Usage:
    python3 train_forecast.py --data 117=/path/bulk117 --data 118=/path/bulk118 --out forecast-model.json

Each data folder holds unzipped BILLSTATUS XML files from
https://www.govinfo.gov/bulkdata/BILLSTATUS/{congress}/{hr|s}/BILLSTATUS-{congress}-{hr|s}.zip

Pure Python, no packages needed.
"""
import argparse, glob, json, math, re, datetime as dt
import xml.etree.ElementTree as ET

CONGRESSES = json.load(open(__file__.replace("train_forecast.py", "congresses.json")))
STAGES = ["introduced", "reported", "passed_one", "passed_both"]
DAYS_LEFT_SAMPLES = [700, 540, 365, 270, 180, 120, 72, 30, 10]
FEATURES = ["intercept", "log_days_left", "bipartisan", "origin_chamber_control",
            "other_chamber_control", "companion_bill", "many_cosponsors"]


def parse_date(s):
    try:
        return dt.date.fromisoformat((s or "")[:10])
    except ValueError:
        return None


def caucus(party):
    # Independents in these Congresses caucused with Democrats.
    return "D" if party == "I" else party


def load_bills(congress, folder):
    bills = {}
    for f in glob.glob(f"{folder}/*/*.xml"):
        b = ET.parse(f).getroot().find("bill")
        btype = (b.findtext("type") or "").lower()
        if btype not in ("hr", "s"):
            continue
        sp = b.find("sponsors/item")
        if sp is None:
            continue
        actions = [(parse_date(a.findtext("actionDate")), a.findtext("text") or "") for a in b.findall("actions/item")]
        cosponsors = [(parse_date(c.findtext("sponsorshipDate")), parse_date(c.findtext("sponsorshipWithdrawnDate")), c.findtext("party"))
                      for c in b.findall("cosponsors/item")]
        companions = [(x.findtext("type") or "").lower() + (x.findtext("number") or "")
                      for x in b.findall("relatedBills/item")
                      if any(y.findtext("type") == "Identical bill" for y in x.findall("relationshipDetails/item"))]
        bills[btype + b.findtext("number")] = {
            "type": btype,
            "introduced": parse_date(b.findtext("introducedDate")),
            "sponsor_party": caucus(sp.findtext("party")),
            "actions": [(d, t) for d, t in actions if d],
            "cosponsors": cosponsors,
            "companions": companions,
            "enacted": bool(b.findall("laws/item")) or any("Became Public Law" in t for _, t in actions),
        }
    return bills


def stage_at(actions, on):
    st, chambers = 0, set()
    for d, txt in actions:
        if d > on:
            continue
        if re.search(r"\bReported\b|Ordered to be Reported", txt):
            st = max(st, 1)
        m = re.search(r"Passed/agreed to in (House|Senate)", txt)
        if m:
            chambers.add(m.group(1))
        if "Became Public Law" in txt:
            return "enacted"
    if chambers:
        st = max(st, 3 if len(chambers) == 2 else 2)
    return STAGES[st]


def features(bill, congress, days_left, on, all_bills):
    info = CONGRESSES[str(congress)]
    own = "house" if bill["type"] == "hr" else "senate"
    other = "senate" if own == "house" else "house"
    active = [caucus(p) for sd, wd, p in bill["cosponsors"] if sd and sd <= on and (not wd or wd > on)]
    companion = any(all_bills.get(c) and all_bills[c]["introduced"] and all_bills[c]["introduced"] <= on
                    for c in bill["companions"])
    return {
        "intercept": 1.0,
        "log_days_left": math.log(max(days_left, 1)),
        "bipartisan": float(any(p and p != bill["sponsor_party"] for p in active)),
        "origin_chamber_control": float(bill["sponsor_party"] == info["majority"][own]),
        "other_chamber_control": float(bill["sponsor_party"] == info["majority"][other]),
        "companion_bill": float(companion),
        "many_cosponsors": float(len(active) >= (20 if own == "house" else 5)),
    }


def build_rows(congress, bills):
    end = parse_date(CONGRESSES[str(congress)]["ends"])
    rows = []
    for bill in bills.values():
        for days_left in DAYS_LEFT_SAMPLES:
            on = end - dt.timedelta(days=days_left)
            if not bill["introduced"] or bill["introduced"] > on:
                continue
            stage = stage_at(bill["actions"], on)
            if stage == "enacted":
                continue
            rows.append((stage, features(bill, congress, days_left, on, bills), float(bill["enacted"])))
    return rows


def solve(a, b):
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c and m[c][c]:
                f = m[r][c] / m[c][c]
                m[r] = [x - f * y for x, y in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] if m[i][i] else 0.0 for i in range(n)]


def sigmoid(z):
    return 1 / (1 + math.exp(-max(min(z, 30), -30)))


def fit(rows, l2=1.0, iters=25):
    """Logistic regression by Newton's method with a small L2 penalty (intercept unpenalized)."""
    k = len(FEATURES)
    w = [0.0] * k
    xs = [[f[n] for n in FEATURES] for _, f, _ in rows]
    ys = [y for _, _, y in rows]
    for _ in range(iters):
        g = [0.0] * k
        h = [[0.0] * k for _ in range(k)]
        for x, y in zip(xs, ys):
            p = sigmoid(sum(a * b for a, b in zip(w, x)))
            s = p * (1 - p)
            for i in range(k):
                g[i] += (y - p) * x[i]
                for j in range(i, k):
                    h[i][j] += s * x[i] * x[j]
        for i in range(k):
            for j in range(i):
                h[i][j] = h[j][i]
            if i:
                g[i] -= l2 * w[i]
                h[i][i] += l2
        step = solve(h, g)
        w = [a + b for a, b in zip(w, step)]
        if max(abs(s) for s in step) < 1e-6:
            break
    return dict(zip(FEATURES, w))


def train(rows):
    model = {}
    for stage in STAGES:
        stage_rows = [r for r in rows if r[0] == stage]
        if stage == "passed_both":
            # Too few cases for a full model: use the observed rate.
            rate = sum(y for _, _, y in stage_rows) / max(len(stage_rows), 1)
            model[stage] = {"fixed_probability": round(rate, 3), "n": len(stage_rows)}
        else:
            model[stage] = {"weights": {k: round(v, 4) for k, v in fit(stage_rows).items()}, "n": len(stage_rows)}
    return model


def predict(model, stage, feats):
    m = model[stage]
    if "fixed_probability" in m:
        return m["fixed_probability"]
    return sigmoid(sum(m["weights"][k] * feats[k] for k in FEATURES))


def evaluate(model, rows, label):
    base = {s: sum(y for st, _, y in rows if st == s) / max(sum(1 for st, _, _ in rows if st == s), 1) for s in STAGES}
    brier_model = sum((predict(model, s, f) - y) ** 2 for s, f, y in rows) / len(rows)
    brier_stage = sum((base[s] - y) ** 2 for s, f, y in rows) / len(rows)
    print(f"\n[{label}] {len(rows)} bill-snapshots")
    print(f"  Brier score, full model:      {brier_model:.5f}")
    print(f"  Brier score, stage-only rate: {brier_stage:.5f}  (lower is better)")
    print("  Calibration (predicted vs actual), bills past committee:")
    later = [(predict(model, s, f), y) for s, f, y in rows if s != "introduced"]
    for lo, hi in [(0, .05), (.05, .15), (.15, .3), (.3, .5), (.5, 1.01)]:
        g = [(p, y) for p, y in later if lo <= p < hi]
        if g:
            print(f"    {lo:4.0%}-{min(hi, 1):4.0%}: n={len(g):5d}  predicted {sum(p for p, _ in g)/len(g):5.1%}  actual {sum(y for _, y in g)/len(g):5.1%}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", action="append", required=True, help="congress=folder")
    ap.add_argument("--out", default="forecast-model.json")
    args = ap.parse_args()

    by_congress = {}
    for item in args.data:
        c, folder = item.split("=", 1)
        bills = load_bills(int(c), folder)
        by_congress[c] = build_rows(int(c), bills)
        print(f"Congress {c}: {len(bills)} bills, {sum(b['enacted'] for b in bills.values())} enacted")

    # Backtest: train on each Congress, test on the others.
    if len(by_congress) > 1:
        for test_c in by_congress:
            train_rows = [r for c, rs in by_congress.items() if c != test_c for r in rs]
            evaluate(train(train_rows), by_congress[test_c], f"trained without {test_c}th, tested on {test_c}th")

    all_rows = [r for rs in by_congress.values() for r in rs]
    model = {"trained_on_congresses": sorted(by_congress), "features": FEATURES, "stages": train(all_rows)}
    json.dump(model, open(args.out, "w"), indent=2)
    print(f"\nSaved {args.out}")
