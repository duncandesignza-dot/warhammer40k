#!/usr/bin/env python3
"""
Build js/data/sheets/<faction>.js from the BSData Warhammer 40,000 11th edition repository:
each datasheet's model profiles, weapon profiles, and the names of its abilities, rules and keywords.
War Ledger loads a faction's file only when you open a unit's datasheet.

Usage (after cloning BSData as in build_factions.py):
  python3 tools/build_sheets.py bsdata

Like build_factions.py, rules text is left out: abilities and rules are listed by name only.
A Space Marine chapter's file has only its own datasheets; the app loads Space Marines' file alongside it.
"""
import ast, json, glob, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "bsdata"
HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "js", "data", "sheets")

# The faction list is build_factions.py's, so the two never disagree.
src = open(os.path.join(HERE, "build_factions.py"), encoding="utf-8").read()
FACTIONS = ast.literal_eval(re.search(r"^FACTIONS = (\[.*?^\])", src, re.S | re.M).group(1))
SKIP_ROLES = {"Configuration", "Order of Battle", ""}
# Groups that hold options for the army rather than the datasheet's own rules.
NOT_THE_UNIT = re.compile(r"crusade|enhancement|honour|scar|relic|upgrade|warlord|requisition|detachment|agenda|trait", re.I)

ents, cats, docs = {}, {}, {}
def index(o):
    if isinstance(o, dict):
        if "id" in o and "name" in o: ents.setdefault(o["id"], o)
        for k, v in o.items():
            if k == "categoryEntries":
                for c in v: cats[c["id"]] = c["name"]
            index(v)
    elif isinstance(o, list):
        for x in o: index(x)
for f in glob.glob(os.path.join(SRC, "*.json")):
    d = json.load(open(f, encoding="utf-8"))
    docs[os.path.basename(f)] = d.get("catalogue") or d.get("gameSystem")
    index(d)

# Some rules and profiles are hidden unless the army is a particular faction (a chapter's own army rule, say).
# Conditions on the army's catalogue are worked out; anything else is assumed to apply.
def cond_true(c, cat_id):
    if c.get("scope") != "primary-catalogue" or c.get("type") not in ("instanceOf", "notInstanceOf"): return None
    hit = c.get("childId") == cat_id
    return hit if c["type"] == "instanceOf" else not hit
def group_true(g, cat_id):
    vals = [cond_true(c, cat_id) for c in g.get("conditions", []) or []] + [group_true(x, cat_id) for x in g.get("conditionGroups", []) or []]
    if any(v is None for v in vals) or not vals: return None
    return all(vals) if g.get("type") == "and" else any(vals)
def hidden(e, cat_id):
    for m in e.get("modifiers", []) or []:
        if m.get("field") != "hidden" or m.get("type") != "set": continue
        v = group_true({"type": "and", "conditions": m.get("conditions", []) or [], "conditionGroups": m.get("conditionGroups", []) or []}, cat_id)
        if v: return bool(m.get("value") in (True, "true"))
        if v is False and m.get("value") in (False, "false"): continue
    return e.get("hidden") is True

def clean(n): return re.sub(r"^[➤>\s]+", "", n or "").replace(" ", " ").strip()

def walk(entry, acc, cat_id, depth=0, seen=None):
    """Every profile and rule that belongs to a datasheet, following its models, wargear and shared entries."""
    if seen is None: seen = set()
    if depth > 8 or not isinstance(entry, dict) or NOT_THE_UNIT.search(entry.get("name", "")) or (depth and hidden(entry, cat_id)): return
    key = entry.get("id")
    if key in seen: return
    if key: seen.add(key)
    for p in entry.get("profiles", []) or []:
        if not hidden(p, cat_id): acc["profiles"].append(p)
    for r in entry.get("rules", []) or []: acc["rules"].append(r.get("name", ""))
    for il in entry.get("infoLinks", []) or []:
        t = ents.get(il.get("targetId"))
        if not t or NOT_THE_UNIT.search(t.get("name", "")) or hidden(il, cat_id) or hidden(t, cat_id): continue
        if il.get("type") == "rule": acc["rules"].append(t["name"])
        elif il.get("type") == "profile": acc["profiles"].append(t)
        else: walk(t, acc, cat_id, depth + 1, seen)
    for k in ("selectionEntries", "selectionEntryGroups"):
        for c in entry.get(k, []) or []: walk(c, acc, cat_id, depth + 1, seen)
    for el in entry.get("entryLinks", []) or []:
        if NOT_THE_UNIT.search(el.get("name", "")): continue
        t = ents.get(el.get("targetId"))
        if t: walk(t, acc, cat_id, depth + 1, seen)

