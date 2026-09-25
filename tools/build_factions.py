#!/usr/bin/env python3
"""
Build js/data/factions.js from the BSData Warhammer 40,000 11th edition repository.

Usage:
  git clone --depth 1 https://github.com/BSData/wh40k-11e bsdata
  python3 tools/build_factions.py bsdata
  python3 tools/data_changes.py OLD_factions.js js/data/factions.js   # optional: what changed

.github/workflows/refresh-datasheets.yml does this every Monday and opens a pull request when
something changed.

Writes js/data/factions.js (window.LEDGER_FACTIONS = {...}).
Unit names, battlefield roles and weapon names come straight from the data files, along with
unit sizes, detachments (with their Detachment Points and enhancements) and battle-size limits.
"""
import json, glob, os, re, sys, subprocess, datetime

SRC = sys.argv[1] if len(sys.argv) > 1 else "bsdata"
OUT = os.path.join(os.path.dirname(__file__), "..", "js", "data", "factions.js")

# catalogue file -> (faction id, display name, group, parent faction id or None, extra catalogues to import units from)
FACTIONS = [
  # Imperium
  ("Imperium - Adepta Sororitas.json",  "adepta-sororitas",  "Adepta Sororitas",      "Imperium", None, []),
  ("Imperium - Adeptus Custodes.json",  "adeptus-custodes",  "Adeptus Custodes",      "Imperium", None, []),
  ("Imperium - Adeptus Mechanicus.json","adeptus-mechanicus","Adeptus Mechanicus",    "Imperium", None, []),
  ("Imperium - Agents of the Imperium.json","agents-of-the-imperium","Agents of the Imperium","Imperium", None, []),
  ("Imperium - Astra Militarum.json",   "astra-militarum",   "Astra Militarum",       "Imperium", None, []),
  ("Imperium - Grey Knights.json",      "grey-knights",      "Grey Knights",          "Imperium", None, []),
  ("Imperium - Imperial Knights.json",  "imperial-knights",  "Imperial Knights",      "Imperium", None, ["Imperium - Imperial Knights - Library.json"]),
  ("Imperium - Space Marines.json",     "space-marines",     "Space Marines",         "Imperium", None, []),
  ("Imperium - Black Templars.json",    "black-templars",    "Black Templars",        "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Blood Angels.json",      "blood-angels",      "Blood Angels",          "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Dark Angels.json",       "dark-angels",       "Dark Angels",           "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Deathwatch.json",        "deathwatch",        "Deathwatch",            "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Imperial Fists.json",    "imperial-fists",    "Imperial Fists",        "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Iron Hands.json",        "iron-hands",        "Iron Hands",            "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Raven Guard.json",       "raven-guard",       "Raven Guard",           "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Salamanders.json",       "salamanders",       "Salamanders",           "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Space Wolves.json",      "space-wolves",      "Space Wolves",          "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - Ultramarines.json",      "ultramarines",      "Ultramarines",          "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  ("Imperium - White Scars.json",       "white-scars",       "White Scars",           "Imperium", "space-marines", ["Imperium - Space Marines.json"]),
  # Chaos
  ("Chaos - Chaos Daemons.json",        "chaos-daemons",     "Chaos Daemons",         "Chaos", None, ["Chaos - Chaos Daemons Library.json"]),
  ("Chaos - Chaos Knights.json",        "chaos-knights",     "Chaos Knights",         "Chaos", None, ["Chaos - Chaos Knights Library.json"]),
  ("Chaos - Chaos Space Marines.json",  "chaos-space-marines","Chaos Space Marines",  "Chaos", None, []),
  ("Chaos - Death Guard.json",          "death-guard",       "Death Guard",           "Chaos", None, []),
  ("Chaos - Emperor's Children.json",   "emperors-children", "Emperor's Children",    "Chaos", None, []),
  ("Chaos - Thousand Sons.json",        "thousand-sons",     "Thousand Sons",         "Chaos", None, []),
  ("Chaos - World Eaters.json",         "world-eaters",      "World Eaters",          "Chaos", None, []),
  # Xenos
  ("Aeldari - Craftworlds.json",        "aeldari",           "Aeldari",               "Xenos", None, []),
  ("Aeldari - Drukhari.json",           "drukhari",          "Drukhari",              "Xenos", None, []),
  ("Genestealer Cults.json",            "genestealer-cults", "Genestealer Cults",     "Xenos", None, []),
  ("Leagues of Votann.json",            "leagues-of-votann", "Leagues of Votann",     "Xenos", None, []),
  ("Necrons.json",                      "necrons",           "Necrons",               "Xenos", None, []),
  ("Orks.json",                         "orks",              "Orks",                  "Xenos", None, []),
  ("T'au Empire.json",                  "tau-empire",        "T'au Empire",           "Xenos", None, []),
  ("Tyranids.json",                     "tyranids",          "Tyranids",              "Xenos", None, []),
]

SKIP_ROLES = {"Configuration", "Order of Battle", ""}
ROLE_ORDER = ["Epic Hero","Character","Battleline","Infantry","Mounted","Beast","Swarm","Monster","Vehicle","Dedicated Transport","Fortification","Other"]

ents, cats, docs = {}, {}, {}

def index(o):
    if isinstance(o, dict):
        if "id" in o and "name" in o and ("type" in o or "profiles" in o or "typeName" in o or "selectionEntries" in o):
            ents.setdefault(o["id"], o)
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

def resolve(e):
    seen = 0
    while e and e.get("targetId") and seen < 5:
        t = ents.get(e["targetId"])
        if not t: break
        e = {**t, **{k: v for k, v in e.items() if k in ("categoryLinks",) and v}} if "categoryLinks" in e else t
        seen += 1
    return e

def primary_role(link, target):
    for src in (link.get("categoryLinks", []), target.get("categoryLinks", [])):
        for cl in src:
            if cl.get("primary"):
                return cats.get(cl.get("targetId"), cl.get("name", ""))
    return ""

def keywords(link, target):
    out = []
    for src in (link.get("categoryLinks", []), target.get("categoryLinks", [])):
        for cl in src:
            n = cats.get(cl.get("targetId"), cl.get("name", ""))
            if n and n not in out: out.append(n)
    return out

def weapons(entry, depth=0, seen=None, acc=None):
    if seen is None: seen, acc = set(), {"Ranged": [], "Melee": []}
    if depth > 7 or not isinstance(entry, dict): return acc
    key = entry.get("id")
    if key in seen: return acc
    if key: seen.add(key)
    for p in entry.get("profiles", []) or []:
        tn = p.get("typeName", "")
        name = re.sub(r"^[➤>\s]+", "", p.get("name", "")).strip()
        if tn.startswith("Ranged Weapon") and name not in acc["Ranged"]: acc["Ranged"].append(name)
        if tn.startswith("Melee Weapon") and name not in acc["Melee"]: acc["Melee"].append(name)
    for il in entry.get("infoLinks", []) or []:
        t = ents.get(il.get("targetId"))
        if t: weapons({"id": "il-"+t["id"], "profiles": [t]} if t.get("typeName") else t, depth+1, seen, acc)
    for k in ("selectionEntries", "selectionEntryGroups", "sharedSelectionEntries"):
        for c in entry.get(k, []) or []:
            weapons(c, depth+1, seen, acc)
    for el in entry.get("entryLinks", []) or []:
        t = ents.get(el.get("targetId"))
        if t: weapons(t, depth+1, seen, acc)
    return acc

def tidy(names):
    """Collapse weapon profile variants ("Plasma pistol - supercharge") into one weapon name."""
    out, seen = [], set()
    for n in names:
        base = re.split(r"\s+[-–]\s+", n, maxsplit=1)[0].strip()
        k = base.lower()
        if base and k not in seen:
            seen.add(k); out.append(base)
    return out

PTS_ID = None
for gs in docs.values():
    for ct in (gs or {}).get("costTypes", []) or []:
        if ct.get("name") == "pts": PTS_ID = ct["id"]

ARMY_SCOPES = {"force", "roster", "parent", "primary-catalogue", "ancestor"}

def model_range(conds):
    """Turn model-count conditions into an inclusive (lo, hi) range, or None if they aren't about model count."""
    lo, hi, seen = 1, 999, False
    for c in conds:
        if c.get("field") != "selections" or c.get("scope") in ARMY_SCOPES: return None
        if c.get("childName") or c.get("type") in ("instanceOf", "notInstanceOf", "before"): return None
        v = c.get("value")
        if not isinstance(v, (int, float)): return None
        t = c.get("type"); v = int(v); seen = True
        if t == "atLeast": lo = max(lo, v)
        elif t == "greaterThan": lo = max(lo, v + 1)
        elif t == "atMost": hi = min(hi, v)
        elif t == "lessThan": hi = min(hi, v - 1)
        elif t == "equalTo": lo, hi = max(lo, v), min(hi, v)
        else: return None
    return (lo, hi) if seen and lo <= hi else None

def points(entry):
    base = next((c.get("value") for c in entry.get("costs", []) or [] if c.get("typeId") == PTS_ID or c.get("name") == "pts"), None)
    if base is None: return None, []
    brackets = []
    for m in entry.get("modifiers", []) or []:
        if m.get("field") != PTS_ID or m.get("type") != "set": continue
        conds = list(m.get("conditions", []) or [])
        for g in m.get("conditionGroups", []) or []:
            if g.get("type") != "and" or g.get("conditionGroups") or g.get("localConditionGroups"): conds = None; break
            conds += g.get("conditions", []) or []
        if not conds: continue
        r = model_range(conds)
        if r: brackets.append([r[0], r[1] if r[1] < 999 else 0, int(m.get("value"))])
    return int(base), brackets

def units_for(files):
    out, names = [], set()
    for fn in files:
        c = docs.get(fn)
        if not c: print("missing", fn, file=sys.stderr); continue
        roots = (c.get("entryLinks") or []) + (c.get("selectionEntries") or [])
        for link in roots:
            if link.get("hidden"): continue
            t = ents.get(link.get("targetId")) if link.get("targetId") else link
            if not t or t.get("type") not in ("unit", "model"): continue
            role = primary_role(link, t)
            if role in SKIP_ROLES: continue
            name = link.get("name") or t.get("name")
            if name in names: continue
            names.add(name)
            kw = keywords(link, t)
            w = weapons(t)
            pts, br = points(t)
            tag = "Legends" if "[Legends]" in name else ("Crucible" if "[Crucible]" in name else "")
            clean = re.sub(r"\s*\[(Legends|Crucible)\]\s*", "", name).strip()
            ms = (1, 1) if t.get("type") == "model" else model_count(t)
            mx = copies(t, role)
            usual = [2, 3, 3] if role not in ("Battleline", "Dedicated Transport") else [4, 6, 6]
            out.append({
                "n": clean, "r": role if role in ROLE_ORDER else "Other",
                **({"ms": list(ms)} if ms[1] and ms != (1, 1) else {}),
                **({"mx": mx} if mx and mx != usual[:len(mx)] else {}),
                **({"t": tag} if tag else {}),
                **({"eh": 1} if "Epic Hero" in kw else {}),
                **({"p": pts} if pts is not None else {}),
                **({"pb": br} if br else {}),
                **({"wr": tidy(w["Ranged"])[:40]} if w["Ranged"] else {}),
                **({"wm": tidy(w["Melee"])[:40]} if w["Melee"] else {}),
            })
    out.sort(key=lambda u: (u.get("t", "") != "", ROLE_ORDER.index(u["r"]), u["n"]))
    return out

# ---------- Army list data: detachments, enhancements, unit sizes, battle-size limits ----------
# Only names, costs and limits are taken. Rules text is left out.

# Where each faction's detachments live, besides its own catalogue (and the extra catalogues above).
DET_LIBRARIES = {
  "astra-militarum": ["Imperium - Astra Militarum - Library.json"],
  "tyranids": ["Library - Tyranids.json"],
  "genestealer-cults": ["Library - Tyranids.json"],
  "aeldari": ["Aeldari - Aeldari Library.json"],
  "drukhari": ["Aeldari - Aeldari Library.json"],
}
names_by_id = {}
def index_names(o):
    if isinstance(o, dict):
        if "id" in o and "name" in o: names_by_id.setdefault(o["id"], o["name"])
        for v in o.values(): index_names(v)
    elif isinstance(o, list):
        for v in o: index_names(v)
for d in docs.values(): index_names(d)
for d in docs.values(): names_by_id[d["id"]] = d["name"]

def cost(entry, name):
    return next((c.get("value") for c in entry.get("costs", []) or [] if c.get("name") == name), None)

# A tiny condition checker for the conditions that decide which army can see an entry. ctx has the
# army's primary catalogue id and the chosen battle size. Anything it doesn't understand counts as not met.
BOARDING = {i for i, n in names_by_id.items() if n == "Boarding Actions"}
def cond_ok(c, ctx):
    t, cid, scope = c.get("type"), c.get("childId"), c.get("scope")
    if scope == "primary-catalogue" and t in ("instanceOf", "notInstanceOf"):
        return (cid == ctx["primary"]) == (t == "instanceOf")
    if cid in BOARDING: return t == "notInstanceOf"
    if cid in ctx.get("sizes", {}):
        on = ctx["sizes"][cid]; v = c.get("value", 0)
        if t == "equalTo": return (1 if on else 0) == v
        if t == "atLeast": return (1 if on else 0) >= v
        if t == "notEqualTo": return (1 if on else 0) != v
        return False
    if names_by_id.get(cid) == "3DP Detachment": return bool(ctx.get("dp3")) == (t in ("atLeast", "greaterThan", "equalTo") and c.get("value", 0) >= 1)
    if names_by_id.get(cid) == "Override points limit?": return t == "equalTo" and c.get("value") == 0
    return False
def group_ok(g, ctx):
    rs = [cond_ok(c, ctx) for c in g.get("conditions", []) or []] + [group_ok(x, ctx) for x in g.get("conditionGroups", []) or []]
    if not rs: return True
    return any(rs) if g.get("type") == "or" else all(rs)
def mod_applies(m, ctx):
    return group_ok({"type": "and", "conditions": m.get("conditions", []), "conditionGroups": m.get("conditionGroups", [])}, ctx)
def visible(entry, ctx):
    hid = bool(entry.get("hidden"))
    for m in entry.get("modifiers", []) or []:
        if m.get("field") == "hidden" and m.get("type") == "set" and mod_applies(m, ctx): hid = m.get("value") in (True, "true")
    return not hid

def walk_dicts(o):
    if isinstance(o, dict):
        yield o
        for v in o.values(): yield from walk_dicts(v)
    elif isinstance(o, list):
        for v in o: yield from walk_dicts(v)

def cond_list(m):
    out = list(m.get("conditions", []) or [])
    for g in m.get("conditionGroups", []) or []: out += cond_list(g)
    return out

def enhancement_only(e, skip):
    """Names an enhancement is limited to ("Captain model only"), from its hide-unless modifiers."""
    out = []
    for m in e.get("modifiers", []) or []:
        if m.get("field") != "hidden": continue
        for c in cond_list(m):
            n = names_by_id.get(c.get("childId"))
            if c.get("scope") == "ancestor" and c.get("type") == "notInstanceOf" and n and c.get("childId") not in skip and n not in out:
                out.append(n)
    return out

def walk_with_parents(o, parents=()):
    if isinstance(o, dict):
        yield o, parents
        for v in o.values(): yield from walk_with_parents(v, parents + (o,))
    elif isinstance(o, list):
        for v in o: yield from walk_with_parents(v, parents)

ENH_ID = next((i for d in docs.values() for c in d.get("costTypes", []) or [] for i in [c["id"]] if c.get("name") == "Enhancements"), None)

def detachment_groups(files):
    """Follow the faction's own "Detachment" entry to the groups of detachments it offers."""
    for f in files:
        c = docs.get(f) or {}
        for link in (c.get("entryLinks") or []) + (c.get("selectionEntries") or []):
            if link.get("name") not in ("Detachment", "Detachments"): continue
            root = ents.get(link.get("targetId")) or link
            out, todo, seen = [], [root], set()
            while todo:
                g = todo.pop()
                if not g or g.get("id") in seen: continue
                seen.add(g.get("id"))
                if g is not root and g.get("selectionEntries"): out.append(g)
                todo += list(g.get("selectionEntryGroups", []) or [])
                todo += [ents.get(l.get("targetId")) for l in g.get("entryLinks", []) or [] if l.get("type") == "selectionEntryGroup"]
            if out: return out
    return []

def detachments_for(fid, files, primary):
    ctx = {"primary": primary}
    srcs = [docs[f] for f in files if f in docs]
    dets, by_id, seen = [], {}, set()
    for o in detachment_groups(files):
            for e in o.get("selectionEntries", []) or []:
                dp = cost(e, "Detachment Points")
                if not dp or e["name"] in seen or not visible(e, ctx): continue
                seen.add(e["name"])
                kind = next((names_by_id.get(c.get("targetId"), c.get("name")) for c in e.get("categoryLinks", []) or [] if "DP Detachment" not in c.get("name", "")), "")
                d = {"n": e["name"], "dp": int(dp), **({"c": kind} if kind else {}), "e": []}
                dets.append(d); by_id[e["id"]] = d
    # An enhancement belongs to the detachment its (or its group's) conditions name,
    # or to the detachment whose "<name> Enhancements" group holds it.
    by_name = {d["n"]: d for d in dets}
    done = set()
    for src in srcs:
        for o, parents in walk_with_parents(src):
            if not ENH_ID or not any(c.get("typeId") == ENH_ID and c.get("value") for c in o.get("costs", []) or []): continue
            owner = None
            for node in (o,) + tuple(reversed(parents)):
                n = node.get("name", "")
                if isinstance(n, str) and n.endswith(" Enhancements") and n[:-13] in by_name: owner = by_name[n[:-13]]; break
                refs = [c.get("childId") for m in node.get("modifiers", []) or [] if m.get("field") == "hidden" for c in cond_list(m)]
                hit = next((by_id[r] for r in refs if r in by_id), None)
                if hit: owner = hit; break
            if not owner or (owner["n"], o["name"]) in done or not visible_enh(o, ctx): continue
            done.add((owner["n"], o["name"]))
            row = [o["name"], int(cost(o, "pts") or 0)]
            only = enhancement_only(o, by_id)
            if only: row.append(only)
            owner["e"].append(row)
    for d in dets:
        if not d["e"]: del d["e"]
    dets.sort(key=lambda d: d["n"])
    return dets

def visible_enh(e, ctx):
    """Enhancements hide themselves until their detachment is chosen, so only chapter and Boarding Actions rules count here."""
    for m in e.get("modifiers", []) or []:
        if m.get("field") != "hidden" or m.get("type") != "set" or m.get("value") not in (True, "true"): continue
        cs = cond_list(m)
        if cs and all(c.get("scope") == "primary-catalogue" or c.get("childId") in BOARDING for c in cs) and mod_applies(m, ctx): return False
    return True

# Battle sizes from the game system: points limit, Detachment Points and enhancements allowed.
GS = next(d for d in docs.values() if d.get("forceEntries"))
SIZE_ENTRIES = next(g["selectionEntries"] for e in GS.get("sharedSelectionEntries", []) if e.get("name") == "Battle Size" for g in e.get("selectionEntryGroups", []) if g.get("name") == "Battle Size")
ROSTER = GS["forceEntries"][0]
CT = {c["name"]: c["id"] for c in GS.get("costTypes", [])}
def limit_for(field, ctx):
    con = next((c for c in ROSTER.get("constraints", []) if c.get("field") == field and c.get("type") == "max"), None)
    if not con: return None
    v = con["value"]
    for m in ROSTER.get("modifiers", []) or []:
        if m.get("field") == con["id"] and mod_applies(m, ctx):
            v = m["value"] if m["type"] == "set" else v + m["value"] if m["type"] == "increment" else v
    return int(v)
SIZES = []
size_ids = [e["id"] for e in SIZE_ENTRIES]
for e in SIZE_ENTRIES:
    ctx = {"primary": "", "sizes": {i: i == e["id"] for i in size_ids}}
    m = re.match(r"^\d+\.\s*(.+?)\s*\((\d+)\s*Point", e["name"])
    if not m: continue
    dp, dp3 = limit_for(CT["Detachment Points"], ctx), limit_for(CT["Detachment Points"], {**ctx, "dp3": True})
    SIZES.append({"id": {"Incursion": "incursion", "Strike Force": "strike", "Onslaught": "onslaught"}.get(m.group(1), re.sub(r"\W+", "-", m.group(1).lower())),
                  "name": m.group(1), "pts": int(m.group(2)), "dp": dp, **({"dp3": dp3} if dp3 != dp else {}), "enh": limit_for(CT["Enhancements"], ctx), "_id": e["id"]})

def copies(entry, role):
    """How many of this datasheet each battle size allows, or None when it's the usual for its role."""
    con = next((c for c in entry.get("constraints", []) or [] if c.get("field") == "selections" and c.get("type") == "max" and c.get("scope") == "force"), None)
    if not con: return None
    out = []
    for z in SIZES:
        ctx = {"primary": "", "sizes": {x["_id"]: x["_id"] == z["_id"] for x in SIZES}}
        v = con["value"]
        for m in entry.get("modifiers", []) or []:
            if m.get("field") == con["id"] and m.get("type") == "set" and mod_applies(m, ctx): v = m["value"]
        out.append(int(v))
    return out

def model_count(entry, depth=0, seen=None):
    """(min, max) models in a unit, from the model entries and the groups around them."""
    seen = seen or set()
    if depth > 5 or not isinstance(entry, dict) or entry.get("id") in seen: return (0, 0)
    seen = seen | {entry.get("id")}
    if entry.get("type") == "model" and depth > 0:
        return (1, 1)
    lo = hi = 0
    kids = list(entry.get("selectionEntries", []) or []) + [ents.get(l.get("targetId")) or {} for l in entry.get("entryLinks", []) or [] if l.get("type") == "selectionEntry"]
    for k in kids:
        if not k or k.get("type") != "model": continue
        cmin = next((c["value"] for c in k.get("constraints", []) or [] if c.get("field") == "selections" and c.get("type") == "min" and c.get("scope") == "parent"), 0)
        cmax = next((c["value"] for c in k.get("constraints", []) or [] if c.get("field") == "selections" and c.get("type") == "max" and c.get("scope") == "parent"), None)
        lo += int(cmin); hi += int(cmax if cmax is not None else max(1, cmin))
    for g in list(entry.get("selectionEntryGroups", []) or []) + [ents.get(l.get("targetId")) or {} for l in entry.get("entryLinks", []) or [] if l.get("type") == "selectionEntryGroup"]:
        a, b = model_count(g, depth + 1, seen)
        if not b: continue
        gmin = next((c["value"] for c in g.get("constraints", []) or [] if c.get("field") == "selections" and c.get("type") == "min" and c.get("scope") == "parent"), None)
        gmax = next((c["value"] for c in g.get("constraints", []) or [] if c.get("field") == "selections" and c.get("type") == "max" and c.get("scope") == "parent"), None)
        lo += int(gmin) if gmin is not None else a
        hi += int(gmax) if gmax is not None else b
    return (lo, hi)

try:
    commit = subprocess.check_output(["git", "-C", SRC, "log", "-1", "--format=%h %cs"], text=True).strip()
except Exception:
    commit = ""

result = {"source": "BSData/wh40k-11e", "commit": commit, "built": datetime.date.today().isoformat(),
          "sizes": [{k: v for k, v in z.items() if not k.startswith("_")} for z in SIZES], "factions": []}
for fn, fid, name, group, parent, extra in FACTIONS:
    us = units_for([fn] + extra)
    dets = detachments_for(fid, [fn] + extra + DET_LIBRARIES.get(fid, []), docs[fn]["id"]) if fn in docs else []
    result["factions"].append({"id": fid, "name": name, "group": group, **({"parent": parent} if parent else {}), "units": us, **({"dets": dets} if dets else {})})
    print(f"{name:26} {len(us):4} units {len(dets):3} detachments {sum(len(d.get('e', [])) for d in dets):4} enhancements", file=sys.stderr)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("/* Generated by tools/build_factions.py from " + result["source"] + " " + commit + ". Do not edit by hand. */\n")
    fh.write("window.LEDGER_FACTIONS = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("wrote", OUT, os.path.getsize(OUT), "bytes", file=sys.stderr)
