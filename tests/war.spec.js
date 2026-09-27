// War Ledger: armies, the collection, army lists (details, options, things to check) and battles.
const {test, expect, seed, saved, open, mockSupabase} = require("./helpers");

// Points are written with a non-breaking space ("75 pts"); compare with ordinary spaces.
const checks = async page => (await page.locator(".tc-list li strong").allInnerTexts()).map(t => t.replace(/\u00a0/g, " "));

test("muster an army and add units from a pasted list", async ({page}) => {
  await page.goto("/#/war/new");
  await page.click('.fcard[href="#/war/new/ultramarines"]');
  await page.fill("#w-name", "Test Company"); await page.fill("#w-lim", "2000");
  await page.click("#wn-form [type=submit]");
  await expect(page.locator("h1")).toHaveText("Test Company");
  await page.click("[data-from-list]");
  await page.fill("#w-list", "Captain (80 points)\n  • Warlord\nIntercessor Squad (150 points)\n  • 10x Intercessor\nRedemptor Dreadnought (195 points)");
  await page.click("#w-add");
  await expect(page.locator(".wtable tbody tr")).toHaveCount(3);
  const d = await saved(page);
  expect(d.units.map(u => [u.name, u.count]).sort()).toEqual([["Captain", 1], ["Intercessor Squad", 10], ["Redemptor Dreadnought", 1]]);
});

test("a unit can live in the armoury without an army, and lists can use it", async ({page}) => {
  await seed(page);
  await open(page, "#/war/armoury");
  await page.click(".war-actions [data-coll-add]");
  await page.selectOption("#w-cf", "ultramarines");
  await page.selectOption("#w-ca", "");
  await page.click("dialog[open] [type=submit]");
  await page.selectOption("#w-sheet", {label: await page.$eval("#w-sheet", s => [...s.options].find(o => o.textContent.startsWith("Lieutenant")).textContent)});
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator('.ar-fac:has(h2:text-is("Ultramarines")) tr:has-text("Lieutenant")')).toContainText("Not in an army");
  await open(page, "#/war/list/l1");
  await page.click('[data-add-tab="coll"]');
  await expect(page.locator('.lb-coll li:has-text("Lieutenant")')).toContainText("Not in an army");
});

test("the armoury lists your units by faction, with points, painting and how often your lists use them", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], fav: true});`);
  await open(page, "#/war/armoury");
  await expect(page.locator("h1")).toHaveText("Armoury");
  await expect(page.locator('.war-tabs a[aria-current="page"]')).toHaveText("Armoury");
  // Most points first.
  expect(await page.locator(".ar-fac h2").allInnerTexts()).toEqual(["Ultramarines", "Tyranids"]);
  const um = page.locator('.ar-fac:has(h2:text-is("Ultramarines"))');
  await expect(um.locator(".ar-stats")).toHaveText("5 units · 18 models · 745\u00a0pts");
  await expect(um.locator(".ar-paintbar > span")).toHaveText("39% painted");
  await expect(um.locator(".ar-chip")).toContainText("Ultramarines 2nd Company");
  await expect(um.locator("thead")).toHaveText(/Unit\s*Role\s*Models\s*Points\s*Painted\s*In lists/);
  await expect(um.locator('tr:has-text("Intercessor Squad") [data-label="Painted"]')).toHaveText("6/10");
  await expect(um.locator('tr:has-text("Intercessor Squad") [data-label="In lists"]')).toHaveText("1");
  await expect(um.locator('tr:has-text("Terminator Squad") [data-label="In lists"]')).toHaveText("0");
  // Search.
  await page.fill("#ar-q", "hive");
  await expect(page.locator('.ar-fac:has(h2:text-is("Tyranids")) tbody tr')).toHaveCount(1);
  await expect(um).toContainText("No units match.");
  // The old collection page opens the armoury.
  await open(page, "#/war/collection");
  await expect(page).toHaveURL(/#\/war\/armoury$/);
});

test("army lists: each army's full army comes first, then its lists", async ({page}) => {
  await seed(page);
  await open(page, "#/war/lists");
  // Every army shows, even one with no lists yet.
  expect(await page.locator(".war-sec h2").allInnerTexts()).toEqual(["Ultramarines 2nd Company", "Hive Fleet Leviathan"]);
  const um = page.locator(".war-sec", {has: page.locator('h2:text-is("Ultramarines 2nd Company")')});
  await expect(um.locator(".lcard").first()).toContainText("Full army");
  await expect(um.locator(".full-army .wc-nums")).toContainText("585 / 2,000 pts");
  await expect(um.locator(".full-army .wc-nums")).toContainText("4 units");
  await expect(um.locator(".lcard").nth(1)).toContainText("Club night");
  await um.locator(".full-army").click();
  await expect(page).toHaveURL(/#\/war\/army\/a1$/);
  await expect(page.locator('.war-tabs a[aria-current="page"]')).toHaveText("Army lists");
  // A list of the whole army, to print, export or play.
  await page.click("#wa-more"); await page.click("[data-full-list]");
  await expect(page).toHaveURL(/#\/war\/list\//);
  await expect(page.locator("h1")).toHaveText("Ultramarines 2nd Company: full army");
  await expect(page.locator(".lb-own")).toHaveText("You own every unit in this list.");
});

test("an army is what you own; a list can try out units you don't, and marks them until you buy them", async ({page}) => {
  await seed(page);
  // Club night has a Gladiator Lancer from the datasheets: it's marked, and the list says how much you own.
  await open(page, "#/war/list/l1");
  await expect(page.locator('.lb-in li:has-text("Gladiator Lancer") .tag.plan')).toHaveText("Not owned");
  await expect(page.locator(".lb-own")).toContainText("You own 3 of 4 units");
  await expect(page.locator(".lb-own b")).toHaveText("160\u00a0pts");
  await expect(page.locator(".war-stats")).not.toContainText(/battle ready|available/i);
  // Add units opens on the units you own.
  await expect(page.locator('[data-add-tab="coll"]')).toHaveAttribute("aria-pressed", "true");
  // Bought it: it joins the army (and Livery Ledger), keeping its place in the list.
  await page.click('.lb-in [aria-label="Datasheet, models and points for Gladiator Lancer"]');
  await page.click("dialog[open] [data-bought]");
  await expect(page.locator(".lb-own")).toHaveText("You own every unit in this list.");
  const d = await saved(page), lancer = d.units.find(u => u.name === "Gladiator Lancer");
  expect(lancer).toMatchObject({armyId: "a1", own: "owned", count: 1, points: 160});
  expect(d.lists[0].units[3]).toMatchObject({u: lancer.id, k: "d"});
  // The army has no readiness or ownership columns, filters or batch actions.
  await open(page, "#/war/army/a1");
  await expect(page.locator(".war-stats")).toContainText("5 units");
  await expect(page.locator(".wc-group thead").first()).toHaveText(/Unit\s*Role\s*Models\s*Points/);
  await expect(page.locator('[data-filter="notready"]')).toHaveCount(0);
  expect(await page.locator("#wa-g option").allInnerTexts()).toEqual(["Nothing", "Role"]);
  expect(await page.locator("#wa-s option").allInnerTexts()).toEqual(["Name", "Points (most first)", "Models (most first)"]);
  await page.click("[data-select]");
  await expect(page.locator('[data-bb="ready"], [data-bb="bought"], [data-bb="own"]')).toHaveCount(0);
  await page.click('[data-bb="done"]');
  // The unit editor asks only about the unit itself: an army's units are yours.
  await page.click(`.wtable [data-unit="${lancer.id}"]`);
  await expect(page.locator("dialog[open] legend")).toHaveText(["Wargear"]);
  await expect(page.locator("#w-owned, #w-own, #w-built, #w-painted, #w-ready, #w-bought")).toHaveCount(0);
  await page.keyboard.press("Escape");
  // The overview shows where the points go, and nothing about readiness.
  await open(page, "#/war");
  await expect(page.locator("main")).not.toContainText(/battle ready|Collection status/i);
  await expect(page.locator(".war-comp .ws-rule")).toHaveText("1,070 pts across 39 models");
  expect(await page.locator(".war-comp .stack-key li").allTextContents()).toEqual(["295 ptsCharacters · 28%", "260 ptsBattleline · 24%", "160 ptsInfantry · 15%", "355 ptsVehicles · 33%"]);
  await open(page, "#/settings");
  await expect(page.locator("#set-ready")).toHaveCount(0);
});

test("list details: battle size sets the limit, and Detachment Points are counted", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click("[data-details]");
  await expect(page.locator("#w-dp")).toHaveText("Detachment Points: 3 used of 3 for Strike Force.");
  await page.selectOption("#w-lsz", "onslaught");
  await expect(page.locator("#w-ll")).toHaveValue("3000");
  await page.click("#w-det-add"); await page.locator(".w-det").nth(1).fill("Blade of Ultramar");
  await expect(page.locator("#w-dp")).toHaveText("Detachment Points: 6 used of 4 for Onslaught.");
  await page.selectOption("#w-lst", "tournament");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".war-head .sub")).toContainText("Onslaught · Gladius Task Force + Blade of Ultramar · 3,000 pts limit");
  await expect(page.locator(".lst-meta .tag")).toHaveText("Tournament");
  expect(await checks(page)).toContain("Detachments cost 6 Detachment Points.");
  const l = (await saved(page)).lists[0];
  expect([l.size, l.limit, l.detachments, l.status]).toEqual(["onslaught", 3000, ["Gladius Task Force", "Blade of Ultramar"], "tournament"]);
});

test("unit options: warlord and an enhancement whose points fill in", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  expect(await checks(page)).toContain("No warlord chosen.");
  await page.click('[aria-label="Warlord, enhancement and leading for Captain"]');
  await page.check("#w-ewl");
  await page.fill("#w-een", "Artificer Armour");
  await expect(page.locator("#w-eep")).toHaveValue("20");
  await page.click("dialog[open] [type=submit]");
  const row = page.locator('.lb-in li:has-text("Captain")');
  await expect(row.locator(".tag.wl")).toHaveText("Warlord");
  await expect(row).toContainText("Enhancement: Artificer Armour (+20)");
  expect(await checks(page)).not.toContain("No warlord chosen.");
  expect((await saved(page)).lists[0].units[0]).toMatchObject({warlord: true, enh: {n: "Artificer Armour", p: 20}});
});

test("things to check use the datasheet data, and can be hidden or turned off", async ({page}) => {
  await seed(page, `db.lists[0].size = "incursion"; db.lists[0].limit = 1000;
    db.lists[0].units.push(...[1, 2, 3, 4, 5].map(i => ({n: "Rhino", sheet: "Rhino", role: "Dedicated Transport", count: 1, points: 75, k: "r" + i})),
      {n: "Intercessor Squad", sheet: "Intercessor Squad", role: "Battleline", count: 12, points: 150, k: "big"});
    db.lists[0].units[0].enh = {n: "Adept of the Codex", p: 20}; db.lists[0].units.push({n: "Lieutenant", sheet: "Lieutenant", role: "Character", count: 1, points: 65, k: "lt", enh: {n: "Adept of the Codex", p: 20}});`);
  await open(page, "#/war/list/l1");
  const all = await checks(page);
  for(const c of ["5 units of Rhino.", "Adept of the Codex is on 2 units.", "Adept of the Codex is usually for Captain only.", "Intercessor Squad has 12 models."]) expect(all).toContain(c);
  await page.click('[data-hide-check="warlord"]');
  expect(await checks(page)).not.toContain("No warlord chosen.");
  await expect(page.locator(".tc-hid")).toContainText("1 check hidden");
  expect((await saved(page)).lists[0].ignored).toEqual(["warlord"]);
  await open(page, "#/settings");
  await page.click("label.switch:has(#set-checks)");
  await open(page, "#/war/list/l1");
  await expect(page.locator(".tc")).toHaveCount(0);
});

test("when datasheet points change, lists say so and update in one go", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u4").points = 180; db.lists[0].units[3].points = 150; db.lists[0].units[0].enh = {n: "Adept of the Codex", p: 5};`);
  await open(page, "#/war/lists");
  await expect(page.locator(".latest-b")).toContainText("Club night");
  await open(page, "#/war/list/l1");
  const note = page.locator(".tc-list > li", {hasText: "The latest points change this list"});
  await expect(note).toContainText("Redemptor Dreadnought: 180 → 195 pts");
  await expect(note).toContainText("Gladiator Lancer: 150 → 160 pts");
  await expect(note).toContainText("Adept of the Codex on Captain: 5 → 20 pts");
  await note.getByRole("button", {name: "Update to latest points"}).click();
  await expect(page.locator(".toast")).toContainText("Updated 3 points values");
  await expect(page.locator(".tc-list > li", {hasText: "The latest points change"})).toHaveCount(0);
  const db = await saved(page);
  expect(db.units.find(u => u.id === "u4").points).toBe(195);
  expect(db.lists[0].units[3].points).toBe(160);
  expect(db.lists[0].units[0].enh.p).toBe(20);
  await open(page, "#/war/lists");
  await expect(page.locator(".latest-b")).toHaveCount(0);
});

