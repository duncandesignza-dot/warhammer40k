# Livery Ledger / War Ledger: project handoff

Everything a new session (or a new account) needs to pick this project up. Read this first, then `tests/README.md`.

## What it is

One static site with two tools that share the same armies and units:

- **Livery Ledger**: plan and track painting. Colour schemes, paint recipes, painting stages, photos, painting time, pile of shame. It shows **only units you own**.
- **War Ledger**: the army planner and list builder, a lightweight New Recruit. Armies (owned or not), army lists, battle reports and Crusade forces.

A toggle in the header switches between them. Everything is vanilla JS, with no build step and no framework.

| | |
|---|---|
| Repo | `duncandesignza-dot/warhammer40k` |
| Live site | https://www.liveryledger.co.za (Cloudflare Workers, deploys `main`) |
| Branch previews | `https://<branch>-warhammer40k.duncandesignza.workers.dev` (e.g. `claude-jolly-faraday-yfgidw-…`) |
| Backend | Supabase project `obnwceftiohxwiajqfqv` (optional; without it everything is saved in the browser) |
| Datasheet source | BSData `wh40k-11e` (community BattleScribe data), commit `6fca2d1` |

Cloudflare needed `"previews": {}` in `wrangler.jsonc` for the Workers Builds check to pass; that's in place.

## Current state (at handoff)

- `main` has the datasheet eye on War's army and collection tables and in the unit editor (PR #42), and faction pictures on the new army pages.
- Tests pass (76).
- **Next step:** pick something from "Ideas that came up but aren't done".

## How we've been working

- **Branch:** develop on a feature branch, push, test on the preview URL, then open a PR to `main`. When the owner says **"merge"**:
  1. Create the PR.
  2. Wait for the `test` check (GitHub Actions, about 2 minutes) and the Cloudflare "Workers Builds" check.
  3. Merge with method **merge**, passing the head SHA.
  4. Fast-forward the branch to `main` and push it.
- **Commits:** clear messages that describe the change for a person. Don't put AI model names or identifiers in commits or PRs.
- **Before every push:** run the full test suite (see below), and screenshot the changed pages with Playwright (desktop 1280 wide and phone 390 wide) to check them by eye.
- **Copy style:** plain, friendly UK English ("colours", "organiser"), short sentences, no jargon. Buttons say what they do ("Import an army", "Export list"). Hints explain in one line.

## Adding an event (when the owner asks)

Players can't add events: the owner asks for one, and it's added by hand to `js/data/events.js`. They show on War Ledger's Events page, on Play on the day, on Community, and in Livery's "Before your events".

**What the owner gives you:**
- its name and date
- whether it's a club or national event
- optionally, the venue, details (points limit, missions, times) and a link

If the name, date or type is missing, ask for it. Nothing else is needed.

**How to add it:** add an entry to `window.LEDGER_EVENTS` in `js/data/events.js`:

```js
{id: "winter-gt-2026", name: "Winter GT", date: "2026-07-18", kind: "national", place: "Cape Town",
 notes: "2000 pts, Pariah Nexus missions. Doors open 8am.", link: "https://example.com/winter-gt"},
```

- `id`: short, lowercase, made from the name and year. **Never change it once the event is up**, because players' sign-ups are kept against it.
- `date`: `YYYY-MM-DD`. `kind`: `"club"` or `"national"`.
- `place`, `notes` and `link` are optional. The link must start with `https://`, or it isn't shown.
- To change an event, edit its entry but keep its `id`. Past events can stay: they move to "Past events" by themselves.

Then commit ("Events: add Winter GT"), push, and say it goes live once it's merged. It's a data change only, so there's no need for screenshots, but run the tests as usual.

## Running it

```bash
python3 -m http.server 8765          # from the repo root, then open http://localhost:8765
cd tests && npm ci && npx playwright test     # the whole suite (~1.5 min, 76 tests)
npx playwright test war.spec.js -g "import an army"   # one test
```

