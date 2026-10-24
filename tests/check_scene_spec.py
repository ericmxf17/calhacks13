"""Check the Scene Designer agent's output (SceneSpec v1) for one test company.

Usage:
    python3 tests/check_scene_spec.py <reply-or-job.json> tests/scene-profiles/<name>.json
    python3 tests/check_scene_spec.py --all

- FAIL: anything the app's validator would have to repair: unknown or extra keys,
  values outside the allowed lists, bad colors, an unreadable sign, too few or too
  many rooms, text over its length limit, or digits that aren't in the profile.
- WARN: taste issues: a different building type than expected, no finance room,
  parts but no supply room, or more rooms than a small service business needs.
- --all checks every saved reply in tests/scene-outputs/ (named <profile>-<n>.json)
  against its profile and prints a summary.

The reply can be raw JSON, a reply with a ```json code block in it, or a saved job
file (web/.backend/jobs/<id>/job.json).
"""
import glob, json, os, re, sys

ARCHETYPES = {"storefront", "workshop", "cafe", "studio", "warehouse"}
GROUNDS = {"lawn", "plaza", "gravel"}
ROOF_PROPS = {"solar_panels", "water_tower", "rooftop_garden", "vents", "antenna", "chimney"}
GROUND_PROPS = {"planters", "benches", "bike_rack", "delivery_van", "pallets", "cafe_tables", "street_lamps"}
KINDS = {"finance", "sales", "marketing", "supply", "product", "operations", "people", "custom"}
FURNITURE = {"desk", "shelves", "workbench", "counter", "meeting_table", "drafting_table", "lounge", "crates"}
TOP_KEYS = {"version", "archetype", "palette", "sign", "ground", "roof_props", "ground_props", "rooms", "reasoning"}
PALETTE_KEYS = {"body", "trim", "accent", "roof"}
ROOM_KEYS = {"id", "name", "short_name", "kind", "furniture", "color", "description", "tracks"}
# accent isn't in the agent's spec, but web/src/lib/scene-spec.ts repairs it outside this range.
LIGHTNESS = {"body": (0.45, 0.85), "trim": (0.80, 0.97), "accent": (0.10, 0.75), "roof": (0.20, 0.60)}
CAPS = {"name": 26, "short_name": 14, "description": 180}
HERE = os.path.dirname(os.path.abspath(__file__))


def from_reply(text):
    """Every ```json block in a reply, then the whole text. Returns (spec, number of blocks)."""
    blocks = re.findall(r"```json\s*(\{.*?\})\s*```", text or "", re.S)
    candidates = blocks + ([text.strip()] if (text or "").strip().startswith("{") else [])
    for c in candidates:
        try:
            data = json.loads(c)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and "archetype" in data:
            return data, len(blocks)
    return None, len(blocks)


def load(path):
    """Returns (spec, notes). Notes are warnings about how the reply was written."""
    raw = open(path).read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = None
    notes = []
    if isinstance(data, dict) and "archetype" not in data and "result" in data:
        # A saved job file. CREAO's result.text is only a short summary, so read the full reply first.
        result = data["result"]
        texts = [("result", result)] if isinstance(result, str) else \
            [("result.chatText", (result or {}).get("chatText")), ("result.text", (result or {}).get("text"))]
        for field, text in texts:
            spec, blocks = from_reply(text if isinstance(text, str) else None)
            if spec is not None:
                if blocks > 1:
                    notes.append(f"{field} has {blocks} json blocks (should be exactly one)")
                return spec, notes
        raise SystemExit(f"No SceneSpec JSON found in the job file's result.chatText or result.text: {path}")
    if data is not None:
        return data, notes
    spec, blocks = from_reply(raw)
    if spec is None:
        raise SystemExit(f"No SceneSpec JSON found in {path}")
    if blocks > 1:
        notes.append(f"reply has {blocks} json blocks (should be exactly one)")
    return spec, notes


