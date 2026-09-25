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
  await expect(page.locator(".wc-loose")).toHaveCount(1);
  await open(page, "#/war/list/l1");
  await expect(page.locator('.lb-coll li:has-text("Lieutenant")')).toContainText("Not in an army");
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
