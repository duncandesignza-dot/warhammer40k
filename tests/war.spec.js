// War Ledger: armies, the collection, army lists (details, options, things to check) and battles.
const {test, expect, seed, saved, open} = require("./helpers");

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

test("a unit can live in the collection without an army, and lists can use it", async ({page}) => {
  await seed(page);
  await open(page, "#/war/collection");
  await page.click("[data-coll-add]");
  await page.selectOption("#w-cf", "ultramarines");
  await page.selectOption("#w-ca", "");
  await page.click("dialog[open] [type=submit]");
  await page.selectOption("#w-sheet", {label: await page.$eval("#w-sheet", s => [...s.options].find(o => o.textContent.startsWith("Lieutenant")).textContent)});
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator('.wc-group:has(h3:text-is("Not in an army"))')).toContainText("Lieutenant");
  await open(page, "#/war/list/l1");
  await expect(page.locator('.lb-coll li:has-text("Lieutenant")')).toContainText("Not in an army");
});

test("the collection works like the roster: a summary, quick filters and grouping", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], own: "planned", fav: true});`);
  await open(page, "#/war/collection");
  // The totals sit under the title, as on the roster. Every unit counts, owned or not, and nothing about painting shows.
  await expect(page.locator(".page-head .sub")).toHaveText("7 units · 39 models · 1,070 pts".replace(/ pts/, "\u00a0pts"));
  await expect(page.locator(".wc-group thead").first()).toHaveText(/Unit\s*Role\s*Models\s*Points/);
  await expect(page.locator("main")).not.toContainText(/battle ready|Planned|Painted/i);
  const heads = () => page.locator(".wc-group h3").allInnerTexts();
  expect(await heads()).toEqual(["Ultramarines 2nd Company", "Hive Fleet Leviathan"]);
  const rows = () => page.locator(".wc-group tbody tr").count();
  expect(await rows()).toBe(7);
  // Quick filters: all or starred.
  expect(await page.locator("[data-cf]").allInnerTexts()).toEqual(["All", "Starred"]);
  await page.click('[data-cf="fav"]');
  expect(await page.locator(".wc-group tbody [data-unit]").allInnerTexts()).toEqual(["Gladiator Lancer"]);
  await expect(page.locator(".page-head .sub")).toContainText("showing 1");
  await page.click('[data-cf="all"]');
  // Group by army or role; the choice is remembered.
  expect(await page.locator("#wc-g option").allInnerTexts()).toEqual(["Army", "Role"]);
  await page.selectOption("#wc-g", "role");
  expect(await heads()).toEqual(["Character", "Battleline", "Infantry", "Vehicle"]);
  await open(page, "#/war");
  await open(page, "#/war/collection");
  await expect(page.locator("#wc-g")).toHaveValue("role");
  // Search finds units by army name too.
  await page.selectOption("#wc-g", "army");
  await page.fill("#wc-q", "hive fleet");
  expect(await heads()).toEqual(["Hive Fleet Leviathan"]);
});

test("lists and armies work with units you don't own: no readiness or ownership anywhere", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], own: "planned"});`);
  // A list entry pasted from a datasheet sits in the list like any other unit.
  await open(page, "#/war/list/l1");
  await expect(page.locator(".lr, [data-own], [data-bought]")).toHaveCount(0);
  await expect(page.locator('.lb-in li:has-text("Gladiator Lancer")')).toContainText("1 model");
  await expect(page.locator(".war-stats")).not.toContainText(/battle ready|available/i);
  // The army counts a planned unit like any other, with no readiness columns, filters, groups or batch actions.
  await open(page, "#/war/army/a1");
  await expect(page.locator(".war-stats")).toContainText("5 units");
  await expect(page.locator(".wc-group thead").first()).toHaveText(/Unit\s*Role\s*Models\s*Points/);
  await expect(page.locator('[data-filter="notready"]')).toHaveCount(0);
  expect(await page.locator("#wa-g option").allInnerTexts()).toEqual(["Nothing", "Role"]);
  expect(await page.locator("#wa-s option").allInnerTexts()).toEqual(["Name", "Points (most first)", "Models (most first)"]);
  await page.click("[data-select]");
  await expect(page.locator('[data-bb="ready"], [data-bb="bought"]')).toHaveCount(0);
  await page.click('[data-bb="done"]');
  // The unit editor asks only about the unit itself.
  await page.click('.wtable [data-unit="u9"]');
  await expect(page.locator("dialog[open] legend")).toHaveText(["Wargear"]);
  await expect(page.locator("#w-own, #w-built, #w-painted, #w-ready, #w-bought")).toHaveCount(0);
  await page.keyboard.press("Escape");
  // And the overview and settings don't mention it.
  await open(page, "#/war");
  await expect(page.locator("main")).not.toContainText(/battle ready|Collection status/i);
  // Instead it shows where the points go: every unit counts, owned or not (the planned Gladiator Lancer is a vehicle).
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
  await page.click('[aria-label="Options for Captain in this list"]');
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
  await page.locator(".wrec").getByRole("button", {name: "Captain"}).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
});

test("duplicate a list as a new version and compare the two", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click("[data-dup]");
  await expect(page.locator("h1")).toHaveText("Club night v2");
  await page.click('[data-rm="0"]');                  // take the Captain out of the new version
  await page.click('[data-opts="2"]'); await page.fill("#w-ep", "200"); await page.click("dialog[open] [type=submit]");
  await page.click("[data-compare]");
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
  await page.click('[data-kind="crusade"]');
  await page.fill("#w-ln", "Indomitus Crusade"); await page.fill("#w-ll", "1000");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator("h1")).toHaveText("Indomitus Crusade");
  await expect(page.locator(".lst-meta .tag.cr")).toHaveText("Crusade");
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
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], own: "planned"});
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
