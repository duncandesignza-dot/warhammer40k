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
  await expect(page.locator("#st-done")).toHaveText("7/17");
  await card.locator(".card-open").click();
  await page.click("[data-bought]");
  await expect(page.locator("#st-done")).toHaveText("7/18");
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
  await expect(page.locator("#dl-text")).toContainText("along with its 1 army list and 2 battle reports");
});
