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
- Tests pass (71).
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

## Running it

```bash
python3 -m http.server 8765          # from the repo root, then open http://localhost:8765
cd tests && npm ci && npx playwright test     # the whole suite (~1.5 min, 71 tests)
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
                      points p, points brackets pb [[lo,hi,pts]], weapon names wr/wm, Legends tag t;
                      detachments dets [{n, dp, c, e:[[enhancement, pts, only?]]}]; battle sizes
js/data/sheets/<faction>.js   datasheet profiles, loaded on demand (see "Datasheet profiles")
js/data/presets.js, emblems.js, paints.js   colour presets, faction emblems, paint data
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
  - War: `#/war`, `#/war/{armies,collection,lists,battles,new}`, `#/war/new/<faction>`, `#/war/army/<id>`, `#/war/list/<id>`, `#/war/compare/<a>/<b>`.
  - Shared: `#/shame`, `#/settings`, `#/shared`, `#/painter/<id>`, and `#/` (landing).
- **Page lifecycle:**
  - `view.seq` goes up on every route, so an async page can tell it has been left.
  - Listeners go through `onApp(handler)` (clicks on `#app`) and `onWin(type, handler, target)`. Both chain into `view.cleanup`.
- **Dialogs:** `modal(title, bodyHtml, cls)` returns a `<dialog>` with a `<form>`. The sizes are `"wide"` (760px) and `"wide xwide"` (1120px). `flash(msg)` shows a toast.
- **War data:** `warData()` returns `{armies, pools, units, lists, games, warMissing}`, and `D.byArmy(id)` gets an army's units.
  - "Pools" are hidden holder armies (`scheme.pool`), one per faction, for units not in an army. `poolFor(faction)` makes one.
- **Datasheet helpers** (near the top of app.js):
  - Lookups: `FBY[factionId]`, `sheetsOf(fid)`, `sheetByName(fid, name)`.
  - Sizes and points: `minModels(sh)`, `sheetPts(sh, count)`.
  - Detachments: `factionDets(fid)`, `detByName`, `enhOptions`.
  - Factions: `allyFactions(fid)`, `fitsFaction(fid, sheet)`, `sameFamily(a, b)`.
- **Key War functions:**
  - Army cards and lists: `armyCard`, `listCard`, `listState(l, D)` (the rows with points), `listChecks(l, s, faction)` ("Things to check").
  - `latestChanges` (points-update warnings), and `crusadeState` / `crUnit` (Crusade).
  - `viewWarList`: the New Recruit-style builder.
    - The roster: `configRow`, `sizePick`, `sheetRows`.
    - Dialogs: `openEntryView` (the eye), `openEntryOptions` (character ⋯), `openSheetPeek`.
  - `openUnitSheet(army, unit, edit)` and `sheetEye(u)`: the eye on army and collection tables. `sheetFaction` finds which faction's sheets file a datasheet is in.
    - `addSheet` adds a datasheet to the list.
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

## Data model (what's saved)

- **Army:** `{id, faction, name, scheme, public, owner?}`.
  - `scheme` holds colours, tiers and `limit` (the points it's built to).
  - `scheme.wonly = true` means it was made in War and is still using the preset colours. Livery prompts to choose colours.
  - `scheme.pool = true` means it's a holder army.
  - `scheme.rec` is the win–loss record shown on shared armies.
- **Unit:** `{id, armyId, name, datasheet, role, count, points, ranged, melee, notes, fav, own, …}`, plus Livery's painting fields (colours, `stages`, `painted`, `built`, `photos`, `tlog`, …).
  - **`own: "planned"`** means a War planning unit that isn't in Livery.
  - Anything else counts as owned. Units made in War are planned by default. The editor's "I own this unit" and Select units "I own these" flip them to owned.
- **List:** `{id, armyId, name, kind: ""|"crusade", limit, size, detachments[], status, ptsAsOf, ignored[], units: [entry], rp?, from?}`.
- **List entry:** either from the collection, or only in the list.
  - Collection unit: `{u: unitId, k, pts?}`. `pts` overrides the unit's points in this list.
  - List-only unit: `{n, sheet, role, count, points, gear?, k}`.
  - Either can also have `warlord`, `enh: {n, p}`, `lead: <k of the unit it leads>`, and Crusade `xp`, `hon`, `scar`, `cpx`, `cnote`.
- **Game:** `{armyId, listId, date, opp, oppName, mission, result: w|l|d, us, them, mvp, took[], mfg, oppUser?, …}`.
- **Settings:** in localStorage and on the account (`currency`, `listChecks`, …).

## Product decisions to keep

- **Livery = what you own.** War = your Livery units plus anything you're planning. Don't show planned units in Livery; only a small blue "Planned" tag in War tables.
- **War has no built/painted/battle-ready tracking.** It was removed on purpose so people can test armies they don't own. The fields are still stored and Livery owns them.
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
  - "Import an army" makes the army (planned units) and a list with the same detachment, warlord, enhancements and leaders.
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
  - Army lists and battles need `supabase/features.sql` (`warMissing` / `code: "nowar"` when missing).
  - Kits (pile of shame), comments, likes, follows and `games.opp_user` are also in features.sql. All of it has been run on the project.
- **Store changes:** keep `cleanUnit` / `cleanList` in step with any new field, or it's silently dropped on save. That already happened once with list-entry `gear`.

## Ideas that came up but aren't done

- Show ability descriptions in the datasheet view (a build-script change).
- Per-model wargear with counts ("2 with Khornate eviscerator"), like New Recruit's model breakdown. The data only has the datasheet's weapon names, not its option groups.
- Check leaders against each datasheet's "Leader" list (BSData has it in the Leader ability's text).
