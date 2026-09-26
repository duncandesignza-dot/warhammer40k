// Getting around: the tab bar on phones, the page for addresses that don't exist, and link previews.
const {test, expect, seed, open} = require("./helpers");
const fs = require("fs"), path = require("path");

test("phones get a tab bar for the tool you're in, lighting the section you're on", async ({page}) => {
  await page.setViewportSize({width: 412, height: 915});
  await seed(page);
  const bar = page.locator("#botnav");
  await open(page, "#/");
  await expect(bar).toBeHidden();
  await open(page, "#/army/a1");
  await expect(bar.locator('[aria-current="page"]')).toHaveText("Ledgers");
  await expect(page.locator(".war-tabs").first()).toBeHidden();
  await open(page, "#/war/list/l1");
  await expect(bar).toHaveAttribute("aria-label", "War Ledger sections");
  await expect(bar.locator('[aria-current="page"]')).toHaveText("Lists");
  await bar.locator("a", {hasText: "Battles"}).click();
  await expect(page).toHaveURL(/#\/war\/battles$/);
  // The floating Add unit button stays clear of the bar.
  await open(page, "#/army/a1");
  const fab = await page.locator("#b-fab").boundingBox(), nav = await bar.boundingBox();
  expect(fab.y + fab.height).toBeLessThanOrEqual(nav.y);
});

test("desktops keep the tabs on the page and no bar", async ({page}) => {
  await seed(page);
  await open(page, "#/war");
  await expect(page.locator("#botnav")).toBeHidden();
  await expect(page.locator(".war-tabs").first()).toBeVisible();
});

test("an address that isn't a page says so", async ({page}) => {
  for(const r of ["#/nope", "#/war/nope", "#/livery/nope"]){
    await open(page, r);
    await expect(page.locator("h1"), r).toHaveText("Page not found");
    await expect(page).toHaveTitle(/^Page not found/);
  }
  await page.click('a:has-text("Homepage")');
  await expect(page).toHaveURL(/#\/$/);
});

test("shared links show a preview picture", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const img = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
  expect(img).toBe("https://www.liveryledger.co.za/img/share.jpg");
  const file = path.join(__dirname, "..", "img", "share.jpg");
  expect(fs.existsSync(file)).toBe(true);
  const b = fs.readFileSync(file);
  expect([b[0], b[1]]).toEqual([0xff, 0xd8]);   // a JPEG
  expect(b.length).toBeLessThan(300 * 1024);
});

test("leaving Paints & recipes before it has loaded doesn't break the next page", async ({page}) => {
  await seed(page);
  // A slow paint catalogue: the page is left long before it arrives.
  await page.route("**/js/data/paints.js", async r => { await new Promise(res => setTimeout(res, 1500)); await r.continue(); });
  await page.goto("/#/livery/paints");
  await page.goto("/#/livery/new");
  await page.waitForTimeout(2000);
  await expect(page.locator("#app h1, #app h2").first()).toBeVisible();
});
