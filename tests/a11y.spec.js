// No accessibility problems (axe-core, WCAG 2.1 AA) on the main pages and dialogs.
const {test, expect, seed, open, axe} = require("./helpers");

const PAGES = ["#/", "#/livery", "#/livery/roster", "#/livery/paints", "#/livery/new/ultramarines", "#/army/a1", "#/army/a1/colours",
  "#/war", "#/war/collection", "#/war/army/a1", "#/war/list/l1", "#/war/lists", "#/war/battles", "#/shame", "#/settings"];

test("main pages on a desktop", async ({page}) => {
  await seed(page);
  for(const r of PAGES){ await open(page, r); expect(await axe(page), r).toEqual([]); }
});

test("War tables as cards on a phone", async ({page}) => {
  await page.setViewportSize({width: 412, height: 915});
  await seed(page);
  for(const r of ["#/war/collection", "#/war/army/a1", "#/war/list/l1"]){ await open(page, r); expect(await axe(page), r).toEqual([]); }
});

test("list dialogs", async ({page}) => {
  await seed(page);
  await open(page, "#/war/list/l1");
  await page.click("[data-details]");
  expect(await axe(page, "dialog[open]"), "list details").toEqual([]);
  await page.keyboard.press("Escape");
  await page.click('[aria-label="Options for Captain in this list"]');
  expect(await axe(page, "dialog[open]"), "unit options").toEqual([]);
});
