#!/usr/bin/env python3
"""
Fill in the CIT table in js/data/presets.js: for every Citadel paint named in the starting
schemes (inside F(...) calls, or as "@Paint" in rank sources), look up its label and colour in
js/data/paints.js, so presets can start ledgers with real paints without loading the catalogue.

Usage (after editing paint names in presets.js, or rebuilding paints.js):
  python3 tools/build_citadel_refs.py
"""
import os, re, sys, json

ROOT = os.path.join(os.path.dirname(__file__), "..")
PRESETS = os.path.join(ROOT, "js", "data", "presets.js")
PAINTS = os.path.join(ROOT, "js", "data", "paints.js")

# Prefer the ranges people basecoat and layer with over sprays, air paints and old ranges.
RANGE_ORDER = ["Base", "Layer", "Technical", "Shade", "Contrast", "Dry"]

def main():
    src = open(PRESETS, encoding="utf-8").read()
    data = open(PAINTS, encoding="utf-8").read()
    cat = json.loads(data[data.index("{"):data.rindex("}") + 1])
    brand = cat["brands"].index("Citadel")
    citadel = [p for p in cat["paints"] if p[0] == brand]
    count = {}
    for p in citadel:
        count[p[1].lower()] = count.get(p[1].lower(), 0) + 1

    names = set()
    for call in re.findall(r"\bF\(([^)]*)\)", src):
        names.update(n for n in re.findall(r'"([^"]*)"', call) if n)
    names.update(re.findall(r'"@([^"]+)"', src))

    table, missing = {}, []
    for name in sorted(names):
        hits = [p for p in citadel if p[1].lower() == name.lower() and "discontinued" not in p[2].lower()]
        hits.sort(key=lambda p: RANGE_ORDER.index(p[2]) if p[2] in RANGE_ORDER else 99)
        if not hits:
            missing.append(name)
            continue
        p = hits[0]
        # Same label the paint picker builds: brand + name, plus the range when the name repeats.
        label = f"Citadel {p[1]}" + (f" ({p[2]})" if count[p[1].lower()] > 1 and p[2] else "")
        table[name] = [label, p[3]]
    if missing:
        sys.exit("Not in the Citadel catalogue: " + ", ".join(missing))

    line = "  const CIT = " + json.dumps(table, ensure_ascii=False, separators=(",", ":")) + ";"
    out, n = re.subn(r"^  const CIT = .*;$", lambda m: line, src, count=1, flags=re.M)
    if not n:
        sys.exit("Couldn't find the CIT line in presets.js")
    open(PRESETS, "w", encoding="utf-8").write(out)
    print(f"CIT: {len(table)} Citadel paints")

if __name__ == "__main__":
    main()