test("log a battle from a list and the army's record updates", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click("button[data-log][data-list]");
  await page.selectOption("#w-go", "orks"); await page.fill("#w-gu", "90"); await page.fill("#w-gt", "40");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".war-head .sub")).toContainText("2–0 record");
  await expect.poll(async () => (await saved(page)).armies.find(a => a.id === "a1").scheme.rec).toEqual({w: 2, l: 1, d: 0});
});

test("when the browser is full, a battle isn't logged and nothing shows as saved", async ({page, errors}) => {
  await seed(page);
  await page.evaluate(() => { let i = 0; for(const n of [262144, 1024, 16]){ const s = "x".repeat(n); try { for(;;) localStorage.setItem("fill" + i++, s); } catch(e){} } });
  await open(page, "#/war/army/a1");
  await page.click(".sec-h button[data-log]");
  await page.fill("#w-gp", "Robin"); await page.fill("#w-gn", "A long game. ".repeat(60));
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator("dialog[open] #w-msg")).toContainText("out of storage space");
  await page.keyboard.press("Escape");
  // Moving around inside the app (no reload) still shows only the battles that were really saved.
  await page.goto("/#/war/battles");
  await expect(page.locator(".games .game")).toHaveCount(3);
  await expect(page.getByText("vs Robin")).toHaveCount(0);
  expect((await saved(page)).games).toHaveLength(3);
  errors.splice(0); // the failed save is logged to the console on purpose
});

test("battle stats: streaks, scores, a margin chart and more ways to slice the record", async ({page}) => {
  await seed(page);
  await open(page, "#/war/battles");
  const hl = page.locator('[aria-label="Highlights"]');
  await expect(hl).toContainText("1 win");
  await expect(hl).toContainText("63 – 66");
  await expect(hl).toContainText("+23");
  await expect(page.locator(".mchart .mc-bar")).toHaveCount(3);
  await expect(page.locator(".mchart .mc-bar").first()).toHaveAttribute("data-tip", /Draw vs T'au Empire · no score/);
  for(const [title, row] of [["By detachment", "Gladius Task Force"], ["By mission", "Take and Hold"], ["Most valuable units", "Captain"]])
    await expect(page.locator(".wrec", {has: page.locator("h2", {hasText: title})})).toContainText(row);
  // Each unit in the lists you played with: g1 used Club night (a win), so its four units are 1 game, 100% won.
  const units = page.locator(".wrec", {has: page.locator("h2", {hasText: "Units in your games"})});
  await expect(units.locator("tbody tr")).toHaveCount(4);
  await expect(units.locator('tbody tr:has-text("Gladiator Lancer")')).toContainText("100%");
  await page.locator(".wrec").getByRole("button", {name: "Captain"}).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
});

test("duplicate a list as a new version and compare the two", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click("#wl-more"); await page.click("[data-dup]");
  await expect(page.locator("h1")).toHaveText("Club night v2");
  await page.click('[data-rm="0"]');                  // take the Captain out of the new version
  await page.click('[data-view="2"]'); await page.fill("#w-ep", "200"); await page.click("dialog[open] [type=submit]");
  await page.click("#wl-more"); await page.click("[data-compare]");
  await expect(page.locator("h1")).toHaveText("Compare lists");
  await expect(page.locator(".cmp-t thead")).toContainText("Club nightClub night v2");
  await expect(page.locator("section", {has: page.locator("h2", {hasText: "Only in Club night"})}).first()).toContainText("Captain");
  await expect(page.locator("section", {has: page.locator("h2", {hasText: "In both, but different"})})).toContainText("160 → 200 pts");
  await page.click("#cmp-swap");
  await expect(page.locator(".cmp-t thead")).toContainText("Club night v2Club night");
  expect((await saved(page)).lists.find(l => l.name === "Club night v2").from).toBe("l1");
});

