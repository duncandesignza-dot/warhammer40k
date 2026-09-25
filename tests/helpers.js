// Shared test setup: a page that fails the test on any error, never reaches the internet (so it can
// never touch the real Supabase database), sample data, a pretend Supabase, and an accessibility check.
const base = require("@playwright/test");
const fs = require("fs");

const AXE = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const test = base.test.extend({
  errors: async ({}, use) => { await use([]); },
  page: async ({page, errors}, use) => {
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if(m.type() === "error" && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(m.text()); });
    // Everything off this machine is blocked. With the Supabase library blocked the app saves in the
    // browser instead. Tests that need the online version use mockSupabase(), which is set up after this.
    await page.route(/^https?:\/\/(?!localhost[:/])/, r => r.abort());
    await use(page);
    base.expect(errors, "errors in the page").toEqual([]);
  },
});
const expect = base.expect;

// Two armies, six units, a list and three battles, saved in the browser like a real user's data.
async function seed(page, extra){
  await page.goto("/#/");
  await page.waitForFunction(() => window.LEDGER_PRESETS);
  await page.evaluate(extra => {
    const scheme = window.LEDGER_PRESETS.presetFor("ultramarines"); scheme.limit = 2000; scheme.rec = {w: 1, l: 1, d: 0};
    const u = (id, name, role, count, points, painted, stages, more) => ({id, armyId: "a1", name, datasheet: name, role, count, points, painted, stages, updatedAt: "2026-09-01", ...(more || {})});
    const db = {
      armies: [
        {id: "a1", faction: "ultramarines", name: "Ultramarines 2nd Company", scheme, public: false, createdAt: "2026-01-01", updatedAt: "2026-01-01"},
        {id: "a2", faction: "tyranids", name: "Hive Fleet Leviathan", scheme: {...window.LEDGER_PRESETS.presetFor("tyranids"), wonly: true, rec: {w: 0, l: 0, d: 1}}, public: false, createdAt: "2026-01-02", updatedAt: "2026-01-02"}],
      units: [
        u("u1", "Captain", "Character", 1, 80, 1, ["built", "primed", "base", "shade", "highlight", "basing"]),
        u("u2", "Intercessor Squad", "Battleline", 10, 150, 6, ["built", "primed", "base"]),
        u("u3", "Terminator Squad", "Infantry", 5, 160, 0, ["built", "primed"]),
        u("u4", "Redemptor Dreadnought", "Vehicle", 1, 195, 0, []),
        {...u("u5", "Termagants", "Battleline", 20, 110, 0, ["built"]), armyId: "a2"},
        {...u("u6", "Hive Tyrant", "Character", 1, 215, 1, ["built", "primed", "base"]), armyId: "a2"}],
      lists: [{id: "l1", armyId: "a1", name: "Club night", limit: 2000, size: "strike", detachments: ["Gladius Task Force"], status: "draft", notes: "",
        units: [{u: "u1", k: "a"}, {u: "u2", k: "b"}, {u: "u4", k: "c"}, {n: "Gladiator Lancer", sheet: "Gladiator Lancer", role: "Vehicle", count: 1, points: 160, k: "d"}], createdAt: "2026-09-01", updatedAt: "2026-09-01"}],
      games: [
        {id: "g1", armyId: "a1", listId: "l1", date: "2026-09-20", opp: "necrons", oppName: "Sam", mission: "Take and Hold", result: "w", us: 85, them: 62, mvp: "u1", notes: ""},
        {id: "g2", armyId: "a1", listId: "", date: "2026-09-10", opp: "orks", oppName: "", mission: "", result: "l", us: 40, them: 70, mvp: "", notes: ""},
        {id: "g3", armyId: "a2", listId: "", date: "2026-08-30", opp: "tau-empire", oppName: "", mission: "", result: "d", us: null, them: null, mvp: "", notes: ""}]};
    if(extra) new Function("db", extra)(db);
    localStorage.setItem("livery-ledger-v3", JSON.stringify(db));
  }, extra ? String(extra) : "");
  await page.reload();
  await page.waitForFunction(() => window.LEDGER_PRESETS);
}
// Read the browser's saved data.
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("livery-ledger-v3")));

