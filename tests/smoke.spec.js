// Every page opens without errors and without sideways scrolling, on a desktop, a phone and a small phone.
const {test, expect, seed, open, noSidewaysScroll, mockSupabase} = require("./helpers");

const ROUTES = ["#/", "#/livery", "#/livery/ledgers", "#/livery/collection", "#/livery/paints", "#/livery/activity", "#/livery/new", "#/livery/new/ultramarines",
  "#/army/a1", "#/army/a1/colours", "#/army/a1/guide", "#/army/a1/unit/u2",
  "#/war", "#/war/armoury", "#/war/armies", "#/war/collection", "#/war/lists", "#/war/battles", "#/war/buy", "#/war/points", "#/war/datasheets", "#/war/events", "#/war/list/l1/play", "#/war/list/l1/print", "#/war/army/a1", "#/war/army/a2", "#/war/list/l1", "#/war/new", "#/war/new/necrons",
  "#/settings", "#/shared", "#/nope"];
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
      // On wider screens War tables are real tables, with the header row above the rows (phones get cards).
      if(viewport.width > 640){
        const bad = await page.$$eval(".wtable", ts => ts.filter(t => getComputedStyle(t).display !== "table" || (t.tHead && t.tBodies[0] && t.tHead.getBoundingClientRect().bottom > t.tBodies[0].getBoundingClientRect().top + 1)).length);
        expect(bad, `a War table isn't laid out as a table on ${route}`).toBe(0);
      }
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

test("the homepage's Community view is gold, says who runs it and lists every feature", async ({page}) => {
  for(const w of [1280, 390, 320]){
    await page.setViewportSize({width: w, height: 800});
    await page.goto("/#/");
    await page.click('.lp-hero [data-lp-mode="community"]');
    await expect(page.locator('.lp-hero [data-lp-mode="community"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".lp-hero .lp-switch [aria-pressed=true]")).toHaveCount(1);
    await expect(page.locator(".lp-hero .eyebrow")).toHaveText("Run by the Eastern Cape Warlords");
    await expect(page.locator("#lp-club-h")).toContainText("Eastern Cape Warlords");
    await expect(page.locator(".lp-both-col.liv li")).toContainText(["Scheme lab: try schemes side by side"]);
    await expect(page.locator(".lp-both-col.war li")).toContainText(["Game day at the table"]);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim())).toBe("#f5b83d");
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
    // Back to Livery Ledger: green again, and the saved tool wasn't changed.
    await page.click('.lp-hero [data-lp-mode="livery"]');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim())).toBe("#3ddc84");
  }
});

test("the background picker sits next to your profile", async ({page}) => {
  await mockSupabase(page);
  await page.goto("/#/livery");
  await page.locator(".acct").waitFor();
  expect(await page.evaluate(() => document.querySelector(".bgpick").nextElementSibling.className)).toBe("acct");
  await page.goto("/#/war");
  await page.locator(".acct").waitFor();
  expect(await page.evaluate(() => document.querySelector(".bgpick").nextElementSibling.className)).toBe("acct");
  await page.click("#b-bg");
  await expect(page.locator("#bg-menu")).toBeVisible();
});