test("a Crusade force: battles give experience and requisition points, and each unit keeps a Crusade card", async ({page}) => {
  await seed(page);
  await open(page, "#/war/lists");
  // One New list button: a Crusade force is one of the choices in it.
  await expect(page.locator('[data-kind="crusade"]')).toHaveCount(0);
  await page.click('.war-actions [data-new-list]');
  await page.selectOption("#w-lk", "crusade");
  await expect(page.locator("#w-lk-hint")).toContainText("supply limit");
  await page.fill("#w-ln", "Indomitus Crusade"); await page.fill("#w-ll", "1000");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator("h1")).toHaveText("Indomitus Crusade");
  await expect(page.locator(".lst-meta .tag.cr")).toHaveText("Crusade");
  await page.click('[data-add-tab="coll"]');
  await page.click('[data-add="u1"]'); await page.click('[data-add="u2"]');
  await expect(page.locator(".cr-t tbody tr")).toHaveCount(2);
  // A battle: both took part, the Captain was Marked for Greatness.
  await page.click(".war-actions [data-log]");
  await expect(page.locator("#w-gv-l")).toBeHidden();
  await page.selectOption("#w-gmfg", {label: "Captain"});
  await page.click("dialog[open] [type=submit]");
  const row = name => page.locator(".cr-t tbody tr", {hasText: name});
  await expect(row("Captain").locator('[data-label="XP"]')).toHaveText("4");
  await expect(row("Intercessor Squad").locator('[data-label="XP"]')).toHaveText("1");
  await expect(page.locator(".cr-stats")).toContainText("1 victory");
  // The Crusade card: honours, a scar and extra experience.
  await page.click('[data-cr="0"]');
  await page.fill("#cr-hn", "Hardened veterans"); await page.keyboard.press("Enter");
  await page.selectOption("#cr-ht", "relic"); await page.fill("#cr-hn", "Blade of Macragge"); await page.click("#cr-hadd");
  await page.fill("#cr-sn", "Battle-weary"); await page.click("#cr-sadd");
  await page.fill("#cr-xp", "10");
  await page.click("dialog[open] [type=submit]");
  await expect(row("Captain").locator(".cr-rank")).toHaveText("Blooded");
  await expect(row("Captain").locator('[data-label="Crusade pts"]')).toHaveText("1");
  // Spend a requisition point.
  await page.click("[data-rp]"); await page.fill("#cr-rp", "0"); await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".cr-stats .wstat").first()).toContainText("0");
  const l = (await saved(page)).lists.find(x => x.name === "Indomitus Crusade");
  expect(l.kind).toBe("crusade"); expect(l.rp).toBe(-1);
  expect(l.units[0]).toMatchObject({xp: 6, hon: [{t: "trait", n: "Hardened veterans"}, {t: "relic", n: "Blade of Macragge"}], scar: ["Battle-weary"]});
  const g = (await saved(page)).games.find(x => x.listId === l.id);
  expect(g.took).toEqual([l.units[0].k, l.units[1].k]); expect(g.mfg).toBe(l.units[0].k); expect(g.mvp).toBe("u1");
  // Removing a unit with a record takes two presses.
  await page.click('[data-rm="0"]');
  await expect(page.locator(".toast")).toContainText("Press × again");
  await expect(page.locator(".cr-t tbody tr")).toHaveCount(2);
  await page.click('[data-rm="0"]');
  await expect(page.locator(".cr-t tbody tr")).toHaveCount(1);
});

test("an army's current force can be grouped and sorted, and the choice is remembered", async ({page}) => {
  await seed(page);
  await open(page, "#/war/army/a1");
  await expect(page.locator(".wc-group h3")).toHaveText(["Character", "Battleline", "Infantry", "Vehicle"]);
  await page.selectOption("#wa-g", "none"); await page.selectOption("#wa-s", "points");
  await expect(page.locator(".wtable tbody th .linkish")).toHaveText(["Redemptor Dreadnought", "Terminator Squad", "Intercessor Squad", "Captain"]);
  await expect(page.locator(".wtable tfoot")).toContainText("Total");
  await open(page, "#/war/army/a1");
  await expect(page.locator("#wa-g")).toHaveValue("none");
  await expect(page.locator("#wa-s")).toHaveValue("points");
});

test("select units on an army page: star, add to a list, move and delete", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: []});
    db.lists.push({id: "l2", armyId: "a1", name: "Second list", limit: 1000, units: [], createdAt: "2026-09-02", updatedAt: "2026-09-02"});`);
  await open(page, "#/war/army/a1");
  await page.click("[data-select]");
  const pick = name => page.getByRole("checkbox", {name: `Select ${name}`}).check();
  const unit = async id => (await saved(page)).units.find(u => u.id === id);
  await pick("Terminator Squad"); await pick("Gladiator Lancer");
  await expect(page.locator("#wa-count")).toHaveText("2 selected");
  await page.click('[data-bb="star"]');
  await expect.poll(async () => (await unit("u3")).fav && (await unit("u9")).fav).toBe(true);
  await page.selectOption("#wa-list", "l2");
  await expect(page.locator(".toast")).toContainText("Added 2 units to Second list.");
  expect((await saved(page)).lists.find(l => l.id === "l2").units.map(e => e.u)).toEqual(["u3", "u9"]);
  await page.selectOption("#wa-move", "__pool");
  await expect(page.locator(".toast")).toContainText("Moved 2 units");
  const pool = (await saved(page)).armies.find(a => a.scheme.pool);
  expect((await unit("u3")).armyId).toBe(pool.id);
  await pick("Captain");
  await page.click('[data-bb="del"]'); await page.click('[data-bb="del"]');
  await expect(page.locator(".toast")).toContainText("Deleted 1 unit.");
  expect(await unit("u1")).toBeUndefined();
  await page.click('[data-bb="done"]');
  await expect(page.locator("#wa-bar")).toHaveCount(0);
});

test("export a list in New Recruit's tournament layout, and paste it back in without losing anything", async ({page}) => {
  const text = require("fs").readFileSync(require("path").join(__dirname, "fixtures/newrecruit-world-eaters.txt"), "utf8");
  await seed(page, `db.armies.push({id: "w1", faction: "world-eaters", name: "Butchers", scheme: window.LEDGER_PRESETS.presetFor("world-eaters"), createdAt: "2026-01-01", updatedAt: "2026-01-01"});
    db.lists.push({id: "wl", armyId: "w1", name: "Imported", limit: 2000, detachments: [], units: [], createdAt: "2026-09-01", updatedAt: "2026-09-01"},
      {id: "w2", armyId: "w1", name: "Round trip", limit: 2000, detachments: [], units: [], createdAt: "2026-09-01", updatedAt: "2026-09-01"});`);
  await open(page, "#/war/list/wl");
  await page.click("[data-import]"); await page.fill("#w-list", text); await page.click("#w-add");
  await expect(page.locator(".war-stats")).toContainText("1,995");
  await page.click("[data-export]");
  const out = await page.inputValue("#w-exp");
  for(const line of ["+ FACTION KEYWORD: Chaos - World Eaters", "+ DETACHMENT: Berzerker Warband", "+ TOTAL ARMY POINTS: 1995pts", "+ WARLORD: Char1: Daemon Prince of Khorne", "+ NUMBER OF UNITS: 17",
    "Char1: 1x Daemon Prince of Khorne (200 pts): Warlord, Infernal cannon, Hellforged weapons", "Char3: 1x Lord Invocatus (100 pts): Bolt pistol, Bladed horn, Coward's Bane",
    "Leading Khorne Berzerkers[2]", "Leading Eightbound", "2x Chaos Spawn (95 pts): Hideous Mutations", "  Attached to Slaughterbound[1]"]) expect(out.split("\n")).toContain(line);
  // Pasting the export into another list gives the same list back.
  const list = async id => (await saved(page)).lists.find(l => l.id === id);
  await open(page, "#/war/list/w2");
  await page.click("[data-import]"); await page.fill("#w-list", out); await page.click("#w-add");
  await expect(page.locator(".war-stats")).toContainText("1,995");
  const shape = l => { const key = new Map(l.units.map((e, i) => [e.k, i])); return {det: l.detachments, units: l.units.map(e => ({n: e.n, count: e.count, points: e.points, gear: e.gear, warlord: !!e.warlord, enh: e.enh, lead: e.lead ? key.get(e.lead) : null}))}; };
  const a = shape(await list("wl")), b = shape(await list("w2"));
  expect(b.det).toEqual(a.det);
  // Same units, in export order (characters first), with the same leaders.
  const byName = xs => xs.map(({lead, ...x}) => x).sort((p, q) => JSON.stringify(p).localeCompare(JSON.stringify(q)));
  expect(byName(b.units)).toEqual(byName(a.units));
  expect(b.units.filter(x => x.lead != null).map(x => [x.n, b.units[x.lead].n])).toEqual(a.units.filter(x => x.lead != null).map(x => [x.n, a.units[x.lead].n]));
});

test("import an army: the faction is found, and the army and a list of units you don't own yet are made", async ({page}) => {
  const text = require("fs").readFileSync(require("path").join(__dirname, "fixtures/newrecruit-world-eaters.txt"), "utf8");
  await seed(page);
  await open(page, "#/war/new");
  await page.click("[data-import-army]");
  await page.fill("#ia-text", text);
  await expect(page.locator("#ia-f")).toHaveValue("world-eaters");
  await expect(page.locator("#ia-lim")).toHaveValue("2000");
  await expect(page.locator("#ia-name")).toHaveValue("World Eaters · Berzerker Warband");
  await expect(page.locator("#ia-go")).toHaveText("Import 17 units");
  await page.fill("#ia-name", "Butchers");
  await page.click("#ia-go");
  await expect(page).toHaveURL(/#\/war\/list\//);
  await expect(page.locator("h1")).toHaveText("Butchers");
  await expect(page.locator(".war-stats")).toContainText("1,995");
  const d = await saved(page), army = d.armies.find(a => a.name === "Butchers"), list = d.lists.find(l => l.armyId === army.id);
  expect(army.faction).toBe("world-eaters"); expect(army.scheme.limit).toBe(2000);
  // The army is what you own, so it starts empty; the list holds the units, not owned yet.
  expect(d.units.filter(u => u.armyId === army.id)).toHaveLength(0);
  expect(list.units).toHaveLength(17);
  expect(list.units.every(e => !e.u && e.n && e.sheet)).toBe(true);
  expect(list).toMatchObject({name: "Butchers", limit: 2000, size: "strike", detachments: ["Berzerker Warband"]});
  await expect(page.locator(".lb-own")).toContainText("You own 0 of 17 units");
  const name = e => e.n;
  expect(list.units.filter(e => e.warlord).map(name)).toEqual(["Daemon Prince of Khorne"]);
  // Coward's Bane is Lord Invocatus's own weapon, not an enhancement.
  expect(list.units.filter(e => e.enh)).toEqual([]);
  expect(list.units.find(e => e.n === "Lord Invocatus").gear).toBe("Bolt pistol, Bladed horn, Coward's Bane");
  expect(list.units.filter(e => e.lead).map(e => [name(e), name(list.units.find(x => x.k === e.lead))])).toEqual([["Khârn the Betrayer", "Khorne Berzerkers"],
    ["Lord Invocatus", "Khorne Berzerkers"], ["Master of Executions", "Khorne Berzerkers"], ["Slaughterbound", "Exalted Eightbound"], ["Slaughterbound", "Eightbound"]]);
  // Nothing owned, so none of it shows in Livery Ledger.
  await open(page, "#/livery/ledgers");
  await expect(page.locator(".lcard h3")).not.toContainText(["Butchers"]);
  // Bought the lot: every unit joins the army, leaders and warlord kept.
  await open(page, `#/war/list/${list.id}`);
  await page.click("[data-own-all]");
  await expect(page.locator(".lb-own")).toHaveText("You own every unit in this list.");
  const d2 = await saved(page), l2 = d2.lists.find(l => l.id === list.id);
  expect(d2.units.filter(u => u.armyId === army.id)).toHaveLength(17);
  expect(l2.units.every(e => e.u)).toBe(true);
  expect(l2.units.filter(e => e.lead)).toHaveLength(5);
  expect(d2.units.find(u => u.id === l2.units.find(e => e.warlord).u).name).toBe("Daemon Prince of Khorne");
  await open(page, "#/livery/ledgers");
  await expect(page.locator(".lcard h3")).toContainText(["Butchers"]);
});

