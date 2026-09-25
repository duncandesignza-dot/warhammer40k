// Livery Ledger and War Ledger edit the same units with different editors. These check they follow the
// same rules and never undo each other's work.
const {test, expect, seed, saved, open} = require("./helpers");

const unit = async (page, id) => (await saved(page)).units.find(u => u.id === id);

test("both editors price a unit by its size", async ({page}) => {
  await seed(page);
  // War Ledger
  await open(page, "#/war/army/a1");
  await page.click("[data-add-unit]");
  await page.selectOption("#w-sheet", "Intercessor Squad");
  await expect(page.locator("#w-count")).toHaveValue("5");
  await expect(page.locator("#w-pts")).toHaveValue("80");
  await page.fill("#w-count", "10");
  await expect(page.locator("#w-pts")).toHaveValue("150");
  await page.keyboard.press("Escape");
  // Livery Ledger
  await open(page, "#/army/a1");
  await page.click("#b-add");
  await page.selectOption("#f-sheet", "Intercessor Squad");
  await expect(page.locator("#f-points")).toHaveValue("80");
  await page.fill("#f-count", "10");
  await expect(page.locator("#f-points")).toHaveValue("150");
});

test("a price you type yourself isn't overwritten when the size changes", async ({page}) => {
  await seed(page);
  await open(page, "#/war/army/a1");
  await page.click("[data-add-unit]");
  await page.selectOption("#w-sheet", "Intercessor Squad");
  await page.fill("#w-pts", "99");
  await page.fill("#w-count", "10");
  await expect(page.locator("#w-pts")).toHaveValue("99");
});

test("saving in Livery Ledger keeps everything War Ledger knows, and the other way round", async ({page}) => {
  await seed(page, `db.units.push({id: "c1", armyId: "a1", name: "Kitbashed walker", datasheet: "", role: "Vehicle", count: 1, points: 120, painted: 0, stages: [],
    built: 1, ready: 0, bought: "2026-05-01", price: 450, shop: "Local store", assembly: "Magnetised", own: "owned", fav: true});`);
  await open(page, "#/army/a1/unit/c1");
  await page.click("[data-edit]");
  await page.fill("#f-notes", "Painted with a drybrush");
  await page.click("#b-save");
  await expect.poll(async () => (await unit(page, "c1")).notes).toBe("Painted with a drybrush");
  expect(await unit(page, "c1")).toMatchObject({role: "Vehicle", built: 1, ready: 0, bought: "2026-05-01", price: 450, shop: "Local store", assembly: "Magnetised", fav: true});
  // and War Ledger keeps Livery's paint scheme and notes
  const before = await unit(page, "c1");
  await open(page, "#/war/army/a1");
  await page.click('.wtable [data-unit="c1"]');
  await page.fill("#w-shop", "Online");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => (await unit(page, "c1")).shop).toBe("Online");
  const after = await unit(page, "c1");
  // Every field the War Ledger form doesn't show is exactly as it was.
  for(const k of Object.keys(before)) if(!["shop", "updatedAt", "log"].includes(k)) expect(after[k], k).toEqual(before[k]);
});

test("ticking Built in Livery Ledger makes the whole unit built in War Ledger", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u3").built = 2; db.units.find(u => u.id === "u3").stages = [];`);
  await open(page, "#/army/a1/unit/u3");
  await page.click("[data-edit]");
  await page.check('#f-stages input[value="built"]');
  await page.click("#b-save");
  await expect.poll(async () => (await unit(page, "u3")).stages).toContain("built");
  await open(page, "#/war/army/a1");
  await expect(page.locator('.wtable tr:has([data-unit="u3"]) td[data-label="Built"]')).toHaveText("5");
});

test("building the whole unit in War Ledger ticks Built in Livery Ledger, and unbuilding it unticks it", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u4").stages = [];`);
  await open(page, "#/war/army/a1");
  await page.click('.wtable [data-unit="u4"]');
  await page.fill("#w-built", "1");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => (await unit(page, "u4")).stages).toContain("built");
  await page.click('.wtable [data-unit="u4"]');
  await page.fill("#w-built", "0");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => (await unit(page, "u4")).stages).not.toContain("built");
});

test("both editors offer the same datasheets", async ({page}) => {
  await seed(page);
  await open(page, "#/war/army/a1");
  await page.click("[data-add-unit]");
  const war = await page.$$eval("#w-sheet option", os => os.map(o => o.value).filter(v => v && v !== "__custom"));
  await page.keyboard.press("Escape");
  await open(page, "#/army/a1");
  await page.click("#b-add");
  const livery = await page.$$eval("#f-sheet option", os => os.map(o => o.value).filter(v => v && v !== "__custom"));
  expect(war).toEqual(livery);
});