def chars(p): return {c.get("name", ""): clean(c.get("$text", "")) for c in p.get("characteristics", []) or []}

def sheet(link, t, cat_id):
    acc = {"profiles": [], "rules": []}
    walk(t, acc, cat_id)
    models, ranged, melee, abilities, names = [], [], [], [], set()
    for p in acc["profiles"]:
        tn, n, c = p.get("typeName", ""), clean(p.get("name")), chars(p)
        if (tn, n) in names or not n: continue
        names.add((tn, n))
        if tn == "Unit": models.append([n, c.get("M", ""), c.get("T", ""), c.get("Sv", c.get("SV", "")), c.get("W", ""), c.get("LD", c.get("Ld", "")), c.get("OC", ""), c.get("InSv", "")])
        elif tn.startswith("Ranged Weapon"): ranged.append([n, c.get("Range", ""), c.get("A", ""), c.get("BS", ""), c.get("S", ""), c.get("AP", ""), c.get("D", ""), c.get("Keywords", "")])
        elif tn.startswith("Melee Weapon"): melee.append([n, c.get("Range", ""), c.get("A", ""), c.get("WS", ""), c.get("S", ""), c.get("AP", ""), c.get("D", ""), c.get("Keywords", "")])
        elif tn == "Abilities" and n not in abilities: abilities.append(n)
    rules = []
    for r in acc["rules"]:
        r = clean(r)
        if r and r not in rules: rules.append(r)
    kws = []
    for src in (link.get("categoryLinks", []) or [], t.get("categoryLinks", []) or []):
        for cl in src:
            n = cats.get(cl.get("targetId"), cl.get("name", ""))
            if n and n not in kws and n not in SKIP_ROLES: kws.append(n)
    return {k: v for k, v in {"m": models, "r": ranged, "w": melee, "a": abilities, "ru": rules, "k": kws}.items() if v}

def primary_role(link, t):
    for src in (link.get("categoryLinks", []) or [], t.get("categoryLinks", []) or []):
        for cl in src:
            if cl.get("primary"): return cats.get(cl.get("targetId"), cl.get("name", ""))
    return ""

def sheets_for(files, skip=()):
    out, cat_id = {}, (docs.get(files[0]) or {}).get("id")
    for fn in files:
        c = docs.get(fn)
        if not c: print("missing", fn, file=sys.stderr); continue
        for link in (c.get("entryLinks") or []) + (c.get("selectionEntries") or []):
            if link.get("hidden"): continue
            t = ents.get(link.get("targetId")) if link.get("targetId") else link
            if not t or t.get("type") not in ("unit", "model") or primary_role(link, t) in SKIP_ROLES: continue
            name = re.sub(r"\s*\[(Legends|Crucible)\]\s*", "", link.get("name") or t.get("name")).strip()
            if name in out or name in skip: continue
            out[name] = sheet(link, t, cat_id)
    return out

os.makedirs(OUT, exist_ok=True)
by_id = {}
for cat, fid, name, group, parent, extra in FACTIONS:
    if parent: continue
    by_id[fid] = sheets_for([cat] + extra)
for cat, fid, name, group, parent, extra in FACTIONS:
    if parent:
        mine = sheets_for([cat] + extra)
        by_id[fid] = {k: v for k, v in mine.items() if by_id[parent].get(k) != v}
total = 0
for fid, data in by_id.items():
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, fid + ".js"), "w", encoding="utf-8") as f:
        f.write("/* Datasheet profiles for War Ledger, from BSData wh40k-11e. Built by tools/build_sheets.py. */\n")
        f.write(f"(window.LEDGER_SHEETS = window.LEDGER_SHEETS || {{}})[{json.dumps(fid)}] = {body};\n")
    total += len(body)
    print(f"{fid}: {len(data)} datasheets, {len(body)//1024} KB")
print(f"total {total//1024} KB")