- Run Playwright **from `tests/`**. From the repo root it finds two copies of `@playwright/test` and finds no tests.
- The config starts its own server on port 8765 (or reuses one that's already running).
- In the cloud container, Chromium is at `/opt/pw-browsers`. Don't run `playwright install`.
- Test files:
  - `smoke` opens every page at 3 sizes and checks there's no sideways scroll.
  - `a11y` runs axe on pages and dialogs.
  - `war`, `livery`, `editors`, `backup`, `online`, `nav` and `data` cover the features.
- `helpers.js` has `seed(page, extraJs)`, `open(page, hash)`, `saved(page)` and `mockSupabase`.
- The seed has two armies (`a1` Ultramarines 2nd Company, `a2` Hive Fleet Leviathan, a War-only army), six units, list `l1` "Club night" and three games.
- `mockSupabase` ignores column selection, so column-only queries (totals) can't be checked online.
- An accessibility test failed once under a full parallel run and then passed 5 times in a row. If it happens again, rerun before digging.

## Files

```
index.html            shell: header, toggle, <main id="app">, script tags
css/styles.css        all styles (~1,850 lines); tokens on :root (--brand, --surface, --ink, --muted…)
js/app.js             the whole app (~6,400 lines, one IIFE): routing, every page, dialogs
js/store.js           data layer: LocalStore (localStorage + IndexedDB photos) and SupaStore (Supabase),
                      plus cleanUnit / cleanList / cleanGame / cleanArmy (every save goes through these)
js/config.js          Supabase URL + anon key (empty = browser-only mode)
js/paints.js          paint catalogue UI (lazy-loads js/data/paints.js)
js/art.js             badge/emblem drawing
js/data/factions.js   datasheets per faction: name n, role r, sizes ms, max copies mx, epic hero eh,
                      points p, points brackets pb [[lo,hi,pts]], weapon names wr/wm, Legends tag t,
                      the units a character can lead ld (names from its Leader ability);
                      detachments dets [{n, dp, c, e:[[enhancement, pts, only?]]}]; battle sizes
js/data/sheets/<faction>.js   datasheet profiles, loaded on demand (see "Datasheet profiles")
js/data/presets.js, emblems.js, paints.js   colour presets, faction emblems, paint data
js/data/events.js     War Ledger events (club and national), added by hand on request
img/heroes/<faction>.webp   faction pictures on the new army pages (800×250); <faction>-2.webp etc. for more than one
tools/build_factions.py   builds factions.js from BSData
tools/build_sheets.py     builds js/data/sheets/*.js from BSData (reads the faction list from build_factions.py)
tools/data_changes.py     summarises what changed between two factions.js builds
.github/workflows/tests.yml               runs Playwright on pushes/PRs (the "test" check)
.github/workflows/refresh-datasheets.yml  weekly: rebuild both data sets from BSData, test, open a PR
supabase/setup.sql, features.sql, recipes.sql   schema + policies (all have been run on the project)
sw.js                 service worker: network-first for site files, offline fallback
```

To rebuild the data by hand:

```bash
git clone --depth 1 https://github.com/BSData/wh40k-11e bsdata
python3 tools/build_factions.py bsdata && python3 tools/build_sheets.py bsdata
```

## How app.js is put together

- **Routing:** hash routes in `route()`.
  - Livery: `#/livery`, `#/livery/{ledgers,collection,activity,paints,new}`, `#/army/<id>` (the ledger), `#/army/<id>/{colours,guide,unit/<uid>}`, `#/new/<faction>`.
  - War: `#/war` (the Armies tab), `#/war/{lists,datasheets,play,battles,events,buy,points,new,collection}`, `#/war/datasheets/<faction>`, `#/war/armies` (redirects to `#/war`), `#/war/list/<id>/{print,play}`, `#/war/new/<faction>`, `#/war/army/<id>`, `#/war/list/<id>`, `#/war/compare/<a>/<b>`.
  - Shared: `#/shame`, `#/settings`, `#/community`, `#/community/shared` (Shared armies; `#/shared` redirects there), `#/painter/<id>`, and `#/` (landing).
- **Page lifecycle:**
  - `route()` queues: one page loads at a time, and only the newest address is opened, so a slow page can't draw over the one you went to. `routeNow()` does the work.
  - A page slower than 250ms shows a bar along the top (`busy()`, `body.loading`, `aria-busy` on `#app`).
  - Online, `cacheReads(store)` keeps the reads (`listArmies`, `listAllUnits`, `listLists`, `listGames`, `listTagged`, `listUnits`, `getArmy`, `summary`, `listKits`) for a minute and shares ones in flight. Any store method that isn't a read clears it (before and after), as does coming back to the tab. Callers get copies.
  - Supabase requests give up after 20s (reads) or 60s (saves) with a plain message (`timedFetch` in store.js); datasheet files after 15s. Before this, one stalled request froze every page after it.
  - `view.seq` goes up on every route, so async work that outlives its page (not awaited by the view) can tell it has been left.
  - Listeners go through `onApp(handler)` (clicks on `#app`) and `onWin(type, handler, target)`. Both chain into `view.cleanup`.
- **Dialogs:** `modal(title, bodyHtml, cls)` returns a `<dialog>` with a `<form>`. The sizes are `"wide"` (760px) and `"wide xwide"` (1120px). `flash(msg)` shows a toast.
- **War data:** `warData()` returns `{armies, pools, units, lists, games, warMissing}`, and `D.byArmy(id)` gets an army's units.
  - "Pools" are hidden holder armies (`scheme.pool`), one per faction, for units not in an army. `poolFor(faction)` makes one.
- **Datasheet helpers** (near the top of app.js):
  - Lookups: `FBY[factionId]`, `sheetsOf(fid)`, `sheetByName(fid, name)`.
  - Sizes and points: `minModels(sh)`, `sheetPts(sh, count)`.
  - Detachments: `factionDets(fid)`, `detByName`, `enhOptions`.
  - Factions: `allyFactions(fid)`, `fitsFaction(fid, sheet)`, `sameFamily(a, b)`, `sheetFaction(fid, name)` (which faction's datasheets hold a name).
  - `rowSheetName(x)`: the datasheet of a list row (collection unit or list-only entry).
- **Key War functions:**
  - Army cards and lists: `armyCard`, `listCard`, `listState(l, D)` (the rows with points), `listChecks(l, s, faction)` ("Things to check").
  - `latestChanges` (points-update warnings), and `crusadeState` / `crUnit` (Crusade).
  - `viewWarList`: the New Recruit-style builder.
    - The roster: `configRow`, `sizePick`, `sheetRows`.
    - Dialogs: `openEntryView` (the eye), `openEntryOptions` (character ⋯), `openSheetPeek`.
  - `openUnitSheet(army, unit, edit)` and `sheetEye(u)`: the eye on army and collection tables. `sheetFaction` finds which faction's sheets file a datasheet is in.
    - `addSheet` adds a datasheet to the list.
  - Buying: `unitFromEntry(army, entry)` makes an army unit from a not-owned entry; `ownedEntry(entry, unit)` points the entry at it.
  - Shopping list (`#/war/buy`): `shoppingRows(D)` gathers not-owned entries across lists (not archived) by army, datasheet and size.
  - Points check (`#/war/points`): `pointsReport(D)` and `latestUnits(list, changes)` (also used by a list's "Update to latest points").
  - Print (`#/war/list/<id>/print`, `viewWarListPrint`) and Game day (`#/war/list/<id>/play`, `viewWarPlay`; kept in localStorage `ll-play-<id>`).
  - Battles: "Units in your games" (`unitsTable`) and Opponent notes (`settings.oppNotes`, shown in `openGame`).
  - Leader check: `listChecks` flags a lead not in the leader's `ld`; the ⋯ Leading menu lists "Can lead" first.
  - `openUnit(army, unit, done, opts)`: the War unit editor. `mergeUnit` keeps fields the other editor owns.
  - Pasting and importing: `makeListReader(fid)` (`parseList` / `parseCode`), `openListImport` (Paste a list), `openAddFromList`, `openImportArmy` + `detectFaction`.
  - Export: `exportText` (New Recruit tournament layout).
  - `gearPicker(box, {kind, options, value, onChange})`: wargear chips plus a dropdown. `splitGear` splits a comma list.
  - `loadSheets(fid)` then `datasheetHtml(profile, gear)`: the datasheet tables.
  - `forceStatus`: the War overview's "Force composition" panel.
- **Faction pictures:** `FACTION_HEROES` (faction id → description, or a list of them for several pictures) and `factionHero(fid)`, shown in the form card under the army name on `#/war/new/<faction>` and `#/livery/new/<faction>`. A faction with several shows one at random. Space Marines and Ultramarines have none yet.
- **Livery:**
  - `liveryData()` returns armies and a summary. Only owned units count; War-only armies with no owned units are hidden.
  - `ownedUnits(armyId)`, `unitOwned(u)`, `paintStatus`, `viewLedger` (the big ledger page), `viewSetup` (colours).
  - Overview: **Before your events** (`drawEventPaint`, `paintJob(list, units)`, `perDay`): for each upcoming event you're going to, the models left to paint in your list, days to go and models a day. The War event card shows the same line. **Up next** (`drawUpNext`, `nextStageOf`, `paintShare`): starred units and ones at least half done, with the next stage.
  - Collection (`#/livery/collection`): Select, then set a stage, All painted, Star or Unstar across units in any ledger (`wireRosterBatch`, `rosterSel`). The ledger page has its own batch bar.
  - Paints: tap an owned paint to mark it low, then empty (`settings.paintLow`, `paintLevels`/`setPaintLevel`); low and empty paints head the To buy list, and "Bought more" clears it.
  - Unit photos: "Before and after" (`openBeforeAfter`, a wipe slider; before is the first extra photo, after the main one, and with 3+ photos you can pick) and, for a painted unit with a photo, "Share image" (`makeShareImage`: a 1080×1350 JPEG with the photo, name, army and models painted; Share where the browser can, otherwise Download). Photos from Supabase are drawn with `crossOrigin` and a `?share=1` address so the service worker's copy doesn't block it.
  - **Paint matcher** (Paints & recipes → Match a paint; `drawMatch`, `PU.nearestOf(label, labels, n)`, `PU.matchWord`): the closest paints you own, then the nearest in each other brand (`PU.similar`). To buy says "You have X, a close match" when one of yours will do. Shades match by the usual swaps, not colour.
  - **Projects** (`#/livery/projects`, `viewLiveryProjects`, `settings.projects` = `[{id, name, date, units: [unit ids]}]`, `myProjects`/`saveProjects`): goals with units and a date, shown with `goalCard` (shared with Before your events). The Overview shows up to three unfinished ones.
  - **Year in review** (`#/livery/year[/YYYY]`, `viewLiveryYear`, `yearOf`, `yearImage`): models painted (from `log`), time (from `tlog`), days painting, busiest month, units finished (done, last logged that year), factions, most-used paints (colours' paints and recipes, weighted by models painted) and colours. "Share your year" uses `shareDialog` (the same dialog as a unit's Share image).
  - **Scheme lab** (unit detail → Scheme lab; `openLab` in `viewLedger`): two or three schemes side by side with pictures, suggestions (darker trim, metallic trim, a spot colour, lighter armour, swap armour and secondary; paints found with `PU.nearestHex`, yours first), and Use this scheme saves the colours and paints to that unit only.
  - **Painting journal** (unit detail; `journalHtml`, `addJournal`, `delJournal`): `unit.journal` = `[{id, d, t, p}]` (store.js `cleanJournal`), p being one of the unit's gallery photos. Adding a note with a photo adds the photo to the gallery first.
- **Community** (`#/community`, `viewCommunity`, icon `LOGO_COMMUNITY` / `img/community.svg`: the Livery and War shield in gold with two figures): in the header (icon only below 1100px, and in the account menu; hidden from the header below 480px) for logged-in players. For now: events coming up, a link to Shared armies, and Spotlights and Painting events marked Coming soon.
  - Its name in the header, switch and menus is **Community Ledger** (just "Community" in the header below 480px). The club section on the homepage shows the Eastern Cape Warlords logo (`img/ecw-logo.webp`, 480×480, transparent).
  - On desktops (900px and up) a copy of the homepage switch docks at the bottom of the screen (`#lp-dock`, shown by an IntersectionObserver on the hero switch, `landingDock`) once the top one has scrolled away. Switching from it goes to the top of the new homepage.
  - Shared armies and painter profiles are part of Community Ledger: gold, with its tabs (`COMM_TABS`: Overview, Shared armies) and, on phones, its own bottom bar (`BOTNAV.community`: Overview, Shared, Events, Livery, War). Shared armies isn't in the account menu any more.
  - The homepage switch has a third choice, Community (`viewLanding({comm: true})`): gold, "Run by the Eastern Cape Warlords", what Community offers, the club section with upcoming events, and every Livery and War feature in two lists. It doesn't change the saved tool. Keep those feature lists (and the "little things" cards on the Livery and War homepages) up to date when features are added.
  - The background picker (`.bgpick`) is moved into the top bar beside the profile menu (or the log in buttons) each time `setTop()` redraws it.
  - On the Community page `html[data-page="community"]` turns the accents gold (the `--brand` variables), neither side of the Livery/War switch is lit, and the header logo shows the two figures over "Livery Ledger". The saved mode (`ll-mode`) is left as it was.

## Data model (what's saved)

- **Army:** `{id, faction, name, scheme, public, owner?}`.
  - `scheme` holds colours, tiers and `limit` (the points it's built to).
  - `scheme.wonly = true` means it was made in War and is still using the preset colours. Livery prompts to choose colours.
  - `scheme.pool = true` means it's a holder army.
  - `scheme.rec` is the win–loss record shown on shared armies.
- **Unit:** `{id, armyId, name, datasheet, role, count, points, ranged, melee, notes, fav, own, …}`, plus Livery's painting fields (colours, `stages`, `painted`, `built`, `photos`, `tlog`, …).
  - Every unit in an army is owned. Units you don't own live only in lists (list-only entries, below).
  - `own: "planned"` is old data: `movePlanned` (called from `warData` and `liveryData`) turns each planned unit into a list-only entry in the lists that used it, or into its army's "Wishlist" list, then deletes the unit.
- **List:** `{id, armyId, name, kind: ""|"crusade", limit, size, detachments[], status, ptsAsOf, ignored[], units: [entry], rp?, from?}`.
- **List entry:** either from the collection, or only in the list.
  - Collection unit: `{u: unitId, k, pts?}`. `pts` overrides the unit's points in this list.
  - List-only unit (not owned): `{n, sheet, role, count, points, gear?, k}`. Shown with a "Not owned" tag; "I've bought this" (in the eye) and "Mark all as owned" (`ownEntries`) turn it into an army unit with the same `k`.
  - Either can also have `warlord`, `enh: {n, p}`, `lead: <k of the unit it leads>`, and Crusade `xp`, `hon`, `scar`, `cpx`, `cnote`.
- **Game:** `{armyId, listId, date, opp, oppName, mission, result: w|l|d, us, them, mvp, took[], mfg, oppUser?, …}`.
- **Settings:** in localStorage and on the account (`currency`, `listChecks`, …).

## Product decisions to keep

- **An army is what you own**, in both tools (the same units). **A list is for testing**: units from your army plus datasheets you don't own, marked "Not owned", with "You own 3 of 4 units · 160 pts not owned" at the top.
- War tabs: Armoury (`#/war`), Army lists, Datasheets, Play, Battles, Events, To buy (with a count). Phones' bottom bar has Armoury, Lists, Play, Battles and To buy; Datasheets and Events are buttons on the Armoury, shown only on phones (`.phone-only`), since the tabs have them elsewhere.
- **Armoury** (`viewWarDash`/`drawWarDash`): every unit you own by faction, with units, models, points, painting (read-only, from Livery's `painted`), how many lists use each unit and the faction's record. `#/war/collection` and `#/war/armies` redirect here.
- **Army lists**: every army with its "Full army" card (`fullArmyCard`, opens `#/war/army/<id>`) then its lists. Army pages sit under Army lists; their More menu has "Make a list of the whole army".
- Events are club or national events listed by hand in `js/data/events.js` (`window.LEDGER_EVENTS`): the owner asks for one to be added, and it's added there and pushed. Players can't add or edit events. Each needs an `id` that never changes (sign-ups are kept against it), `name`, `date` and `kind` (`club`/`national`), plus optional `place`, `notes` and an https `link`. Players sign up ("I'm going", or "I went" after) with a list and notes, kept in `settings.eventLog` (`myEvents`/`saveMyEvent`); the old player-made `settings.events` are dropped. An event's result is the battles logged with your list on its date.
- The list builder's Add units opens on "Your units"; Datasheets is the second tab.
- **War doesn't edit painting.** Livery owns built/painted; the Armoury and Full army cards only show how much is painted. There's still no battle-ready tracking.
- **Rules text stays out of the data.** Only numbers, profiles, and names of abilities, rules and keywords (the same choice as `build_factions.py`). Adding ability descriptions is possible but was deliberately not done.
- **Faction rules:**
  - Allies only Imperial Agents / Imperial Knights for Imperium armies, Chaos Daemons / Chaos Knights for Chaos armies, and none for Xenos.
  - A Space Marine chapter includes Space Marines datasheets.
  - The unit editor only offers armies of the same faction family.
- **List builder (New Recruit style):**
  - The points total stays in view, with battle size and detachment in the roster.
  - Units are added from datasheets at their smallest size, and each row has a unit-size dropdown.
  - The row buttons are 👁 (datasheet, models, wargear, points), ⋯ (characters only), copy and ×.
- **Import/export:**
  - "Import an army" makes an empty army and a list of not-owned units with the same detachment, warlord, enhancements and leaders. "I own all of these" puts them in the army instead.
  - "Export list" writes New Recruit's tournament layout (`tests/fixtures/newrecruit-world-eaters.txt` is a real example), and "Paste a list" reads it back losslessly.
- **Look:**
  - The dark UI has green for Livery and red for War.
  - Army and faction badges are shoulder-pad emblems only (`soloBadge`, `armyBadge`); all helmet previews were removed.
  - Buttons sit in page headers ("+ Add unit · Add from a list · Share · More").

## Gotchas

- **BSData quirks handled in the code:**
  - Some datasheets' sizes disagree with their points brackets (Jakhals "2 models"). They're fixed at load in app.js: the brackets win.
  - New Recruit pastes contain non-breaking spaces (normalised in `parseList`).
  - Chapter-only rules are hidden by conditions on the primary catalogue; `build_sheets.py` evaluates them.
- **Legends datasheets** are hidden in the builder unless the "Legends" box is ticked (e.g. Deathstorm Drop Pod).
- **"Coward's Bane"** is Lord Invocatus's own weapon, not an enhancement. Enhancements are only recognised if they're in the faction's detachment data.
- **Cloud containers block newrecruit.eu.** To compare against New Recruit, ask the owner for screenshots.
- **Supabase:**
  - `setup.sql` has a policy "units: army is yours (update)" (a unit can't be moved into someone else's army). If the project was set up before it was added, run just that policy in the SQL editor.
  - Army lists and battles need `supabase/features.sql` (`warMissing` / `code: "nowar"` when missing).
  - Kits (pile of shame), comments, likes, follows and `games.opp_user` are also in features.sql. All of it has been run on the project.
- **Store changes:** keep `cleanUnit` / `cleanList` in step with any new field, or it's silently dropped on save. That already happened once with list-entry `gear`.

## Ideas that came up but aren't done

- Show ability descriptions in the datasheet view (a build-script change).
- Per-model wargear with counts ("2 with Khornate eviscerator"), like New Recruit's model breakdown. The data only has the datasheet's weapon names, not its option groups.