test("build a list New Recruit style: battle size, detachment, datasheets, unit sizes and copies", async ({page}) => {
  await seed(page, `db.lists.push({id: "nb", armyId: "a1", name: "Fresh", limit: 0, detachments: [], units: [], createdAt: "2026-09-01", updatedAt: "2026-09-01"});`);
  await open(page, "#/war/list/nb");
  const list = async () => (await saved(page)).lists.find(l => l.id === "nb");
  // Configuration sits in the roster.
  await page.selectOption("#lb-bs", "incursion");
  await expect(page.locator(".lb-sum")).toContainText("/ 1,000 pts");
  await page.selectOption("#lb-det", "Gladius Task Force");
  await expect.poll(async () => (await list()).detachments).toEqual(["Gladius Task Force"]);
  expect((await list())).toMatchObject({size: "incursion", limit: 1000});
  // Units come straight from the datasheets at their smallest size.
  await page.click('[data-add-tab="sheets"]');
  await page.fill("#lb-dq", "intercessor squ");
  await expect(page.locator("#lb-dlist [data-sheet]").first()).toBeVisible();
  expect(await page.locator("#lb-dlist [data-sheet]").evaluateAll(bs => bs.map(b => b.dataset.sheet).every(n => /intercessor squ/i.test(n)))).toBe(true);
  await page.click('[data-sheet="Intercessor Squad"]');
  await expect(page.locator(".lb-in")).toContainText("Intercessor Squad");
  await expect(page.locator(".lb-sum b")).toHaveText("80");
  // Changing the size uses the datasheet's points for that size.
  await page.selectOption('[data-size="0"]', "10");
  await expect(page.locator(".lb-sum b")).toHaveText("150");
  // Another copy, and the datasheet list says how many are in the list.
  await page.click('[data-dupe="0"]');
  await expect(page.locator(".lb-sum b")).toHaveText("300");
  await page.fill("#lb-dq", "intercessor squ");
  await expect(page.locator('#lb-dlist li:has([data-sheet="Intercessor Squad"])')).toContainText("2 in list");
  // Wargear on a unit that's only in the list is kept, and exported.
  // Clicking a list-only unit's name opens its options; wargear comes from the datasheet's weapons.
  await page.click('.lb-in .lb-title [data-view="1"]');
  await page.selectOption("#w-emc", "5");
  await expect(page.locator("#w-ep")).toHaveValue("80");
  await page.selectOption("#w-egear .gp-add", "Bolt Rifle");
  await page.selectOption("#w-egear .gp-add", "Astartes grenade launcher");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".lb-sum b")).toHaveText("230");
  await expect.poll(async () => (await list()).units.map(e => [e.count, e.points, e.gear])).toEqual([[10, 150, undefined], [5, 80, "Bolt Rifle, Astartes grenade launcher"]]);
  await open(page, "#/war/list/nb");
  await page.click("[data-export]");
  expect((await page.inputValue("#w-exp")).split("\n")).toContain("5x Intercessor Squad (80 pts): Bolt Rifle, Astartes grenade launcher");
  await page.keyboard.press("Escape");
  // Your collection is the other tab.
  await page.click('[data-add-tab="coll"]');
  await expect(page.locator("#lb-q")).toBeVisible();
});

test("wargear is picked from the datasheet: imported units can be changed, and anything else typed in", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Intercessor Squad", datasheet: "Intercessor Squad", role: "Battleline", count: 5, points: 80, painted: 0, stages: [], ranged: "Bolt Rifle, Bolt pistol", melee: "Close combat weapon"});`);
  await open(page, "#/war/army/a1");
  await page.click('.wtable [data-unit="u9"]');
  // What the unit has shows as chips; the dropdown offers the rest of the datasheet's weapons.
  await expect(page.locator("#w-ranged .gp-chips li span")).toHaveText(["Bolt Rifle", "Bolt pistol"]);
  const offered = await page.locator("#w-ranged .gp-add option").allInnerTexts();
  expect(offered).toContain("Astartes grenade launcher"); expect(offered).not.toContain("Bolt Rifle");
  await page.click('#w-ranged [aria-label="Remove Bolt pistol"]');
  await page.selectOption("#w-ranged .gp-add", "Plasma pistol");
  await page.selectOption("#w-melee .gp-add", "Power fist");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => { const u = (await saved(page)).units.find(x => x.id === "u9"); return [u.ranged, u.melee]; })
    .toEqual(["Bolt Rifle, Plasma pistol", "Close combat weapon, Power fist"]);
  // Choosing a datasheet for a new unit starts it with that datasheet's weapons.
  await page.click("[data-add-unit]");
  await page.selectOption("#w-sheet", "Terminator Squad");
  await expect(page.locator("#w-ranged .gp-chips li span")).toHaveText(["Storm bolter", "Cyclone missile launcher", "Heavy Flamer", "Assault Cannon"]);
});

