# Tests

Browser tests for Livery Ledger and War Ledger, using [Playwright](https://playwright.dev) and
[axe-core](https://github.com/dequelabs/axe-core). GitHub runs them on every pull request
(`.github/workflows/tests.yml`), and the weekly datasheet refresh runs them before it opens a pull request.

The tests never touch the real database. Everything off the machine is blocked, so the app saves in the
browser; the online tests use a pretend Supabase (`mockSupabase` in `helpers.js`).

## Run them on your computer

You need Node.js 20 or newer and Python 3.

```bash
cd tests
npm ci
npx playwright install chromium   # once
npx playwright test               # all 40, under a minute
npx playwright test war           # just the files matching "war"
npx playwright test --ui          # watch them run, step by step
```

The tests start their own copy of the site on http://localhost:8765 (Python's web server).

## What's covered

| File | What it checks |
|---|---|
| `smoke.spec.js` | Every page opens with no errors and no sideways scrolling, on a desktop, a phone and a 320px phone |
| `a11y.spec.js` | No accessibility problems on the main pages and the list dialogs |
| `livery.spec.js` | Making a ledger and adding units, planned units, the colours prompt, the delete warning |
| `war.spec.js` | Mustering an army, units not in an army, planned units, list details, unit options, things to check, battles |
| `editors.spec.js` | Livery Ledger's and War Ledger's unit editors follow the same rules and never undo each other's work |
| `backup.spec.js` | Downloading everything and restoring it, with lists and battles still linked to their units |
| `online.spec.js` | The online version against the pretend Supabase |
| `nav.spec.js` | The tab bar on phones, the page for unknown addresses, and the link preview picture |
| `data.spec.js` | The datasheet data file: factions (chapters included), detachments, battle sizes, unit sizes |

`helpers.js` has the shared pieces: sample data (`seed`), `open` to move between pages, the pretend
Supabase, and the accessibility check.
