"""Print a run's brief in the terminal, formatted for reading.

Usage:
    python3 backend/show_brief.py              # the most recent run
    python3 backend/show_brief.py runs/<folder>
"""
import glob, json, os, sys, textwrap

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH = 88


def wrap(text, indent="  "):
    return textwrap.fill(text, WIDTH, initial_indent=indent, subsequent_indent=indent + "  ")


def heading(title):
    print(f"\n{title.upper()}\n{'-' * len(title)}")


def main():
    if len(sys.argv) > 1:
        folder = sys.argv[1]
    else:
        runs = sorted(glob.glob(os.path.join(ROOT, "runs", "*")), key=os.path.getmtime)
        if not runs:
            sys.exit("No runs yet. Try: python3 backend/pipeline.py hr 973 --companion s389 --demo")
        folder = runs[-1]
    path = os.path.join(folder, "8-brief.json")
    if not os.path.exists(path):
        sys.exit(f"{folder} has no brief yet. Check summary.json there to see where it stopped.")
    b = json.load(open(path))
    summary = json.load(open(os.path.join(folder, "summary.json")))
    check = summary.get("steps", {}).get("9 number check", {})

    print("=" * WIDTH)
    print(textwrap.fill(b["headline"], WIDTH))
    print("=" * WIDTH)
    print(f"Run: {os.path.basename(folder)}   Number check: "
          + ("PASSED" if check.get("verified") else f"FLAGGED {len(check.get('untraced_numbers', []))} number(s)"))

    heading("The bill")
    print(wrap(b["bill_in_plain_english"]))

    heading("Odds: " + b["odds"]["probability_text"])
    for w in b["odds"]["why"]:
        print(wrap("- " + w))

    heading("What it means")
    for w in b["what_it_means"]:
        print(wrap("- " + w))

    r = b["recommendation"]
    heading("Recommendation")
    print(wrap(r["summary"]))
    print(wrap("Why: " + r["why"]))
    print(wrap("Tradeoff: " + r["tradeoff"]))
    print("  Switch if:")
    for s in r["switch_if"]:
        print(wrap("- " + s, "    "))

    heading("Options compared")
    print(f"  {'Option':52s} {'Expected':>10s} {'Worst':>10s}  Ready?")
    for o in b["options_compared"]:
        print(f"  {o['name'][:52]:52s} {o['expected_impact_text']:>10s} {o['worst_case_text']:>10s}  "
              f"{'yes' if o['ready_if_it_passes'] else 'no'}")

    heading("Next steps")
    for s in b["next_steps"]:
        print(wrap(f"- {s['step']} ({s['who']}, {s['by_when']})"))

    print(f"\n{b.get('disclaimer', '')}\n")


if __name__ == "__main__":
    main()
