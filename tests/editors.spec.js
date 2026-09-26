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
  // War Ledger no longer asks about building, painting or buying, but it keeps what Livery Ledger recorded.
  await expect(page.locator("#w-built, #w-painted, #w-ready, #w-own, #w-shop")).toHaveCount(0);
  await page.fill("#w-melee", "Power fists");
  await page.click("dialog[open] [type=submit]");
  await expect.poll(async () => (await unit(page, "c1")).melee).toBe("Power fists");
  const after = await unit(page, "c1");
  // Every field the War Ledger form doesn't change is exactly as it was.
  for(const k of Object.keys(before)) if(!["melee", "ranged", "updatedAt", "log"].includes(k)) expect(after[k], k).toEqual(before[k]);
});

test("ticking Built in Livery Ledger makes the whole unit built", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u3").built = 2; db.units.find(u => u.id === "u3").stages = [];`);
  await open(page, "#/army/a1/unit/u3");
  await page.click("[data-edit]");
  await page.check('#f-stages input[value="built"]');
  await page.click("#b-save");
  await expect.poll(async () => (await unit(page, "u3")).stages).toContain("built");
  expect((await unit(page, "u3")).built).toBe(5);
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
