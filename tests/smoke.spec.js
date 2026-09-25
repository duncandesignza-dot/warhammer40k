// Every page opens without errors and without sideways scrolling, on a desktop, a phone and a small phone.
const {test, expect, seed, open, noSidewaysScroll} = require("./helpers");

const ROUTES = ["#/", "#/livery", "#/livery/ledgers", "#/livery/roster", "#/livery/paints", "#/livery/activity", "#/livery/new", "#/livery/new/ultramarines",
  "#/army/a1", "#/army/a1/colours", "#/army/a1/guide", "#/army/a1/unit/u2",
  "#/war", "#/war/armies", "#/war/collection", "#/war/lists", "#/war/battles", "#/war/army/a1", "#/war/army/a2", "#/war/list/l1", "#/war/new", "#/war/new/necrons",
  "#/shame", "#/settings", "#/shared", "#/nope"];
const SIZES = {desktop: {width: 1366, height: 900}, phone: {width: 412, height: 915}, "small phone": {width: 320, height: 640}};

for(const [name, viewport] of Object.entries(SIZES)){
  test(`every page opens cleanly on a ${name}`, async ({page}) => {
    await page.setViewportSize(viewport);
    await seed(page);
    for(const route of ROUTES){
      await open(page, route);
      await expect(page.locator("#app h1, #app h2").first(), route).toBeVisible();
      // The printable guide's table scrolls inside its own box on phones, by design.
      if(route.endsWith("/guide")) continue;
      expect(await noSidewaysScroll(page), `sideways scrolling on ${route}`).toBeLessThanOrEqual(0);
      // War tables fit without scrolling sideways inside their own box, too.
      const hidden = await page.$$eval(".wt-scroll", els => els.filter(e => e.scrollWidth > e.clientWidth + 1).length);
      expect(hidden, `a War table scrolls sideways on ${route}`).toBe(0);
    }
  });
}

test("both modes of the homepage open, and the switch changes the colours", async ({page}) => {
  await page.goto("/#/");
  const brand = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  await page.click('[data-lp-mode="war"], .mode-switch a[href*="war"]');
  await expect.poll(brand).toBe("#ec5a5f");
  await page.goto("/#/livery");
  await expect.poll(brand).toBe("#3ddc84");
});
