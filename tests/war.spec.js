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
  await page.click('[data-add-tab="coll"]');
  await expect(page.locator('.lb-coll li:has-text("Lieutenant")')).toContainText("Not in an army");
});

test("the collection works like the roster: a summary, quick filters and grouping", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], own: "planned", fav: true});`);
  await open(page, "#/war/collection");
  // The totals sit under the title, as on the roster. Every unit counts, owned or not, and nothing about painting shows.
  await expect(page.locator(".page-head .sub")).toHaveText("7 units · 39 models · 1,070 pts".replace(/ pts/, "\u00a0pts"));
  await expect(page.locator(".wc-group thead").first()).toHaveText(/Unit\s*Role\s*Models\s*Points/);
  await expect(page.locator("main")).not.toContainText(/battle ready|Painted/i);
  // A unit you don't own is marked Planned: it's in War Ledger for planning, not in Livery Ledger.
  await expect(page.locator('.wc-group tr:has([data-unit="u9"]) .tag.plan')).toHaveText("Planned");
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
  await page.locator(".wrec").getByRole("button", {name: "Captain"}).click();
  await expect(page.locator("dialog[open]")).toBeVisible();
});

test("duplicate a list as a new version and compare the two", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click("[data-dup]");
  await expect(page.locator("h1")).toHaveText("Club night v2");
  await page.click('[data-rm="0"]');                  // take the Captain out of the new version
  await page.click('[data-view="2"]'); await page.fill("#w-ep", "200"); await page.click("dialog[open] [type=submit]");
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

test("import an army: the faction is found, and the army, its planned units and a list to test are made", async ({page}) => {
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
  const units = d.units.filter(u => u.armyId === army.id);
  expect(units).toHaveLength(17);
  expect(units.every(u => u.own === "planned")).toBe(true);
  expect(list).toMatchObject({name: "Butchers", limit: 2000, size: "strike", detachments: ["Berzerker Warband"]});
  const name = e => units.find(u => u.id === e.u).name;
  expect(list.units.filter(e => e.warlord).map(name)).toEqual(["Daemon Prince of Khorne"]);
  // Coward's Bane is Lord Invocatus's own weapon, not an enhancement.
  expect(list.units.filter(e => e.enh)).toEqual([]);
  expect(units.find(u => u.name === "Lord Invocatus").melee).toBe("Bladed horn, Coward's Bane");
  expect(list.units.filter(e => e.lead).map(e => [name(e), name(list.units.find(x => x.k === e.lead))])).toEqual([["Khârn the Betrayer", "Khorne Berzerkers"],
    ["Lord Invocatus", "Khorne Berzerkers"], ["Master of Executions", "Khorne Berzerkers"], ["Slaughterbound", "Exalted Eightbound"], ["Slaughterbound", "Eightbound"]]);
  // Planned units, so none of it shows in Livery Ledger.
  await open(page, "#/livery/ledgers");
  await expect(page.locator(".lcard h3")).not.toContainText(["Butchers"]);
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
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Intercessor Squad", datasheet: "Intercessor Squad", role: "Battleline", count: 5, points: 80, painted: 0, stages: [], own: "planned", ranged: "Bolt Rifle, Bolt pistol", melee: "Close combat weapon"});`);
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
  await page.fill("#lb-dq", "deathstorm");
  await page.check("#lb-dl");
  await page.click('[data-peek="Deathstorm Drop Pod"]');
  await expect(page.locator("#ds-body")).toContainText("Deathstorm cannon array");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator(".lb-in")).toContainText("Deathstorm Drop Pod");
});
