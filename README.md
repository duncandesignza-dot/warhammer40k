# Livery Ledger

Plan how you'll paint a Warhammer 40,000 army. Pick a faction, choose its colours, then track every unit with a photo, weapons, rank colours and paint recipes.

## Files

```
index.html               page shell
css/styles.css           all styles
js/config.js             your Supabase settings (edit this)
js/data/factions.js      factions, datasheets and weapons (generated)
js/data/emblems.js       list of emblem icons (generated)
js/data/presets.js       starting colours and default emblem per faction, colour names
icons/                   770 one-colour faction icons (generated), with their licence
js/art.js                helmet, roundel and pauldron artwork
js/store.js              saving: Supabase, or the browser when not configured
js/app.js                pages: start, colour setup, ledger
supabase-setup.sql       database tables, security rules and photo storage
tools/build_factions.py  rebuilds js/data/factions.js from BSData
tools/build_emblems.py   rebuilds icons/ and js/data/emblems.js from wh40k-icon
```

## Hosting

Upload the whole folder to any static host (GitHub Pages, Netlify, Cloudflare Pages, your own server). There is no build step.

Without Supabase details the app saves to the visitor's browser, which is fine for trying it out.

## Supabase setup

1. Create a project at supabase.com.
2. SQL Editor → New query → paste `supabase-setup.sql` → Run.
3. Project Settings → API: copy the Project URL and the anon public key into `js/config.js`.
4. Authentication → URL Configuration: set Site URL to your hosted address.
5. Optional: Authentication → Providers → Email → turn off "Confirm email" if you want accounts to work without a confirmation email.

Each account sees only its own ledgers. To let anyone with a link view ledgers read-only, remove the dashes in front of the two "public read" lines in the SQL file and run it again.

## Updating unit data

Unit names, battlefield roles and weapon names come from the community BattleScribe data repository for 11th edition, [BSData/wh40k-11e](https://github.com/BSData/wh40k-11e). To refresh after a new codex or balance update:

```
git clone --depth 1 https://github.com/BSData/wh40k-11e bsdata
python3 tools/build_factions.py bsdata
```

That rewrites `js/data/factions.js`. Units marked Legends or Crucible in the data are listed separately under "Legends and other".

## Emblem icons

The emblems come from [wh40k-icon](https://github.com/Certseeds/wh40k-icon) (the maintained successor of Warhammer40kGroup/wh40k-icon) by shitake, farvig, 夜行漫记 and Certseeds. They are licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/):

- keep the credit on the start page and in `icons/LICENSE.md`
- non-commercial use only (no ads, paid access or selling the site)
- the recoloured icons in `icons/` are shared under the same licence

The build script turns each icon into a single-colour shape so it can take your emblem colour; lighter parts of an icon show the pauldron colour through. A few multi-colour icons lose some detail this way. To refresh the icons:

```
git clone --depth 1 https://github.com/Certseeds/wh40k-icon wh40k-icon
python3 tools/build_emblems.py wh40k-icon
```

Icons load from the `icons/` folder, so open the site through a web server (any host, or `python3 -m http.server` locally). Opened straight from disk as a file, the icons won't show and the simple shapes still work.

Warhammer 40,000, faction names and their symbols are trademarks of Games Workshop. This is an unofficial, non-commercial fan tool.
