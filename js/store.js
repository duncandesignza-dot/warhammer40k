/* Storage: Supabase when configured, otherwise this browser (localStorage). */
(function(){
  "use strict";
  const CFG = window.LEDGER_CONFIG || {};
  const PIC_BASE = CFG.SUPABASE_URL ? String(CFG.SUPABASE_URL).replace(/\/+$/, "") + "/storage/v1/object/public/" : "";

  const FIELDS = ["datasheet","role","name","count","status","tier","head","helmet","skin","lens","hdetail","noHelmet",
    "armour","lpauldron","lpsecondary","lpemblem","rpauldron","rpsecondary","rpemblem","secondary","trim","emblem","shape","cloth","metal","extras","melee","ranged","paints","notes","points","painted"];
  const STAGES = [["built","Built"],["primed","Primed"],["base","Basecoat"],["shade","Shade"],["highlight","Highlight"],["basing","Basing"],["varnish","Varnish"]];
  const STAGE_KEYS = STAGES.map(s => s[0]);
  const STAGES_FOR_STATUS = {unbuilt:[], built:["built"], primed:["built","primed"], progress:["built","primed","base"], done:STAGE_KEYS.slice()};
  function deriveStatus(stages, painted, count){
    if(count > 0 && painted >= count) return "done";
    if(painted > 0 || stages.some(k => STAGE_KEYS.indexOf(k) >= 2)) return "progress";
    if(stages.includes("primed")) return "primed";
    if(stages.includes("built")) return "built";
    return "unbuilt";
  }
  const MAX_PHOTOS = 12;
  // A photo kept in this browser's photo store (IndexedDB) rather than inside the saved data.
  const IDB_REF = /^idb:[\w-]{1,60}$/;
  const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };
  function cleanLog(list){
    const m = new Map();
    (Array.isArray(list) ? list : []).forEach(e => { if(e && /^\d{4}-\d\d-\d\d$/.test(e.d)){ const n = Math.max(0, Math.min(999, parseInt(e.n, 10) || 0)); if(n) m.set(e.d, Math.min(999, (m.get(e.d) || 0) + n)); } });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-240).map(([d, n]) => ({d, n}));
  }
  // Painting time: minutes per day, e.g. [{d: "2026-09-24", m: 95}].
  function cleanTlog(list){
    const m = new Map();
    (Array.isArray(list) ? list : []).forEach(e => { if(e && /^\d{4}-\d\d-\d\d$/.test(e.d)){ const n = Math.max(0, Math.min(1440, parseInt(e.m, 10) || 0)); if(n) m.set(e.d, Math.min(1440, (m.get(e.d) || 0) + n)); } });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-400).map(([d, n]) => ({d, m: n}));
  }
  // An existing unit that gains painted models logs them today; taking some back (a mistake or an undo) removes them from today.
  function nextLog(prev, u){
    if(!prev) return u.log;   // new, imported or duplicated units aren't painting activity
    const log = cleanLog(prev.log), was = Math.min(+prev.count || 0, +prev.painted || 0);
    const cnt = Math.min(99, Math.max(1, parseInt(u.count, 10) || 1)), now = Math.min(cnt, Math.max(0, parseInt(u.painted, 10) || 0));
    const delta = now - was, d = today();
    if(!delta) return log;
    const last = log[log.length - 1];
    if(delta > 0){ if(last && last.d === d) last.n += delta; else log.push({d, n: delta}); }
    else if(last && last.d === d){ last.n = Math.max(0, last.n + delta); }
    return cleanLog(log);
  }
  const STATUS = {unbuilt:"Unbuilt",built:"Built",primed:"Primed",progress:"In progress",done:"Painted"};
  const HEX = /^#[0-9a-f]{6}$/i;
  const COLOR_FIELDS = ["helmet","skin","lens","armour","lpauldron","lpsecondary","lpemblem","rpauldron","rpsecondary","rpemblem","secondary","trim","emblem","cloth","metal"];

  // Paint chosen for each colour area, e.g. {armour: "Citadel Abaddon Black"}. The colour itself stays in the hex fields.
  const SLOT_KEYS = ["helmet","skin","lens","armour","lpauldron","lpsecondary","lpemblem","rpauldron","rpsecondary","rpemblem","secondary","trim","emblem","cloth","metal"];
  function cleanSlotPaints(m){
    const o = {};
    if(m && typeof m === "object") SLOT_KEYS.forEach(k => { const v = String(m[k] || "").trim().slice(0, 90); if(v) o[k] = v; });
    return o;
  }

  // Extra paint areas added to an army or unit, e.g. {"d:leather": {hex, paint}}; "d:" = cloth & details, "w:" = weapons.
  function cleanXareas(m){
    const o = {};
    if(m && typeof m === "object") Object.keys(m).filter(k => /^[dw]:[a-z0-9-]{1,30}$/.test(k)).slice(0, 40).forEach(k => {
      const v = m[k] || {};
      if(HEX.test(v.hex)) o[k] = {hex: v.hex, paint: String(v.paint || "").trim().slice(0, 90)};
    });
    return o;
  }

  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  function cleanUnit(r){
    const o = {};
    FIELDS.forEach(f => { o[f] = r[f] == null ? "" : String(r[f]).slice(0, 600); });
    o.count = Math.min(99, Math.max(1, parseInt(r.count, 10) || 1));
    o.points = Math.min(9999, Math.max(0, parseInt(r.points, 10) || 0));
    // painting stages: older saves only had a status, so work the stages out from it
    const oldStatus = STATUS[r.status] ? r.status : "unbuilt";
    o.stages = Array.isArray(r.stages) ? STAGE_KEYS.filter(k => r.stages.includes(k)) : STAGES_FOR_STATUS[oldStatus].slice();
    const p = parseInt(r.painted, 10);
    o.painted = Math.min(o.count, Math.max(0, Number.isFinite(p) ? p : (oldStatus === "done" ? o.count : 0)));
    o.tier = Math.max(0, parseInt(r.tier, 10) || 0);
    // head: "helmet", "bare" (face showing, e.g. face paint) or "none" (vehicles, monsters). Older saves used noHelmet.
    const oldBare = r.noHelmet === true || r.noHelmet === "true";
    o.head = ["helmet", "bare", "none"].includes(r.head) ? r.head : (oldBare ? "bare" : "helmet");
    o.noHelmet = o.head === "bare";
    o.status = deriveStatus(o.stages, o.painted, o.count);
    o.recipes = Array.isArray(r.recipes) ? [...new Set(r.recipes.map(x => String(x).slice(0, 40)))].slice(0, 20) : [];
    COLOR_FIELDS.forEach(f => { if(!HEX.test(o[f])) o[f] = ""; });
    o.slotPaints = cleanSlotPaints(r.slotPaints);
    // Each pauldron painted in its own colours (Space Marines); off means both follow the armour.
    o.splitPauldrons = r.splitPauldrons === true || r.splitPauldrons === "true";
    // null = not set on this unit yet, so it shows the army's extra areas.
    o.xareas = r.xareas && typeof r.xareas === "object" ? cleanXareas(r.xareas) : null;
    // Starred: shown with a star and kept together by the "Starred" filter.
    o.fav = r.fav === true || r.fav === "true";
    // Painting history: models painted per day, e.g. [{d: "2026-09-24", n: 3}].
    o.log = cleanLog(r.log);
    o.tlog = cleanTlog(r.tlog);
    // Extra photos (the gallery): storage paths online, small data URLs when saving in this browser.
    o.photos = (Array.isArray(r.photos) ? r.photos : []).filter(x => typeof x === "string" && (/^data:image\/(jpeg|png|webp);base64,/.test(x) || /^[\w-]+\/[\w-]+\/[\w-]+\.jpg$/.test(x) || IDB_REF.test(x))).slice(0, MAX_PHOTOS);
    // War Ledger: models built (null = follow the Built stage), a battle-ready override (null = follow
    // the Battle Ready setting), and where and when the unit was bought.
    const cnt = (v, max) => v === null || v === undefined || v === "" ? null : Math.min(max, Math.max(0, parseInt(v, 10) || 0));
    o.built = cnt(r.built, o.count);
    o.ready = cnt(r.ready, o.count);
    o.bought = /^\d{4}-\d{2}-\d{2}$/.test(r.bought || "") ? r.bought : "";
    o.price = Math.min(1e6, Math.max(0, Math.round((parseFloat(r.price) || 0) * 100) / 100));
    o.shop = String(r.shop || "").slice(0, 80);
    o.assembly = String(r.assembly || "").slice(0, 600);
    // Planned: in your plans but not bought yet. It's never battle ready and isn't counted as owned.
    o.own = r.own === "planned" ? "planned" : "owned";
    if(!o.name) o.name = o.datasheet || "Unnamed unit";
    return o;
  }
  // at: when the recipe was last saved, so the newest copy wins between ledgers and the library.
  function cleanRecipe(r){
    return {
      id: String(r.id).slice(0, 40),
      name: String(r.name || "Recipe").slice(0, 60),
      area: String(r.area || "").slice(0, 30),
      notes: String(r.notes || "").slice(0, 300),
      steps: (Array.isArray(r.steps) ? r.steps : []).slice(0, 20).map(st => ({t: String((st && st.t) || "").slice(0, 30), p: String((st && st.p) || "").slice(0, 90)})).filter(st => st.p || st.t),
      at: /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(r.at) ? r.at : ""
    };
  }
  // Recipe library entries: a recipe, or a deleted marker so other ledgers don't bring it back.
  const cleanLibrary = list => (Array.isArray(list) ? list : []).filter(r => r && r.id).slice(0, 400).map(r => ({...cleanRecipe(r), deleted: r.deleted === true}));
  function cleanScheme(s){
    s = s || {};
    const colors = {};
    ["armour","secondary","trim","emblem","lens","cloth","metal"].forEach(k => { colors[k] = HEX.test((s.colors||{})[k]) ? s.colors[k] : "#1f1f22"; });
    // Skin came later: leave it out when missing so the app can use the faction's starting skin.
    if(HEX.test((s.colors||{}).skin)) colors.skin = s.colors.skin;
    // Separate pauldron colours (Space Marines) are optional too: missing means "same as the armour".
    ["lpauldron","lpsecondary","lpemblem","rpauldron","rpsecondary","rpemblem"].forEach(k => { if(HEX.test((s.colors||{})[k])) colors[k] = s.colors[k]; });
    const tiers = (Array.isArray(s.tiers) ? s.tiers : []).slice(0, 8).map(t => ({
      name: String((t && t.name) || "Tier").slice(0, 40),
      note: String((t && t.note) || "").slice(0, 80),
      color: HEX.test(t && t.color) ? t.color : "#1f1f22",
      paint: String((t && t.paint) || "").trim().slice(0, 90)
    }));
    const limit = Math.min(20000, Math.max(0, parseInt(s.limit, 10) || 0));
    const recipes = (Array.isArray(s.recipes) ? s.recipes : []).slice(0, 60).filter(r => r && r.id).map(cleanRecipe);
    // by: the owner's display name, shown on the Shared armies page (never their email).
    const by = String(s.by || "").replace(/\s+/g, " ").trim().slice(0, 40);
    // byPic: the owner's profile picture, only ever a public image from this site's own storage.
    const byPic = typeof s.byPic === "string" && s.byPic.length < 600 && PIC_BASE && s.byPic.startsWith(PIC_BASE) && !/["'<>\s]/.test(s.byPic) ? s.byPic : "";
    // wonly: made in War Ledger, so the colours were never chosen. rec: the army's battle record, kept
    // on the army so Shared armies can show it.
    const n = v => Math.min(9999, Math.max(0, parseInt(v, 10) || 0)), rc = s.rec && typeof s.rec === "object" ? s.rec : {};
    const rec = {w: n(rc.w), l: n(rc.l), d: n(rc.d)};
    // pool: the hidden holder for units in your collection that aren't in an army yet (one per faction).
    return {style: s.style === "roundel" ? "roundel" : "astartes", by, byPic, wonly: s.wonly === true, pool: s.pool === true, rec, limit, recipes, colors, slotPaints: cleanSlotPaints(s.slotPaints), splitPauldrons: s.splitPauldrons === true, xareas: cleanXareas(s.xareas), shape: String(s.shape || "cross").slice(0, 160), tiers: tiers.length ? tiers : [{name:"Line", note:"", color:colors.armour}]};
  }
  const cleanPaints = list => [...new Set((Array.isArray(list) ? list : []).map(p => String(p).trim().slice(0, 90)).filter(Boolean))].slice(0, 600);
  const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : new Date().toISOString().slice(0, 10);
  const int = (v, lo, hi) => Math.min(hi, Math.max(lo, parseInt(v, 10) || 0));
  // An army list: units picked from the collection ({u: unit id}), or units you don't own yet ({n, sheet, ...}).
  // Each entry has a key (k) so leaders can point at the unit they lead; warlord, enhancement and a
  // points override (pts) are only stored when set. Nothing here checks the rules: that's left to the player.
  const slug = v => /^[a-z0-9-]{1,24}$/.test(v || "") ? v : "";
  const LIST_STATUS = ["draft", "theory", "tournament", "narrative", "archived"];
  const CR_HONOURS = ["trait", "weapon", "relic", "other"];
  const key = v => /^[\w-]{1,24}$/.test(v || "") ? v : "";
  function cleanList(l){
    l = l || {};
    const seen = new Set();
    const units = (Array.isArray(l.units) ? l.units : []).slice(0, 200).map((e, i) => {
      if(!e || typeof e !== "object") return null;
      let row;
      if(e.u) row = {u: String(e.u).slice(0, 60)};
      else {
        const n = String(e.n || e.sheet || "").trim().slice(0, 80);
        if(!n) return null;
        row = {n, sheet: String(e.sheet || "").slice(0, 80), role: String(e.role || "").slice(0, 40), count: int(e.count, 1, 99) || 1, points: int(e.points, 0, 9999)};
        // Wargear for a unit that's only in the list (a unit from the collection has its own).
        const gear = String(e.gear || "").trim().slice(0, 600); if(gear) row.gear = gear;
      }
      let k = /^[\w-]{1,24}$/.test(e.k || "") ? e.k : "e" + i;
      while(seen.has(k)) k += "x";
      seen.add(k); row.k = k;
      if(e.warlord === true) row.warlord = true;
      const en = e.enh && typeof e.enh === "object" ? String(e.enh.n || "").trim().slice(0, 80) : "";
      if(en) row.enh = {n: en, p: int(e.enh.p, 0, 999)};
      if(e.lead && /^[\w-]{1,24}$/.test(e.lead)) row.lead = e.lead;
      if(e.u && e.pts !== null && e.pts !== undefined && e.pts !== "") row.pts = int(e.pts, 0, 9999);
      // Crusade: experience added by hand (battles add their own), battle honours and scars, a crusade
      // points adjustment and notes. Only stored when set.
      const xp = int(e.xp, -999, 999); if(xp) row.xp = xp;
      const hon = (Array.isArray(e.hon) ? e.hon : []).map(h => h && typeof h === "object" ? {t: CR_HONOURS.includes(h.t) ? h.t : "other", n: String(h.n || "").trim().slice(0, 80)} : null).filter(h => h && h.n).slice(0, 20);
      if(hon.length) row.hon = hon;
      const scar = (Array.isArray(e.scar) ? e.scar : []).map(x => String(x || "").trim().slice(0, 80)).filter(Boolean).slice(0, 20);
      if(scar.length) row.scar = scar;
      const cpx = int(e.cpx, -99, 99); if(cpx) row.cpx = cpx;
      const cnote = String(e.cnote || "").trim().slice(0, 400); if(cnote) row.cnote = cnote;
      return row;
    }).filter(Boolean);
    // Leaders only point at units still in the list.
    units.forEach(r => { if(r.lead && (r.lead === r.k || !seen.has(r.lead))) delete r.lead; });
    const dets = (Array.isArray(l.detachments) ? l.detachments : [l.detachment]).map(d => String(d || "").trim().slice(0, 80)).filter(Boolean).slice(0, 4);
    return {armyId: String(l.armyId || "").slice(0, 60), name: String(l.name || "Army list").trim().slice(0, 80) || "Army list",
      limit: int(l.limit, 0, 20000), size: slug(l.size), detachments: dets, detachment: dets.join(" + "),
      status: LIST_STATUS.includes(l.status) ? l.status : "draft", ptsAsOf: /^\d{4}-\d{2}-\d{2}$/.test(l.ptsAsOf || "") ? l.ptsAsOf : "",
      notes: String(l.notes || "").slice(0, 600), units,
      // from: the list this one was copied from, so Compare can start with the two.
      from: /^[\w-]{1,60}$/.test(l.from || "") ? l.from : "",
      // A Crusade force (an Order of Battle) rather than a list for one game. rp: requisition points
      // added or spent by hand; each battle logged with the force adds one on top.
      kind: l.kind === "crusade" ? "crusade" : "", rp: int(l.rp, -99, 999),
      // "Things to check" the player has looked at and hidden for this list.
      ignored: [...new Set((Array.isArray(l.ignored) ? l.ignored : []).map(x => String(x).slice(0, 120)).filter(Boolean))].slice(0, 60)};
  }
  // A battle: when, with which list, against whom, and how it went.
  function cleanGame(g){
    g = g || {};
    const score = v => v === null || v === undefined || v === "" ? null : int(v, 0, 999);
    return {armyId: String(g.armyId || "").slice(0, 60), listId: String(g.listId || "").slice(0, 60), date: day(g.date),
      opp: String(g.opp || "").slice(0, 60), oppName: String(g.oppName || "").slice(0, 60), mission: String(g.mission || "").slice(0, 80),
      result: ["w", "l", "d"].includes(g.result) ? g.result : "w", us: score(g.us), them: score(g.them),
      mvp: String(g.mvp || "").slice(0, 60), notes: String(g.notes || "").slice(0, 1000),
      // Crusade: the units (list entry keys) that took part, and the one Marked for Greatness.
      took: [...new Set((Array.isArray(g.took) ? g.took : []).map(key).filter(Boolean))].slice(0, 200), mfg: key(g.mfg),
      // A friend tagged as the opponent (online only): their account id and name. by* says who logged it,
      // so the friend can see it; mirror is the friend's battle this one was added from.
      oppUser: /^[\w-]{1,60}$/.test(g.oppUser || "") ? g.oppUser : "", oppUserName: String(g.oppUserName || "").slice(0, 40),
      byName: String(g.byName || "").slice(0, 40), byArmy: String(g.byArmy || "").slice(0, 80), byFaction: String(g.byFaction || "").slice(0, 60),
      mirror: /^[\w-]{1,60}$/.test(g.mirror || "") ? g.mirror : ""};
  }
  function cleanArmy(a){
    return {faction: String(a.faction || "").slice(0, 60), name: String(a.name || "My army").slice(0, 80), scheme: cleanScheme(a.scheme), public: a.public === true};
  }

  /* ---------- images ---------- */
  // square: crop the middle of the photo to a square first (profile pictures).
  async function resizeImage(file, max, quality, square){
    if(!/^image\//.test(file.type)) throw Object.assign(new Error("That file isn't an image."), {code:"type"});
    let src;
    try { src = await createImageBitmap(file); }
    catch(e){
      src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Object.assign(new Error("That photo couldn't be read. Try a JPG or PNG."), {code:"type"})); i.src = URL.createObjectURL(file); });
    }
    const side = Math.min(src.width, src.height);
    const sw = square ? side : src.width, sh = square ? side : src.height;
    const sx = square ? (src.width - side) / 2 : 0, sy = square ? (src.height - side) / 2 : 0;
    const k = Math.min(1, max / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("Couldn't process that photo.")), "image/jpeg", quality));
  }
  const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const dataURLToBlob = async u => (await fetch(u)).blob();

  /* ============================================================
     Browser storage
     ============================================================ */
  /* Photos saved in this browser live in IndexedDB, which has far more room than localStorage (about 5 MB,
     shared with everything else). The saved data only keeps "idb:<id>". If IndexedDB can't be used,
     photos stay inside the saved data as before. */
  function PhotoDB(){
    let db = null;
    const urls = new Map(), refs = new Map();   // id -> object URL, object URL -> "idb:<id>"
    const tx = (mode, fn) => new Promise((res, rej) => { const t = db.transaction("p", mode), r = fn(t.objectStore("p")); t.oncomplete = () => res(r && r.result); t.onerror = t.onabort = () => rej(t.error || new Error("Photo store failed")); });
    const show = (id, blob) => { const u = URL.createObjectURL(blob); urls.set(id, u); refs.set(u, "idb:" + id); return u; };
    return {
      get ok(){ return !!db; },
      async open(){
        if(!window.indexedDB) return false;
        try {
          db = await new Promise((res, rej) => { const r = indexedDB.open("livery-photos", 1); r.onupgradeneeded = () => r.result.createObjectStore("p"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
          await new Promise((res, rej) => { const t = db.transaction("p", "readonly"), c = t.objectStore("p").openCursor(); c.onsuccess = () => { const k = c.result; if(!k) return; show(String(k.key), k.value); k.continue(); }; t.oncomplete = res; t.onerror = () => rej(t.error); });
          return true;
        } catch(e){ console.warn("Photo store unavailable; keeping photos in saved data", e); db = null; return false; }
      },
      async put(blob){
        const id = newId();
        try { await tx("readwrite", st => st.put(blob, id)); }
        catch(e){ throw Object.assign(new Error("This browser is out of space for photos. Remove some photos or connect Supabase."), {code: "quota"}); }
        show(id, blob); return "idb:" + id;
      },
      remove(ref){
        if(!IDB_REF.test(ref || "") || !db) return;
        const id = ref.slice(4), u = urls.get(id);
        if(u){ URL.revokeObjectURL(u); urls.delete(id); refs.delete(u); }
        tx("readwrite", st => st.delete(id)).catch(() => {});
      },
      clear(){ if(db) tx("readwrite", st => st.clear()).catch(() => {}); urls.forEach(u => URL.revokeObjectURL(u)); urls.clear(); refs.clear(); },
      url: ref => IDB_REF.test(ref || "") ? urls.get(ref.slice(4)) || "" : ref || "",
      ref: v => refs.get(v) || v
    };
  }
  function LocalStore(){
    const KEY = "livery-ledger-v3";
    let ok = true;
    let db = {armies: [], units: [], lists: [], games: []};

    function load(){
      try {
        const v = JSON.parse(localStorage.getItem(KEY) || "null");
        if(v && Array.isArray(v.armies) && Array.isArray(v.units)){ db = {lists: [], games: [], ...v}; return; }
        migrateOld();
      } catch(e){ ok = false; }
    }
    // Bring over units from the earlier single-army Black Templars page.
    function migrateOld(){
      let old = null;
      try { old = JSON.parse(localStorage.getItem("crusade-livery-units-v2") || localStorage.getItem("crusade-livery-units-v1") || "null"); } catch(e){}
      if(!Array.isArray(old) || !old.length) return;
      const P = window.LEDGER_PRESETS, preset = P.presetFor("black-templars");
      const army = {id: newId(), faction: "black-templars", name: "Black Templars Crusade", scheme: preset, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()};
      const NAMED = {Black:"#1f1f22",White:"#efeee9",Red:"#b3141c",Bone:"#d8cba8",Silver:"#a9adb3",Gold:"#c9a13b",Green:"#3fbf5a",Blue:"#3b8fe0",Yellow:"#e8c33a"};
      const TIER = {Neophyte:0, Initiate:0, "Sword Brother":1, Leader:2, Champion:2, Chaplain:3, Vehicle:0};
      db.armies.push(army);
      old.forEach(o => {
        db.units.push({...cleanUnit({
          datasheet: o.type || "", name: o.name, count: o.count, status: o.status, tier: TIER[o.rank] || 0,
          helmet: NAMED[o.helmet] || "", noHelmet: o.helmet === "No helmet", lens: NAMED[o.eyes] || "", hdetail: o.hdetail,
          armour: NAMED[o.pauld] || NAMED[o.armour] || "", secondary: "", trim: NAMED[o.trim] || "", emblem: NAMED[o.emblem] || "", shape: "cross",
          cloth: NAMED[o.robe] || "", metal: NAMED[o.wcase] || "", extras: o.extras, melee: o.melee, ranged: o.ranged, paints: o.paints, notes: o.notes
        }), id: o.id || newId(), armyId: army.id, image: typeof o.image === "string" ? o.image : "", updatedAt: o.updatedAt || new Date().toISOString()});
      });
      save();
    }
    // If the browser won't take the change, go back to what was last saved, so nothing shows as
    // saved on screen that would be gone after a reload. When storage couldn't be read at all,
    // changes are kept for this visit only (the banner says so) and never written over it.
    let last = "";
    // Photos: blobs in IndexedDB (see PhotoDB). Units handed to the app carry a showable address for the main
    // photo; extra photos stay as "idb:<id>" and are shown through photoUrl().
    const pics = PhotoDB();
    const out = u => ({...u, ...cleanUnit(u), image: pics.url(u.image)});
    const unitPics = u => [u.image, ...(u.photos || [])].map(pics.ref).filter(p => IDB_REF.test(p || ""));
    const keepPhoto = async blob => pics.ok ? pics.put(blob) : blobToDataURL(blob);
    // Photos saved inside the data by older versions move to the photo store, freeing localStorage.
    async function movePhotos(){
      let moved = 0;
      for(const u of db.units){
        const inline = v => typeof v === "string" && /^data:image\//.test(v);
        try {
          if(inline(u.image)){ u.image = await pics.put(await dataURLToBlob(u.image)); moved++; }
          if((u.photos || []).some(inline)){ u.photos = await Promise.all(u.photos.map(async p => inline(p) ? (moved++, pics.put(await dataURLToBlob(p))) : p)); }
        } catch(e){ console.warn("Couldn't move a photo to the photo store", e); return; }
      }
      if(moved) try { save(); } catch(e){ console.warn("Couldn't save after moving photos", e); }
    }
    function save(){
      if(!ok) return;
      const next = JSON.stringify(db);
      try { localStorage.setItem(KEY, next); last = next; }
      catch(e){ if(last) db = JSON.parse(last); throw Object.assign(new Error("This browser is out of storage space. Remove some photos or connect Supabase."), {code:"quota"}); }
    }
    load(); last = JSON.stringify(db);
    const ready = pics.open().then(on => on && movePhotos()).catch(e => console.warn(e));

    return {
      ready,
      kind: "local", canWrite: true, session: null, canShare: false,
      note(){ return ok ? {cls:"warn", text:"Saved in this browser only. Add your Supabase details in js/config.js to save online."}
                        : {cls:"warn", text:"This browser is blocking storage, so changes will be lost when you close the page."}; },
      async listArmies(){ return db.armies.map(a => ({...a})); },
      async getPaints(){ try { const v = JSON.parse(localStorage.getItem("livery-paints-v1") || "[]"); return Array.isArray(v) ? v : []; } catch(e){ return []; } },
      async setPaints(list){ try { localStorage.setItem("livery-paints-v1", JSON.stringify(cleanPaints(list))); } catch(e){ throw Object.assign(new Error("This browser is blocking storage."), {code:"quota"}); } return cleanPaints(list); },
      async getLibrary(){ try { return cleanLibrary(JSON.parse(localStorage.getItem("livery-recipes-v1") || "[]")); } catch(e){ return []; } },
      async putLibrary(rows){
        const lib = await this.getLibrary(), clean = cleanLibrary(rows), ids = new Set(clean.map(r => r.id));
        try { localStorage.setItem("livery-recipes-v1", JSON.stringify(cleanLibrary(lib.filter(r => !ids.has(r.id)).concat(clean)))); }
        catch(e){ throw Object.assign(new Error("This browser is out of storage space."), {code:"quota"}); }
      },
      async getArmy(id){ const a = db.armies.find(x => x.id === id); return a ? {...a} : null; },
      async summary(){
        const m = {};
        db.units.forEach(u => { const s = m[u.armyId] || (m[u.armyId] = {units:0, models:0, done:0, points:0}); if(u.own === "planned"){ s.planned = (s.planned || 0) + 1; return; } s.units++; s.models += +u.count || 0; s.done += Math.min(+u.count || 0, +u.painted || (u.status === "done" ? +u.count || 0 : 0)); s.points += +u.points || 0; });
        return m;
      },
      async saveArmy(a, id){
        const now = new Date().toISOString();
        const prev = id ? db.armies.find(x => x.id === id) : null;
        const row = {...(prev || {createdAt: now}), ...cleanArmy(a), id: prev ? prev.id : newId(), updatedAt: now};
        db.armies = db.armies.filter(x => x.id !== row.id).concat(row); save(); return {...row};
      },
      async removeArmy(a){
        const gone = db.units.filter(u => u.armyId === a.id);
        db.armies = db.armies.filter(x => x.id !== a.id); db.units = db.units.filter(u => u.armyId !== a.id); db.lists = db.lists.filter(l => l.armyId !== a.id); db.games = db.games.filter(g => g.armyId !== a.id); save();
        gone.forEach(u => unitPics(u).forEach(pics.remove));
      },
      // War Ledger: army lists and battles.
      async listLists(){ return db.lists.map(l => ({...l, ...cleanList(l)})); },
      async saveList(l, id){
        const prev = id ? db.lists.find(x => x.id === id) : null, now = new Date().toISOString();
        const row = {...cleanList(l), id: prev ? prev.id : newId(), createdAt: prev ? prev.createdAt : now, updatedAt: now};
        db.lists = db.lists.filter(x => x.id !== row.id).concat(row); save(); return {...row};
      },
      async removeList(id){ db.lists = db.lists.filter(x => x.id !== id); save(); },
      async listGames(){ return db.games.map(g => ({...g, ...cleanGame(g)})); },
      async saveGame(g, id){
        const prev = id ? db.games.find(x => x.id === id) : null, now = new Date().toISOString();
        const row = {...cleanGame(g), id: prev ? prev.id : newId(), createdAt: prev ? prev.createdAt : now, updatedAt: now};
        db.games = db.games.filter(x => x.id !== row.id).concat(row); save(); return {...row};
      },
      async removeGame(id){ db.games = db.games.filter(x => x.id !== id); save(); },
      async setArmyRecord(army, rec){ const a = db.armies.find(x => x.id === army.id); if(a){ a.scheme = cleanScheme({...a.scheme, rec}); save(); } },
      async listUnits(armyId){ return db.units.filter(u => u.armyId === armyId).map(out); },
      async listAllUnits(){ return db.units.map(out); },
      async listShared(){ return {armies: [], sum: {}}; },
      async communityState(){ return null; },
      async saveUnit(armyId, u, id, photo, remove){
        const prev = id ? db.units.find(x => x.id === id) : null, was = prev ? prev.image || "" : "";
        let image = was;
        if(photo) image = await keepPhoto(await resizeImage(photo.file, 1000, .8));
        else if(remove) image = "";
        const row = {...cleanUnit({...u, log: nextLog(prev, u)}), id: prev ? prev.id : newId(), armyId, image, updatedAt: new Date().toISOString()};
        db.units = db.units.filter(x => x.id !== row.id).concat(row);
        try { save(); } catch(e){ if(image !== was) pics.remove(image); throw e; }
        if(image !== was) pics.remove(was);
        return out(row);
      },
      // keepImage: the photos stay until purgeImage, so Undo can bring the unit back whole.
      async removeUnit(u, keepImage){
        const prev = db.units.find(x => x.id === u.id);
        db.units = db.units.filter(x => x.id !== u.id); save();
        if(prev && !keepImage) unitPics(prev).forEach(pics.remove);
      },
      photoUrl: p => pics.url(p),
      // For backups: a photo as a data URL, so the file still has it after this visit.
      async inlinePhoto(src){ const v = pics.url(src); return /^blob:/.test(v) ? blobToDataURL(await (await fetch(v)).blob()) : v; },
      // "Delete account" when saving in this browser: clear everything this site saved here.
      async deleteAccount(){
        ["livery-ledger-v3", "livery-paints-v1", "livery-recipes-v1", "ll-goal", "ll-settings", "ll-shame", "ll-list-prefs", "ll-detail-open", "ll-roster-group", "ll-coll-group", "ll-mode"].forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
        db = {armies: [], units: [], lists: [], games: []};
        pics.clear();
      },
      async addUnitPhoto(armyId, u, file){
        const ref = await keepPhoto(await resizeImage(file, 900, .78));
        try { return await this.saveUnit(armyId, {...u, photos: [...(u.photos || []), ref]}, u.id, null, false, u); }
        catch(e){ pics.remove(ref); throw e; }
      },
      async removeUnitPhoto(armyId, u, p){ const row = await this.saveUnit(armyId, {...u, photos: (u.photos || []).filter(x => x !== p)}, u.id, null, false, u); pics.remove(p); return row; },
      async restoreUnit(armyId, u){ const row = {...u, armyId, image: pics.ref(u.image || "")}; db.units = db.units.filter(x => x.id !== u.id).concat(row); save(); return out(row); },
      purgeImage(u){ if(!db.units.some(x => x.id === u.id)) unitPics(u).forEach(pics.remove); },
      async importUnits(armyId, rows){
        const now = new Date().toISOString();
        for(const r of rows){
          let image = "";
          if(typeof r.image === "string" && /^data:image\//.test(r.image)) image = pics.ok ? await pics.put(await dataURLToBlob(r.image)) : r.image;
          db.units.push({...cleanUnit(r), id: newId(), armyId, image, updatedAt: now});
        }
        save(); return rows.length;
      }
    };
  }

  /* ============================================================
     Supabase
     ============================================================ */
  function SupaStore(){
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    const A = CFG.ARMIES_TABLE || "armies", U = CFG.UNITS_TABLE || "units", B = CFG.BUCKET || "unit-images", R = CFG.RECIPES_TABLE || "recipes";
    const L = "lists", G = "games";
    // The recipes table is optional (added later): say so plainly when it hasn't been created yet.
    const libErr = error => /PGRST205|42P01/.test(error.code || "") || /could not find the table|does not exist/i.test(error.message || "")
      ? Object.assign(new Error("The recipes table hasn't been set up in Supabase yet."), {code: "nolib"}) : error;
    let session = null;
    const pub = path => path ? sb.storage.from(B).getPublicUrl(path).data.publicUrl : "";
    const toArmy = r => ({id: r.id, owner: r.owner, faction: r.faction, name: r.name, scheme: cleanScheme(r.scheme), public: r.public === true, createdAt: r.created_at, updatedAt: r.updated_at});
    const toUnit = r => ({...cleanUnit(r.data || {}), id: r.id, armyId: r.army_id, owner: r.owner, imagePath: r.image_path || "", image: pub(r.image_path), updatedAt: r.updated_at});
    const need = () => { if(!session) throw Object.assign(new Error("Sign in to save."), {code:"auth"}); };
    async function upload(armyId, blob){
      const path = `${session.user.id}/${armyId}/${newId()}.jpg`;
      const {error} = await sb.storage.from(B).upload(path, blob, {contentType: "image/jpeg", cacheControl: "31536000", upsert: false});
      if(error) throw error;
      return path;
    }
    const mustOk = ({data, error}) => { if(error) throw error; return data; };
    const SUM_COLS = "army_id,data->>status,data->>count,data->>painted,data->>points,data->>own";
    function totals(rows){
      const m = {};
      rows.forEach(r => { const s = m[r.army_id] || (m[r.army_id] = {units:0, models:0, done:0, points:0}); if(r.own === "planned"){ s.planned = (s.planned || 0) + 1; return; } const c = parseInt(r.count, 10) || 1; const p = parseInt(r.painted, 10); s.units++; s.models += c; s.done += Math.min(c, Number.isFinite(p) ? p : (r.status === "done" ? c : 0)); s.points += parseInt(r.points, 10) || 0; });
      return m;
    }
    // War Ledger's tables are added by supabase/features.sql; say so plainly if they're not there yet.
    const warErr = e => tableMissing(e) ? Object.assign(new Error("Army lists and battles aren't set up in Supabase yet. Run supabase/features.sql to add them."), {code: "nowar"}) : e;
    const warOk = ({data, error}) => { if(error) throw warErr(error); return data; };
    const toList = r => ({...cleanList({...(r.data || {}), armyId: r.army_id}), id: r.id, createdAt: r.created_at, updatedAt: r.updated_at});
    const toGame = r => ({...cleanGame({...(r.data || {}), armyId: r.army_id}), id: r.id, createdAt: r.created_at, updatedAt: r.updated_at});
    // by_pic is only shown when it's a picture from this site's own storage.
    const toComment = r => ({id: r.id, armyId: r.army_id, owner: r.owner, body: String(r.body || ""), createdAt: r.created_at,
      byName: String(r.by_name || "").slice(0, 40), byPic: typeof r.by_pic === "string" && PIC_BASE && r.by_pic.startsWith(PIC_BASE) && !/["'<>\s]/.test(r.by_pic) ? r.by_pic : ""});
    const tableMissing = e => /PGRST205|42P01/.test(e.code || "") || /could not find the table|does not exist/i.test(e.message || "");
    let paintsTable = null;   // null: not checked yet; false: owned_paints isn't set up, so paints stay on the account
    const myName = () => String(((session && session.user.user_metadata) || {}).display_name || "").trim();
    const myPic = () => String(((session && session.user.user_metadata) || {}).avatar_url || "");

    return {
      kind: "supabase", client: sb, canShare: true,
      get session(){ return session; },
      get canWrite(){ return !!session; },
      setSession(s){ if(!s || !session || s.user.id !== session.user.id) paintsTable = null; session = s; },
      // Nothing to say when signed in: saving online is the normal case.
      note(){ return session ? null : {cls:"", text:"Viewing only. Sign in to create and edit ledgers."}; },
      /* Paints you own live in the owned_paints table (one row each). Lists saved on the account
         before the table existed are moved over the first time; without the table they stay there. */
      async getPaints(){
        if(!session) return [];
        const old = cleanPaints((session.user.user_metadata || {}).paints);
        const res = await sb.from("owned_paints").select("paints").eq("owner", session.user.id).maybeSingle();
        if(res.error){ if(tableMissing(res.error)){ paintsTable = false; return old; } throw res.error; }
        paintsTable = true;
        const have = cleanPaints(res.data ? res.data.paints : []);
        if(!old.length) return have;
        const merged = cleanPaints(have.concat(old));
        try { await this.setPaints(merged); await this.updateProfile({paints: null}); } catch(e){ console.warn("Couldn't move owned paints", e); }
        return merged;
      },
      async setPaints(list){
        need();
        const paints = cleanPaints(list);
        if(paintsTable !== false){
          const res = await sb.from("owned_paints").upsert({owner: session.user.id, paints, updated_at: new Date().toISOString()}, {onConflict: "owner"});
          if(!res.error){ paintsTable = true; return paints; }
          if(!tableMissing(res.error)) throw res.error;
          paintsTable = false;
        }
        const {data, error} = await sb.auth.updateUser({data: {paints}});
        if(error) throw error;
        if(data && data.user) session = {...session, user: data.user};
        return paints;
      },
      async getLibrary(){
        if(!session) return [];
        const {data, error} = await sb.from(R).select("id,data").eq("owner", session.user.id);
        if(error) throw libErr(error);
        return cleanLibrary((data || []).map(r => ({...(r.data || {}), id: r.id})));
      },
      async putLibrary(rows){
        need();
        const now = new Date().toISOString();
        const payload = cleanLibrary(rows).map(({id, ...data}) => ({owner: session.user.id, id, data, updated_at: now}));
        if(!payload.length) return;
        const {error} = await sb.from(R).upsert(payload, {onConflict: "owner,id"});
        if(error) throw libErr(error);
      },
      async listArmies(){
        if(!session) return [];
        return (mustOk(await sb.from(A).select("*").eq("owner", session.user.id).order("created_at", {ascending: true})) || []).map(toArmy);
      },
      async getArmy(id){ const d = mustOk(await sb.from(A).select("*").eq("id", id).maybeSingle()); return d ? toArmy(d) : null; },
      async summary(){
        if(!session) return {};
        return totals(mustOk(await sb.from(U).select(SUM_COLS).eq("owner", session.user.id)) || []);
      },
      /* Pile of shame kits. null means the kits table hasn't been set up (supabase/features.sql). */
      async listKits(){
        if(!session) return [];
        const {data, error} = await sb.from("kits").select("id,data").eq("owner", session.user.id);
        if(error){ if(/PGRST205|42P01/.test(error.code || "") || /could not find the table|does not exist/i.test(error.message || "")) return null; throw error; }
        return (data || []).map(r => ({...(r.data || {}), id: r.id}));
      },
      async putKits(list){
        need();
        const uid = session.user.id, now = new Date().toISOString();
        if(list.length) mustOk(await sb.from("kits").upsert(list.map(({id, ...data}) => ({owner: uid, id, data, updated_at: now})), {onConflict: "owner,id"}));
        const keep = list.map(k => `"${String(k.id).replace(/"/g, "")}"`).join(",");
        mustOk(list.length ? await sb.from("kits").delete().eq("owner", uid).not("id", "in", `(${keep})`) : await sb.from("kits").delete().eq("owner", uid));
      },
      /* Likes and follows. null means the tables haven't been set up yet (supabase/features.sql). */
      async communityState(armyIds){
        if(!session) return null;
        const missing = e => /PGRST205|42P01/.test(e.code || "") || /could not find the table|does not exist/i.test(e.message || "");
        const lk = armyIds.length ? await sb.from("likes").select("army_id,user_id").in("army_id", armyIds) : {data: [], error: null};
        if(lk.error){ if(missing(lk.error)) return null; throw lk.error; }
        const fl = await sb.from("follows").select("followee").eq("follower", session.user.id);
        if(fl.error){ if(missing(fl.error)) return null; throw fl.error; }
        const likes = {}, liked = new Set();
        (lk.data || []).forEach(r => { likes[r.army_id] = (likes[r.army_id] || 0) + 1; if(r.user_id === session.user.id) liked.add(r.army_id); });
        return {likes, liked, following: new Set((fl.data || []).map(r => r.followee))};
      },
      async setLike(armyId, on){
        need();
        const {error} = on ? await sb.from("likes").insert({army_id: armyId, user_id: session.user.id}) : await sb.from("likes").delete().eq("army_id", armyId).eq("user_id", session.user.id);
        if(error && !/duplicate/i.test(error.message || "")) throw error;
      },
      async setFollow(userId, on){
        need();
        const {error} = on ? await sb.from("follows").insert({follower: session.user.id, followee: userId}) : await sb.from("follows").delete().eq("follower", session.user.id).eq("followee", userId);
        if(error && !/duplicate/i.test(error.message || "")) throw error;
      },
      // Every ledger with sharing on, newest first, with painting totals. Readable without logging in.
      async listShared(){
        need();
        const armies = (mustOk(await sb.from(A).select("*").eq("public", true).order("updated_at", {ascending: false}).limit(150)) || []).map(toArmy);
        const ids = armies.map(a => a.id);
        const sum = ids.length ? totals(mustOk(await sb.from(U).select(SUM_COLS).in("army_id", ids)) || []) : {};
        return {armies, sum};
      },
      async saveArmy(a, id){
        need();
        const row = {...cleanArmy({...a, scheme: {...(a.scheme || {}), by: myName(), byPic: myPic()}}), updated_at: new Date().toISOString()};
        const res = id ? await sb.from(A).update(row).eq("id", id).select().single() : await sb.from(A).insert(row).select().single();
        return toArmy(mustOk(res));
      },
      async listLists(){ if(!session) return []; return (warOk(await sb.from(L).select("*").eq("owner", session.user.id).order("updated_at", {ascending: false})) || []).map(toList); },
      async saveList(l, id){
        need(); const c = cleanList(l), row = {army_id: c.armyId, data: c, updated_at: new Date().toISOString()};
        return toList(warOk(id ? await sb.from(L).update(row).eq("id", id).select().single() : await sb.from(L).insert(row).select().single()));
      },
      async removeList(id){ need(); warOk(await sb.from(L).delete().eq("id", id)); },
      async listGames(){ if(!session) return []; return (warOk(await sb.from(G).select("*").eq("owner", session.user.id).order("created_at", {ascending: false})) || []).map(toGame); },
      async saveGame(g, id){
        need(); const c = cleanGame(g), row = {army_id: c.armyId, data: c, updated_at: new Date().toISOString()};
        // The friend tagged as opponent can read the battle; the column comes with supabase/features.sql.
        if(c.oppUser) row.opp_user = c.oppUser; else if(id) row.opp_user = null;
        const res = id ? await sb.from(G).update(row).eq("id", id).select().single() : await sb.from(G).insert(row).select().single();
        if(res.error && /opp_user/.test(res.error.message || "")) throw Object.assign(new Error("Tagging a friend needs a quick database update. Run supabase/features.sql in Supabase."), {code: "setup"});
        return toGame(warOk(res));
      },
      // Battles friends logged against you. null when that part of the database isn't set up.
      async listTagged(){
        if(!session) return [];
        const {data, error} = await sb.from(G).select("*").eq("opp_user", session.user.id);
        if(error){ if(tableMissing(error) || /opp_user/.test(error.message || "")) return null; throw error; }
        return (data || []).filter(r => r.owner !== session.user.id).map(r => ({...toGame(r), owner: r.owner}));
      },
      /* Comments on shared armies. null means the comments table isn't set up yet (supabase/features.sql). */
      async listComments(armyId){
        const {data, error} = await sb.from("comments").select("*").eq("army_id", armyId).order("created_at", {ascending: true});
        if(error){ if(tableMissing(error)) return null; throw error; }
        return (data || []).map(toComment);
      },
      async addComment(armyId, body){
        need();
        const text = String(body || "").trim().slice(0, 1000);
        if(!text) throw new Error("Write something first.");
        return toComment(mustOk(await sb.from("comments").insert({army_id: armyId, body: text, by_name: myName().slice(0, 40), by_pic: myPic().slice(0, 600)}).select().single()));
      },
      async removeComment(id){ need(); mustOk(await sb.from("comments").delete().eq("id", id)); },
      // One painter's shared armies, for their profile page.
      async listSharedBy(ownerId){
        const armies = (mustOk(await sb.from(A).select("*").eq("owner", ownerId).eq("public", true).order("updated_at", {ascending: false})) || []).map(toArmy);
        const ids = armies.map(a => a.id);
        const sum = ids.length ? totals(mustOk(await sb.from(U).select(SUM_COLS).in("army_id", ids)) || []) : {};
        return {armies, sum};
      },
      async removeGame(id){ need(); warOk(await sb.from(G).delete().eq("id", id)); },
      // The army's win/loss record lives on the army, so Shared armies can show it (without moving it up that list).
      async setArmyRecord(army, rec){ need(); mustOk(await sb.from(A).update({scheme: cleanScheme({...army.scheme, rec})}).eq("id", army.id)); },
      async removeArmy(a){
        need();
        const paths = (mustOk(await sb.from(U).select("image_path,data->photos").eq("army_id", a.id)) || [])
          .flatMap(r => [r.image_path, ...(Array.isArray(r.photos) ? r.photos : [])]).filter(p => typeof p === "string" && p && !/^data:/.test(p));
        mustOk(await sb.from(A).delete().eq("id", a.id));
        if(paths.length) sb.storage.from(B).remove(paths).catch(() => {});
      },
      async listUnits(armyId){ return (mustOk(await sb.from(U).select("*").eq("army_id", armyId).order("created_at", {ascending: true})) || []).map(toUnit); },
      // Every unit across all your ledgers, for the roster.
      async listAllUnits(){ if(!session) return []; return (mustOk(await sb.from(U).select("*").eq("owner", session.user.id).order("created_at", {ascending: true})) || []).map(toUnit); },
      async saveUnit(armyId, u, id, photo, remove, prev){
        need();
        let image_path = prev ? prev.imagePath || null : null, oldPath = null;
        if(photo){ oldPath = image_path; image_path = await upload(armyId, await resizeImage(photo.file, 1600, .85)); }
        else if(remove){ oldPath = image_path; image_path = null; }
        const row = {army_id: armyId, data: cleanUnit({...u, log: id ? nextLog(prev, u) : u.log}), image_path, updated_at: new Date().toISOString()};
        const res = id ? await sb.from(U).update(row).eq("id", id).select().single() : await sb.from(U).insert(row).select().single();
        if(res.error){ if(photo && image_path) sb.storage.from(B).remove([image_path]).catch(() => {}); throw res.error; }
        if(oldPath) sb.storage.from(B).remove([oldPath]).catch(() => {});
        return toUnit(res.data);
      },
      // keepImage: leave the photo in storage for a moment so "Undo" can bring the unit back with it
      async removeUnit(u, keepImage){ need(); mustOk(await sb.from(U).delete().eq("id", u.id)); if(!keepImage) this.purgeImage(u); },
      // The unit's main photo and gallery photos.
      purgeImage(u){ const paths = [u && u.imagePath, ...((u && u.photos) || [])].filter(p => p && !/^data:/.test(p)); if(paths.length) sb.storage.from(B).remove(paths).catch(() => {}); },
      photoUrl: p => /^data:/.test(p) ? p : pub(p),
      // Delete the account: check the database is set up, remove every photo, then the rows and the login.
      async deleteAccount(){
        need();
        const setup = await sb.rpc("delete_my_account", {dry: true});
        if(setup.error) throw Object.assign(new Error("Deleting accounts needs a one-time database setup: run supabase/features.sql in Supabase, then try again."), {code: "nosetup"});
        const uid = session.user.id, paths = [];
        const top = mustOk(await sb.storage.from(B).list(uid, {limit: 1000})) || [];
        for(const f of top){
          if(f.id){ paths.push(`${uid}/${f.name}`); continue; }
          const inner = mustOk(await sb.storage.from(B).list(`${uid}/${f.name}`, {limit: 1000})) || [];
          inner.filter(x => x.id).forEach(x => paths.push(`${uid}/${f.name}/${x.name}`));
        }
        for(let i = 0; i < paths.length; i += 100) await sb.storage.from(B).remove(paths.slice(i, i + 100));
        mustOk(await sb.rpc("delete_my_account", {dry: false}));
        try { await sb.auth.signOut(); } catch(e){}
      },
      async addUnitPhoto(armyId, u, file){
        need();
        const path = await upload(armyId, await resizeImage(file, 1600, .85));
        try { return await this.saveUnit(armyId, {...u, photos: [...(u.photos || []), path]}, u.id, null, false, u); }
        catch(e){ sb.storage.from(B).remove([path]).catch(() => {}); throw e; }
      },
      async removeUnitPhoto(armyId, u, p){
        const row = await this.saveUnit(armyId, {...u, photos: (u.photos || []).filter(x => x !== p)}, u.id, null, false, u);
        if(!/^data:/.test(p)) sb.storage.from(B).remove([p]).catch(() => {});
        return row;
      },
      async restoreUnit(armyId, u){
        need();
        const res = await sb.from(U).insert({id: u.id, army_id: armyId, data: cleanUnit(u), image_path: u.imagePath || null, updated_at: new Date().toISOString()}).select().single();
        return toUnit(mustOk(res));
      },
      async importUnits(armyId, rows){
        need(); let n = 0;
        for(const r of rows){
          let image_path = null;
          try { if(typeof r.image === "string" && /^data:image\//.test(r.image)) image_path = await upload(armyId, await dataURLToBlob(r.image)); } catch(e){}
          const {error} = await sb.from(U).insert({army_id: armyId, data: cleanUnit(r), image_path, updated_at: new Date().toISOString()});
          if(!error) n++;
        }
        return n;
      },
      async signIn(email, pass){ const {error} = await sb.auth.signInWithPassword({email, password: pass}); if(error) throw error; },
      async signUp(email, pass){ const {data, error} = await sb.auth.signUp({email, password: pass, options: {emailRedirectTo: location.href.split("#")[0]}}); if(error) throw error; return data; },
      async signOut(){ await sb.auth.signOut(); },
      // Emails a link back to this page; opening it signs the person in and fires PASSWORD_RECOVERY.
      async resetPassword(email){ const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo: location.href.split("#")[0]}); if(error) throw error; },
      // Display name and profile picture live on the account (user metadata), so they follow you to any device.
      async updateProfile(data){
        const {data: d, error} = await sb.auth.updateUser({data}); if(error) throw error;
        if(d && d.user && session) session = {...session, user: d.user};
        // A new display name or picture also goes on your shared ledgers (without moving them up the Shared armies list).
        if("display_name" in data || "avatar_url" in data){
          try {
            const mine = mustOk(await sb.from(A).select("id,scheme").eq("owner", session.user.id).eq("public", true)) || [];
            for(const r of mine) await sb.from(A).update({scheme: {...(r.scheme || {}), by: myName(), byPic: myPic()}}).eq("id", r.id);
          } catch(e){ console.warn("Couldn't update the name on shared ledgers", e); }
        }
        return d && d.user;
      },
      async uploadAvatar(file){
        need();
        const path = await upload("profile", await resizeImage(file, 360, .88, true));
        return {path, url: pub(path)};
      },
      removeAvatar(path){ if(path && session && path.startsWith(session.user.id + "/profile/")) sb.storage.from(B).remove([path]).catch(() => {}); },
      async updatePassword(pass){ const {data, error} = await sb.auth.updateUser({password: pass}); if(error) throw error; if(data && data.user && session) session = {...session, user: data.user}; }
    };
  }

  function create(){
    const ready = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient;
    if(CFG.SUPABASE_URL && !window.supabase) console.warn("Supabase library failed to load; using browser storage.");
    return ready ? SupaStore() : LocalStore();
  }

  window.LEDGER_STORE = {create, MAX_PHOTOS, FIELDS, STATUS, STAGES, STAGE_KEYS, deriveStatus, cleanUnit, cleanScheme, cleanRecipe, cleanList, cleanGame, newId};
})();