// A pretend Supabase client with an in-memory database (window.__db), used instead of the real library.
function supabaseMock(){
  window.supabase = {createClient(){
    const listeners = []; const user = {id: "u1", email: "player@example.com", created_at: "2025-03-02T00:00:00Z", user_metadata: {}, identities: [{}]};
    let session = window.__startSession ? {user} : null;
    const chain = t => {
      const f = []; let op = null, payload = null;
      const rows = () => (window.__db[t] = window.__db[t] || []);
      const match = r => f.every(([c, v]) => String(r[c]) === String(v));
      const exec = () => {
        if(window.__noWar && (t === "lists" || t === "games")) return {data: null, error: {code: "PGRST205", message: "Could not find the table"}};
        if(op === "insert"){ const arr = (Array.isArray(payload) ? payload : [payload]).map(p => ({id: "x" + Math.random().toString(36).slice(2), owner: "u1", created_at: new Date().toISOString(), ...JSON.parse(JSON.stringify(p))})); rows().push(...arr); return {data: arr, error: null}; }
        if(op === "update"){ const hit = rows().filter(match); hit.forEach(r => Object.assign(r, JSON.parse(JSON.stringify(payload)))); return {data: hit, error: null}; }
        if(op === "delete"){ window.__db[t] = rows().filter(r => !match(r)); return {data: null, error: null}; }
        return {data: rows().filter(match), error: null};
      };
      const h = {get(_, k){
        if(k === "then"){ const p = Promise.resolve(exec()); return p.then.bind(p); }
        if(k === "single" || k === "maybeSingle") return () => { const r = exec(); return Promise.resolve(r.error ? r : {data: Array.isArray(r.data) ? r.data[0] || null : r.data, error: null}); };
        if(k === "eq") return (c, v) => { f.push([c, v]); return px; };
        if(k === "insert" || k === "update" || k === "upsert") return p => { op = k === "update" ? "update" : "insert"; payload = p; return px; };
        if(k === "delete") return () => { op = "delete"; return px; };
        return () => px;
      }};
      const px = new Proxy({}, h); return px;
    };
    const fire = ev => listeners.forEach(cb => cb(ev, session));
    return {auth: {
      onAuthStateChange(cb){ listeners.push(cb); setTimeout(() => cb("INITIAL_SESSION", session), 10); return {data: {subscription: {unsubscribe(){}}}}; },
      async signInWithPassword({password}){ if(password !== "secret1") return {error: {message: "Invalid login credentials"}}; session = {user}; fire("SIGNED_IN"); return {error: null}; },
      async signUp(){ return {data: {user: {...user, identities: [{}]}, session: null}, error: null}; },
      async signOut(){ session = null; fire("SIGNED_OUT"); return {}; },
      async resetPasswordForEmail(){ return {error: null}; },
      async updateUser(u){ window.__upd = u; return {data: {user}, error: null}; }
    }, from: t => chain(t), storage: {from: () => ({getPublicUrl: () => ({data: {publicUrl: ""}}), remove: async () => ({}),
      upload: async p => { (window.__uploads = window.__uploads || []).push(p); return {data: {path: p}, error: null}; }})}};
  }};
}
// Use the pretend Supabase for this page. db is the starting database; signedIn starts with a session.
async function mockSupabase(page, {db = {}, signedIn = true, noWar = false} = {}){
  await page.route("**/js/config.js", r => r.fulfill({contentType: "text/javascript", body: "window.LEDGER_CONFIG={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'test'}"}));
  await page.route(/supabase-js/, r => r.fulfill({contentType: "text/javascript", body: `(${supabaseMock})();`}));
  await page.addInitScript(({db, signedIn, noWar}) => {
    window.__db = {armies: [], units: [], likes: [], follows: [], lists: [], games: [], kits: [], recipes: [], ...db};
    window.__startSession = signedIn; window.__noWar = noWar;
  }, {db, signedIn, noWar});
}

// Accessibility problems on the page (or inside one element), as short strings.
async function axe(page, selector){
  // Scan once things have finished fading in, or half-faded text reads as low contrast.
  await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== "running" || (a.effect && a.effect.getTiming().iterations === Infinity)));
  await page.addScriptTag({content: AXE});
  return page.evaluate(async sel => (await window.axe.run(sel ? document.querySelector(sel) : document, {
    runOnly: {type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"]}, rules: {region: {enabled: false}}
  })).violations.map(v => `${v.id}: ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`), selector || null);
}
// Go to a page inside the app and wait until it has replaced the one before (the page doesn't reload
// when only the part after # changes, so an old heading could otherwise still be on screen).
async function open(page, route){
  if(!(await page.evaluate(() => !!document.getElementById("app")))){ await page.goto("/" + route); await page.waitForLoadState("networkidle"); return; }
  await page.evaluate(() => { const m = document.createElement("i"); m.id = "__stale"; m.hidden = true; document.getElementById("app").appendChild(m); });
  const same = await page.evaluate(r => (location.hash || "#/") === r, route);
  if(same) await page.reload(); else await page.goto("/" + route);
  await page.waitForFunction(() => document.getElementById("app") && !document.getElementById("__stale"));
  await page.waitForLoadState("networkidle");
}
const noSidewaysScroll = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

module.exports = {test, expect, seed, saved, open, mockSupabase, axe, noSidewaysScroll};
