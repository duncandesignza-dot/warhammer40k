// The online version, against a pretend Supabase: saving lists and details, restoring a backup, and
// what happens when the lists and battles tables haven't been set up.
const {test, expect, open, mockSupabase} = require("./helpers");

const DB = {
  armies: [{id: "a1", owner: "u1", faction: "necrons", name: "Szarekhan Dynasty", public: false, updated_at: "2026-09-19", scheme: {tiers: [{name: "Line", color: "#888888"}], colors: {armour: "#888888"}}}],
  units: [{id: "n1", army_id: "a1", owner: "u1", created_at: "2026-09-01", data: {name: "Necron Warriors", datasheet: "Necron Warriors", role: "Battleline", count: 20, points: 200, painted: 20, stages: ["built", "primed", "base", "shade"]}},
          {id: "n2", army_id: "a1", owner: "u1", created_at: "2026-09-02", data: {name: "Overlord", datasheet: "Overlord", role: "Character", count: 1, points: 85, painted: 0, stages: ["built"]}}]};
const db = page => page.evaluate(() => window.__db);

test("build a list online and save its details", async ({page}) => {
  await mockSupabase(page, {db: DB});
  await page.goto("/#/war/army/a1");
  await page.click("[data-new-list]");
  await page.fill("#w-ln", "Test list");
  await page.click("dialog[open] [type=submit]");
  await page.click('[data-add="n1"]'); await page.click('[data-add="n2"]');
  await expect.poll(async () => (await db(page)).lists[0].data.units.length).toBe(2);
  await page.click("[data-details]");
  await page.selectOption("#w-lsz", "onslaught"); await page.selectOption("#w-lst", "theory");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => (await db(page)).lists[0].data.status).toBe("theory");
  expect((await db(page)).lists[0].data).toMatchObject({size: "onslaught", limit: 3000});
});

test("restore a backup online, photos included", async ({page}, info) => {
  const fs = require("fs"), file = info.outputPath("backup.json");
  fs.writeFileSync(file, JSON.stringify({app: "livery-ledger", kind: "everything", version: 6, ledgers: [{id: "old1", faction: "orks", name: "Waaagh", scheme: {}, units: [
    {id: "ou1", name: "Boyz", datasheet: "Boyz", role: "Battleline", count: 10, points: 85, image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8DwnwEFMBQAAO4H+Qm7p1wAAAAASUVORK5CYII=", photos: []}]}],
    lists: [{id: "ol1", armyId: "old1", name: "Green tide", units: [{u: "ou1", k: "a"}]}], games: [{id: "og1", armyId: "old1", listId: "ol1", date: "2026-09-01", result: "w", mvp: "ou1"}]}));
  await mockSupabase(page, {db: DB});
  await page.goto("/#/settings");
  await page.setInputFiles("#set-restore-f", file);
  await page.click("#rs-go");
  await expect(page.locator("#rs-msg")).toContainText("Restored 1 ledger, 1 unit, 1 army list, 1 battle report");
  const d = await db(page), army = d.armies.find(a => a.name === "Waaagh"), unit = d.units.find(u => u.army_id === army.id);
  expect(unit.image_path).toBeTruthy();
  expect(d.lists.find(l => l.army_id === army.id).data.units[0].u).toBe(unit.id);
  expect(d.games.find(g => g.army_id === army.id).data).toMatchObject({mvp: unit.id});
});

test("without the lists and battles tables, War Ledger says how to set them up", async ({page}) => {
  await mockSupabase(page, {db: DB, noWar: true});
  await page.goto("/#/war/lists");
  await expect(page.locator(".banner")).toContainText("features.sql");
});
