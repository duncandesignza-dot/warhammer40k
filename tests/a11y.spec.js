// No accessibility problems (axe-core, WCAG 2.1 AA) on the main pages and dialogs.
const {test, expect, seed, open, axe, noSidewaysScroll} = require("./helpers");

const PAGES = ["#/", "#/livery", "#/livery/collection", "#/livery/paints", "#/livery/new/ultramarines", "#/army/a1", "#/army/a1/colours",
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

// A Crusade force (l2) with a battle, so the Order of Battle, the compare page and the chart all have something to show.
const CRUSADE = `db.lists.push({id: "l2", armyId: "a1", name: "Indomitus Crusade", kind: "crusade", rp: 1, limit: 1000, size: "incursion", status: "narrative", detachments: [],
    units: [{u: "u1", k: "a", xp: 3, hon: [{t: "trait", n: "Hardened veterans"}], scar: ["Battle-weary"]}, {u: "u3", k: "b"}], createdAt: "2026-09-02", updatedAt: "2026-09-02"});
  db.games.push({id: "g4", armyId: "a1", listId: "l2", date: "2026-09-22", opp: "orks", result: "w", us: 70, them: 50, took: ["a", "b"], mfg: "a", mvp: "u1"});`;

test("Crusade force, compare and battle stats", async ({page}) => {
  await seed(page, CRUSADE);
  for(const r of ["#/war/list/l2", "#/war/compare/l1/l2", "#/war/battles"]){ await open(page, r); expect(await axe(page), r).toEqual([]); }
  await open(page, "#/war/list/l2");
  await page.click('[data-cr="0"]');
  expect(await axe(page, "dialog[open]"), "Crusade card").toEqual([]);
  await page.keyboard.press("Escape");
  await page.click(".war-actions [data-log]");
  expect(await axe(page, "dialog[open]"), "log a Crusade battle").toEqual([]);
  await page.keyboard.press("Escape");
  await page.setViewportSize({width: 412, height: 915});
  for(const r of ["#/war/list/l2", "#/war/compare/l1/l2"]){ await open(page, r); expect(await axe(page), r + " (phone)").toEqual([]); }
  await page.setViewportSize({width: 320, height: 700});
  for(const r of ["#/war/list/l2", "#/war/compare/l1/l2", "#/war/battles"]){ await open(page, r); expect(await noSidewaysScroll(page), r + " at 320px").toBe(0); }
});

test("painting time: the timer bar and Painting activity", async ({page}) => {
  await seed(page, `db.units[0].tlog = [{d: "2026-09-20", m: 95}];`);
  await page.evaluate(() => localStorage.setItem("ll-timer", JSON.stringify({armyId: "a1", unitId: "u2", name: "Intercessor Squad", start: Date.now() - 60000})));
  await page.reload();
  for(const r of ["#/livery/activity", "#/army/a1"]){ await open(page, r); expect(await axe(page), r).toEqual([]); }
  await page.click("[data-tstop]");
  expect(await axe(page, "dialog[open]"), "stop the timer").toEqual([]);
});