test("units stay in armies they belong to: only real allies are matched, and odd ones are flagged", async ({page}) => {
  await seed(page, `db.lists[0].units.push({n: "Hive Tyrant", sheet: "Hive Tyrant", role: "Character", count: 1, points: 215, k: "z"});`);
  await open(page, "#/war/list/l1");
  // A Tyranid unit in an Ultramarines list is flagged.
  await expect(page.locator(".tc-list")).toContainText("Hive Tyrant isn't an Ultramarines unit.");
  // Pasting: Imperial Knights are allies; Tyranids aren't recognised.
  await page.click("[data-import]");
  await page.fill("#w-list", "Armiger Warglaive (140 points)\nTermagants (60 points)\nCaptain (80 points)");
  await expect(page.locator("#w-found")).toContainText("2 units");
  await expect(page.locator("#w-found")).toContainText("Armiger Warglaive");
  await expect(page.locator("#w-found .hint")).toContainText("Not recognised: Termagants");
  await page.keyboard.press("Escape");
  // The unit editor only offers armies of the same faction family.
  await open(page, "#/war/army/a1");
  await page.click('.wtable [data-unit="u2"]');
  const armies = await page.locator("#w-army option").allInnerTexts();
  expect(armies).toContain("Ultramarines 2nd Company"); expect(armies.join()).not.toContain("Hive Fleet Leviathan");
  await page.keyboard.press("Escape");
  // Adding from the collection: a Tyranid unit can't pick an Ultramarines army.
  await open(page, "#/war/collection");
  await expect(page).toHaveURL(/#\/war\/armoury$/);
  await page.click("[data-coll-add]");
  await page.selectOption("#w-cf", "tyranids");
  expect(await page.locator("#w-ca option").allInnerTexts()).toEqual(["Not in an army", "Hive Fleet Leviathan"]);
});

test("datasheets whose sizes disagree with their points use the points brackets (Jakhals come in 10 or 20)", async ({page}) => {
  await seed(page, `db.armies.push({id: "w1", faction: "world-eaters", name: "Butchers", scheme: window.LEDGER_PRESETS.presetFor("world-eaters"), createdAt: "2026-01-01", updatedAt: "2026-01-01"});
    db.lists.push({id: "wl", armyId: "w1", name: "Test", limit: 2000, detachments: [], units: [], createdAt: "2026-09-01", updatedAt: "2026-09-01"});`);
  await open(page, "#/war/list/wl");
  await page.fill("#lb-dq", "jakhals");
  await page.click('[data-sheet="Jakhals"]');
  await expect(page.locator(".lb-in")).toContainText("Jakhals");
  await expect(page.locator('[data-size="0"] option:checked')).toHaveText("10 models · 65 pts");
  await page.selectOption('[data-size="0"]', "20");
  await expect(page.locator(".lb-sum b")).toHaveText("130");
});

test("the eye shows a unit's datasheet: models, weapons, abilities, rules and keywords; the ⋯ is for characters", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u2").ranged = "Bolt Rifle"; db.units.find(u => u.id === "u2").melee = "Close combat weapon";`);
  await open(page, "#/war/list/l1");
  // Only characters have the ⋯ (warlord, enhancement, leading); every unit has the eye.
  await expect(page.locator(".lb-in .icon-x[data-view]")).toHaveCount(4);
  await expect(page.locator(".lb-in [data-opts]")).toHaveCount(1);
  await page.click('[aria-label="Datasheet, models and points for Intercessor Squad"]');
  const ds = page.locator("#ds-body");
  await expect(ds.locator("table").first()).toContainText("Intercessor");
  await expect(ds.locator("table").first().locator("thead")).toContainText("InSv");
  // The weapons the unit has come first, with their profiles; the rest fold away.
  const ranged = ds.locator("table").nth(1);
  await expect(ranged.locator("tbody th")).toHaveText(["Bolt Rifle"]);
  await expect(ranged.locator("tbody tr").first()).toContainText('24"');
  await expect(ds.locator(".ds-more summary").first()).toContainText("Other ranged weapons on the datasheet");
  await expect(ds).toContainText("Abilities");
  await expect(ds).toContainText("Oath of Moment");
  await expect(ds.locator(".ds-kws")).toContainText("Battleline");
  // Points in this list can still be changed here.
  await page.fill("#w-ep", "140");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => (await saved(page)).lists[0].units[1].pts).toBe(140);
  // A datasheet can be looked at before it's added.
  // (Deathstorm Drop Pod is a Legends datasheet, so Legends are shown first.)
  await page.click('[data-add-tab="sheets"]');
  await page.fill("#lb-dq", "deathstorm");
  await page.check("#lb-dl");
  await page.click('[data-peek="Deathstorm Drop Pod"]');
  await expect(page.locator("#ds-body")).toContainText("Deathstorm cannon array");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".lb-in")).toContainText("Deathstorm Drop Pod");
});

test("the eye on army and collection tables shows a unit's datasheet, and the unit editor has it too", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u2").ranged = "Bolt Rifle";`);
  await open(page, "#/war/army/a1");
  await page.click('[aria-label="Datasheet for Intercessor Squad"]');
  const ds = page.locator("#ds-body");
  await expect(ds.locator("table").nth(1).locator("tbody th")).toHaveText(["Bolt Rifle"]);
  await expect(ds.locator(".ds-kws")).toContainText("Battleline");
  // Edit the unit goes on to the unit editor.
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator("dialog[open] #w-sheet")).toHaveValue("Intercessor Squad");
  // The editor's datasheet folds open and follows the wargear chosen.
  await page.click("#w-ds summary");
  const eds = page.locator("#w-ds-body");
  await expect(eds.locator("table").nth(1).locator("tbody th")).toHaveText(["Bolt Rifle"]);
  const more = (await page.locator("#w-ranged .gp-add option").nth(1).textContent()).trim();
  await page.locator("#w-ranged .gp-add").selectOption({index: 1});
  await expect(eds.locator("table").nth(1).locator("tbody")).toContainText(more);
  await page.click("dialog[open] [data-x]");
  // The collection has the eye too.
  await open(page, "#/war/collection");
  await page.click('[aria-label="Datasheet for Intercessor Squad"]');
  await expect(page.locator("#ds-body .ds-kws")).toContainText("Battleline");
});

test("new army pages show the faction's picture under the army name, where there is one", async ({page}) => {
  await seed(page);
  for(const f of ["aeldari", "drukhari", "genestealer-cults", "leagues-of-votann", "necrons", "orks", "tau-empire", "tyranids", "adepta-sororitas", "adeptus-custodes", "adeptus-mechanicus", "agents-of-the-imperium", "astra-militarum", "black-templars", "chaos-daemons", "chaos-knights", "chaos-space-marines", "death-guard", "emperors-children", "blood-angels", "dark-angels", "deathwatch", "grey-knights", "imperial-fists", "imperial-knights", "iron-hands", "raven-guard", "salamanders", "space-wolves", "thousand-sons", "white-scars", "world-eaters"]){
    await open(page, "#/war/new/" + f);
    const img = page.locator("#wn-form .faction-hero img");
    await expect(img).toHaveAttribute("alt", /.+/);
    await expect.poll(() => img.evaluate(i => i.complete && i.naturalWidth)).toBe(800);
  }
  // A faction with more than one picture shows one of them at random, so every file is checked directly.
  for(const f of ["imperial-knights-2", "chaos-space-marines-2", "chaos-knights-2"])
    expect((await page.request.get(`/img/heroes/${f}.webp`)).ok()).toBe(true);
  await open(page, "#/livery/new/black-templars");
  await expect(page.locator(".setup .faction-hero img")).toBeVisible();
  // Factions without a picture just have the form.
  await open(page, "#/war/new/ultramarines");
  await expect(page.locator(".faction-hero")).toHaveCount(0);
});