def is_color(c):
    return isinstance(c, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", c) is not None


def channels(c):
    return [int(c[i:i + 2], 16) for i in (1, 3, 5)]


def lightness(c):
    rgb = channels(c)
    return (max(rgb) + min(rgb)) / 510


def luminance(c):
    lin = [(v / 255) / 12.92 if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4 for v in channels(c)]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a, b):
    hi, lo = sorted([luminance(a), luminance(b)], reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def check(spec, profile_doc):
    """Returns (fails, warns, passes)."""
    profile, expect = profile_doc["profile"], profile_doc.get("expect", {})
    fails, warns, passes = [], [], []
    if not isinstance(spec, dict):
        return [f"the reply is a {type(spec).__name__}, not a JSON object"], warns, passes

    def keys(obj, where, allowed, required):
        if not isinstance(obj, dict):
            fails.append(f"{where} is not an object")
            return False
        extra, missing = set(obj) - allowed, required - set(obj)
        if extra:
            fails.append(f"{where} has unknown keys: {sorted(extra)}")
        if missing:
            fails.append(f"{where} is missing keys: {sorted(missing)}")
        return True

    def color(value, where):
        if not is_color(value):
            fails.append(f"{where} is not a #rrggbb color: {value!r}")
            return False
        return True

    # Digits are only allowed when the same number appears in the profile ("AI reads and writes, code calculates").
    allowed_numbers = set(re.findall(r"\d+", json.dumps(profile, ensure_ascii=False)))
    texts = []  # (where, text) pairs to check for digits

    def text(value, where, cap, required=True):
        if not isinstance(value, str) or (required and not value.strip()):
            fails.append(f"{where} must be a non-empty string, got {value!r}")
            return
        if len(value) > cap:
            fails.append(f"{where} is {len(value)} characters (max {cap}): {value!r}")
        texts.append((where, value))

    keys(spec, "the spec", TOP_KEYS, TOP_KEYS)
    if spec.get("version") != 1 or isinstance(spec.get("version"), bool):
        fails.append(f"version must be 1, got {spec.get('version')!r}")

    archetype = spec.get("archetype")
    if archetype not in ARCHETYPES:
        fails.append(f"unknown archetype {archetype!r}")
    want = expect.get("archetype")
    if want and archetype in ARCHETYPES:
        (passes if archetype == want else warns).append(
            f"archetype is {archetype}" + ("" if archetype == want else f" (expected {want})"))

    palette = spec.get("palette")
    if keys(palette, "palette", PALETTE_KEYS, PALETTE_KEYS):
        for part in sorted(PALETTE_KEYS & set(palette)):
            if color(palette[part], f"palette.{part}") and part in LIGHTNESS:
                lo, hi = LIGHTNESS[part]
                lit = lightness(palette[part])
                if not lo <= lit <= hi:
                    fails.append(f"palette.{part} {palette[part]} has lightness {lit:.2f} (allowed {lo} to {hi})")
        if all(is_color(palette.get(p)) for p in PALETTE_KEYS):
            passes.append("palette colors and lightness checked")

    sign = spec.get("sign")
    if keys(sign, "sign", {"background", "color", "tagline"}, {"background", "color"}):
        if color(sign.get("background"), "sign.background") & color(sign.get("color"), "sign.color"):
            ratio = contrast(sign["background"], sign["color"])
            (passes if ratio >= 4.5 else fails).append(
                f"sign contrast is {ratio:.2f}" +("" if ratio >= 4.5 else " (min 4.5)"))
        if "tagline" in sign:
            if sign["tagline"] is None or sign["tagline"] == "":
                warns.append("sign.tagline is empty; leave the key out instead")
            else:
                text(sign["tagline"], "sign.tagline", 28)

    if spec.get("ground") not in GROUNDS:
        fails.append(f"unknown ground {spec.get('ground')!r}")

    for field, allowed, cap in (("roof_props", ROOF_PROPS, 3), ("ground_props", GROUND_PROPS, 4)):
        props = spec.get(field)
        if not isinstance(props, list):
            fails.append(f"{field} is not a list")
            continue
        if len(props) > cap:
            fails.append(f"{field} has {len(props)} items (max {cap})")
        unknown = [p for p in props if p not in allowed]
        if unknown:
            fails.append(f"{field} has unknown values: {unknown}")
        if len(set(map(str, props))) != len(props):
            fails.append(f"{field} repeats a value: {props}")

    rooms = spec.get("rooms")
    if not isinstance(rooms, list):
        fails.append("rooms is not a list")
        rooms = []
    (passes if 3 <= len(rooms) <= 6 else fails).append(
        f"{len(rooms)} rooms" + ("" if 3 <= len(rooms) <= 6 else " (allowed 3 to 6)"))
    ids, kinds = [], []
    for i, room in enumerate(rooms):
        where = f"room {i + 1} ({room.get('id', '?')})" if isinstance(room, dict) else f"room {i + 1}"
        if not keys(room, where, ROOM_KEYS, ROOM_KEYS):
            continue
        rid = room.get("id")
        if not isinstance(rid, str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,23}", rid):
            fails.append(f"{where} id must be lowercase letters, digits and hyphens, starting with a letter, max 24: {rid!r}")
        ids.append(rid)
        if room.get("kind") not in KINDS:
            fails.append(f"{where} has unknown kind {room.get('kind')!r}")
        kinds.append(room.get("kind"))
        if room.get("furniture") not in FURNITURE:
            fails.append(f"{where} has unknown furniture {room.get('furniture')!r}")
        color(room.get("color"), f"{where} color")
        for field, cap in CAPS.items():
            text(room.get(field), f"{where} {field}", cap)
        tracks = room.get("tracks")
        if not isinstance(tracks, list) or not 1 <= len(tracks) <= 3:
            fails.append(f"{where} tracks must be a list of 1 to 3 items, got {tracks!r}")
        else:
            for t in tracks:
                text(t, f"{where} tracks item", 40)
    repeated_ids = sorted({x for x in ids if ids.count(x) > 1}, key=str)
    if repeated_ids:
        fails.append(f"room ids repeat: {repeated_ids}")
    repeated_kinds = sorted({k for k in kinds if k != "custom" and kinds.count(k) > 1}, key=str)
    if repeated_kinds:
        fails.append(f"room kinds repeat (only custom may): {repeated_kinds}")

    text(spec.get("reasoning"), "reasoning", 280)

    invented = [(where, n, t) for where, t in texts for n in re.findall(r"\d+", t) if n not in allowed_numbers]
    for where, n, t in invented:
        fails.append(f"{where} has the number {n}, which isn't in the profile: {t!r}")
    if not invented:
        passes.append("no invented numbers in any text")

    # Taste checks: the app accepts these, but they're worth a look.
    if rooms:
        (passes if "finance" in kinds else warns).append("finance room" + ("" if "finance" in kinds else " is missing"))
        if profile.get("parts"):
            (passes if "supply" in kinds else warns).append(
                "supply room" + ("" if "supply" in kinds else " is missing, but the profile has parts"))
    cap = expect.get("max_rooms")
    if cap and len(rooms) > cap:
        warns.append(f"{len(rooms)} rooms is more than {cap} for this business (small service businesses get 3 to 4)")
    return fails, warns, passes


def report(fails, warns, passes):
    for p in passes:
        print(f"  PASS  {p}")
    for w in warns:
        print(f"  WARN  {w}")
    for f in fails:
        print(f"  FAIL  {f}")
    print(f"\n{len(passes)} passed, {len(warns)} warnings, {len(fails)} failed")


def check_all():
    outputs = sorted(glob.glob(os.path.join(HERE, "scene-outputs", "*.json")))
    profiles = {os.path.basename(p)[:-5]: p for p in glob.glob(os.path.join(HERE, "scene-profiles", "*.json"))}
    results, any_fail = {}, False
    for path in outputs:
        m = re.fullmatch(r"(.+)-(\d+)\.json", os.path.basename(path))
        if not m or m.group(1) not in profiles:
            print(f"SKIP  {os.path.basename(path)} (name it <profile>-<n>.json)")
            continue
        doc = json.load(open(profiles[m.group(1)]))
        spec, notes = load(path)
        fails, warns, passes = check(spec, doc)
        warns = notes + warns
        any_fail |= bool(fails)
        want = doc.get("expect", {}).get("archetype")
        got = spec.get("archetype") if isinstance(spec, dict) else None
        match = want is None or got == want
        results.setdefault(m.group(1), []).append(match and not fails)
        rooms = len(spec.get("rooms") or []) if isinstance(spec, dict) else 0
        print(f"{'FAIL' if fails else 'ok  '}  {os.path.basename(path):24} {str(got):11} expected {str(want or 'any'):11}"
              f" {rooms} rooms  {len(fails)} fails, {len(warns)} warns")
        for line in fails + warns:
            print(f"        {line}")
    good = sum(all(v) for v in results.values())
    missing = sorted(set(profiles) - set(results))
    print(f"\n{good} of {len(profiles)} profiles have only passing replies with the expected archetype"
          + (f". No saved reply yet for: {', '.join(missing)}" if missing else ""))
    sys.exit(1 if any_fail else 0)


def main():
    if sys.argv[1:] == ["--all"]:
        check_all()
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    spec, notes = load(sys.argv[1])
    fails, warns, passes = check(spec, json.load(open(sys.argv[2])))
    report(fails, notes + warns, passes)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
