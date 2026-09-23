#!/usr/bin/env python3
"""
Build the emblem library from the wh40k-icon repository.

Usage:
  git clone --depth 1 https://github.com/Certseeds/wh40k-icon wh40k-icon
  python3 tools/build_emblems.py wh40k-icon

Writes:
  icons/<category>/<name>.svg   one-colour icons, recoloured at runtime
  js/data/emblems.js            list of icons (window.LEDGER_EMBLEMS)

Icons: wh40k-icon by shitake, farvig, 夜行漫记 and Certseeds, CC BY-NC-SA 4.0.
Symbols and names belong to Games Workshop. Changes made here: colours replaced so the
icon can be recoloured, metadata removed, numbers rounded.
"""
import os, re, sys, json, glob, subprocess, datetime, shutil
import xml.etree.ElementTree as ET

SRC = sys.argv[1] if len(sys.argv) > 1 else "wh40k-icon"
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT_DIR = os.path.join(ROOT, "icons")
OUT_JS = os.path.join(ROOT, "js", "data", "emblems.js")
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)

CAT_LABELS = {
  "human_imperium": "Imperium", "human_imperium/adeptus_astartes": "Space Marine specialists",
  "human_imperium/adeptus_custodes": "Adeptus Custodes", "human_imperium/astartes_chapters": "Space Marine chapters",
  "human_imperium/astartes_legion": "Space Marine legions", "human_imperium/astartes_legion/blood_angels": "Blood Angels successors",
  "human_imperium/astartes_legion/dark_angels": "Dark Angels successors", "human_imperium/astartes_legion/imperial_fists": "Imperial Fists successors",
  "human_imperium/astartes_legion/iron_hands": "Iron Hands successors", "human_imperium/astartes_legion/space_wolves": "Space Wolves great companies",
  "human_imperium/astra_militarum": "Astra Militarum", "human_imperium/battle_sisters": "Adepta Sororitas",
  "human_imperium/mechanicum": "Adeptus Mechanicus", "human_imperium/officio-assassinorum": "Officio Assassinorum",
  "human_imperium/sisters_of_silence": "Sisters of Silence", "human_imperium/solar_auxilla": "Solar Auxilia",
  "chaos": "Chaos", "chaos/gods": "Chaos gods", "chaos/legions": "Chaos legions",
  "xenos": "Xenos", "xenos/durhkari": "Drukhari", "xenos/eldar": "Aeldari", "xenos/genestealer_cult": "Genestealer Cults",
  "xenos/harlequins": "Harlequins", "xenos/necrons": "Necrons", "xenos/orks": "Orks", "xenos/tau_empire": "T'au Empire",
  "general": "General", "general/swords": "Swords", "general/unit_attributes": "Unit markings", "general/unit_type": "Unit types", "general/weapon": "Weapons",
}