test("export and paste back: renamed units, two detachments, and a unit that isn't recognised", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u2").name = "Squad Alpha";
    db.lists[0].detachments = ["Gladius Task Force", "Firestorm Assault Force"];
    db.lists.push({id: "l2", armyId: "a1", name: "Copy", limit: 2000, detachments: [], units: [], createdAt: "2026-09-01", updatedAt: "2026-09-01"});`);
  await open(page, "#/war/list/l1");
  await page.click("[data-export]");
  const out = await page.inputValue("#w-exp");
  // Datasheet names, as New Recruit writes them, even for a unit you've renamed.
  expect(out).toContain("10x Intercessor Squad (150 pts)");
  expect(out).not.toContain("Squad Alpha");
  expect(out).toContain("+ DETACHMENT: Gladius Task Force + Firestorm Assault Force");
  await open(page, "#/war/list/l2");
  await page.click("[data-import]"); await page.fill("#w-list", out); await page.click("#w-add");
  await expect.poll(async () => (await saved(page)).lists.find(l => l.id === "l2").detachments).toEqual(["Gladius Task Force", "Firestorm Assault Force"]);
  // A unit that isn't recognised ends the one before it, so its models aren't counted there.
  await open(page, "#/war/army/a1");
  await page.click("[data-from-list]");
  await page.fill("#w-list", "Intercessor Squad (80 points)\n  • 5x Intercessor\nSome Forge World Unit (100 points)\n  • 5x FW model");
  await expect(page.locator("#w-found li")).toHaveText(["Intercessor Squad 5 · 80 pts"]);
});

test("a new unit takes the wargear of the datasheet you switch to, and Custom unit clears the datasheet", async ({page}) => {
  await seed(page);
  await open(page, "#/war/army/a1");
  await page.click("[data-add-unit]");
  await page.selectOption("#w-sheet", "Intercessor Squad");
  await expect(page.locator("#w-ranged .gp-chips")).toContainText("Bolt Rifle");
  await page.selectOption("#w-sheet", "Hellblaster Squad");
  await expect(page.locator("#w-ranged .gp-chips")).not.toContainText("Bolt Rifle");
  await expect(page.locator("#w-ranged .gp-chips")).toContainText("Plasma Incinerator");
  await page.click("dialog[open] [data-x]");
  // Choosing "Custom unit" for an existing unit saves it without a datasheet.
  await page.click('[data-unit="u3"]');
  await page.selectOption("#w-sheet", "");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "u3").datasheet).toBe("");
});

test("the new army page can import from a list, with the faction and anything typed already filled in", async ({page}) => {
  await seed(page);
  await open(page, "#/war/new/black-templars");
  await page.fill("#w-name", "Crusade of Sigismund");
  await page.fill("#w-lim", "1000");
  await page.click("#wn-import");
  await expect(page.locator("#ia-f")).toHaveValue("black-templars");
  await expect(page.locator("#ia-name")).toHaveValue("Crusade of Sigismund");
  await expect(page.locator("#ia-lim")).toHaveValue("1000");
  await page.fill("#ia-text", "Marshal (80 points)\n  • Warlord\nCrusader Squad (150 points)");
  await expect(page.locator("#ia-go")).toHaveText("Import 2 units");
  // Units you already have go straight into the army.
  await page.check("#ia-own");
  await page.click("#ia-go");
  await expect(page).toHaveURL(/#\/war\/list\//);
  const db = await saved(page), army = db.armies.find(a => a.name === "Crusade of Sigismund");
  expect(army.faction).toBe("black-templars");
  const mine = db.units.filter(u => u.armyId === army.id);
  expect(mine.map(u => u.datasheet).sort()).toEqual(["Crusader Squad", "Marshal"]);
  expect(mine.every(u => u.own === "owned")).toBe(true);
  expect(db.lists.find(l => l.armyId === army.id).units.every(e => e.u)).toBe(true);
});

test("Army lists has Import a list, and the faction picker has a Back button", async ({page}) => {
  await seed(page);
  await open(page, "#/war/lists");
  await page.click("[data-import-army]");
  await expect(page.locator("dialog[open] #ia-text")).toBeVisible();
  await page.click("dialog[open] [data-x]");
  await open(page, "#/war/new");
  await page.click(".war-actions a:has-text('Back')");
  await expect(page).toHaveURL(/#\/war\/lists$/);
});

test("the shopping list gathers units you don't own from every list, and buying one fills it everywhere", async ({page}) => {
  await seed(page, `db.lists.push({id: "l2", armyId: "a1", name: "Big game", limit: 3000, detachments: [], status: "draft", units: [
    {n: "Gladiator Lancer", sheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, k: "x"}, {n: "Gladiator Lancer", sheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, k: "y"},
    {n: "Hellblaster Squad", sheet: "Hellblaster Squad", role: "Infantry", count: 5, points: 115, k: "z"}], createdAt: "2026-09-02", updatedAt: "2026-09-02"});`);
  // To buy is a tab, with how many units your lists want.
  await open(page, "#/war/lists");
  await expect(page.locator('.war-tabs a[href="#/war/buy"]')).toHaveText("To buy 3");
  await page.click('.war-tabs a[href="#/war/buy"]');
  await expect(page.locator('.war-tabs a[aria-current="page"]')).toHaveText("To buy 3");
  // Most wanted first: the Lancer is in both lists, and Big game wants two.
  const rows = page.locator(".buy-rows li");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("2× Gladiator Lancer");
  await expect(rows.nth(0).locator(".buy-lists")).toHaveText("In Club night, Big game");
  await expect(page.locator(".page-head .sub")).toContainText("3 units you don't own yet");
  // One bought: it fills one spot in each list, and the second Lancer is still wanted.
  await rows.nth(0).locator("[data-buy]").click();
  await expect(page.locator(".toast")).toContainText("Gladiator Lancer added to Ultramarines 2nd Company");
  const d = await saved(page), lancer = d.units.find(u => u.name === "Gladiator Lancer");
  expect(d.lists.find(l => l.id === "l1").units.find(e => e.k === "d").u).toBe(lancer.id);
  const l2 = d.lists.find(l => l.id === "l2").units;
  expect([l2[0].u, l2[1].u]).toEqual([lancer.id, undefined]);
  await expect(page.locator(".buy-rows li").first()).toContainText("Gladiator Lancer");
  await expect(page.locator(".buy-rows li").first().locator(".buy-lists")).toHaveText("In Big game");
});

test("a list prints on one clean page, with its datasheets if you like", async ({page}) => {
  await seed(page, `db.lists[0].units[0].warlord = true; db.lists[0].units[0].enh = {n: "Artificer Armour", p: 10};
    db.units.find(u => u.id === "u2").ranged = "Bolt Rifle";`);
  await open(page, "#/war/list/l1");
  await page.click("#wl-more"); await page.click('a:has-text("Print list")');
  await expect(page).toHaveURL(/#\/war\/list\/l1\/print$/);
  const pl = page.locator(".pl");
  await expect(pl.locator("h1")).toHaveText("Club night");
  await expect(pl.locator(".pl-total")).toContainText("595 / 2,000 pts · 4 units · 13 models");
  await expect(pl.locator('tr:has-text("Captain")')).toContainText("Warlord");
  await expect(pl.locator('tr:has-text("Captain")')).toContainText("Enhancement: Artificer Armour (+10)");
  await expect(pl.locator('tr:has-text("Intercessor Squad")')).toContainText("Bolt Rifle");
  await expect(pl.locator(".pl-sheet")).toHaveCount(0);
  await page.check("#pl-sheets");
  await expect(pl.locator(".pl-sheet")).toHaveCount(4);
  await expect(pl.locator('.pl-sheet:has(h2:text-is("Intercessor Squad")) table').nth(1).locator("tbody th")).toHaveText(["Bolt Rifle"]);
  // Remembered next time.
  await page.reload();
  await expect(page.locator("#pl-sheets")).toBeChecked();
});

test("the points check shows every list the latest points change, flags ones over the limit, and updates them", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u4").points = 180; db.lists[0].units[3].points = 150;
    db.lists.push({id: "l2", armyId: "a1", name: "Tight", limit: 500, detachments: [], status: "draft", units: [{u: "u4", k: "a"}, {n: "Gladiator Lancer", sheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 150, k: "b"}, {u: "u1", k: "c"}], createdAt: "2026-09-02", updatedAt: "2026-09-02"});`);
  await open(page, "#/war/lists");
  await page.click('a:has-text("Points check")');
  await expect(page).toHaveURL(/#\/war\/points$/);
  const card = name => page.locator(".pc", {has: page.locator(".pc-h", {hasText: name})});
  await expect(card("Club night").locator(".pc-nums")).toHaveText("560 → 585 pts");
  await expect(card("Club night").locator(".pc-items")).toContainText("Redemptor Dreadnought 180 → 195");
  // 410 now, 435 with the latest points: under 500, so no warning; lower the limit and it warns.
  await expect(card("Tight").locator(".pc-warn")).toHaveCount(0);
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("livery-ledger-v3")); d.lists.find(l => l.id === "l2").limit = 420; localStorage.setItem("livery-ledger-v3", JSON.stringify(d)); });
  await page.reload();
  await expect(card("Tight").locator(".pc-warn")).toHaveText("With the latest points it's 15 pts over its limit.");
  await page.click("[data-latest-all]");
  await expect(page.locator(".toast")).toContainText("Updated 2 lists to the latest points.");
  // Tight is still over its limit after the update, so it stays; Club night is done.
  await expect(card("Club night")).toHaveCount(0);
  await expect(card("Tight").locator(".pc-warn")).toHaveText("It's 15 pts over its limit.");
  const d = await saved(page);
  expect(d.units.find(u => u.id === "u4").points).toBe(195);
  expect(d.lists.find(l => l.id === "l2").units[1].points).toBe(160);
});

