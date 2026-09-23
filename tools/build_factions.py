#!/usr/bin/env python3
"""
Build js/data/factions.js from the BSData Warhammer 40,000 11th edition repository.

Usage:
  git clone --depth 1 https://github.com/BSData/wh40k-11e bsdata
  python3 tools/build_factions.py bsdata

Writes js/data/factions.js (window.LEDGER_FACTIONS = {...}).
Unit names, battlefield roles and weapon names come straight from the data files.
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
            tag = "Legends" if "[Legends]" in name else ("Crucible" if "[Crucible]" in name else "")
            clean = re.sub(r"\s*\[(Legends|Crucible)\]\s*", "", name).strip()
            out.append({
                "n": clean, "r": role if role in ROLE_ORDER else "Other",
                **({"t": tag} if tag else {}),
                **({"eh": 1} if "Epic Hero" in kw else {}),
                **({"wr": tidy(w["Ranged"])[:40]} if w["Ranged"] else {}),
                **({"wm": tidy(w["Melee"])[:40]} if w["Melee"] else {}),
            })
    out.sort(key=lambda u: (u.get("t", "") != "", ROLE_ORDER.index(u["r"]), u["n"]))
    return out

try:
    commit = subprocess.check_output(["git", "-C", SRC, "log", "-1", "--format=%h %cs"], text=True).strip()
except Exception:
    commit = ""

result = {"source": "BSData/wh40k-11e", "commit": commit, "built": datetime.date.today().isoformat(), "factions": []}
for fn, fid, name, group, parent, extra in FACTIONS:
    us = units_for([fn] + extra)
    result["factions"].append({"id": fid, "name": name, "group": group, **({"parent": parent} if parent else {}), "units": us})
    print(f"{name:26} {len(us):4} units", file=sys.stderr)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("/* Generated by tools/build_factions.py from " + result["source"] + " " + commit + ". Do not edit by hand. */\n")
    fh.write("window.LEDGER_FACTIONS = " + json.dumps(result, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("wrote", OUT, os.path.getsize(OUT), "bytes", file=sys.stderr)
