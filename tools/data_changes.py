#!/usr/bin/env python3
"""
Compare two builds of js/data/factions.js and describe what changed, in Markdown.

Usage:
  python3 tools/data_changes.py OLD.js NEW.js

Prints the summary. Exit codes: 0 = something changed, 10 = nothing but the build date and
BSData commit changed, 3 = the new build looks broken (a faction lost all its units or detachments).
Used by .github/workflows/refresh-datasheets.yml, and handy after a manual rebuild too.
"""
import json, re, sys

def load(path):
    text = open(path, encoding="utf-8").read()
    return json.loads(re.search(r"window\.LEDGER_FACTIONS\s*=\s*(\{.*\});?\s*$", text, re.S).group(1))

old, new = load(sys.argv[1]), load(sys.argv[2])

# A build that lost a faction's units or detachments is more likely a BSData rename than a real change.
broken = [f["name"] for f in new["factions"] if not f.get("units") or not f.get("dets")]
if broken:
    print("The new build looks broken. These factions have no units or no detachments: " + ", ".join(broken))
    sys.exit(3)

same = lambda d: {k: v for k, v in d.items() if k not in ("commit", "built")}
if same(old) == same(new):
    print("No changes to units, points, detachments or enhancements.")
    sys.exit(10)

lines = [f"Datasheet data rebuilt from BSData/wh40k-11e **{new.get('commit', '?')}** (was {old.get('commit', '?')}).", ""]
if old.get("sizes") != new.get("sizes"):
    lines += ["### Battle sizes", *[f"- {z['name']}: {z['pts']} pts, {z.get('dp')} DP, {z.get('enh')} enhancements" for z in new.get("sizes", [])], ""]

by_id = {f["id"]: f for f in old["factions"]}
for f in new["factions"]:
    o = by_id.get(f["id"])
    if not o:
        lines += [f"### {f['name']}", "- New faction", ""]; continue
    out = []
    ou, nu = {u["n"]: u for u in o["units"]}, {u["n"]: u for u in f["units"]}
    out += [f"- New unit: {n}" for n in nu if n not in ou]
    out += [f"- Removed unit: {n}" for n in ou if n not in nu]
    for n, u in nu.items():
        if n in ou and (ou[n].get("p"), ou[n].get("pb")) != (u.get("p"), u.get("pb")):
            out.append(f"- {n}: {ou[n].get('p')} → {u.get('p')} pts" + (" (size prices changed too)" if ou[n].get("pb") != u.get("pb") else ""))
        elif n in ou and ou[n].get("ms") != u.get("ms"):
            out.append(f"- {n}: unit size {ou[n].get('ms') or 'single model'} → {u.get('ms') or 'single model'}")
    od, nd = {d["n"]: d for d in o.get("dets", [])}, {d["n"]: d for d in f.get("dets", [])}
    out += [f"- New detachment: {n} ({d['dp']} DP)" for n, d in nd.items() if n not in od]
    out += [f"- Removed detachment: {n}" for n in od if n not in nd]
    for n, d in nd.items():
        if n not in od: continue
        if od[n]["dp"] != d["dp"]: out.append(f"- {n}: {od[n]['dp']} → {d['dp']} DP")
        oe, ne = {e[0]: e[1] for e in od[n].get("e", [])}, {e[0]: e[1] for e in d.get("e", [])}
        out += [f"- {n}: new enhancement {e} ({p} pts)" for e, p in ne.items() if e not in oe]
        out += [f"- {n}: removed enhancement {e}" for e in oe if e not in ne]
        out += [f"- {n}: {e} {oe[e]} → {p} pts" for e, p in ne.items() if e in oe and oe[e] != p]
    if out:
        lines += [f"### {f['name']}", *out[:60], *([f"- …and {len(out) - 60} more"] if len(out) > 60 else []), ""]

if len(lines) <= 2:
    lines.append("Only small data details changed (weapons or copy limits); no points, units or detachments.")
print("\n".join(lines))