test("opponent notes: written on Battles, shown when you log a battle against that faction", async ({page}) => {
  await seed(page);
  await open(page, "#/war/battles");
  const panel = page.locator(".opp-notes");
  await expect(panel.locator(".on-list strong")).toHaveText(["Necrons", "Orks", "T'au Empire"]);
  await expect(panel.locator('li:has-text("Necrons") small')).toHaveText("1–0 against them");
  await page.click('[aria-label="Edit your notes on Necrons"]');
  await page.fill("#on-text", "Reanimation: finish units off.");
  await page.click("dialog[open] [type=submit]");
  await expect(panel.locator('li:has-text("Necrons") p')).toHaveText("Reanimation: finish units off.");
  // A faction you haven't faced yet.
  await page.selectOption("#on-add", "drukhari");
  await page.fill("#on-text", "Fast raiders: screen the objectives.");
  await page.click("dialog[open] [type=submit]");
  await expect(panel.locator(".on-list strong")).toHaveText(["Necrons", "Orks", "T'au Empire", "Drukhari"]);
  await expect(panel.locator('li:has-text("Drukhari") p')).toHaveText("Fast raiders: screen the objectives.");
  // Remembered with your settings.
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("ll-settings"))).oppNotes.necrons).toBe("Reanimation: finish units off.");
  await page.click("[data-log]");
  await expect(page.locator("#w-gon")).toBeHidden();
  await page.selectOption("#w-go", "necrons");
  await expect(page.locator("#w-gon")).toContainText("Your notes on Necrons");
  await expect(page.locator("#w-gon")).toContainText("Reanimation: finish units off.");
});

test("a character leading a unit its datasheet doesn't list is flagged, and the units it can lead come first", async ({page}) => {
  await seed(page, `db.lists[0].units[0].lead = "c";`);
  await open(page, "#/war/list/l1");
  // The Captain is leading the Redemptor Dreadnought.
  const note = page.locator(".tc-list > li", {hasText: "can't usually lead"});
  await expect(note).toContainText("Captain can't usually lead Redemptor Dreadnought.");
  await expect(note).toContainText("Intercessor Squad");
  await page.click('[aria-label="Warlord, enhancement and leading for Captain"]');
  expect(await page.locator("#w-eld optgroup").evaluateAll(gs => gs.map(g => [g.label, [...g.children].map(o => o.textContent)]))).toEqual([
    ["Can lead", ["Intercessor Squad"]], ["Other units", ["Redemptor Dreadnought", "Gladiator Lancer"]]]);
  await page.selectOption("#w-eld", {label: "Intercessor Squad"});
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".tc-list > li", {hasText: "can't usually lead"})).toHaveCount(0);
});

test("game day: round, CP and VP at the table, kept through a reload, then logged with the score filled in", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click('a:has-text("Game day")');
  await expect(page).toHaveURL(/#\/war\/list\/l1\/play$/);
  await page.selectOption("#gd-opp", "necrons");
  await page.fill("#gd-mission", "Take and Hold");
  await page.click('[aria-label="Round: one more"]');
  await expect(page.locator("#gd-round")).toHaveText("2");
  await page.click('[aria-label="Your CP: one more"]'); await page.click('[aria-label="Your CP: one more"]');
  await expect(page.locator("#gd-cp0")).toHaveText("2");
  await page.fill('[aria-label="Your points in round 1"]', "10");
  await page.fill('[aria-label="Their points in round 1"]', "5");
  await page.fill('[aria-label="Your points in round 2"]', "15");
  await expect(page.locator("#gd-t0")).toHaveText("25");
  await page.check('[data-dead="c"]');
  await expect(page.locator("#gd-left")).toHaveText("3 of 4 left");
  // Ticking it doesn't open the unit.
  expect(await page.locator('.gd-u[data-k="c"]').evaluate(d => d.open)).toBe(false);
  // A unit's datasheet opens from the list.
  await page.click('.gd-u[data-k="b"] summary');
  await expect(page.locator('.gd-u[data-k="b"] .gd-ds table').first()).toContainText("Intercessor");
  // A reload keeps the game.
  await page.reload();
  await expect(page.locator("#gd-round")).toHaveText("2");
  await expect(page.locator("#gd-t0")).toHaveText("25");
  await expect(page.locator('[data-dead="c"]')).toBeChecked();
  // Log it: army, list, opponent, mission, score and result are filled in.
  await page.click("[data-gd-log]");
  await expect(page.locator("#w-gl")).toHaveValue("l1");
  await expect(page.locator("#w-go")).toHaveValue("necrons");
  await expect(page.locator("#w-gm")).toHaveValue("Take and Hold");
  await expect(page.locator("#w-gu")).toHaveValue("25");
  await expect(page.locator("#w-gt")).toHaveValue("5");
  await expect(page.locator("[name=w-gr][value=w]")).toBeChecked();
  await page.click("dialog[open] [type=submit]");
  await expect(page).toHaveURL(/#\/war\/battles$/);
  const d = await saved(page);
  expect(d.games.find(g => g.us === 25)).toMatchObject({listId: "l1", opp: "necrons", them: 5, result: "w"});
  expect(await page.evaluate(() => localStorage.getItem("ll-play-l1"))).toBeNull();
});

test("datasheets: browse a faction, open one and add it to a list as a unit you don't own", async ({page}) => {
  await seed(page);
  await open(page, "#/war/datasheets");
  // Nothing chosen to start with: the page says what it's for, and the other filters wait.
  await expect(page.locator("#dsp-f")).toHaveValue("");
  await expect(page.locator(".war-empty")).toContainText("Choose a faction above");
  await expect(page.locator(".war-empty button, .war-empty a")).toHaveCount(0);
  await expect(page.locator("#dsp-q")).toBeDisabled();
  await page.selectOption("#dsp-f", "ultramarines");
  await expect(page.locator("#dsp-q")).toBeEnabled();
  await page.fill("#dsp-q", "gladiator");
  await expect(page.locator(".dsp-open")).toHaveCount(3);
  await page.selectOption("#dsp-s", "high");
  const names = await page.locator(".dsp-open .lb-name").evaluateAll(els => els.map(e => e.firstChild.textContent.trim()));
  expect(names[0]).toBe("Gladiator Lancer");
  await page.click('[data-dsp="Gladiator Reaper"]');
  await expect(page.locator("#ds-body table").first()).toContainText("Gladiator Reaper");
  await page.selectOption("#dsp-list", "l1");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".toast")).toContainText("Added Gladiator Reaper to Club night");
  const l = (await saved(page)).lists.find(x => x.id === "l1");
  expect(l.units[l.units.length - 1]).toMatchObject({n: "Gladiator Reaper", sheet: "Gladiator Reaper", count: 1});
  // Another faction: its address can be shared, but opening Datasheets afresh starts with nothing chosen again.
  await page.selectOption("#dsp-f", "necrons");
  await expect(page).toHaveURL(/#\/war\/datasheets\/necrons$/);
  await open(page, "#/war/datasheets/necrons");
  await expect(page.locator("#dsp-f")).toHaveValue("necrons");
  await open(page, "#/war/datasheets");
  await expect(page.locator("#dsp-f")).toHaveValue("");
});

// Events come from js/data/events.js; these tests serve their own.
const withEvents = (page, evs) => page.route("**/js/data/events.js", r => r.fulfill({contentType: "text/javascript", body: `window.LEDGER_EVENTS = ${JSON.stringify(evs)};`}));
const dayFrom = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test("events: sign up with a list, see its points checked, play it on the day and see the result after", async ({page}) => {
  const today = dayFrom(0);
  await withEvents(page, [{id: "club-night", name: "Club night", date: today, kind: "national", place: "The Games Room", link: "https://example.com/gt"},
    {id: "later", name: "Winter GT", date: dayFrom(9), kind: "club"}, {id: "bad-link", name: "Old one", date: dayFrom(-20), link: "javascript:alert(1)"}, {name: "No id", date: today}]);
  await seed(page, `db.units.find(u => u.id === "u4").points = 180;`);
  await open(page, "#/war/events");
  // Players can't add or change events.
  await expect(page.locator(".ev")).toHaveCount(3);
  await expect(page.locator("[data-ev-new], [data-ev-edit]")).toHaveCount(0);
  await expect(page.locator('.ev:has-text("Old one") .ev-link')).toHaveCount(0);
  const ev = page.locator(".ev").first();
  await expect(ev.locator(".ev-h")).toHaveText("Club night");
  await expect(ev).toContainText("Today · The Games Room");
  await expect(ev.locator(".ev-kind")).toHaveText("National");
  await expect(ev.locator(".ev-link a")).toHaveAttribute("href", "https://example.com/gt");
  await expect(ev.locator("[data-ev-log]")).toHaveCount(0);
  // Say you're going, with a list.
  await ev.locator("[data-ev-join]").click();
  await page.selectOption("#ej-list", "l1");
  await page.fill("#ej-notes", "Table 4");
  await page.click("dialog[open] [type=submit]");
  await expect(ev.locator(".ev-list")).toContainText("You're going, taking Club night");
  await expect(ev.locator(".ev-warn")).toContainText("The latest points change this list");
  await expect(ev.locator('a:has-text("Game day")')).toHaveAttribute("href", "#/war/list/l1/play");
  // Log a battle from it: the date and list are filled in, and the result shows.
  await ev.locator("[data-ev-log]").click();
  await expect(page.locator("#w-gl")).toHaveValue("l1");
  await expect(page.locator("#w-gd")).toHaveValue(today);
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".ev .ev-res")).toContainText("Result: 1–0 over 1 game");
  // Only the events you're going to, or of one kind.
  await page.selectOption("#ev-show", "mine");
  await expect(page.locator(".ev")).toHaveCount(1);
  await page.selectOption("#ev-show", "club");
  await expect(page.locator(".ev .ev-h")).toHaveText(["Winter GT", "Old one"]);
  // It's on Battles too, as today's event, and your sign-up is kept with your settings.
  await open(page, "#/war/battles");
  await expect(page.locator('section:has(#pp-today) .pp-rows li')).toContainText("Club night");
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("ll-settings"))).eventLog).toEqual({"club-night": {listId: "l1", notes: "Table 4"}});
  // Not going after all.
  await open(page, "#/war/events");
  await page.locator('.ev:has-text("Club night") [data-ev-join]').click();
  await page.click("#ej-off");
  await expect(page.locator('.ev:has-text("Club night") [data-ev-join]')).toHaveText("I'm going");
  await expect(page.locator('.ev:has-text("Old one") [data-ev-join]')).toHaveText("I went");
});