def lum(c):
    c = c.strip().lower()
    names = {"white": "#ffffff", "black": "#000000", "none": None}
    if c in names: c = names[c]
    if c is None: return None
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", c)
    if not m:
        m2 = re.fullmatch(r"rgb\((\d+),\s*(\d+),\s*(\d+)\)", c)
        if not m2: return 0.0
        r, g, b = (int(x) for x in m2.groups())
    else:
        h = m.group(1)
        if len(h) == 3: h = "".join(x * 2 for x in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

def paint(value):
    v = (value or "").strip()
    if not v: return None
    if v.lower() == "none" or v.lower() == "transparent": return "none"
    if v.startswith("url("): return "currentColor"
    l = lum(v)
    return "var(--ko,#fff)" if (l is not None and l > 0.85) else "currentColor"

def round_nums(s):
    return re.sub(r"-?\d+\.\d{2,}", lambda m: ("%.1f" % float(m.group(0))).rstrip("0").rstrip("."), s)

DRAW = {"path", "polygon", "polyline", "circle", "ellipse", "rect", "line", "g", "use"}

def local(tag): return tag.split("}")[-1]

def convert(path):
    txt = open(path, encoding="utf-8", errors="ignore").read()
    if "<image" in txt: return None
    try:
        root = ET.fromstring(re.sub(r"<!DOCTYPE[^>]*>", "", txt))
    except ET.ParseError:
        return None
    vb = root.get("viewBox")
    if not vb:
        w, h = root.get("width"), root.get("height")
        try: vb = f"0 0 {float(re.sub('[a-z%]', '', w))} {float(re.sub('[a-z%]', '', h))}"
        except Exception: return None
    # class -> declarations from <style>
    classes = {}
    for st in root.iter():
        if local(st.tag) == "style" and st.text:
            for sel, body in re.findall(r"([^{}]+)\{([^}]*)\}", st.text):
                for cls in re.findall(r"\.([\w-]+)", sel):
                    classes.setdefault(cls, "")
                    classes[cls] += ";" + body

    def clean(el):
        tag = local(el.tag)
        if tag not in DRAW: return None
        out = ET.Element("{%s}%s" % (SVG_NS, tag))
        style = ";".join(classes.get(c, "") for c in (el.get("class") or "").split()) + ";" + (el.get("style") or "")
        decl = {}
        for part in style.split(";"):
            if ":" in part:
                k, v = part.split(":", 1); decl[k.strip().lower()] = v.strip()
        fill = el.get("fill", decl.get("fill"))
        stroke = el.get("stroke", decl.get("stroke"))
        keep = ["d", "points", "cx", "cy", "r", "rx", "ry", "x", "y", "width", "height", "x1", "y1", "x2", "y2", "transform", "fill-rule", "clip-rule", "stroke-width", "stroke-linejoin", "stroke-linecap", "stroke-miterlimit", "opacity", "fill-opacity"]
        for k in keep:
            v = el.get(k, decl.get(k))
            if v is not None and v != "":
                out.set(k, round_nums(v) if k in ("d", "points", "transform") else v)
        # keep the original colour for now; mapped to currentColor / knockout below
        if fill: out.set("fill", "RAW:" + fill.strip())
        if stroke and stroke.strip().lower() not in ("none", "transparent"): out.set("stroke", "RAW:" + stroke.strip())
        if decl.get("display") == "none" or el.get("display") == "none": return None
        for ch in list(el):
            c = clean(ch)
            if c is not None: out.append(c)
        if tag == "g" and len(out) == 0: return None
        return out

    g = ET.Element("{%s}g" % SVG_NS, {"fill": "currentColor"})
    for ch in list(root):
        c = clean(ch)
        if c is not None: g.append(c)
    if len(g) == 0: return None
    # Map colours: the darkest colour becomes the icon ink (currentColor); lighter colours become
    # knock-outs that show the pauldron colour through (var(--ko)).
    raws, default_used = set(), False
    def scan(el, inherited_set):
        nonlocal default_used
        f = el.get("fill")
        if f and f.startswith("RAW:"): raws.add(f[4:]); inherited_set = True
        elif f is None and not inherited_set and local(el.tag) != "g": default_used = True
        st = el.get("stroke")
        if st and st.startswith("RAW:"): raws.add(st[4:])
        for c in el: scan(c, inherited_set)
    for c in g: scan(c, False)
    lums = {r: lum(r) for r in raws if paint(r) not in (None, "none") and not r.startswith("url(")}
    if default_used: lums["#000000"] = 0.0
    darkest = min(lums.values()) if lums else 0.0
    def mapped(raw):
        p = paint(raw)
        if p in (None, "none"): return "none"
        if raw.startswith("url("): return "currentColor"
        l = lums.get(raw, 0.0)
        return "currentColor" if l is None or l - darkest < 0.12 else "var(--ko,#fff)"
    for el in g.iter():
        for attr in ("fill", "stroke"):
            v = el.get(attr)
            if v and v.startswith("RAW:"): el.set(attr, mapped(v[4:]))
    # Some icons are drawn entirely in white. Treat those white shapes as the icon itself.
    def visible_ink(el, inherited):
        fill = el.get("fill", inherited)
        if local(el.tag) != "g" and fill == "currentColor": return True
        return any(visible_ink(c, fill) for c in el)
    if not visible_ink(g, "currentColor"):
        for el in g.iter():
            for attr in ("fill", "stroke"):
                if el.get(attr) == "var(--ko,#fff)": el.set(attr, "currentColor")
    svg = ET.Element("{%s}svg" % SVG_NS, {"viewBox": round_nums(vb)})
    svg.append(g)
    return ET.tostring(svg, encoding="unicode")

def nice(name):
    n = re.sub(r"\.svg$", "", name)
    n = n.replace("_s-", "'s-").replace("-clan", " clan")
    n = re.sub(r"[-_]+", " ", n).strip()
    n = re.sub(r"\bpreheresy\b", "(pre-Heresy)", n)
    n = re.sub(r"\s(\d+)$", r" \1", n)
    return " ".join(w if w.startswith("(") else (w[:1].upper() + w[1:]) for w in n.split())

def main():
    base = os.path.join(SRC, "src", "svgs")
    if os.path.isdir(OUT_DIR): shutil.rmtree(OUT_DIR)
    icons, skipped = [], 0
    for path in sorted(glob.glob(os.path.join(base, "**", "*.svg"), recursive=True)):
        rel = os.path.relpath(path, base).replace(os.sep, "/")
        cat = os.path.dirname(rel)
        svg = convert(path)
        if not svg: skipped += 1; continue
        fn = os.path.basename(rel).lower().replace("_", "-")
        out_rel = f"icons/{cat.replace('_', '-')}/{fn}" if cat else f"icons/{fn}"
        os.makedirs(os.path.join(ROOT, os.path.dirname(out_rel)), exist_ok=True)
        with open(os.path.join(ROOT, out_rel), "w", encoding="utf-8") as fh: fh.write(svg)
        iid = re.sub(r"[^a-z0-9]+", "-", (cat + "-" + fn[:-4]).lower()).strip("-")
        icons.append({"id": iid, "n": nice(os.path.basename(rel)), "c": cat, "f": out_rel})
    try: commit = subprocess.check_output(["git", "-C", SRC, "log", "-1", "--format=%h %cs"], text=True).strip()
    except Exception: commit = ""
    data = {"source": "Certseeds/wh40k-icon", "commit": commit, "license": "CC BY-NC-SA 4.0",
            "credit": "Icons from wh40k-icon by shitake, farvig, 夜行漫记 and Certseeds (CC BY-NC-SA 4.0). Symbols and names belong to Games Workshop.",
            "cats": {c: CAT_LABELS.get(c, c) for c in sorted({i["c"] for i in icons})}, "icons": icons}
    with open(OUT_JS, "w", encoding="utf-8") as fh:
        fh.write("/* Generated by tools/build_emblems.py from " + data["source"] + " " + commit + ". Do not edit by hand. */\n")
        fh.write("window.LEDGER_EMBLEMS = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    lic = os.path.join(OUT_DIR, "LICENSE.md")
    with open(lic, "w", encoding="utf-8") as fh:
        fh.write("# Emblem icons\n\nThese icons come from [wh40k-icon](https://github.com/Certseeds/wh40k-icon) by shitake, farvig, 夜行漫记 and Certseeds, "
                 "licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Symbols and names belong to Games Workshop.\n\n"
                 "Changes: colours replaced with currentColor so they can be recoloured, metadata removed, numbers rounded. "
                 "These changed files are shared under the same licence. Non-commercial use only.\n")
    print(f"{len(icons)} icons written, {skipped} skipped", file=sys.stderr)

main()