test("on a desktop, the homepage switch docks at the bottom once you scroll past it", async ({page}) => {
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto("/#/");
  const dock = page.locator("#lp-dock");
  await expect(dock).not.toHaveClass(/\bon\b/);
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect(dock).toHaveClass(/\bon\b/);
  await expect(dock).toHaveAttribute("aria-hidden", "false");
  // Switching from the dock goes to the top of the new homepage.
  await dock.locator('[data-lp-mode="war"]').click();
  await expect(page.locator('.lp-hero [data-lp-mode="war"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator("#lp-dock")).not.toHaveClass(/\bon\b/);
  // Not on a phone.
  await page.setViewportSize({width: 390, height: 800});
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect(page.locator("#lp-dock")).toBeHidden();
});

test("tooltips: pointing at a tab or button says what it does, and so does tabbing to it", async ({page}) => {
  await seed(page);
  await page.setViewportSize({width: 1280, height: 800});
  await open(page, "#/war");
  await page.hover('.war-tabs a[href="#/war/lists"]');
  await expect(page.locator("#tipbox")).toBeVisible();
  await expect(page.locator("#tipbox")).toHaveText("Lists for your games, with units you own and ones you don't");
  await expect(page.locator('.war-tabs a[href="#/war/lists"]')).toHaveAttribute("aria-describedby", "tipbox");
  await page.mouse.move(5, 790);
  await expect(page.locator("#tipbox")).toBeHidden();
  // A title becomes a tooltip too, without the browser's own.
  await open(page, "#/livery/collection");
  await page.hover("#ro-sel");
  await expect(page.locator("#tipbox")).toContainText("Pick several units");
  // Keyboard.
  await page.locator(".war-tabs a").first().focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#tipbox")).toBeVisible();
});

test("ⓘ buttons explain a word, on a tap as well as a click, and link to Help", async ({page}) => {
  await seed(page);
  await page.setViewportSize({width: 390, height: 800});
  await open(page, "#/war/list/l1");
  await page.locator('[data-info="detachment"]').first().click();
  const pop = page.locator(".infopop");
  await expect(pop).toContainText("Detachment");
  await expect(pop).toContainText("The set of army rules you choose for a list");
  await expect(pop.locator("a")).toHaveAttribute("href", "#/help#g-detachment");
  await expect(page.locator('[data-info="detachment"]').first()).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(pop).toHaveCount(0);
  // In a summary, it explains without opening or closing the section.
  await open(page, "#/army/a1/unit/u2");
  const sec = page.locator('details.dsec[data-k="painting"]');
  const was = await sec.evaluate(d => d.open);
  await sec.locator('[data-info="stages"]').click();
  await expect(page.locator(".infopop")).toContainText("Painting stages");
  expect(await sec.evaluate(d => d.open)).toBe(was);
});

test("Help: the three tools, getting started, the words and questions, and a ⓘ opens it at its word", async ({page}) => {
  await seed(page);
  await open(page, "#/help");
  await expect(page.locator("h1")).toHaveText("How it all works");
  await expect(page.locator(".hp-tool h3")).toHaveText(["Livery Ledger", "War Ledger", "Community Ledger"]);
  await expect(page.locator(".hp-tool.war .hp-tabs li").nth(1)).toContainText("Every unit you own, by faction");
  await expect(page.locator("#g-supply-limit dt")).toHaveText("Supply limit");
  // From a ⓘ: straight to the word.
  await open(page, "#/war/list/l1");
  await page.locator('[data-info="detachment"]').first().click();
  await page.click(".infopop a");
  await expect(page).toHaveURL(/#\/help#g-detachment$/);
  await expect(page.locator("#g-detachment")).toBeInViewport();
  await expect(page.locator("#g-detachment")).toHaveClass(/hp-hit/);
  // Linked from the footer.
  await expect(page.locator('.site-foot a[href="#/help"]')).toBeVisible();
});

test("Help sits just left of Settings on each ledger's overview", async ({page}) => {
  await seed(page);
  for(const h of ["#/livery", "#/war", "#/community"]){
    await open(page, h);
    const links = page.locator(':is(.page-head,.profile-head) a[href="#/help"] + a[href="#/settings"]');
    await expect(links, h).toBeVisible();
  }
});

test("getting started: a checklist for someone new, ticking off as they go, and it can be hidden", async ({page}) => {
  await seed(page, `db.units = []; db.lists = []; db.games = []; db.armies = db.armies.slice(0, 1);`);
  await open(page, "#/war");
  const card = page.locator('[data-start-card="war"]');
  await expect(card).toContainText("1 of 4 done");
  await expect(card.locator("li.done")).toHaveCount(1);
  await expect(card.locator("li").nth(1)).toContainText("Add the units you own");
  await open(page, "#/livery");
  const liv = page.locator('[data-start-card="livery"]');
  await expect(liv).toContainText("2 of 4 done");
  await liv.locator("[data-start-hide]").click();
  await expect(liv).toHaveCount(0);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("ll-settings"))).startHide).toEqual({livery: true});
  await open(page, "#/livery");
  await expect(page.locator('[data-start-card="livery"]')).toHaveCount(0);
  await open(page, "#/war");
  await expect(page.locator('[data-start-card="war"]')).toHaveCount(1);
});
