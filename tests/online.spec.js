// The online version, against a pretend Supabase: saving lists and details, restoring a backup, and
// what happens when the lists and battles tables haven't been set up.
const {test, expect, open, mockSupabase, axe} = require("./helpers");

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

// Another painter's shared army, to comment on and follow.
const SHARED = {...DB, armies: [...DB.armies, {id: "a2", owner: "u2", faction: "ultramarines", name: "Robin's Ultramarines", public: true, updated_at: "2026-09-20",
  scheme: {by: "Robin", tiers: [{name: "Line", color: "#1f4aa8"}], colors: {armour: "#1f4aa8"}, rec: {w: 3, l: 1, d: 0}}}],
  units: [...DB.units, {id: "r1", army_id: "a2", owner: "u2", created_at: "2026-09-03", data: {name: "Intercessors", datasheet: "Intercessor Squad", role: "Battleline", count: 10, points: 80, painted: 5, stages: ["built"]}}]};

test("comment on a shared army, and see the painter's profile", async ({page}) => {
  await mockSupabase(page, {db: SHARED});
  await page.goto("/#/army/a2");
  const box = page.locator(".comments");
  await expect(box).toContainText("No comments yet.");
  await page.fill("#cm-in", "Lovely blues on those Intercessors.");
  await page.click(".cm-form [type=submit]");
  await expect(box.locator(".cm-list li")).toHaveCount(1);
  await expect(box.locator(".cm-top a")).toHaveText("You");
  expect((await db(page)).comments[0]).toMatchObject({army_id: "a2", body: "Lovely blues on those Intercessors."});
  await box.locator("[data-cdel]").click(); await box.locator("[data-cdel]").click();
  await expect(box).toContainText("No comments yet.");
  expect((await db(page)).comments).toHaveLength(0);

  await page.click(".owner-link");
  await expect(page.locator("h1")).toHaveText("Robin");
  // (The pretend database ignores which columns are asked for, so the painted totals aren't checked here.)
  await expect(page.locator(".painter-head .sub")).toContainText("1 shared army");
  await expect(page.locator(".painter-head .sub")).toContainText("3–1 battle record");
  await expect(page.locator(".shcard h3")).toHaveText("Robin's Ultramarines");
  await page.click('.painter-head [data-follow="u2"]');
  await expect(page.locator('.painter-head [data-follow="u2"]')).toHaveText("Following");
  expect((await db(page)).follows).toEqual([expect.objectContaining({follower: "u1", followee: "u2"})]);
});

test("battles against a friend: tag them, and add their battle against you to your record", async ({page}) => {
  await mockSupabase(page, {db: {...SHARED, follows: [{follower: "u1", followee: "u2"}],
    games: [{id: "rg1", owner: "u2", army_id: "a2", opp_user: "u1", created_at: "2026-09-21", data: {armyId: "a2", date: "2026-09-21", result: "w", us: 70, them: 50, mission: "Take and Hold", byName: "Robin", byArmy: "Robin's Ultramarines", byFaction: "ultramarines", oppUser: "u1"}}]}});
  await page.goto("/#/war");
  await expect(page.locator("#wd-tag")).toContainText("Robin logged a battle against you.");
  await page.click("#wd-tag a");
  const tg = page.locator(".tagged");
  await expect(tg).toContainText("Robin");
  await expect(tg.locator(".res")).toHaveText("L");
  await tg.getByRole("button", {name: "Add to my record"}).click();
  await expect(page.locator("#w-gu")).toHaveValue("50");
  await expect(page.locator("#w-gt")).toHaveValue("70");
  await expect(page.locator("[name=w-gr][value=l]")).toBeChecked();
  await expect(page.locator("#w-gf")).toHaveValue("u2");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".tagged")).toHaveCount(0);
  const mine = (await db(page)).games.find(g => g.owner === "u1");
  expect(mine).toMatchObject({opp_user: "u2", data: expect.objectContaining({mirror: "rg1", result: "l", oppName: "Robin", opp: "ultramarines"})});
  await expect(page.locator(".games .g-friend").first()).toHaveText("Robin");

  // Logging a new battle and tagging Robin.
  await page.click(".war-actions [data-log]");
  await expect(page.locator("#w-gf option")).toHaveCount(2);
  await page.selectOption("#w-gf", "u2");
  await expect(page.locator("#w-gp")).toHaveValue("Robin");
  await page.click("dialog[open] [type=submit]");
  const tagged = (await db(page)).games.filter(g => g.owner === "u1" && !g.data.mirror);
  expect(tagged[0]).toMatchObject({opp_user: "u2", data: expect.objectContaining({oppUser: "u2", byName: "player", byArmy: "Szarekhan Dynasty", byFaction: "necrons"})});
});

test("no accessibility problems on a painter's profile, comments and battles against you", async ({page}) => {
  await mockSupabase(page, {db: {...SHARED, comments: [{id: "c1", army_id: "a2", owner: "u2", body: "Thanks for looking!", by_name: "Robin", created_at: "2026-09-22T10:00:00Z"}],
    games: [{id: "rg1", owner: "u2", army_id: "a2", opp_user: "u1", created_at: "2026-09-21", data: {armyId: "a2", date: "2026-09-21", result: "w", us: 70, them: 50, byName: "Robin", byArmy: "Robin's Ultramarines", byFaction: "ultramarines", oppUser: "u1"}}]}});
  for(const r of ["#/army/a2", "#/painter/u2", "#/war/battles"]){
    await page.goto("/" + r); await page.waitForLoadState("networkidle");
    await expect(page.locator(r === "#/army/a2" ? ".comments" : r === "#/war/battles" ? ".tagged" : ".painter-head")).toBeVisible();
    expect(await axe(page), r).toEqual([]);
  }
});

test("share an army from War Ledger", async ({page}) => {
  await mockSupabase(page, {db: DB});
  await page.goto("/#/war/army/a1");
  await page.click("[data-share]");
  await page.click("label.switch:has(#wsh-on)");
  await expect(page.locator("#wsh-msg")).toContainText("Sharing is on");
  await expect(page.locator("#wsh-link")).toHaveValue(/#\/army\/a1$/);
  expect((await db(page)).armies.find(a => a.id === "a1").public).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-share]")).toHaveText("Shared");
  expect(await axe(page)).toEqual([]);
});
