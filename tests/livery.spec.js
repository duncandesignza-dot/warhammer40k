// Livery Ledger: making a ledger, adding units, planned units and the colours prompt.
const {test, expect, seed, saved, open} = require("./helpers");

test("make a ledger and add a unit to it", async ({page}) => {
  await page.goto("/#/livery/new");
  await page.click('.fcard[href="#/livery/new/ultramarines"]');
  await page.fill("#s-name", "Test Company");
  await page.click("#s-save");
  await expect(page).toHaveURL(/#\/army\/[\w-]+$/);
  await expect(page.locator("h1")).toHaveText("Test Company");
  await page.click("#b-add");
  await page.selectOption("#f-sheet", "Intercessor Squad");
  await expect(page.locator("#f-count")).toHaveValue("5");
  await page.click("#b-save");
  await expect(page.locator('.card-open:text-is("Intercessor Squad")')).toBeVisible();
  const d = await saved(page);
  expect(d.armies.map(a => a.name)).toEqual(["Test Company"]);
  expect(d.units.map(u => [u.name, u.count])).toEqual([["Intercessor Squad", 5]]);
});

test("a planned unit shows as planned and doesn't count until bought", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], own: "planned"});`);
  await open(page, "#/army/a1");
  const card = page.locator('.card:has(.card-open:text-is("Gladiator Lancer"))');
  await expect(card.locator(".tag.plan")).toHaveText("Planned");
  await expect(page.locator("#st-done")).toHaveText("7 / 17");
  await card.locator(".card-open").click();
  await page.click("[data-bought]");
  await expect(page.locator("#st-done")).toHaveText("7 / 18");
  expect((await saved(page)).units.find(u => u.id === "u9").own).toBe("owned");
});

test("an army made in War Ledger asks you to choose colours", async ({page}) => {
  await seed(page);
  await open(page, "#/army/a2");
  await expect(page.locator("#wonly-banner")).toContainText("set up in War Ledger");
  await page.click("#b-keepcol");
  await expect(page.locator("#wonly-banner")).toHaveCount(0);
  expect((await saved(page)).armies.find(a => a.id === "a2").scheme.wonly).toBe(false);
});

test("deleting a ledger warns that its lists and battles go too", async ({page}) => {
  await seed(page);
  await open(page, "#/army/a1");
  await page.click("#b-more");
  await page.click("#b-delarmy");
  await expect(page.locator("dialog[open]")).toContainText("its 4 units, with their photos, colours and recipes, 1 army list and 2 battle reports");
});

test("deleting from War Ledger asks the same way, offers a backup, and deletes everywhere", async ({page}) => {
  await seed(page);
  await open(page, "#/war/army/a1");
  await page.click("#w-delarmy");
  const dlg = page.locator("dialog[open]");
  await expect(dlg).toContainText("from Livery Ledger and War Ledger");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#dl-export")]);
  expect(dl.suggestedFilename()).toMatch(/^livery-ultramarines-2nd-company-/);
  await page.click("#dl-go");
  await expect(page).toHaveURL(/#\/war\/armies$/);
  const d = await saved(page);
  expect([d.armies.some(a => a.id === "a1"), d.units.some(u => u.armyId === "a1"), d.lists.some(l => l.armyId === "a1"), d.games.some(g => g.armyId === "a1")]).toEqual([false, false, false, false]);
});

test("a kit from the pile of shame keeps the model count you type, and joins a ledger priced for it", async ({page}) => {
  await seed(page);
  await open(page, "#/shame");
  await page.fill("#kit-name", "Intercessor Squad");
  await expect(page.locator("#kit-models")).toHaveValue("5");
  await page.click("#kit-models");
  await page.keyboard.type("10");
  await expect(page.locator("#kit-models")).toHaveValue("10");
  await page.click('button:has-text("Add to the pile")');
  await page.click('.kit button:has-text("Start")');
  await page.selectOption(".kit [data-to]", "a1");
  await page.click("[data-move]");
  await expect.poll(async () => (await saved(page)).units.filter(u => u.name === "Intercessor Squad").length).toBe(2);
  const u = (await saved(page)).units.filter(x => x.name === "Intercessor Squad").pop();
  expect([u.armyId, u.count, u.points, u.role]).toEqual(["a1", 10, 150, "Battleline"]);
});

test("painting time: a timer that survives a reload, time added by hand, and the totals on Painting activity", async ({page}) => {
  await seed(page);
  await open(page, "#/army/a1");
  await page.getByRole("button", {name: "View Captain"}).click();
  await page.click("[data-timer]");
  await expect(page.locator("#ptimer")).toContainText("Painting Captain");
  // Pretend it has been running for 50 minutes, then come back to the page.
  await page.evaluate(() => { const t = JSON.parse(localStorage.getItem("ll-timer")); t.start -= 50 * 60000; localStorage.setItem("ll-timer", JSON.stringify(t)); });
  await page.reload();
  await expect(page.locator("#ptimer .pt-clock")).toContainText("0:50:");
  await page.click("[data-tstop]");
  await expect(page.locator("#pt-m")).toHaveValue("50");
  await page.click("dialog[open] [type=submit]");
  await expect(page.locator("#ptimer")).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "u1").tlog).toEqual([{d: expect.any(String), m: 50}]);
  // Add more by hand from the editor.
  await page.getByRole("button", {name: "View Captain"}).click();
  await page.click("[data-edit]");
  await expect(page.locator("#f-ptime")).toContainText("Painting time 50m");
  await page.click("#pt-add"); await page.fill("#pt-h", "1"); await page.fill("#pt-m", "10");
  await page.click("form:has(#pt-h) [type=submit]");
  await expect(page.locator("#f-ptime")).toContainText("Painting time 2h");
  // Saving the editor keeps the time.
  await page.click("#b-save");
  await expect.poll(async () => (await saved(page)).units.find(u => u.id === "u1").tlog.reduce((a, e) => a + e.m, 0)).toBe(120);
  await open(page, "#/livery/activity");
  await expect(page.locator(".act-time")).toContainText("2h");
  await expect(page.locator(".at-top li").first()).toContainText("Captain");
});

test("on a phone, the floating Add unit button waits until the page's own buttons scroll away", async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await seed(page);
  await open(page, "#/army/a1");
  await expect(page.locator("#b-fab")).toHaveClass(/fab-off/);
  await page.locator("#cards .card").last().scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 600);
  await expect(page.locator("#b-fab")).not.toHaveClass(/fab-off/);
});

test("+ Add unit on the roster asks which ledger, then opens its unit editor", async ({page}) => {
  await seed(page);
  await open(page, "#/livery/roster");
  await page.click("#ro-add");
  await page.selectOption("#ra-army", "a2");
  await page.click("dialog[open] [type=submit]");
  await expect(page).toHaveURL(/#\/army\/a2$/);
  await expect(page.locator("#editdlg")).toBeVisible();
  await expect(page.locator("#ed-title")).toHaveText("New unit");
});

test("the Livery overview shows every model's painting status", async ({page}) => {
  await seed(page);
  await open(page, "#/livery");
  const ps = page.locator(".liv-status");
  await expect(ps).toContainText("8 of 38 models painted");
  await expect(ps.locator(".stack-key li")).toHaveText([/1\s*Not started/, /20\s*Built/, /5\s*Primed/, /4\s*In progress/, /8\s*Painted/]);
});
