// Backups: everything goes out (lists and battles too), and comes back linked together.
const {test, expect, seed, saved, open} = require("./helpers");
const fs = require("fs");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8DwnwEFMBQAAO4H+Qm7p1wAAAAASUVORK5CYII=";
const EXTRA = `db.units.find(u => u.id === "u1").image = "${PNG}"; db.units.find(u => u.id === "u2").photos = ["${PNG}"];
  db.armies.push({id: "p1", faction: "ultramarines", name: "Ultramarines (not in an army)", scheme: {...window.LEDGER_PRESETS.presetFor("ultramarines"), pool: true}, public: false});
  db.units.push({id: "u10", armyId: "p1", name: "Lieutenant", datasheet: "Lieutenant", role: "Character", count: 1, points: 65, painted: 0, stages: []});
  db.lists[0].units.push({u: "u10", k: "lt"}); db.lists[0].units[0].warlord = true;`;

async function download(page, click, file){
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click(click)]);
  await dl.saveAs(file); return JSON.parse(fs.readFileSync(file, "utf8"));
}

test("download everything, clear it, restore it: lists and battles still point at the right units", async ({page}, info) => {
  await seed(page, EXTRA);
  await open(page, "#/settings");
  const file = info.outputPath("everything.json");
  const j = await download(page, "#set-export", file);
  expect([j.ledgers.length, j.lists.length, j.games.length]).toEqual([3, 1, 3]);

  await page.evaluate(() => localStorage.setItem("livery-ledger-v3", JSON.stringify({armies: [], units: [], lists: [], games: []})));
  await page.reload();
  await page.setInputFiles("#set-restore-f", file);
  await page.click("#rs-go");
  await expect(page.locator("#rs-msg")).toContainText("Restored 2 ledgers, 7 units, 1 army list, 3 battle reports");

  const d = await saved(page), ids = new Set(d.units.map(u => u.id)), list = d.lists[0];
  expect(d.armies.filter(a => a.scheme.pool)).toHaveLength(1);
  expect(list.units.filter(e => e.u).every(e => ids.has(e.u))).toBe(true);
  expect(list.units.some(e => e.u && d.units.find(u => u.id === e.u).name === "Lieutenant")).toBe(true);
  expect(list.units.find(e => e.warlord)).toBeTruthy();
  expect(d.games.filter(g => g.listId).every(g => g.listId === list.id)).toBe(true);
  expect(d.games.filter(g => g.mvp).every(g => ids.has(g.mvp))).toBe(true);
  expect(d.units.filter(u => u.image)).toHaveLength(1);
  expect(d.units.reduce((n, u) => n + (u.photos || []).length, 0)).toBe(1);
});

test("restoring the same file again starts with ledgers you already have unticked", async ({page}, info) => {
  await seed(page);
  await open(page, "#/settings");
  const file = info.outputPath("everything.json");
  await download(page, "#set-export", file);
  await page.setInputFiles("#set-restore-f", file);
  await expect(page.locator("[data-rs]")).toHaveCount(2);
  for(const box of await page.locator("[data-rs]").all()) await expect(box).not.toBeChecked();
});

test("a ledger's backup brings its lists and battles into another ledger", async ({page}, info) => {
  await seed(page, `db.armies.push({id: "fresh", faction: "ultramarines", name: "Fresh", scheme: window.LEDGER_PRESETS.presetFor("ultramarines"), public: false});`);
  await open(page, "#/army/a1");
  await page.click("#b-more");
  const file = info.outputPath("army.json");
  const j = await download(page, "#b-export", file);
  expect([j.units.length, j.lists.length, j.games.length]).toEqual([4, 1, 2]);
  await open(page, "#/army/fresh");
  await page.setInputFiles("#f-import", file);
  await expect.poll(async () => (await saved(page)).lists.filter(l => l.armyId === "fresh").length).toBe(1);
  const d = await saved(page), mine = new Set(d.units.filter(u => u.armyId === "fresh").map(u => u.id));
  expect(mine.size).toBe(4);
  expect(d.lists.find(l => l.armyId === "fresh").units.filter(e => e.u).every(e => mine.has(e.u))).toBe(true);
  expect(d.games.filter(g => g.armyId === "fresh")).toHaveLength(2);
});

test("a file that isn't a backup is turned away politely", async ({page}, info) => {
  await open(page, "#/settings");
  const file = info.outputPath("bad.json"); fs.writeFileSync(file, "not a backup");
  await page.setInputFiles("#set-restore-f", file);
  await expect(page.locator("#set-rmsg")).toHaveText("That file isn't a Livery Ledger backup.");
});
