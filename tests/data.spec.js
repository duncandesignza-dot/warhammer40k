// The datasheet data file is complete enough for the app to use.
const {test, expect} = require("@playwright/test");
const fs = require("fs"), path = require("path"), vm = require("vm"), {spawnSync} = require("child_process");

const FILE = path.join(__dirname, "..", "js", "data", "factions.js");
const load = () => { const w = {}; vm.runInNewContext(fs.readFileSync(FILE, "utf8"), {window: w}); return w.LEDGER_FACTIONS; };

test("every faction has units and detachments", () => {
  const data = load();
  expect(data.factions.length).toBeGreaterThan(30);
  for(const f of data.factions){
    expect(f.units.length, `${f.name} units`).toBeGreaterThan(10);
    expect((f.dets || []).length, `${f.name} detachments`).toBeGreaterThan(2);
    for(const d of f.dets) expect([1, 2, 3], `${f.name}: ${d.n} Detachment Points`).toContain(d.dp);
  }
});

test("chapters get their parent's units and detachments as well as their own", () => {
  const by = Object.fromEntries(load().factions.map(f => [f.id, f]));
  const um = by.ultramarines, sm = by["space-marines"];
  expect(um.units.some(u => u.n === "Marneus Calgar")).toBe(true);
  expect(um.units.some(u => u.n === "Intercessor Squad")).toBe(true);
  expect(um.dets.map(d => d.n)).toEqual(expect.arrayContaining(["Gladius Task Force", "Blade of Ultramar"]));
  expect(sm.dets.some(d => d.n === "Blade of Ultramar")).toBe(false);
  expect(um.ux).toBeUndefined();
});

test("battle sizes have points, Detachment Points and enhancement limits", () => {
  const {sizes} = load();
  expect(sizes.map(z => z.id)).toEqual(["incursion", "strike", "onslaught"]);
  for(const z of sizes){ expect(z.pts).toBeGreaterThan(0); expect(z.dp).toBeGreaterThan(0); expect(z.enh).toBeGreaterThan(0); }
});

test("unit sizes are sensible", () => {
  for(const f of load().factions) for(const u of f.units){
    if(!u.ms) continue;
    expect(u.ms[0], `${f.name}: ${u.n}`).toBeGreaterThanOrEqual(1);
    expect(u.ms[1], `${f.name}: ${u.n}`).toBeGreaterThanOrEqual(u.ms[0]);
  }
});

test("the change summary sees no changes between a file and itself", () => {
  const r = spawnSync("python3", [path.join(__dirname, "..", "tools", "data_changes.py"), FILE, FILE], {encoding: "utf8"});
  expect(r.status, r.stdout + r.stderr).toBe(10);
});
