"""Check that every number in a brief came from the calculations, not from the AI.

Usage:
    python3 verify_brief.py brief.json forecast.json impact-results.json company.json [impact-plan.json]

Prints any number in the brief that can't be traced to an input file, and exits with code 1 if
there are any. Rounding for display is allowed ($217K matches 217350, 22.5% matches 0.225).
"""
import json, re, sys

IGNORE = [
    r"\d{4}-\d{2}-\d{2}",                          # dates
    r"\b(?:H\.R\.|S\.|H\.J\.Res\.|S\.J\.Res\.)\s?\d+",  # bill numbers
    r"\bUL \d+", r"\bSec(?:tion|\.)\s?\d+[\w()]*",  # standards, sections
    r"\b\d{1,3}(?:st|nd|rd|th)\b",                 # "119th"
    r"\b(?:19|20)\d{2}\b",                         # years
    r"\b[A-Z]{1,4}-?\d+\b",                        # IDs like P1, S0, A4
]
MONEY = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)\s?([KMB])?\b", re.I)
PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s?%")
NUMBER = re.compile(r"(?<![\w.])(\d[\d,]*(?:\.\d+)?)(?![\w%])")
SCALE = {"K": 1e3, "M": 1e6, "B": 1e9}


def strings(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings(v)
    elif isinstance(obj, str):
        yield obj


def numbers(obj):
    if isinstance(obj, bool):
        return
    if isinstance(obj, (int, float)):
        yield float(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from numbers(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from numbers(v)
    elif isinstance(obj, str):
        for m in re.finditer(r"-?\d[\d,]*(?:\.\d+)?", obj):
            try:
                yield float(m.group(0).replace(",", ""))
            except ValueError:
                pass


def half_unit(text_number, scale=1.0):
    decimals = len(text_number.split(".")[1]) if "." in text_number else 0
    return 0.5 * 10 ** -decimals * scale


def matches(value, tol, allowed):
    return any(abs(abs(a) - value) <= tol + 1e-9 for a in allowed)


def check(brief, allowed):
    allowed_pct = allowed | {a * 100 for a in allowed if abs(a) <= 1}
    problems = []
    for s in strings(brief):
        text = s
        for pat in IGNORE:
            text = re.sub(pat, " ", text)
        for m in MONEY.finditer(text):
            scale = SCALE.get((m.group(2) or "").upper(), 1.0)
            v = float(m.group(1).replace(",", "")) * scale
            if not matches(v, half_unit(m.group(1), scale), allowed):
                problems.append((m.group(0), s))
        text = MONEY.sub(" ", text)
        for m in PERCENT.finditer(text):
            v = float(m.group(1))
            if not matches(v, half_unit(m.group(1)), allowed_pct):
                problems.append((m.group(0), s))
        text = PERCENT.sub(" ", text)
        for m in NUMBER.finditer(text):
            v = float(m.group(1).replace(",", ""))
            if v <= 12 and v == int(v):
                continue  # small counts like "3 options"
            if not matches(v, half_unit(m.group(1)), allowed):
                problems.append((m.group(0), s))
    return problems


if __name__ == "__main__":
    brief = json.load(open(sys.argv[1]))
    allowed = set()
    for path in sys.argv[2:]:
        allowed |= set(numbers(json.load(open(path))))
    problems = check(brief, allowed)
    if problems:
        print(f"{len(problems)} number(s) could not be traced to the inputs:")
        for num, context in problems:
            print(f"  {num!r} in: {context}")
        sys.exit(1)
    print("All numbers in the brief trace back to the inputs.")
