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
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], own: "planned"});`);
  await open(page, "#/war/collection");
  // The totals sit under the title, as on the roster.
  await expect(page.locator(".page-head .sub")).toHaveText("6 units · 38 models · 910 pts · 21% battle ready · 1 planned".replace(/ pts/, "\u00a0pts"));
  const heads = () => page.locator(".wc-group h3").allInnerTexts();
  expect(await heads()).toEqual(["Ultramarines 2nd Company", "Hive Fleet Leviathan"]);
  const rows = () => page.locator(".wc-group tbody tr").count();
  expect(await rows()).toBe(7);
  // Quick filters
  await page.click('[data-cf="ready"]');
  expect(await page.locator(".wc-group tbody [data-unit]").allInnerTexts()).toEqual(["Captain", "Hive Tyrant"]);
  await expect(page.locator(".page-head .sub")).toContainText("showing 2");
  await page.click('[data-cf="planned"]');
  expect(await page.locator(".wc-group tbody [data-unit]").allInnerTexts()).toEqual(["Gladiator Lancer"]);
  await page.click('[data-cf="all"]');
  // Group by role, then readiness; the choice is remembered.
  await page.selectOption("#wc-g", "role");
  expect(await heads()).toEqual(["Character", "Battleline", "Infantry", "Vehicle"]);
  await page.selectOption("#wc-g", "ready");
  expect(await heads()).toEqual(["Not battle ready", "Partly battle ready", "Battle ready", "Planned"]);
  await open(page, "#/war");
  await open(page, "#/war/collection");
  await expect(page.locator("#wc-g")).toHaveValue("ready");
  // Search finds units by army name too.
  await page.selectOption("#wc-g", "army");
  await page.fill("#wc-q", "hive fleet");
  expect(await heads()).toEqual(["Hive Fleet Leviathan"]);
});

test("plan a unit from a list, then mark it bought", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click('[data-own][data-planned="1"]');
  await expect(page.locator(".lr")).toContainText("Planned, not bought yet");
  expect((await saved(page)).units.find(u => u.name === "Gladiator Lancer").own).toBe("planned");
  await page.click(".lr [data-bought]");
  await expect(page.locator(".lr")).not.toContainText("Planned, not bought yet");
  expect((await saved(page)).units.find(u => u.name === "Gladiator Lancer").own).toBe("owned");
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
  for(const c of ["5 units of Rhino.", "Adept of the Codex is on 2 units.", "Adept of the Codex is usually for Captain only.", "Intercessor Squad has 12 models.", "5 units of Rhino are 75 pts each here but 65 pts in the latest datasheet points."]) expect(all).toContain(c);
  await page.click('[data-hide-check="warlord"]');
  expect(await checks(page)).not.toContain("No warlord chosen.");
  await expect(page.locator(".tc-hid")).toContainText("1 check hidden");
  expect((await saved(page)).lists[0].ignored).toEqual(["warlord"]);
  await open(page, "#/settings");
  await page.click("label.switch:has(#set-checks)");
  await open(page, "#/war/list/l1");
  await expect(page.locator(".tc")).toHaveCount(0);
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
  await page.click("button[data-log]");
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
