/* Storage: Supabase when configured, otherwise this browser (localStorage). */
(function(){
  "use strict";
  const CFG = window.LEDGER_CONFIG || {};

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
    return {style: s.style === "roundel" ? "roundel" : "astartes", limit, recipes, colors, slotPaints: cleanSlotPaints(s.slotPaints), splitPauldrons: s.splitPauldrons === true, xareas: cleanXareas(s.xareas), shape: String(s.shape || "cross").slice(0, 160), tiers: tiers.length ? tiers : [{name:"Line", note:"", color:colors.armour}]};
  }
  const cleanPaints = list => [...new Set((Array.isArray(list) ? list : []).map(p => String(p).trim().slice(0, 90)).filter(Boolean))].slice(0, 600);
  function cleanArmy(a){
    return {faction: String(a.faction || "").slice(0, 60), name: String(a.name || "My army").slice(0, 80), scheme: cleanScheme(a.scheme), public: a.public === true};
  }

  /* ---------- images ---------- */
  async function resizeImage(file, max, quality){
    if(!/^image\//.test(file.type)) throw Object.assign(new Error("That file isn't an image."), {code:"type"});
    let src;
    try { src = await createImageBitmap(file); }
    catch(e){
      src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Object.assign(new Error("That photo couldn't be read. Try a JPG or PNG."), {code:"type"})); i.src = URL.createObjectURL(file); });
    }
    const k = Math.min(1, max / Math.max(src.width, src.height));
    const c = document.createElement("canvas");
    c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error("Couldn't process that photo.")), "image/jpeg", quality));
  }
  const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
  const dataURLToBlob = async u => (await fetch(u)).blob();

  /* ============================================================
     Browser storage
     ============================================================ */
  function LocalStore(){
    const KEY = "livery-ledger-v3";
    let ok = true;
    let db = {armies: [], units: []};

    function load(){
      try {
        const v = JSON.parse(localStorage.getItem(KEY) || "null");
        if(v && Array.isArray(v.armies) && Array.isArray(v.units)){ db = v; return; }
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
    function save(){
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch(e){ ok = false; throw Object.assign(new Error("This browser is out of storage space. Remove some photos or connect Supabase."), {code:"quota"}); }
    }
    load();

    return {
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
        db.units.forEach(u => { const s = m[u.armyId] || (m[u.armyId] = {units:0, models:0, done:0, points:0}); s.units++; s.models += +u.count || 0; s.done += Math.min(+u.count || 0, +u.painted || (u.status === "done" ? +u.count || 0 : 0)); s.points += +u.points || 0; });
        return m;
      },
      async saveArmy(a, id){
        const now = new Date().toISOString();
        const prev = id ? db.armies.find(x => x.id === id) : null;
        const row = {...(prev || {createdAt: now}), ...cleanArmy(a), id: prev ? prev.id : newId(), updatedAt: now};
        db.armies = db.armies.filter(x => x.id !== row.id).concat(row); save(); return {...row};
      },
      async removeArmy(a){ db.armies = db.armies.filter(x => x.id !== a.id); db.units = db.units.filter(u => u.armyId !== a.id); save(); },
      async listUnits(armyId){ return db.units.filter(u => u.armyId === armyId).map(u => ({...u, ...cleanUnit(u)})); },
      async listAllUnits(){ return db.units.map(u => ({...u, ...cleanUnit(u)})); },
      async saveUnit(armyId, u, id, photo, remove){
        const prev = id ? db.units.find(x => x.id === id) : null;
        let image = prev ? prev.image || "" : "";
        if(photo) image = await blobToDataURL(await resizeImage(photo.file, 1000, .8));
        else if(remove) image = "";
        const row = {...cleanUnit(u), id: prev ? prev.id : newId(), armyId, image, updatedAt: new Date().toISOString()};
        const before = db.units;
        db.units = db.units.filter(x => x.id !== row.id).concat(row);
        try { save(); } catch(e){ db.units = before; throw e; }
        return {...row};
      },
      async removeUnit(u){ db.units = db.units.filter(x => x.id !== u.id); save(); },
      async restoreUnit(armyId, u){ db.units = db.units.filter(x => x.id !== u.id).concat({...u, armyId}); save(); return {...u, armyId}; },
      purgeImage(){},
      async importUnits(armyId, rows){
        rows.forEach(r => db.units.push({...cleanUnit(r), id: newId(), armyId, image: typeof r.image === "string" && /^data:image\//.test(r.image) ? r.image : "", updatedAt: new Date().toISOString()}));
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

    return {
      kind: "supabase", client: sb, canShare: true,
      get session(){ return session; },
      get canWrite(){ return !!session; },
      setSession(s){ session = s; },
      note(){ return session ? {cls:"on", text:"Saved online to your database."} : {cls:"", text:"Viewing only. Sign in to create and edit ledgers."}; },
      async getPaints(){ return session ? cleanPaints((session.user.user_metadata || {}).paints) : []; },
      async setPaints(list){
        need();
        const paints = cleanPaints(list);
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
        const rows = mustOk(await sb.from(U).select("army_id,data->>status,data->>count,data->>painted,data->>points").eq("owner", session.user.id)) || [];
        const m = {};
        rows.forEach(r => { const s = m[r.army_id] || (m[r.army_id] = {units:0, models:0, done:0, points:0}); const c = parseInt(r.count, 10) || 1; const p = parseInt(r.painted, 10); s.units++; s.models += c; s.done += Math.min(c, Number.isFinite(p) ? p : (r.status === "done" ? c : 0)); s.points += parseInt(r.points, 10) || 0; });
        return m;
      },
      async saveArmy(a, id){
        need();
        const row = {...cleanArmy(a), updated_at: new Date().toISOString()};
        const res = id ? await sb.from(A).update(row).eq("id", id).select().single() : await sb.from(A).insert(row).select().single();
        return toArmy(mustOk(res));
      },
      async removeArmy(a){
        need();
        const paths = (mustOk(await sb.from(U).select("image_path").eq("army_id", a.id)) || []).map(r => r.image_path).filter(Boolean);
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
        const row = {army_id: armyId, data: cleanUnit(u), image_path, updated_at: new Date().toISOString()};
        const res = id ? await sb.from(U).update(row).eq("id", id).select().single() : await sb.from(U).insert(row).select().single();
        if(res.error){ if(photo && image_path) sb.storage.from(B).remove([image_path]).catch(() => {}); throw res.error; }
        if(oldPath) sb.storage.from(B).remove([oldPath]).catch(() => {});
        return toUnit(res.data);
      },
      // keepImage: leave the photo in storage for a moment so "Undo" can bring the unit back with it
      async removeUnit(u, keepImage){ need(); mustOk(await sb.from(U).delete().eq("id", u.id)); if(u.imagePath && !keepImage) sb.storage.from(B).remove([u.imagePath]).catch(() => {}); },
      purgeImage(u){ if(u && u.imagePath) sb.storage.from(B).remove([u.imagePath]).catch(() => {}); },
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
      async updatePassword(pass){ const {data, error} = await sb.auth.updateUser({password: pass}); if(error) throw error; if(data && data.user && session) session = {...session, user: data.user}; }
    };
  }

  function create(){
    const ready = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient;
    if(CFG.SUPABASE_URL && !window.supabase) console.warn("Supabase library failed to load; using browser storage.");
    return ready ? SupaStore() : LocalStore();
  }

  window.LEDGER_STORE = {create, FIELDS, STATUS, STAGES, STAGE_KEYS, deriveStatus, cleanUnit, cleanScheme, cleanRecipe, newId};
})();
