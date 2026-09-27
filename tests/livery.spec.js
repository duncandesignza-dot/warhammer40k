// Livery Ledger: making a ledger, adding units, planned units and the colours prompt.
const {test, expect, seed, saved, open, mockSupabase} = require("./helpers");

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

test("old planned units move into the lists that use them, or a Wishlist, and leave the army", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Gladiator Lancer", datasheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, painted: 0, stages: [], own: "planned", ranged: "Lancer laser destroyer"});
    db.lists[0].units.push({u: "u9", k: "e", pts: 150});
    db.armies.push({id: "a3", faction: "necrons", name: "Test build", scheme: {...window.LEDGER_PRESETS.presetFor("necrons"), wonly: true}, createdAt: "2026-01-03", updatedAt: "2026-01-03"});
    db.units.push({id: "u10", armyId: "a3", name: "Necron Warriors", datasheet: "Necron Warriors", role: "Battleline", count: 10, points: 90, painted: 0, stages: [], own: "planned"});`);
  await open(page, "#/war");
  await expect.poll(async () => (await saved(page)).units.some(u => u.own === "planned")).toBe(false);
  const d = await saved(page);
  // Used in a list: now a unit in that list you don't own, with its points and wargear kept.
  expect(d.lists.find(l => l.id === "l1").units.find(e => e.k === "e")).toMatchObject({n: "Gladiator Lancer", sheet: "Gladiator Lancer", count: 1, points: 150, gear: "Lancer laser destroyer"});
  // In no list: the army's Wishlist.
  expect(d.lists.find(l => l.armyId === "a3" && l.name === "Wishlist").units.map(e => e.n)).toEqual(["Necron Warriors"]);
  // Livery Ledger is unchanged: it only ever showed units you own.
  await open(page, "#/army/a1");
  await expect(page.locator("#st-done")).toHaveText("7 / 17");
  await open(page, "#/war/list/l1");
  await expect(page.locator('.lb-in li:has-text("Gladiator Lancer") .tag.plan').first()).toHaveText("Not owned");
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
  await page.click("#wa-more"); await page.click("#w-delarmy");
  const dlg = page.locator("dialog[open]");
  await expect(dlg).toContainText("from Livery Ledger and War Ledger");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#dl-export")]);
  expect(dl.suggestedFilename()).toMatch(/^livery-ultramarines-2nd-company-/);
  await page.click("#dl-go");
  await expect(page).toHaveURL(/#\/war\/lists$/);
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

test("+ Add unit on the collection page asks which ledger, then opens its unit editor", async ({page}) => {
  await seed(page);
  await open(page, "#/livery/collection");
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

test("the Livery collection (once the roster) lists units not in a ledger too, and old links still work", async ({page}) => {
  await seed(page, `db.armies.push({id: "p1", faction: "ultramarines", name: "Ultramarines (not in an army)", scheme: {...window.LEDGER_PRESETS.presetFor("ultramarines"), pool: true}, public: false});
    db.units.push({id: "u10", armyId: "p1", name: "Lieutenant", datasheet: "Lieutenant", role: "Character", count: 1, points: 65, painted: 0, stages: []});`);
  await page.goto("/#/livery/roster");
  await expect(page).toHaveURL(/#\/livery\/collection$/);
  await expect(page.locator("h1")).toHaveText("Your collection");
  await page.selectOption("#ro-g", "army");
  const loose = page.locator('.ro-group[aria-label="Not in a ledger"]');
  await expect(loose).toContainText("Lieutenant");
  await expect(loose).toContainText("Ultramarines");
  await expect(page.locator('.war-tabs a[aria-current="page"]')).toHaveText("Collection");
});

test("the ledger counts its units in the totals, leaving planned ones out", async ({page}) => {
  await seed(page, `db.units.push({id: "u9", armyId: "a1", name: "Hellblaster Squad", datasheet: "Hellblaster Squad", role: "Infantry", count: 5, points: 115, painted: 0, stages: [], own: "planned"});`);
  await open(page, "#/army/a1");
  await expect(page.locator("#st-fin")).toHaveText("1 of 4 units finished");
  await expect(page.locator("#st-models")).toHaveText("17 models");
});

// A tiny photo, so there's something to compare and share.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const dayFrom = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test("overview: before your events shows what's left to paint in your list, and up next shows starred and nearly done units", async ({page}) => {
  await page.route("**/js/data/events.js", r => r.fulfill({contentType: "text/javascript", body: `window.LEDGER_EVENTS = ${JSON.stringify([{id: "gt", name: "Winter GT", date: dayFrom(2), kind: "national"}])};`}));
  await seed(page, `db.units.find(u => u.id === "u3").fav = true;`);
  await page.evaluate(() => localStorage.setItem("ll-settings", JSON.stringify({eventLog: {gt: {listId: "l1", notes: ""}}})));
  await page.reload();
  await open(page, "#/livery");
  // Club night has the Captain (painted), 10 Intercessors (6 painted), a Redemptor (not painted) and a Gladiator Lancer you don't own.
  const ep = page.locator(".ep");
  await expect(ep.locator("h3")).toHaveText("Winter GT");
  await expect(ep.locator(".ep-sum")).toHaveText("5 models to paint, 2 days to go, about 2.5 a day");
  await expect(ep.locator(".ep-left li")).toHaveText([/Intercessor Squad\s*4 to go · next: shade/, /Redemptor Dreadnought\s*1 to go · next: built/]);
  await expect(ep).toContainText("1 unit in the list isn't in your collection yet.");
  // Up next: the starred Terminators, then the nearly done Intercessors, each with its next stage.
  await expect(page.locator(".un-rows li")).toHaveCount(2);
  await expect(page.locator(".un-rows li").nth(0)).toContainText("Terminator Squad");
  await expect(page.locator(".un-rows li").nth(0).locator(".un-next")).toContainText("Basecoat");
  await expect(page.locator(".un-rows li").nth(1)).toContainText("Intercessor Squad");
  await expect(page.locator(".un-rows li").nth(1).locator(".un-next")).toContainText("Shade");
  await expect(page.locator(".un-rows a").first()).toHaveAttribute("href", "#/army/a1/unit/u3");
  // The event's card in War Ledger says what's still to paint too.
  await open(page, "#/war/events");
  await expect(page.locator(".ev-paint")).toContainText("5 models still to paint: about 2.5 a day.");
});

test("collection: select several units and set a painting stage, or star them, together", async ({page}) => {
  await seed(page);
  await open(page, "#/livery/collection");
  await page.click("#ro-sel");
  await expect(page.locator("#ro-bar")).toBeVisible();
  await expect(page.locator("#rb-stage")).toBeDisabled();
  await page.check('[data-rp="u4"]');
  await page.check('[data-rp="u5"]');
  await expect(page.locator("#rb-count")).toHaveText("2 selected");
  await page.selectOption("#rb-stage", "primed");
  await expect(page.locator("#toast")).toContainText("Set to Primed: 2 units.");
  const db = await saved(page);
  expect(db.units.find(u => u.id === "u4").stages).toEqual(["built", "primed"]);
  expect(db.units.find(u => u.id === "u5").stages).toEqual(["built", "primed"]);
  expect(db.units.find(u => u.id === "u3").stages).toEqual(["built", "primed"]);
  // Still selected: star them, then leave selecting with Escape.
  await page.click("#rb-star");
  await expect(page.locator("#toast")).toContainText("Starred: 2 units.");
  expect((await saved(page)).units.filter(u => u.fav).map(u => u.id).sort()).toEqual(["u4", "u5"]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#ro-bar")).toBeHidden();
  await expect(page.locator('a.ro-row[href="#/army/a1/unit/u4"]')).toBeVisible();
});

test("paints: mark one running low, then empty, and it goes on the To buy list until you buy more", async ({page}) => {
  await seed(page);
  await page.evaluate(() => localStorage.setItem("livery-paints-v1", JSON.stringify(["Abaddon Black", "Macragge Blue"])));
  await open(page, "#/livery/paints");
  await page.click('[data-pt="owned"]');
  const chip = page.locator('.ochip:has-text("Abaddon Black")');
  await chip.locator("[data-pa=level]").click();
  await expect(chip.locator(".oc-tag")).toHaveText("Low");
  await expect(page.locator("[data-pa=level]:focus")).toHaveCount(1);
  await page.click('[data-pt="buy"]');
  const row = page.locator('.buy li:has-text("Abaddon Black")');
  await expect(row).toContainText("Running low");
  await page.click('[data-pt="owned"]');
  await chip.locator("[data-pa=level]").click();
  await expect(chip.locator(".oc-tag")).toHaveText("Empty");
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("ll-settings"))).paintLow).toEqual({"Abaddon Black": "empty"});
  await page.click('[data-pt="buy"]');
  await expect(row).toContainText("Empty");
  await row.locator("[data-pa=restocked]").click();
  await expect(page.locator('.buy li:has-text("Abaddon Black")')).toHaveCount(0);
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("ll-settings"))).paintLow).toEqual({});
});

test("unit photos: compare before and after, and make a picture of a finished unit to share", async ({page}) => {
  await seed(page, `db.units.find(u => u.id === "u1").image = ${JSON.stringify(PNG)}; db.units.find(u => u.id === "u1").photos = [${JSON.stringify(PNG)}]; db.units.find(u => u.id === "u1").painted = 1;`);
  await open(page, "#/army/a1/unit/u1");
  await page.click("[data-compare]");
  const ba = page.locator("dialog[open] .ba");
  await expect(ba.locator("img")).toHaveCount(2);
  await page.locator("#ba-r").fill("20");
  await expect(ba).toHaveAttribute("style", /--x: ?20%/);
  await page.click("dialog.wdlg[open] [data-x]");
  await page.click("[data-share-unit]");
  await expect(page.locator("#sh-box img")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator('#sh-acts a[download]')).toHaveAttribute("download", "captain-painted.jpg");
  // A unit that isn't finished has no share button.
  await open(page, "#/army/a1/unit/u2");
  await expect(page.locator("[data-share-unit]")).toHaveCount(0);
});

test("community: in the header once you're logged in, with the events coming up", async ({page}) => {
  await page.route("**/js/data/events.js", r => r.fulfill({contentType: "text/javascript", body: `window.LEDGER_EVENTS = ${JSON.stringify([{id: "gt", name: "Winter GT", date: dayFrom(5), kind: "national", place: "Cape Town"}, {id: "old", name: "Old", date: dayFrom(-5)}])};`}));
  await mockSupabase(page);
  await page.goto("/#/livery");
  await page.click(".topnav .top-comm");
  await expect(page).toHaveURL(/#\/community$/);
  await expect(page.locator("h1")).toHaveText("Community");
  await expect(page.locator(".topnav .top-comm")).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".cm-evs li")).toHaveCount(1);
  await expect(page.locator(".cm-evs li")).toContainText("Winter GT");
  await expect(page.locator('.cm-card[href="#/shared"]')).toBeVisible();
});

test("community: logged out, it asks you to log in, and there's no header link", async ({page}) => {
  await mockSupabase(page, {signedIn: false});
  await page.goto("/#/community");
  await expect(page.locator(".top-comm")).toHaveCount(0);
  await expect(page.locator("#authdlg[open], dialog[open]")).toContainText("Log in to see the community.");
});