test("events online: your sign-up is saved to your account", async ({page}) => {
  await withEvents(page, [{id: "winter-gt", name: "Winter GT", date: dayFrom(9), kind: "national", place: "Cape Town"}]);
  await mockSupabase(page, {db: {armies: [{id: "a1", owner: "u1", faction: "ultramarines", name: "Ultras", scheme: {}, created_at: "2026-01-01"}],
    lists: [{id: "l1", owner: "u1", army_id: "a1", data: {name: "Strike force", units: []}}]}});
  await page.goto("/#/war/events");
  await page.locator('.ev:has-text("Winter GT") [data-ev-join]').click();
  await page.selectOption("#ej-list", "l1");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".ev .ev-list")).toContainText("You're going, taking Strike force");
  expect(await page.evaluate(() => window.__db.user_settings[0].data.eventLog)).toEqual({"winter-gt": {listId: "l1", notes: ""}});
});

test("events: with none added yet, say they'll show here", async ({page}) => {
  await withEvents(page, []);
  await seed(page);
  await open(page, "#/war/events");
  await expect(page.locator(".war-empty")).toContainText("Club and national events show here once they've been added.");
});

test("online, moving between War Ledger pages reads your data once, and a change is seen straight away", async ({page}) => {
  await mockSupabase(page, {db: {armies: [{id: "a1", owner: "u1", faction: "ultramarines", name: "Ultras", scheme: {}, created_at: "2026-01-01"}],
    units: [{id: "u1", owner: "u1", army_id: "a1", data: {name: "Captain", datasheet: "Captain", role: "Character", count: 1, points: 80}, created_at: "2026-01-01"}]}});
  await page.goto("/#/war/armoury");
  await expect(page).toHaveTitle(/Armoury/);
  await page.locator("[data-wstar=u1]").waitFor();
  const reads = () => page.evaluate(() => ({...window.__reads}));
  const go = async h => { await page.evaluate(h => { location.hash = h; }, h); await page.waitForFunction(h => location.hash === h && !document.getElementById("app").hasAttribute("aria-busy"), h); };
  const first = await reads();
  for(const h of ["#/war/lists", "#/war/battles", "#/war/buy", "#/war", "#/war/armoury"]) await go(h);
  await expect(page).toHaveTitle(/Armoury/);
  expect(await reads()).toEqual(first);
  // Starring a unit saves it, which clears what was kept: the next page reads again and shows the star.
  await page.click("[data-wstar=u1]");
  await expect(page.locator("[data-wstar=u1]")).toHaveAttribute("aria-pressed", "true");
  await go("#/war/lists"); await go("#/war/armoury");
  await expect(page.locator("[data-wstar=u1]")).toHaveAttribute("aria-pressed", "true");
  expect((await reads()).units).toBeGreaterThan(first.units);
});

test("play is on Battles: pick a list, and carry on a game in progress", async ({page}) => {
  await seed(page);
  await page.evaluate(() => localStorage.setItem("ll-play-l1", JSON.stringify({round: 3, cp: [1, 1], vp: [[10, 5], [5, 5], [null, null], [null, null], [null, null]], dead: []})));
  await open(page, "#/war/play");
  await expect(page).toHaveURL(/#\/war\/battles$/);
  await expect(page.locator('.war-tabs a[href="#/war/play"]')).toHaveCount(0);
  await expect(page.locator("#pp-go-btn")).toHaveAttribute("href", "#/war/list/l1/play");
  const going = page.locator("section:has(#pp-go) li");
  await expect(going).toContainText("Round 3 · 15–10");
  await going.getByRole("link", {name: "Carry on"}).click();
  await expect(page).toHaveURL(/#\/war\/list\/l1\/play$/);
  await expect(page.locator("#gd-round")).toHaveText("3");
});

test("a list's More menu has Print, Duplicate, Compare and Delete, and closes on Escape", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await expect(page.locator(".danger-zone")).toHaveCount(0);
  await page.click("#wl-more");
  await expect(page.locator("#wl-menu a, #wl-menu button")).toHaveText(["Print list", "Duplicate list", "Compare with another list", "Delete list"]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#wl-menu")).toBeHidden();
  await expect(page.locator("#wl-more")).toBeFocused();
  // Delete asks twice; the menu stays open between presses.
  await page.click("#wl-more");
  await page.click("#w-dellist");
  await expect(page.locator("#w-dellist")).toHaveText("Press again to delete");
  await page.click("#w-dellist");
  await expect(page).toHaveURL(/#\/war\/lists$/);
  expect((await saved(page)).lists.some(l => l.id === "l1")).toBe(false);
});

test("War Ledger's overview has your profile, getting started and force composition; its Armoury button opens every unit", async ({page}) => {
  await seed(page);
  await open(page, "#/war");
  await expect(page.locator('.war-tabs a[aria-current="page"]')).toHaveText("Overview");
  await expect(page.locator(".war-comp")).toBeVisible();
  await expect(page.locator(".ar-fac")).toHaveCount(0);
  await expect(page.locator(".ph-actions [data-coll-add]")).toHaveCount(0);
  await expect(page.locator(".profile-head .stats")).toContainText("2Armies");
  await expect(page.locator(".profile-head .stats")).toContainText("1Lists");
  await expect(page.locator(".profile-head .stats")).toContainText("1–1–1Record");
  // A true overview: armies, latest lists, recent battles and events.
  await expect(page.locator("#wo-armies ~ .ledgers .war-card, section:has(#wo-armies) .war-card")).toHaveCount(2);
  await expect(page.locator("section:has(#wo-lists) .war-card h3")).toHaveText(["Club night"]);
  await expect(page.locator("section:has(#wo-games) .games li")).toHaveCount(3);
  await expect(page.locator("section:has(#wo-games) .games li").first()).toContainText("vs Sam");
  await expect(page.locator("section:has(#wo-ev)")).toBeVisible();
  const btn = page.locator('.ph-actions a[href="#/war/armoury"]');
  await expect(btn).toHaveText("Armoury6");
  await btn.click();
  await expect(page).toHaveURL(/#\/war\/armoury$/);
  await expect(page.locator("h1")).toHaveText("Armoury");
  await expect(page.locator(".ar-fac")).toHaveCount(2);
  await expect(page.locator(".war-actions [data-coll-add]")).toBeVisible();
});

test("Add another on a unit you own adds one you don't own yet, so the owned unit isn't counted twice", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  const i = await page.evaluate(() => JSON.parse(localStorage.getItem("livery-ledger-v3")).lists[0].units.findIndex(e => e.u === "u2"));
  await page.click(`[data-dupe="${i}"]`);
  await expect.poll(async () => (await saved(page)).lists[0].units.length).toBe(5);
  const copy = (await saved(page)).lists[0].units[i + 1];
  expect(copy.u).toBeUndefined();
  expect(copy).toMatchObject({n: "Intercessor Squad", count: 10, points: 150});
});

test("game day: CP buttons keep an open datasheet open, and a new game stops showing as in progress", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1/play");
  const unit = page.locator("details.gd-u").first();
  await unit.locator("summary").click();
  await expect(unit).toHaveAttribute("open", "");
  await page.click('[data-step="gd-cp0"][data-d="1"]');
  await expect(page.locator("#gd-cp0")).toHaveText("1");
  await expect(unit).toHaveAttribute("open", "");
  await open(page, "#/war/battles");
  await expect(page.locator("#pp-go")).toHaveCount(1);
  await open(page, "#/war/list/l1/play");
  await page.click("[data-gd-new]"); await page.click("[data-gd-new]");
  await open(page, "#/war/battles");
  await expect(page.locator("#pp-go")).toHaveCount(0);
});
