/* Livery Ledger app: routing, faction picker, colour setup and the ledger itself. */
(function(){
  "use strict";
  const DATA = window.LEDGER_FACTIONS || {factions: []};
  const P = window.LEDGER_PRESETS, ART = window.LEDGER_ART, S = window.LEDGER_STORE;
  const STATUS = S.STATUS;
  const FACTIONS = DATA.factions;
  const FBY = Object.fromEntries(FACTIONS.map(f => [f.id, f]));
  const ROLE_ORDER = ["Epic Hero","Character","Battleline","Infantry","Mounted","Beast","Swarm","Monster","Vehicle","Dedicated Transport","Fortification","Other"];
  // What each colour slot means for the faction on screen (set when a page opens).
  let PROF = P.profileFor("space-marines");
  const colorKeys = () => PROF.keys.map(k => [k, PROF.labels[k]]);
  // Armies saved before skin existed pick up the faction's starting skin.
  function fillSkin(scheme, fid){ if(!ART.hexOk(scheme.colors.skin)) scheme.colors.skin = P.presetFor(fid).colors.skin; }
  const QUICK = ["Black","White","Bone","Silver","Gunmetal","Gold","Brass","Red","Crimson","Blue","Navy","Green","Purple","Yellow"];

  const $ = id => document.getElementById(id);
  const app = $("app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeImg = u => typeof u === "string" && /^(https:\/\/|data:image\/(jpeg|png|webp|gif);base64,|blob:)/i.test(u) ? u : "";
  const cname = hex => P.colorName(hex) || hex;
  const chip = hex => ART.hexOk(hex) ? `<span class="chip" style="background:${hex}"></span>` : "";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const quickHex = n => (P.NAMED.find(x => x[0] === n) || [,"#1f1f22"])[1];

  const EMB = window.LEDGER_EMBLEMS || {icons: [], cats: {}};
  function suggestedIcons(f){
    const cats = P.iconCats(f.id, f.parent);
    const words = f.name.toLowerCase().replace(/[^a-z ]/g, "").split(" ").filter(w => w.length > 3);
    const def = P.defaultIcon(f.id).slice(5);
    const score = i => (i.id === def ? -1000 : 0) + (words.some(w => i.n.toLowerCase().includes(w)) ? -100 : 0) + cats.indexOf(i.c);
    return EMB.icons.filter(i => cats.includes(i.c)).sort((a, b) => score(a) - score(b) || a.n.localeCompare(b.n));
  }
  const catLabel = c => (EMB.cats && EMB.cats[c]) || c;

  let store = null;
  let view = {name: "", cleanup: null};

  /* ============================================================
     Shared bits
     ============================================================ */
  const SKIN = "#c79a7e";
  // Head type: "helmet", "bare" (only where the faction has bare heads) or "none". Older saves used noHelmet.
  const headOf = u => { const h = ["helmet","bare","none"].includes(u.head) ? u.head : (u.noHelmet ? "bare" : "helmet"); return h === "bare" && !PROF.bare ? "helmet" : h; };
  const autoHead = role => PROF.noHeadRoles.includes(role) ? "none" : PROF.defaultHead;
  function unitBadge(u, scheme, size){
    const c = scheme.colors;
    const tier = scheme.tiers[u.tier] || scheme.tiers[0];
    const v = {
      helmet: u.helmet || (tier && tier.color) || c.armour, lens: u.lens || c.lens, armour: u.armour || c.armour,
      secondary: u.secondary || c.secondary, trim: u.trim || c.trim, emblem: u.emblem || c.emblem,
      shape: u.shape || scheme.shape, skin: u.skin || c.skin || SKIN, head: headOf(u)
    };
    const hd = v.head === "bare" ? `bare head (${cname(v.skin)} skin)` : v.head === "none" ? "no head" : `${cname(v.helmet)} ${PROF.head}`;
    return ART.badge(v, scheme.style, size, `${hd}, ${cname(v.armour)} ${PROF.labels.armour.toLowerCase()} with ${cname(v.trim)} ${PROF.labels.trim.toLowerCase()}`);
  }
  function tierBadge(scheme, t, size){
    const c = scheme.colors;
    return ART.badge({helmet: t.color, lens: c.lens, armour: c.armour, secondary: c.secondary, trim: c.trim, emblem: c.emblem, shape: scheme.shape}, scheme.style, size, `${t.name}: ${cname(t.color)} ${PROF.head}`);
  }
  function factionBadge(fid, size){
    const pr = P.presetFor(fid);
    return ART.badge({...pr.colors, helmet: pr.tiers[0].color, shape: pr.shape}, pr.style, size, "");
  }
  function setTop(){
    const sup = store.kind === "supabase";
    $("b-signin").hidden = !sup || !!store.session;
    $("b-signout").hidden = !sup || !store.session;
    $("who").hidden = !sup || !store.session;
    if(sup && store.session) $("who").textContent = store.session.user.email || "Signed in";
  }
  function noteHtml(){ const n = store.note(); return `<span class="note"><span class="dot ${n.cls}"></span>${esc(n.text)}</span>`; }
  function openAuth(){ $("au-msg").textContent = ""; $("authdlg").showModal(); $("au-email").focus(); }
  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const slug = s => String(s || "army").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "army";
  function errText(err){ return (err && err.message) ? err.message : "Something went wrong. Check your connection and try again."; }

  /* ============================================================
     Router
     ============================================================ */
  /* Unsaved changes: ask Save / Discard / Keep editing. Resolves "save", "discard" or "stay". */
  function askLeave(text){
    const d = $("leavedlg");
    $("lv-text").textContent = text || "You have changes that haven't been saved.";
    return new Promise(res => {
      const done = v => { d.removeEventListener("close", onClose); d.querySelectorAll("[data-leave]").forEach(b => b.onclick = null); if(d.open) d.close(); res(v); };
      const onClose = () => done("stay");
      d.querySelectorAll("[data-leave]").forEach(b => b.onclick = () => done(b.dataset.leave));
      d.addEventListener("close", onClose);
      d.showModal();
      d.querySelector('[data-leave="save"]').focus();
    });
  }
  let lastHash = location.hash, routing = false;
  async function route(){
    if(view.guard && location.hash !== lastHash){
      if(routing) return;
      const target = location.hash;
      history.replaceState(null, "", lastHash || "#/");
      routing = true;
      let ok = false;
      try { ok = await view.guard(); } finally { routing = false; }
      if(!ok) return;
      history.pushState(null, "", target);
    }
    lastHash = location.hash;
    if(view.cleanup){ try { view.cleanup(); } catch(e){} view.cleanup = null; }
    const parts = (location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
    setTop();
    try {
      if(parts[0] === "new" && FBY[parts[1]]) await viewSetup({factionId: parts[1]});
      else if(parts[0] === "army" && parts[1] && parts[2] === "colours") await viewSetup({armyId: parts[1]});
      else if(parts[0] === "army" && parts[1]) await viewLedger(parts[1]);
      else await viewHome();
    } catch(err){
      console.error(err);
      app.innerHTML = `<div class="banner"><span class="dot warn"></span>Couldn't load this page: ${esc(errText(err))}</div><p><a class="btn" href="#/">Back to start</a></p>`;
    }
    window.scrollTo(0, 0);
  }

  /* ============================================================
     Home: your ledgers + faction picker
     ============================================================ */
  async function viewHome(){
    view.name = "home";
    document.title = "Livery Ledger";
    let armies = [], sum = {};
    if(store.canWrite || store.kind === "supabase"){
      try { [armies, sum] = await Promise.all([store.listArmies(), store.summary()]); }
      catch(err){ console.error(err); armies = []; }
    }
    const groups = [
      ["Imperium", FACTIONS.filter(f => f.group === "Imperium" && !f.parent)],
      ["Space Marine chapters", FACTIONS.filter(f => f.parent === "space-marines")],
      ["Chaos", FACTIONS.filter(f => f.group === "Chaos")],
      ["Xenos", FACTIONS.filter(f => f.group === "Xenos")]
    ];
    const signedOut = store.kind === "supabase" && !store.session;
    app.innerHTML = `
      <div class="hero">
        <div>
          <h1>Livery Ledger</h1>
          <p class="sub">Plan how you'll paint your army. Pick your faction, choose your colours, then track every unit with photos, weapons and paint recipes.</p>
        </div>
        ${noteHtml()}
      </div>
      ${signedOut ? `<div class="banner"><span class="dot"></span>Sign in to create a ledger and see the ones you've made. <button type="button" class="btn-sm" data-signin>Sign in</button></div>` : ""}
      ${armies.length ? `<h2 class="section">Your ledgers <small>${plural(armies.length, "ledger")}</small></h2>
        <div class="ledgers">${armies.map(a => {
          const s = sum[a.id] || {units:0, models:0, done:0}, f = FBY[a.faction];
          const pct = s.models ? Math.round(s.done / s.models * 100) : 0;
          const t0 = a.scheme.tiers[0];
          return `<a class="lcard" href="#/army/${esc(a.id)}">
            <div class="card-top">${tierBadge(a.scheme, t0, 56)}<div><h3>${esc(a.name)}</h3><div class="meta">${esc(f ? f.name : a.faction)}</div></div></div>
            <div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div>
            <div class="foot"><span>${plural(s.units, "unit")} · ${plural(s.models, "model")}</span><span>${pct}% painted</span></div>
          </a>`;}).join("")}</div>` : ""}
      <h2 class="section">Start a new ledger <small>Choose your faction</small></h2>
      <div class="row-actions">
        <input type="search" class="fsearch" id="fq" placeholder="Search factions" aria-label="Search factions">
        ${store.canWrite ? `<button type="button" class="btn-sm" id="b-import-army">Import a ledger backup</button><input type="file" id="f-import-army" accept="application/json,.json" hidden>` : ""}
      </div>
      <div id="fgroups">${groups.map(([g, list]) => `
        <div class="fgroup" data-group>
          <h3>${esc(g)}</h3>
          <div class="fgrid">${list.map(f => `<a class="fcard" href="#/new/${esc(f.id)}" data-fname="${esc(f.name.toLowerCase())}">
            ${factionBadge(f.id, 34)}<span><strong>${esc(f.name)}</strong><small>${f.units.filter(u => !u.t).length} datasheets</small></span></a>`).join("")}</div>
        </div>`).join("")}</div>
      <p class="source">Unit and weapon names come from the community BattleScribe data for Warhammer 40,000 11th edition (${esc(DATA.source || "BSData")}${DATA.commit ? ", " + esc(DATA.commit) : ""}). Emblem icons from <a href="https://github.com/Certseeds/wh40k-icon" target="_blank" rel="noopener">wh40k-icon</a> by shitake, farvig, 夜行漫记 and Certseeds (<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>), recoloured for this site. Paint names and colours from <a href="https://github.com/Arcturus5404/miniature-paints" target="_blank" rel="noopener">miniature-paints</a> by Rick Fleuren (MIT). Starting colours are suggestions you can change. Warhammer 40,000 and its symbols are trademarks of Games Workshop; this is an unofficial, non-commercial fan tool.</p>
    `;
    const fq = $("fq");
    fq.addEventListener("input", () => {
      const q = fq.value.trim().toLowerCase();
      app.querySelectorAll(".fcard").forEach(c => c.hidden = q && !c.dataset.fname.includes(q));
      app.querySelectorAll("[data-group]").forEach(g => g.hidden = !g.querySelector(".fcard:not([hidden])"));
    });
    app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));
    if(store.canWrite){
      $("b-import-army").addEventListener("click", () => $("f-import-army").click());
      $("f-import-army").addEventListener("change", async e => {
        const file = e.target.files && e.target.files[0]; e.target.value = "";
        if(!file) return;
        try {
          const d = JSON.parse(await file.text());
          if(!d || !d.army || !Array.isArray(d.units)) throw new Error("not a ledger");
          const army = await store.saveArmy({faction: FBY[d.army.faction] ? d.army.faction : "space-marines", name: d.army.name, scheme: d.army.scheme});
          await store.importUnits(army.id, d.units.filter(r => r && typeof r === "object"));
          location.hash = "#/army/" + army.id;
        } catch(err){ console.error(err); alertBanner("That file isn't a Livery Ledger backup."); }
      });
    }
  }
  function alertBanner(text){
    const b = document.createElement("div"); b.className = "banner"; b.innerHTML = `<span class="dot warn"></span>${esc(text)}`;
    app.prepend(b); setTimeout(() => b.remove(), 6000);
  }

  /* ============================================================
     Setup: choose colours (new ledger or edit colours)
     ============================================================ */
  async function viewSetup({factionId, armyId}){
    view.name = "setup";
    let army = null;
    if(armyId){ army = await store.getArmy(armyId); if(!army){ location.hash = "#/"; return; } factionId = army.faction; }
    const f = FBY[factionId] || FBY["space-marines"];
    PROF = P.profileFor(f.id);
    const draft = army ? {name: army.name, scheme: JSON.parse(JSON.stringify(army.scheme))} : {name: "", scheme: P.presetFor(f.id)};
    fillSkin(draft.scheme, f.id);
    const known = P.schemesFor(f.id);
    const editing = !!army;
    document.title = (editing ? "Colours · " + army.name : "New " + f.name + " ledger") + " · Livery Ledger";
    const locked = !store.canWrite;

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Livery Ledger</a> / ${editing ? `<a href="#/army/${esc(army.id)}">${esc(army.name)}</a> / Colours` : esc(f.name)}</div>
      <div class="hero">
        <div><h1>${editing ? "Your colours" : esc(f.name)}</h1>
        <p class="sub">${editing ? "Change your army's colours. Units that use the scheme colours update to match." : "Name your army and choose its colours. These become the starting colours for every unit you add."}</p></div>
      </div>
      ${locked ? `<div class="banner"><span class="dot"></span>Sign in to create a ledger. <button type="button" class="btn-sm" data-signin>Sign in</button></div>` : ""}
      <div class="setup">
        <div>
          <div class="panel">
            <h3>Army</h3>
            <label>Army name<input id="s-name" maxlength="80" placeholder="e.g. ${esc(f.name)} Crusade" value="${esc(draft.name)}"></label>
          </div>
          ${known.length ? `<div class="panel">
            <h3>Start from a known scheme</h3>
            <p class="hint">Sets every colour and the emblem to a well-known ${esc(f.name)} scheme. You can change anything afterwards.</p>
            <div class="schemes" id="s-schemes">${known.map((k, i) => `<button type="button" class="scheme" data-scheme="${i}">${ART.pauldron(k.colors.armour, k.colors.trim, k.colors.emblem, k.shape || draft.scheme.shape, 40)}<span>${esc(k.name)}</span></button>`).join("")}</div>
          </div>` : ""}
          <div class="panel">
            <h3>Colours</h3>
            <p class="hint">Pick a colour, or tap a swatch.</p>
            <div class="cgrid">${colorKeys().map(([k, label]) => `
              <div class="cfield">
                <label for="s-${k}">${label}</label>
                <input type="color" id="s-${k}" value="${esc(draft.scheme.colors[k])}">
                <span class="cname" id="s-${k}-n">${esc(cname(draft.scheme.colors[k]))}</span>
                <div class="swatches">${QUICK.map(n => `<button type="button" class="sw" style="background:${quickHex(n)}" title="${n}" aria-label="${label}: ${n}" data-sw="${k}" data-hex="${quickHex(n)}"></button>`).join("")}</div>
              </div>`).join("")}</div>
          </div>
          <div class="panel">
            <h3>Emblem</h3>
            <p class="hint">Shown on your army badge in the emblem colour. Pick a faction icon or a simple shape.</p>
            <div class="em-current" id="s-emcur"></div>
            <input type="search" id="s-emq" class="em-search" placeholder="Search all ${EMB.icons.length} icons, e.g. Khorne, Iyanden, Goffs" aria-label="Search icons">
            <h4 class="em-h" id="s-emh">Suggested for ${esc(f.name)}</h4>
            <div class="icongrid" id="s-icons"></div>
            <div class="row-actions" style="margin-top:8px"><button type="button" class="btn-sm" id="s-emmore" hidden>Show more</button></div>
            <h4 class="em-h">Simple shapes</h4>
            <div class="shapes" id="s-shapes">${P.SHAPES.map(([k, label]) => `<button type="button" class="shape" data-shape="${k}" aria-pressed="${draft.scheme.shape === k}">${ART.shapeIcon(k, draft.scheme.colors.emblem, 34)}${label}</button>`).join("")}</div>
          </div>
          <div class="panel">
            <h3>Badge style</h3>
            <div class="shapes">
              <button type="button" class="shape" style="width:auto;padding:8px 12px" data-style="astartes" aria-pressed="${draft.scheme.style === "astartes"}">Power-armour helmet</button>
              <button type="button" class="shape" style="width:auto;padding:8px 12px" data-style="roundel" aria-pressed="${draft.scheme.style === "roundel"}">Colour roundel</button>
            </div>
          </div>
          <div class="panel">
            <h3>Rank colours</h3>
            <p class="hint">Each rank gets its own ${esc(PROF.head)} colour. When you pick a rank for a unit, its ${esc(PROF.head)} uses this colour.</p>
            <div class="tiers" id="s-tiers"></div>
            <div class="row-actions" style="margin-top:10px"><button type="button" class="btn-sm" id="s-addtier">Add rank</button></div>
          </div>
        </div>
        <div class="side">
          <div class="panel">
            <h3>Preview</h3>
            <div class="pv-tiers" id="s-preview"></div>
          </div>
          <div class="panel">
            <div class="row-actions">
              <button type="button" class="primary" id="s-save" ${locked ? "disabled" : ""}>${editing ? "Save colours" : "Create ledger"}</button>
              <a class="btn" href="${editing ? "#/army/" + esc(army.id) : "#/"}">Cancel</a>
              ${editing ? `<button type="button" class="danger" id="s-del" style="margin-left:auto">Delete ledger</button>` : ""}
            </div>
            ${!editing ? `<label style="margin-top:12px;flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="s-reset" style="width:auto"> Reset to ${esc(f.name)} starting colours</label>` : ""}
            <div class="msg" id="s-msg" role="status"></div>
          </div>
        </div>
      </div>`;
    app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));

    const sch = draft.scheme;
    const suggested = suggestedIcons(f);
    let emq = "", emLimit = 90;
    function renderIcons(){
      const q = emq.toLowerCase();
      const list = q ? EMB.icons.filter(i => i.n.toLowerCase().includes(q) || catLabel(i.c).toLowerCase().includes(q)) : suggested;
      $("s-emh").textContent = q ? `${list.length} icon${list.length === 1 ? "" : "s"} matching "${emq}"` : `Suggested for ${f.name}`;
      $("s-icons").innerHTML = list.slice(0, emLimit).map(i => `<button type="button" class="ic" data-shape="icon:${esc(i.id)}" aria-pressed="${sch.shape === "icon:" + i.id}" title="${esc(i.n)} · ${esc(catLabel(i.c))}"><img src="${esc(i.f)}" alt="" loading="lazy" decoding="async"><span>${esc(i.n)}</span></button>`).join("") || `<p class="hint" style="grid-column:1/-1">No icons match. Try another word.</p>`;
      $("s-emmore").hidden = list.length <= emLimit;
    }
    function renderCurrent(){
      $("s-emcur").innerHTML = `${ART.pauldron(sch.colors.armour, sch.colors.trim, sch.colors.emblem, sch.shape, 52)}<span><small>Current emblem</small><strong>${esc(P.emblemName(sch.shape))}</strong></span>`;
      app.querySelectorAll(".ic[data-shape]").forEach(b => b.setAttribute("aria-pressed", b.dataset.shape === sch.shape));
    }
    function renderTiers(){
      $("s-tiers").innerHTML = sch.tiers.map((t, i) => `
        <div class="tier">
          <label>Rank ${i + 1}<input data-tname="${i}" maxlength="40" value="${esc(t.name)}" placeholder="e.g. Veteran"></label>
          <label>Colour<input type="color" data-tcolor="${i}" value="${esc(t.color)}"></label>
          <button type="button" class="btn-sm" data-tdel="${i}" ${sch.tiers.length < 2 ? "disabled" : ""} aria-label="Remove rank ${i + 1}">Remove</button>
          <label class="full" style="grid-column:1/-1">Who uses it<input data-tnote="${i}" maxlength="80" value="${esc(t.note)}" placeholder="e.g. Sword Brethren"></label>
        </div>`).join("");
      $("s-addtier").disabled = sch.tiers.length >= 8;
    }
    function renderPreview(){
      $("s-preview").innerHTML = sch.tiers.map(t => `<div class="pv-tier">${tierBadge(sch, t, 60)}<span><strong>${esc(t.name || "Rank")}</strong><small>${esc(t.note || cname(t.color) + " " + PROF.head)}</small></span></div>`).join("");
      $("s-shapes").querySelectorAll("[data-shape]").forEach(b => { b.setAttribute("aria-pressed", b.dataset.shape === sch.shape); b.innerHTML = ART.shapeIcon(b.dataset.shape, sch.colors.emblem, 34) + esc(P.SHAPES.find(s => s[0] === b.dataset.shape)[1]); });
      renderCurrent();
      colorKeys().forEach(([k]) => { $("s-" + k).value = sch.colors[k]; $("s-" + k + "-n").textContent = cname(sch.colors[k]); });
      app.querySelectorAll("[data-style]").forEach(b => b.setAttribute("aria-pressed", b.dataset.style === sch.style));
    }
    renderIcons(); renderTiers(); renderPreview();

    let setupDirty = false;
    app.addEventListener("input", onInput);
    app.addEventListener("click", onClick);
    view.guard = async () => {
      if(!setupDirty || locked) return true;
      const c = await askLeave(editing ? "Your colour changes haven't been saved." : "This ledger hasn't been created yet.");
      if(c === "discard"){ setupDirty = false; return true; }
      if(c === "save") return !!(await saveSetup());
      return false;
    };
    view.cleanup = () => { app.removeEventListener("input", onInput); app.removeEventListener("click", onClick); view.guard = null; };
    async function saveSetup(){
      const name = $("s-name").value.trim() || (f.name + " army");
      const b = $("s-save"); b.disabled = true; $("s-msg").textContent = "Saving…"; $("s-msg").classList.remove("err");
      try {
        const saved = await store.saveArmy({faction: f.id, name, scheme: sch, public: editing ? army.public : false}, editing ? army.id : null);
        setupDirty = false; $("s-msg").textContent = "Saved.";
        return saved;
      } catch(err){ console.error(err); $("s-msg").textContent = "Couldn't save: " + errText(err); $("s-msg").classList.add("err"); return null; }
      finally { b.disabled = false; }
    }

    function onInput(e){
      const t = e.target;
      if(t.id !== "s-emq") setupDirty = true;
      const ck = colorKeys().find(([k]) => t.id === "s-" + k);
      if(ck){ sch.colors[ck[0]] = t.value; renderPreview(); return; }
      if(t.id === "s-emq"){ emq = t.value.trim(); emLimit = 90; renderIcons(); return; }
      if(t.dataset.tname != null){ sch.tiers[+t.dataset.tname].name = t.value; renderPreview(); }
      if(t.dataset.tnote != null){ sch.tiers[+t.dataset.tnote].note = t.value; renderPreview(); }
      if(t.dataset.tcolor != null){ sch.tiers[+t.dataset.tcolor].color = t.value; renderPreview(); }
      if(t.id === "s-reset" && t.checked){ const p = P.presetFor(f.id); Object.assign(sch, p); renderTiers(); renderPreview(); t.checked = false; $("s-msg").textContent = ""; }
    }
    let armed = false;
    async function onClick(e){
      const t = e.target.closest("button"); if(!t) return;
      if(t.dataset.sw || t.dataset.shape || t.dataset.style || t.dataset.scheme || t.dataset.tdel != null || t.id === "s-addtier") setupDirty = true;
      if(t.dataset.scheme){
        // Keep rank names (they may have been edited) but recolour the standard ranks to match.
        const k = known[+t.dataset.scheme];
        sch.colors = {...sch.colors, ...k.colors};
        if(k.shape) sch.shape = k.shape;
        const std = P.tiersFor(f.id, sch.colors);
        sch.tiers.forEach((tr, i) => { if(std[i]) tr.color = std[i].color; });
        renderTiers(); renderPreview();
        $("s-msg").classList.remove("err"); $("s-msg").textContent = `Using the ${k.name} scheme. Save to keep it.`;
        return;
      }
      if(t.dataset.sw){ sch.colors[t.dataset.sw] = t.dataset.hex; renderPreview(); return; }
      if(t.dataset.shape){ sch.shape = t.dataset.shape; renderPreview(); return; }
      if(t.id === "s-emmore"){ emLimit += 90; renderIcons(); return; }
      if(t.dataset.style){ sch.style = t.dataset.style; renderPreview(); return; }
      if(t.dataset.tdel != null){ sch.tiers.splice(+t.dataset.tdel, 1); renderTiers(); renderPreview(); return; }
      if(t.id === "s-addtier"){ sch.tiers.push({name: "New rank", note: "", color: sch.colors.secondary}); renderTiers(); renderPreview(); return; }
      if(t.id === "s-save"){
        const saved = await saveSetup();
        if(saved) location.hash = "#/army/" + saved.id;
        return;
      }
      if(t.id === "s-del"){
        if(!armed){ armed = true; t.classList.add("armed"); t.textContent = "Click again to delete ledger and all its units"; return; }
        t.disabled = true;
        try { await store.removeArmy(army); setupDirty = false; location.hash = "#/"; }
        catch(err){ $("s-msg").textContent = "Couldn't delete: " + errText(err); t.disabled = false; }
      }
    }
  }

  /* ============================================================
     Ledger
     ============================================================ */
  async function viewLedger(armyId){
    view.name = "ledger";
    let army = await store.getArmy(armyId);
    if(!army){
      app.innerHTML = `<div class="banner"><span class="dot warn"></span>${store.kind === "supabase" && !store.session ? "Sign in to open this ledger." : "This ledger doesn't exist any more."}</div><p class="row-actions"><a class="btn" href="#/">Back to start</a>${store.kind === "supabase" && !store.session ? `<button type="button" class="primary" data-signin>Sign in</button>` : ""}</p>`;
      app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));
      return;
    }
    const f = FBY[army.faction] || {name: army.faction, units: []};
    const scheme = army.scheme;
    PROF = P.profileFor(army.faction);
    fillSkin(scheme, army.faction);
    const LB = PROF.labels;
    // Skin sits with the other colours where it always matters (Orks, Tyranids), otherwise it shows for bare heads.
    const skinInHead = PROF.bare && !PROF.skinAlways && !PROF.hide.includes("skin");
    const hasSkin = skinInHead || !!PROF.skinAlways;
    document.title = army.name + " · Livery Ledger";
    const canWrite = store.canWrite && (!army.owner || !store.session || army.owner === store.session.user.id);
    const STAGES = S.STAGES, STAGE_KEYS = S.STAGE_KEYS;

    // datasheet list grouped by role
    const sheets = f.units || [];
    const byRole = {};
    sheets.filter(u => !u.t).forEach(u => (byRole[u.r] = byRole[u.r] || []).push(u));
    const legends = sheets.filter(u => u.t);
    const sheetOptions = ROLE_ORDER.filter(r => byRole[r]).map(r => `<optgroup label="${esc(r)}">${byRole[r].map(u => `<option value="${esc(u.n)}">${esc(u.n)}${u.p != null ? ` · ${u.p} pts` : ""}</option>`).join("")}</optgroup>`).join("")
      + (legends.length ? `<optgroup label="Legends and other">${legends.map(u => `<option value="${esc(u.n)}" data-legend="1">${esc(u.n)} (${esc(u.t)})</option>`).join("")}</optgroup>` : "");
    const sheetFor = n => sheets.find(u => u.n === n && !u.t) || sheets.find(u => u.n === n);
    const sheetIcons = suggestedIcons(FBY[army.faction] || {id: army.faction, name: f.name}).slice(0, 250);
    if(String(scheme.shape).startsWith("icon:") && !sheetIcons.some(i => "icon:" + i.id === scheme.shape) && P.ICON_BY_ID[scheme.shape.slice(5)]) sheetIcons.unshift(P.ICON_BY_ID[scheme.shape.slice(5)]);
    const schemeColors = [...new Set([...Object.values(scheme.colors), ...scheme.tiers.map(t => t.color)])];

    /* Points from the datasheet: base cost, then any model-count bracket that applies (later brackets win). */
    function ptsFor(sh, count){
      if(!sh || sh.p == null) return null;
      let p = sh.p;
      (sh.pb || []).forEach(([lo, hi, v]) => { if(count >= lo && (!hi || count <= hi)) p = v; });
      return p;
    }
    const fmt = n => Number(n || 0).toLocaleString("en");
    const singleRole = r => ["Epic Hero","Character","Vehicle","Monster","Dedicated Transport","Fortification"].includes(r);

    const colorField = (id, label) => `<label>${label}<span class="cpair"><input type="color" id="f-${id}" list="dl-scheme"><span class="cname" data-cn="${id}"></span></span></label>`;
    const PREF_KEY = "ll-list-prefs";
    let prefs = {group: "role", sort: "rank"};
    try { prefs = {...prefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}")}; } catch(e){}

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Livery Ledger</a> / ${esc(f.name)}</div>
      <header class="top">
        <div>
          <h1>${esc(army.name)}</h1>
          <p class="sub">${esc(f.name)} · Track colours, weapons, points and painting progress for every unit.</p>
        </div>
        <div class="stats" aria-live="polite">
          <div class="stat stat-pts"><b><span id="st-pts">0</span><small class="lim"> / <button type="button" id="b-limit" class="lim-btn" ${canWrite ? "" : "disabled"} aria-label="Change points limit">${scheme.limit ? fmt(scheme.limit) : "set limit"}</button></small></b><span>Points</span><i class="pts-bar" aria-hidden="true"><i id="pts-bar"></i></i></div>
          <div class="stat"><b id="st-units">0</b><span>Units</span></div>
          <div class="stat"><b id="st-done">0/0</b><span>Models painted</span></div>
          <div class="stat"><b id="st-pct">0%</b><span>Complete</span></div>
        </div>
      </header>
      <div class="limit-edit" id="limit-edit" hidden>
        <span>Points limit</span>
        <div class="seg">${[500, 1000, 1500, 2000, 2500, 3000].map(v => `<button type="button" data-lim="${v}">${fmt(v)}</button>`).join("")}</div>
        <input type="number" id="lim-custom" min="0" max="20000" step="5" placeholder="Other" aria-label="Custom points limit">
        <button type="button" class="primary btn-sm" id="lim-save">Save</button>
        <button type="button" class="btn-sm" id="lim-cancel">Cancel</button>
      </div>
      <div class="bar" aria-hidden="true"><i id="bar"></i></div>
      <div class="toolbar">
        ${canWrite ? noteHtml() : "<span></span>"}
        <div class="tools">
          ${canWrite ? `<button type="button" class="btn-sm share-btn${army.public ? " on" : ""}" id="b-share"><span class="dot${army.public ? " on" : ""}"></span><span id="share-label">${army.public ? "Shared" : "Share"}</span></button>` : ""}
          ${canWrite ? `<button type="button" class="btn-sm primary" id="b-list">Import army list</button>` : ""}
          <button type="button" class="btn-sm" id="b-paints">Paints &amp; recipes<span class="buy-badge" id="buy-badge" hidden></span></button>
          ${canWrite ? `<a class="btn btn-sm" href="#/army/${esc(army.id)}/colours">Edit colours</a>` : ""}
          <button type="button" class="btn-sm" id="b-export">Export backup</button>
          ${canWrite ? `<button type="button" class="btn-sm" id="b-import">Import backup</button><input type="file" id="f-import" accept="application/json,.json" hidden>` : ""}
        </div>
      </div>

      ${!canWrite ? `<div class="banner viewonly"><span class="dot on"></span><span>You're viewing a shared ledger. You can look but not change anything.</span>${store.kind === "supabase" && !store.session ? `<button type="button" class="btn-sm" data-signin>Sign in</button>` : ""}</div>` : ""}
      <section class="key" aria-label="Rank colours">${scheme.tiers.map(t => `<div>${tierBadge(scheme, t, 44)}<span><strong>${esc(t.name)}</strong><small>${esc(t.note || cname(t.color) + " " + PROF.head)}</small></span></div>`).join("")}</section>

        <section class="list" aria-labelledby="army-h">
          <div class="list-head">
            <h2 class="eyebrow" id="army-h">Your army</h2>
            ${canWrite ? `<button type="button" class="primary btn-add" id="b-add">+ Add unit</button>` : ""}
            <div class="list-tools">
              <input type="search" class="search" id="q" placeholder="Search units" aria-label="Search units">
              <div class="filters" id="filters" role="group" aria-label="Filter by status">
                <button type="button" data-f="all" aria-pressed="true">All</button>
                <button type="button" data-f="todo" aria-pressed="false">To paint</button>
                <button type="button" data-f="progress" aria-pressed="false">In progress</button>
                <button type="button" data-f="done" aria-pressed="false">Painted</button>
              </div>
            </div>
          </div>
          <div class="list-tools arrange">
            <label class="inline">Group by<select id="g-by">
              <option value="none">Nothing</option><option value="role">Role</option><option value="rank">Rank</option><option value="status">Status</option></select></label>
            <label class="inline">Sort by<select id="s-by">
              <option value="rank">Rank</option><option value="name">Name</option><option value="points">Points</option><option value="progress">Progress</option><option value="recent">Recently changed</option></select></label>
          </div>
          <div class="cards" id="cards"><div class="empty">Loading units…</div></div>
        </section>
      ${canWrite ? `<button type="button" class="fab primary" id="b-fab" aria-label="Add a unit">+ Add unit</button>` : ""}

      <dialog id="editdlg" class="editdlg" aria-labelledby="ed-title">
        <form id="form" class="editor-form" autocomplete="off" novalidate>
          <header class="ed-top">
            <div class="ed-titles"><h2 id="ed-title">New unit</h2><span class="dirty" id="dirty" hidden>Unsaved changes</span></div>
            <button type="button" class="btn-sm" id="ed-close">Close</button>
          </header>
          <fieldset class="wrapper" id="fs-all" ${canWrite ? "" : "disabled"}>
          <div class="ed-body">
            <div class="ed-col ed-left">
              <div class="preview"><span id="pv-svg"></span><div><div class="pv-name" id="pv-name">Unnamed unit</div><div class="pv-meta" id="pv-meta">—</div></div></div>
          <fieldset>
            <legend>Photo</legend>
            <div class="drop" id="drop">
              <div class="thumb" id="thumb">No photo</div>
              <div class="dz-text"><span>Drop a photo here, or choose one. JPG, PNG or WebP.</span>
                <div class="dz-btns"><button type="button" id="b-photo">Choose photo</button><button type="button" id="b-photo-rm" hidden>Remove</button></div></div>
              <input type="file" id="f-photo" accept="image/jpeg,image/png,image/webp,image/gif" hidden>
            </div>
          </fieldset>
          <fieldset>
            <legend>Painting</legend>
            <div class="stages full" id="f-stages" role="group" aria-label="Painting stages">${STAGES.map(([k, l], i) => `<label class="stage"><input type="checkbox" value="${k}"><span><em>${i + 1}</em>${l}</span></label>`).join("")}</div>
            <label class="full painted-row">Models painted
              <span class="painted-ctl"><button type="button" class="btn-sm" id="pm-minus" aria-label="One fewer painted">−</button><input id="f-painted" type="number" inputmode="numeric" min="0" max="99" value="0"><span id="painted-of">of 5</span><button type="button" class="btn-sm" id="pm-plus" aria-label="One more painted">+</button><button type="button" class="btn-sm" id="pm-all">All done</button></span>
            </label>
          </fieldset>
            </div>
            <div class="ed-col ed-right">
          <fieldset>
            <legend>Unit</legend>
            <label class="full">Datasheet<select id="f-sheet"><option value="">Choose a datasheet…</option>${sheetOptions}<option value="__custom">Not listed (type it in)</option></select></label>
            <label class="full" id="custom-wrap" hidden>Datasheet name<input id="f-sheet-custom" maxlength="80" placeholder="Unit type"></label>
            <label class="full">Unit name<input id="f-name" maxlength="80" placeholder="e.g. Brother Aldric's squad"></label>
            <label>Rank<select id="f-tier">${scheme.tiers.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join("")}</select></label>
            <label>Models<input id="f-count" type="number" inputmode="numeric" min="1" max="99" value="5"></label>
            <label>Points<input id="f-points" type="number" inputmode="numeric" min="0" max="9999" step="5"></label>
            <div class="pts-hint" id="pts-hint"></div>
          </fieldset>
          <fieldset>
            <legend>${esc(PROF.legends.head)}</legend>
            <div class="full headseg" role="radiogroup" aria-label="Head">
              <label><input type="radio" name="head" value="helmet" checked><span>${esc(PROF.head[0].toUpperCase() + PROF.head.slice(1))}</span></label>
              ${PROF.bare ? `<label><input type="radio" name="head" value="bare"><span>Bare head</span></label>` : ""}
              <label><input type="radio" name="head" value="none"><span>None</span></label>
            </div>
            <p class="hint full" id="head-hint"></p>
            <div class="hd-when" data-when="helmet">${colorField("helmet", esc(LB.helmet))}</div>
            ${skinInHead ? `<div class="hd-when" data-when="bare">${colorField("skin", esc(LB.skin))}</div>` : ""}
            <div class="hd-when" data-when="helmet bare">${colorField("lens", `<span id="lens-lbl">${esc(LB.lens)}</span>`)}</div>
            <label class="full hd-when" data-when="helmet bare"><span id="hdetail-lbl">${esc(PROF.detail[0])}</span><input id="f-hdetail" list="dl-hdetail" maxlength="60" placeholder="${esc(PROF.detail[1])}"></label>
          </fieldset>
          <fieldset>
            <legend>${esc(PROF.legends.body)}</legend>
            ${colorField("armour", esc(LB.armour))}
            ${colorField("secondary", esc(LB.secondary))}
            ${colorField("trim", esc(LB.trim))}
            ${colorField("emblem", esc(LB.emblem) + " colour")}
            <label class="full">Emblem<select id="f-shape">
              <option value="">Army emblem (${esc(P.emblemName(scheme.shape))})</option>
              <optgroup label="${esc(f.name)} icons">${sheetIcons.map(i => `<option value="icon:${esc(i.id)}">${esc(i.n)}</option>`).join("")}</optgroup>
              <optgroup label="Simple shapes">${P.SHAPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</optgroup>
            </select></label>
          </fieldset>
          <fieldset>
            <legend>${esc(PROF.legends.details)}</legend>
            ${colorField("cloth", esc(LB.cloth))}
            ${colorField("metal", esc(LB.metal))}
            ${PROF.skinAlways ? colorField("skin", esc(LB.skin)) : ""}
            <label class="full">${esc(PROF.extras[0])}<input id="f-extras" maxlength="120" placeholder="${esc(PROF.extras[1])}"></label>
          </fieldset>
          <fieldset>
            <legend>Weapons</legend>
            <label class="full">Melee weapon<input id="f-melee" list="dl-melee" maxlength="120" placeholder="Choose or type"></label>
            <label class="full">Ranged weapon<input id="f-ranged" list="dl-ranged" maxlength="120" placeholder="Choose or type"></label>
          </fieldset>
          <fieldset>
            <legend>Paint recipes</legend>
            <div class="full recipe-picks" id="f-recipes"></div>
            <div class="full"><button type="button" class="btn-sm" id="f-manage-recipes">Manage recipes</button></div>
          </fieldset>
          <fieldset>
            <legend>Notes</legend>
            <label class="full">Paint notes<textarea id="f-paints" rows="2" maxlength="600" placeholder="Anything extra for this unit, e.g. freehand banner colours"></textarea></label>
            <label class="full">Notes<textarea id="f-notes" rows="2" maxlength="600" placeholder="Leader attached, magnetised arms, ideas…"></textarea></label>
          </fieldset>
            </div>
          </div>
          </fieldset>
          <footer class="ed-bar">
            <button type="button" class="danger" id="b-del" hidden>Delete</button>
            <div class="msg" id="msg" role="status" aria-live="polite"></div>
            <div class="ed-bar-actions">
              <button type="button" id="b-cancel">Cancel</button>
              <button type="button" id="b-save-new">Save &amp; add another</button>
              <button type="submit" class="primary" id="b-save">Add unit</button>
            </div>
          </footer>
        </form>
      </dialog>
      <datalist id="dl-scheme">${schemeColors.map(c => `<option value="${c}"></option>`).join("")}</datalist>
      <datalist id="dl-melee"></datalist><datalist id="dl-ranged"></datalist>
      <datalist id="dl-face"><option>War paint</option><option>Scars</option><option>Tattoos</option><option>Bionic eye</option><option>Beard</option><option>Service studs</option></datalist>
      <datalist id="dl-hdetail">${PROF.detailOpts.map(o => `<option>${esc(o)}</option>`).join("")}</datalist>

      <dialog id="paintdlg" class="paintdlg" aria-labelledby="pd-h">
        <div class="pd-wrap">
          <header class="ed-top">
            <div class="ed-titles"><h2 id="pd-h">Paints &amp; recipes</h2></div>
            <button type="button" class="btn-sm" id="pd-close">Close</button>
          </header>
          <div class="pd-tabs"><div class="seg" role="tablist" id="pd-tabs">
            <button type="button" role="tab" data-tab="recipes" aria-pressed="true">Recipes</button>
            ${canWrite ? `<button type="button" role="tab" data-tab="owned" aria-pressed="false">My paints</button>
            <button type="button" role="tab" data-tab="buy" aria-pressed="false">To buy <span class="buy-badge" id="buy-tab" hidden></span></button>` : ""}
          </div></div>
          <div class="pd-body" id="pd-body"></div>
        </div>
      </dialog>

      <dialog id="sharedlg" class="small" aria-labelledby="sh-h">
        <div class="dlg-close"><button type="button" data-close>Close</button></div>
        <div class="sharebox">
          <h2 id="sh-h">Share this ledger</h2>
          ${store.canShare ? `
          <label class="switch"><input type="checkbox" id="sh-on" ${army.public ? "checked" : ""}><span class="track" aria-hidden="true"><i></i></span><span>Anyone with the link can view</span></label>
          <p class="hint">People with the link see your units, colours, photos, points and progress. They can't change anything, and they don't need an account. Turn this off at any time to stop sharing.</p>
          <div class="copyrow" id="sh-row" ${army.public ? "" : "hidden"}><input id="sh-link" readonly value="${esc(location.origin + location.pathname + "#/army/" + army.id)}" aria-label="Share link"><button type="button" class="primary" id="sh-copy">Copy link</button></div>`
          : `<p class="hint">Sharing needs the online database. Add your Supabase details in <code>js/config.js</code> and sign in to share ledgers.</p>`}
          <div class="msg" id="sh-msg" role="status"></div>
        </div>
      </dialog>

      <dialog id="listdlg" aria-labelledby="ld-h">
        <div class="dlg-close"><button type="button" data-close>Close</button></div>
        <div class="listimp">
          <h2 id="ld-h">Import army list</h2>
          <p class="hint">Paste the text export from the Warhammer 40,000 app, New Recruit or BattleScribe. Units are matched to ${esc(f.name)} datasheets.</p>
          <textarea id="ld-text" rows="10" spellcheck="false" placeholder="Marshal (80 points)&#10;  • Warlord&#10;  • 1x Master-crafted power weapon&#10;&#10;Crusader Squad (150 points)&#10;  • 5x Initiate&#10;  • 5x Neophyte"></textarea>
          <div class="row-actions"><button type="button" class="btn-sm" id="ld-read">Read list</button><span class="hint" id="ld-sum"></span></div>
          <div id="ld-out"></div>
          <div class="row-actions" id="ld-actions" hidden>
            <button type="button" class="primary" id="ld-add">Add units</button>
            <label class="check" id="ld-lim-wrap" hidden><input type="checkbox" id="ld-lim" checked> <span id="ld-lim-text"></span></label>
          </div>
          <div class="msg" id="ld-msg" role="status"></div>
        </div>
      </dialog>
    `;
    app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));
    $("g-by").value = prefs.group; $("s-by").value = prefs.sort;

    /* ---------- state ---------- */
    let units = [], selId = null, filter = "all", query = "", armed = false, dirty = false, busy = false;
    let pendingPhoto = null, removePhoto = false, tierTouched = false, pointsTouched = false;
    const form = $("form");
    const COLOR_IDS = ["helmet","lens","skin","armour","secondary","trim","emblem","cloth","metal"].filter(k => k !== "skin" || hasSkin);
    let headTouched = false;
    const getHead = () => (form.querySelector('input[name="head"]:checked') || {}).value || "helmet";
    function setHead(h){
      if(h === "bare" && !PROF.bare) h = "helmet";
      form.querySelectorAll('input[name="head"]').forEach(i => i.checked = i.value === h);
      form.querySelectorAll(".hd-when").forEach(el => el.hidden = !el.dataset.when.split(" ").includes(h));
      $("lens-lbl").textContent = h === "bare" ? "Eyes" : LB.lens;
      $("hdetail-lbl").textContent = h === "bare" ? "Face paint & detail" : PROF.detail[0];
      $("f-hdetail").setAttribute("list", h === "bare" ? "dl-face" : "dl-hdetail");
      $("f-hdetail").placeholder = h === "bare" ? "e.g. war paint, scars, tattoos, bionic eye" : PROF.detail[1];
      $("head-hint").textContent = h === "bare" ? `For a painted face: pick a skin tone${skinInHead ? "" : " (under " + PROF.legends.details + ")"} and note any war paint or scars.` : h === "none" ? "No head to paint, e.g. vehicles, monsters and walkers." : "";
      $("head-hint").hidden = h === "helmet";
    }

    function defaults(){
      const c = scheme.colors, t = scheme.tiers[0];
      return {datasheet:"", role:"", name:"", count:5, points:0, stages:[], painted:0, recipes:[], tier:0, helmet:t.color, lens:c.lens, hdetail:"", head:PROF.defaultHead, skin:c.skin,
        armour:c.armour, secondary:c.secondary, trim:c.trim, emblem:c.emblem, shape:"", cloth:c.cloth, metal:c.metal,
        extras:"", melee:"", ranged:"", paints:"", notes:""};
    }
    const readStages = () => [...$("f-stages").querySelectorAll("input:checked")].map(i => i.value);
    function readForm(){
      const sel = $("f-sheet").value;
      const datasheet = sel === "__custom" ? $("f-sheet-custom").value.trim() : sel;
      const sh = sel && sel !== "__custom" ? sheetFor(sel) : null;
      const count = Math.min(99, Math.max(1, parseInt($("f-count").value, 10) || 1));
      const o = {datasheet, role: sh ? sh.r : "", name: $("f-name").value.trim(), count,
        points: Math.max(0, parseInt($("f-points").value, 10) || 0), stages: readStages(),
        painted: Math.min(count, Math.max(0, parseInt($("f-painted").value, 10) || 0)),
        tier: +$("f-tier").value || 0, hdetail: $("f-hdetail").value.trim(), head: getHead(),
        shape: $("f-shape").value, extras: $("f-extras").value.trim(), melee: $("f-melee").value.trim(), ranged: $("f-ranged").value.trim(),
        paints: $("f-paints").value.trim(), notes: $("f-notes").value.trim(),
        recipes: [...$("f-recipes").querySelectorAll("input:checked")].map(i => i.value)};
      o.status = S.deriveStatus(o.stages, o.painted, o.count);
      o.noHelmet = o.head === "bare";
      COLOR_IDS.forEach(k => o[k] = $("f-" + k).value);
      return o;
    }
    function writeForm(u){
      const d = {...defaults(), ...u};
      const known = d.datasheet && sheets.some(s => s.n === d.datasheet);
      $("f-sheet").value = !d.datasheet ? "" : known ? d.datasheet : "__custom";
      $("f-sheet-custom").value = known ? "" : d.datasheet;
      $("custom-wrap").hidden = $("f-sheet").value !== "__custom";
      $("f-name").value = d.name; $("f-count").value = d.count;
      $("f-points").value = d.points || "";
      $("f-stages").querySelectorAll("input").forEach(i => i.checked = (d.stages || []).includes(i.value));
      $("f-painted").value = d.painted || 0;
      renderRecipePicks(d.recipes || []);
      $("f-tier").value = String(Math.min(d.tier, scheme.tiers.length - 1));
      $("f-hdetail").value = d.hdetail; setHead(headOf(d));
      $("f-shape").value = [...$("f-shape").options].some(o => o.value === d.shape) ? d.shape : "";
      ["extras","melee","ranged","paints","notes"].forEach(k => $("f-" + k).value = d[k] || "");
      COLOR_IDS.forEach(k => $("f-" + k).value = ART.hexOk(d[k]) ? d[k] : (defaults()[k] || "#1f1f22"));
      fillWeapons(); preview();
    }
    function fillWeapons(){
      const sel = $("f-sheet").value, sh = sel && sel !== "__custom" ? sheetFor(sel) : null;
      $("dl-melee").innerHTML = (sh && sh.wm || []).map(w => `<option value="${esc(w)}"></option>`).join("");
      $("dl-ranged").innerHTML = (sh && sh.wr || []).map(w => `<option value="${esc(w)}"></option>`).join("");
      $("f-melee").placeholder = sh && sh.wm ? sh.wm.slice(0, 2).join(", ") + (sh.wm.length > 2 ? "…" : "") : "Choose or type";
      $("f-ranged").placeholder = sh && sh.wr ? sh.wr.slice(0, 2).join(", ") + (sh.wr.length > 2 ? "…" : "") : "Choose or type";
    }
    function updatePointsHint(){
      const sel = $("f-sheet").value, sh = sel && sel !== "__custom" ? sheetFor(sel) : null;
      const count = Math.max(1, parseInt($("f-count").value, 10) || 1);
      const auto = ptsFor(sh, count);
      const cur = parseInt($("f-points").value, 10) || 0;
      const h = $("pts-hint");
      if(auto == null){ h.innerHTML = sh ? "No points listed for this datasheet." : ""; return; }
      const br = (sh.pb || []).map(([lo, hi, v]) => `${hi && hi !== lo ? lo + "–" + hi : lo + (hi ? "" : "+")} models ${v}`).join(" · ");
      h.innerHTML = cur === auto ? `Datasheet cost for ${plural(count, "model")}${br ? ` <span>(${esc(sh.p)} base · ${esc(br)})</span>` : ""}`
        : `Datasheet cost is ${auto} pts. <button type="button" class="linkbtn" id="pts-reset">Use ${auto}</button>`;
    }
    function preview(){
      const u = readForm();
      $("pv-svg").innerHTML = unitBadge(u, scheme, 120);
      $("pv-name").textContent = u.name || u.datasheet || "Unnamed unit";
      const tier = scheme.tiers[u.tier];
      $("pv-meta").textContent = [u.datasheet || "Unit", tier && tier.name, plural(u.count, "model"), u.points ? u.points + " pts" : ""].filter(Boolean).join(" · ");
      app.querySelectorAll("[data-cn]").forEach(s => s.textContent = cname($("f-" + s.dataset.cn).value));
      $("painted-of").textContent = "of " + u.count;
      $("f-painted").max = u.count;
      updatePointsHint();
    }
    const edOpen = () => $("editdlg").open;
    // Messages show in the editor's bar while it's open, otherwise as a toast.
    const msg = (t, err) => { const m = $("msg"); m.textContent = edOpen() ? t : ""; m.classList.toggle("err", !!err); if(t && !edOpen()) toast(t); };
    const setDirty = v => { dirty = v; $("dirty").hidden = !v; };
    const disarm = () => { armed = false; const b = $("b-del"); b.classList.remove("armed"); b.textContent = "Delete"; };
    const currentUnit = () => units.find(x => x.id === selId);
    function setPhotoUI(){
      const cur = currentUnit();
      const url = pendingPhoto ? pendingPhoto.url : (!removePhoto && cur ? safeImg(cur.image) : "");
      $("thumb").innerHTML = url ? `<img src="${esc(url)}" alt="">` : "No photo";
      $("b-photo").textContent = url ? "Replace photo" : "Choose photo";
      $("b-photo-rm").hidden = !url;
    }
    function clearPending(){ if(pendingPhoto) URL.revokeObjectURL(pendingPhoto.url); pendingPhoto = null; removePhoto = false; }
    function setEditing(u){
      $("ed-title").textContent = u ? "Edit unit" : "New unit";
      $("b-save").textContent = u ? "Save changes" : "Add unit";
      $("b-del").hidden = !u || !canWrite;
      $("b-save-new").hidden = !!u;
    }
    function editUnit(id){
      const u = units.find(x => x.id === id); if(!u) return;
      selId = id; tierTouched = true; pointsTouched = true; headTouched = true; clearPending(); writeForm(u); disarm(); setEditing(u); setPhotoUI(); setDirty(false); msg(""); render();
      openEditor(); $("f-name").focus({preventScroll: true});
    }
    function newUnit(focus){
      selId = null; tierTouched = false; pointsTouched = false; headTouched = false; clearPending(); writeForm(defaults()); disarm(); setEditing(null); setPhotoUI(); setDirty(false); msg(""); render();
      if(focus) $("f-sheet").focus();
    }
    function openEditor(){
      const d = $("editdlg");
      if(!d.open) d.showModal();
      d.scrollTop = 0;
    }
    async function openNew(){
      if(edOpen() && !(await okToLeave())) return;
      newUnit(false); openEditor(); setTimeout(() => $("f-sheet").focus(), 50);
    }
    async function closeEditor(){
      if(!(await okToLeave())) return;
      if(edOpen()) $("editdlg").close();
      newUnit(false);
    }
    // Moving away from unsaved edits: Save, Discard or Keep editing.
    async function okToLeave(){
      if(!dirty || !canWrite) return true;
      const cur = currentUnit();
      const c = await askLeave(cur ? `Your changes to ${cur.name} haven't been saved.` : "This new unit hasn't been saved yet.");
      if(c === "discard"){ setDirty(false); return true; }
      if(c === "save") return await saveCurrent();
      return false;
    }

    /* ---------- toast with undo ---------- */
    let toastTimer = null, toastDone = null;
    function toast(text, undo, onExpire){
      const t = $("toast");
      if(toastDone){ const fn = toastDone; toastDone = null; fn(); }
      t.querySelector("span").textContent = text;
      const b = t.querySelector("button");
      b.hidden = !undo;
      b.onclick = async () => { clearTimeout(toastTimer); toastDone = null; t.hidden = true; if(undo) await undo(); };
      t.hidden = false;
      toastDone = onExpire || null;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { t.hidden = true; if(toastDone){ const fn = toastDone; toastDone = null; fn(); } }, 8000);
    }

    /* ---------- progress helpers ---------- */
    const stageIndex = u => { let i = -1; STAGE_KEYS.forEach((k, j) => { if((u.stages || []).includes(k)) i = j; }); return i; };
    const progressOf = u => u.count ? ((u.stages || []).length / STAGE_KEYS.length) * .5 + (u.painted / u.count) * .5 : 0;
    function nextStep(u){
      if(u.status === "done") return null;
      const i = stageIndex(u);
      if(i < STAGE_KEYS.length - 1){
        const k = STAGE_KEYS[i + 1];
        const stages = STAGE_KEYS.slice(0, i + 2);
        const painted = k === "varnish" ? u.count : u.painted;
        return {stages, painted, label: (STAGES.find(s => s[0] === k) || ["", k])[1]};
      }
      if(u.painted < u.count) return {stages: u.stages, painted: u.count, label: "All models painted"};
      return null;
    }
    // Every model painted counts as Painted, even if the step boxes weren't ticked.
    const stageLabel = u => { if(u.status === "done") return "Painted"; const i = stageIndex(u); return i < 0 ? "Not started" : STAGES[i][1]; };

    /* ---------- list ---------- */
    const rankOf = u => ROLE_ORDER.indexOf(u.role) < 0 ? 99 : ROLE_ORDER.indexOf(u.role);
    const SORTS = {
      rank: (a, b) => (b.tier - a.tier) || (rankOf(a) - rankOf(b)) || String(a.name).localeCompare(String(b.name)),
      name: (a, b) => String(a.name).localeCompare(String(b.name)),
      points: (a, b) => (b.points - a.points) || String(a.name).localeCompare(String(b.name)),
      progress: (a, b) => (progressOf(b) - progressOf(a)) || String(a.name).localeCompare(String(b.name)),
      recent: (a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
    };
    function visible(){
      const q = query.toLowerCase();
      return units.filter(u => {
        if(filter === "done" && u.status !== "done") return false;
        if(filter === "progress" && !(u.status === "progress" || u.status === "primed" || u.status === "built")) return false;
        if(filter === "todo" && u.status === "done") return false;
        if(q && ![u.name, u.datasheet, u.role, u.melee, u.ranged, u.notes, (scheme.tiers[u.tier] || {}).name].join(" ").toLowerCase().includes(q)) return false;
        return true;
      }).sort(SORTS[prefs.sort] || SORTS.rank);
    }
    function groupsOf(list){
      const g = prefs.group;
      if(g === "none") return [["", list]];
      const keyOf = g === "role" ? (u => u.role || "Other") : g === "rank" ? (u => (scheme.tiers[u.tier] || {}).name || "Other") : (u => STATUS[u.status] || "Unbuilt");
      const order = g === "role" ? ROLE_ORDER : g === "rank" ? scheme.tiers.map(t => t.name).reverse() : ["Painted","In progress","Primed","Built","Unbuilt"];
      const m = new Map();
      list.forEach(u => { const k = keyOf(u); if(!m.has(k)) m.set(k, []); m.get(k).push(u); });
      return [...m.entries()].sort((a, b) => ((order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99)));
    }
    const weaponsText = u => [u.melee, u.ranged].filter(Boolean).join(" + ") || "—";
    // Units saved without a colour fall back to the army's colours.
    const withColours = u => {
      const o = {...u};
      COLOR_IDS.forEach(k => { if(!ART.hexOk(o[k])) o[k] = k === "helmet" ? (scheme.tiers[o.tier] || scheme.tiers[0]).color : scheme.colors[k]; });
      o.head = headOf(o);
      return o;
    };
    function cardHtml(u){
      u = withColours(u);
      const img = safeImg(u.image), tier = scheme.tiers[u.tier] || {};
      const nx = canWrite ? nextStep(u) : null;
      const segs = STAGE_KEYS.map(k => `<i class="${(u.stages || []).includes(k) ? "on" : ""}"></i>`).join("");
      return `<div class="card${u.id === selId ? " sel" : ""}" tabindex="0" role="button" data-id="${esc(u.id)}" aria-label="View ${esc(u.name)}">
        ${img ? `<div class="photo"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>` : ""}
        <div class="body">
          <div class="card-top">${unitBadge(u, scheme, 60)}<div><h3>${esc(u.name)}</h3><div class="type">${esc([u.datasheet && u.datasheet !== u.name ? u.datasheet : "", u.role].filter(Boolean).join(" · ") || "Unit")}</div></div>${u.points ? `<span class="pts">${fmt(u.points)}<small>pts</small></span>` : ""}</div>
          <dl>
            <dt>Rank</dt><dd>${esc(tier.name || "—")}</dd>
            ${u.head === "none" ? "" : `<dt>${u.head === "bare" ? "Face" : esc(LB.helmet)}</dt><dd>${u.head === "bare" ? chip(u.skin) + "Bare head" : chip(u.helmet) + esc(cname(u.helmet))}${u.hdetail ? ", " + esc(u.hdetail) : ""}</dd>`}
            <dt>${esc(LB.armour)}</dt><dd>${chip(u.armour)}${esc(cname(u.armour))}, ${esc(cname(u.trim))} ${esc(LB.trim.toLowerCase())}</dd>
            ${PROF.skinAlways ? `<dt>${esc(LB.skin)}</dt><dd>${chip(u.skin)}${esc(cname(u.skin))}</dd>` : ""}
            <dt>Weapons</dt><dd>${esc(weaponsText(u))}</dd>
            ${recipesOf(u).length ? `<dt>Recipes</dt><dd>${esc(recipesOf(u).map(r => r.name).join(", "))}${canWrite && missingFor(u).length ? ` <span class="need">${missingFor(u).length} to buy</span>` : ""}</dd>` : ""}
          </dl>
          <div class="progress" title="${esc(stageLabel(u))}"><div class="segs" aria-hidden="true">${segs}</div><span>${u.painted}/${u.count} painted</span></div>
          <div class="card-foot">
            ${nx ? `<button type="button" class="pill s-${esc(u.status)} step" data-step="${esc(u.id)}" title="Mark next: ${esc(nx.label)}"><span>${esc(stageLabel(u))}</span><b>→ ${esc(nx.label)}</b></button>`
                 : `<span class="pill s-${esc(u.status)}">${esc(u.status === "done" ? "Painted" : stageLabel(u))}</span>`}
            <span>${plural(u.count, "model")}</span>
          </div>
        </div></div>`;
    }
    function render(){
      // Units saved before points existed pick up their datasheet cost (kept when the unit is next saved).
      units.forEach(u => { if(!u.points && u.datasheet){ const p = ptsFor(sheetFor(u.datasheet), u.count); if(p) u.points = p; } });
      const list = visible(), c = $("cards");
      if(!list.length){ c.innerHTML = `<div class="empty">${units.length ? "No units match." : canWrite ? "No units yet. Pick a datasheet in the form, or import your army list." : "No units in this ledger yet."}</div>`; }
      else c.innerHTML = groupsOf(list).map(([name, us]) => (name ? `<h3 class="group-h"><span>${esc(name)}</span><small>${plural(us.length, "unit")} · ${fmt(us.reduce((a, u) => a + (u.points || 0), 0))} pts · ${us.reduce((a, u) => a + u.painted, 0)}/${us.reduce((a, u) => a + u.count, 0)} painted</small></h3>` : "") + us.map(cardHtml).join("")).join("");
      const models = units.reduce((a, u) => a + (+u.count || 0), 0);
      const done = units.reduce((a, u) => a + (+u.painted || 0), 0);
      const pts = units.reduce((a, u) => a + (+u.points || 0), 0);
      const pct = models ? Math.round(done / models * 100) : 0;
      $("st-units").textContent = units.length; $("st-done").textContent = `${done}/${models}`; $("st-pct").textContent = pct + "%";
      $("st-pts").textContent = fmt(pts);
      const lim = scheme.limit || 0, sp = app.querySelector(".stat-pts");
      $("pts-bar").style.width = lim ? Math.min(100, pts / lim * 100) + "%" : "0";
      sp.classList.toggle("over", !!lim && pts > lim);
      sp.title = lim ? (pts > lim ? `${fmt(pts - lim)} pts over your ${fmt(lim)} limit` : `${fmt(lim - pts)} pts left of ${fmt(lim)}`) : "No points limit set";
      $("bar").style.width = pct + "%";
      updateBuyBadge();
    }
    function openDetail(id){
      const found = units.find(x => x.id === id); if(!found) return;
      const u = withColours(found);
      const img = safeImg(u.image), tier = scheme.tiers[u.tier] || {};
      const col = hex => ART.hexOk(hex) ? chip(hex) + esc(cname(hex)) : "";
      const sec = (title, rows) => { const r = rows.filter(x => x[1]); return r.length ? `<section><h4>${title}</h4><dl>${r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></section>` : ""; };
      $("detail-body").innerHTML = `<div class="detail">
        <div class="media">${img ? `<img src="${esc(img)}" alt="Photo of ${esc(u.name)}">` : unitBadge(u, scheme, 180)}</div>
        <div class="info">
          <div><h2 id="dt-name">${esc(u.name)}</h2>
            <div class="meta">${esc(u.datasheet || "Unit")}${u.role ? " · " + esc(u.role) : ""} · ${plural(u.count, "model")}${u.points ? " · " + fmt(u.points) + " pts" : ""}</div></div>
          <div class="row">${img ? unitBadge(u, scheme, 64) : ""}<span class="pill s-${esc(u.status)}">${esc(u.status === "done" ? "Painted" : stageLabel(u))}</span></div>
          <section><h4>Painting</h4>
            <div class="stage-list">${STAGES.map(([k, l]) => `<span class="${(u.stages || []).includes(k) ? "on" : ""}">${l}</span>`).join("")}</div>
            <p class="prose" style="margin-top:10px">${u.painted} of ${plural(u.count, "model")} painted</p></section>
          ${recipesOf(u).map(r => `<section><h4>Recipe · ${esc(r.name)}${r.area ? " · " + esc(r.area) : ""}</h4>${stepsHtml(r)}</section>`).join("")}
          ${sec("Rank", [["Rank", esc(tier.name)], ["Who", esc(tier.note)]])}
          ${u.head === "none" ? sec(esc(PROF.legends.head), [["Head", "None (vehicle or monster)"]])
            : u.head === "bare" ? sec(esc(PROF.legends.head), [["Head", "Bare head"], ["Skin", col(u.skin)], ["Eyes", col(u.lens)], ["Face paint", esc(u.hdetail)]])
            : sec(esc(PROF.legends.head), [[esc(LB.helmet), col(u.helmet)], [esc(LB.lens), col(u.lens)], ["Detail", esc(u.hdetail)]])}
          ${sec(esc(PROF.legends.body), [[esc(LB.armour), col(u.armour)], [esc(LB.secondary), col(u.secondary)], [esc(LB.trim), col(u.trim)], [esc(LB.emblem), (u.shape || scheme.shape) === "none" ? "None" : col(u.emblem) + " · " + esc(P.emblemName(u.shape || scheme.shape))]])}
          ${sec(esc(PROF.legends.details), [[esc(LB.cloth), col(u.cloth)], [esc(LB.metal), col(u.metal)], [esc(LB.skin), PROF.skinAlways ? col(u.skin) : ""], ["Extras", esc(u.extras)]])}
          ${sec("Weapons", [["Melee", esc(u.melee)], ["Ranged", esc(u.ranged)]])}
          ${u.paints ? `<section><h4>Paint notes</h4><p class="prose">${esc(u.paints)}</p></section>` : ""}
          ${u.notes ? `<section><h4>Notes</h4><p class="prose">${esc(u.notes)}</p></section>` : ""}
          ${canWrite ? `<section class="row-actions"><button type="button" class="primary" data-edit="${esc(u.id)}">Edit unit</button><button type="button" data-dup="${esc(u.id)}">Duplicate</button><button type="button" class="danger" data-del="${esc(u.id)}">Delete</button></section>` : ""}
        </div></div>`;
      $("detail").showModal(); $("detail").scrollTop = 0;
    }

    /* ---------- quick stage step from a card ---------- */
    async function stepUnit(id){
      const u = units.find(x => x.id === id); if(!u || busy) return;
      const nx = nextStep(u); if(!nx) return;
      const before = {stages: u.stages.slice(), painted: u.painted};
      const save = async vals => {
        const row = await store.saveUnit(army.id, {...u, ...vals}, u.id, null, false, u);
        units = units.map(x => x.id === row.id ? row : x);
        if(selId === row.id && !dirty) writeForm(row);
        render();
        return row;
      };
      try { busy = true; await save({stages: nx.stages, painted: nx.painted}); toast(`${u.name}: ${nx.label}`, async () => { try { await save(before); } catch(e){ msg("Couldn't undo: " + errText(e), true); } }); }
      catch(err){ msg("Couldn't update: " + errText(err), true); }
      finally { busy = false; }
    }

    /* ---------- events ---------- */
    form.addEventListener("input", e => {
      if(e.target.id === "f-photo") return;
      if(e.target.id === "f-points") pointsTouched = true;
      if(e.target.name === "head"){ headTouched = true; setHead(getHead()); }
      if(e.target.id === "f-count" && !pointsTouched){ const sel = $("f-sheet").value; const p = ptsFor(sel && sel !== "__custom" ? sheetFor(sel) : null, Math.max(1, parseInt($("f-count").value, 10) || 1)); if(p != null) $("f-points").value = p; }
      if(e.target.closest && e.target.closest("#f-stages") && e.target.value === "varnish" && e.target.checked) $("f-painted").value = $("f-count").value;
      setDirty(true); preview();
    });
    form.addEventListener("click", e => {
      const t = e.target.closest("button"); if(!t) return;
      const cnt = Math.max(1, parseInt($("f-count").value, 10) || 1), pv = parseInt($("f-painted").value, 10) || 0;
      if(t.id === "pm-minus") $("f-painted").value = Math.max(0, pv - 1);
      else if(t.id === "pm-plus") $("f-painted").value = Math.min(cnt, pv + 1);
      else if(t.id === "pm-all") $("f-painted").value = cnt;
      else if(t.id === "pts-reset"){ const sel = $("f-sheet").value; const p = ptsFor(sheetFor(sel), cnt); if(p != null){ $("f-points").value = p; pointsTouched = false; } }
      else return;
      setDirty(true); preview();
    });
    $("f-sheet").addEventListener("change", () => {
      const sel = $("f-sheet").value;
      $("custom-wrap").hidden = sel !== "__custom";
      if(sel === "__custom"){ $("f-sheet-custom").focus(); }
      const sh = sel && sel !== "__custom" ? sheetFor(sel) : null;
      const nm = $("f-name");
      if(sh && (!nm.value || sheets.some(s => s.n === nm.value))) nm.value = sh.n;
      if(sh && !tierTouched){
        const t = (sh.r === "Epic Hero" || sh.r === "Character") ? Math.min(2, scheme.tiers.length - 1) : 0;
        $("f-tier").value = String(t); $("f-helmet").value = scheme.tiers[t].color;
      }
      if(!headTouched) setHead(sh ? autoHead(sh.r) : PROF.defaultHead);
      if(sh && !selId) $("f-count").value = singleRole(sh.r) ? 1 : (sh.pb && sh.pb[0] ? (sh.pb[0][0] === sh.pb[0][1] ? sh.pb[0][0] : Math.max(1, sh.pb[0][0] - 1)) : 5);
      if(sh && !pointsTouched){ const p = ptsFor(sh, Math.max(1, parseInt($("f-count").value, 10) || 1)); if(p != null) $("f-points").value = p; }
      fillWeapons(); preview();
    });
    $("f-tier").addEventListener("change", () => { tierTouched = true; const t = scheme.tiers[+$("f-tier").value]; if(t) $("f-helmet").value = t.color; preview(); });

    function takePhoto(file){
      if(!file) return;
      if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){ msg("That file type isn't supported. Use a JPG, PNG or WebP photo.", true); return; }
      if(file.size > 25 * 1024 * 1024){ msg("That photo is over 25 MB. Choose a smaller one.", true); return; }
      if(pendingPhoto) URL.revokeObjectURL(pendingPhoto.url);
      pendingPhoto = {file, url: URL.createObjectURL(file)}; removePhoto = false;
      setPhotoUI(); setDirty(true); msg("Photo added. Save to keep it.");
    }
    $("b-photo").addEventListener("click", () => $("f-photo").click());
    $("f-photo").addEventListener("change", e => { takePhoto(e.target.files && e.target.files[0]); e.target.value = ""; });
    $("b-photo-rm").addEventListener("click", () => {
      if(pendingPhoto){ URL.revokeObjectURL(pendingPhoto.url); pendingPhoto = null; }
      const cur = currentUnit(); removePhoto = !!(cur && cur.image);
      setPhotoUI(); setDirty(true); msg(removePhoto ? "Photo will be removed when you save." : "");
    });
    const drop = $("drop");
    ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => { if(!canWrite) return; e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove("over")));
    drop.addEventListener("drop", e => { if(!canWrite) return; e.preventDefault(); takePhoto(e.dataTransfer.files && e.dataTransfer.files[0]); });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const wasNew = !currentUnit(), name = $("f-name").value.trim() || $("f-sheet").value;
      if(await saveCurrent()){ $("editdlg").close(); newUnit(false); toast(wasNew ? `Added ${name}` : `Saved ${name}`); }
    });
    $("b-save-new").addEventListener("click", async () => {
      const name = $("f-name").value.trim() || $("f-sheet").value;
      if(await saveCurrent()){ newUnit(false); $("editdlg").scrollTop = 0; $("f-sheet").focus(); msg(`Added ${name}. Add the next one.`); }
    });
    $("b-cancel").addEventListener("click", closeEditor);
    $("ed-close").addEventListener("click", closeEditor);
    $("editdlg").addEventListener("cancel", e => { e.preventDefault(); closeEditor(); });
    $("editdlg").addEventListener("mousedown", e => { if(e.target === $("editdlg")) closeEditor(); });
    $("editdlg").addEventListener("keydown", e => {
      if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){ e.preventDefault(); form.requestSubmit ? form.requestSubmit() : $("b-save").click(); }
    });
    async function saveCurrent(){
      if(busy || !canWrite) return false;
      const u = readForm();
      if(!u.datasheet && !u.name){ msg("Choose a datasheet or give the unit a name.", true); $("f-sheet").focus(); return false; }
      if(!u.name) u.name = u.datasheet;
      const cur = currentUnit();
      busy = true; const b = $("b-save"), label = b.textContent; b.disabled = true; b.textContent = "Saving…";
      try {
        const row = await store.saveUnit(army.id, u, cur ? cur.id : null, pendingPhoto, removePhoto, cur);
        units = units.filter(x => x.id !== row.id).concat(row);
        clearPending(); selId = row.id; setEditing(row); setPhotoUI(); disarm(); setDirty(false);
        render();
        return true;
      } catch(err){ console.error(err); msg("Couldn't save: " + errText(err), true); return false; }
      finally { busy = false; b.disabled = !canWrite; if(b.textContent === "Saving…") b.textContent = label; }
    }
    if(canWrite){ $("b-fab").addEventListener("click", openNew); $("b-add").addEventListener("click", openNew); }
    $("b-del").addEventListener("click", async () => {
      const cur = currentUnit(); if(!cur || busy) return;
      const b = $("b-del");
      if(!armed){ armed = true; b.classList.add("armed"); b.textContent = "Click again to delete"; return; }
      busy = true; b.disabled = true;
      try { await deleteUnit(cur); setDirty(false); $("editdlg").close(); newUnit(false); }
      catch(err){ msg("Couldn't delete: " + errText(err), true); }
      finally { busy = false; b.disabled = false; }
    });
    // Delete with an 8-second Undo (the photo is only removed once Undo has gone).
    async function deleteUnit(cur){
      await store.removeUnit(cur, true);
      units = units.filter(x => x.id !== cur.id);
      if(selId === cur.id) selId = null;
      render();
      toast(`Deleted ${cur.name}`, async () => {
        try { const row = await store.restoreUnit(army.id, cur); units = units.concat(row); render(); toast(`Restored ${cur.name}`); }
        catch(err){ msg("Couldn't restore: " + errText(err), true); }
      }, () => store.purgeImage(cur));
    }
    $("b-del").addEventListener("blur", () => setTimeout(() => { if(armed && document.activeElement !== $("b-del")) disarm(); }, 0));

    $("cards").addEventListener("click", e => {
      const st = e.target.closest("[data-step]");
      if(st){ e.stopPropagation(); stepUnit(st.dataset.step); return; }
      const c = e.target.closest(".card"); if(c) openDetail(c.dataset.id);
    });
    $("cards").addEventListener("keydown", e => { if((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")){ e.preventDefault(); openDetail(e.target.dataset.id); } });
    $("filters").addEventListener("click", e => {
      const b = e.target.closest("button[data-f]"); if(!b) return;
      filter = b.dataset.f; $("filters").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); render();
    });
    $("q").addEventListener("input", e => { query = e.target.value.trim(); render(); });
    const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch(e){} };
    $("g-by").addEventListener("change", e => { prefs.group = e.target.value; savePrefs(); render(); });
    $("s-by").addEventListener("change", e => { prefs.sort = e.target.value; savePrefs(); render(); });

    /* ---------- points limit ---------- */
    let limDraft = scheme.limit || 0;
    const showLimit = on => { $("limit-edit").hidden = !on; if(on){ limDraft = scheme.limit || 0; markLim(); } };
    const markLim = () => app.querySelectorAll("[data-lim]").forEach(b => b.setAttribute("aria-pressed", +b.dataset.lim === limDraft));
    $("b-limit").addEventListener("click", () => showLimit($("limit-edit").hidden));
    $("limit-edit").addEventListener("click", async e => {
      const t = e.target.closest("button"); if(!t) return;
      if(t.dataset.lim){ limDraft = +t.dataset.lim; $("lim-custom").value = ""; markLim(); return; }
      if(t.id === "lim-cancel"){ showLimit(false); return; }
      if(t.id === "lim-save"){
        const c = parseInt($("lim-custom").value, 10); if(Number.isFinite(c)) limDraft = Math.max(0, c);
        await setLimit(limDraft); showLimit(false);
      }
    });
    async function setLimit(v){
      try {
        army = await store.saveArmy({faction: army.faction, name: army.name, scheme: {...army.scheme, limit: v}, public: army.public}, army.id);
        scheme.limit = army.scheme.limit;
        $("b-limit").textContent = scheme.limit ? fmt(scheme.limit) : "set limit";
        render();
      } catch(err){ msg("Couldn't save the limit: " + errText(err), true); }
    }

    async function onDetailClick(e){
      const ed = e.target.closest("[data-edit]"), dup = e.target.closest("[data-dup]"), del = e.target.closest("[data-del]");
      if(del){
        const u = units.find(x => x.id === del.dataset.del); if(!u || busy) return;
        if(!del.classList.contains("armed")){ del.classList.add("armed"); del.textContent = "Click again to delete"; return; }
        busy = true; del.disabled = true;
        try { await deleteUnit(u); $("detail").close(); }
        catch(err){ del.disabled = false; del.textContent = "Couldn't delete. Try again"; }
        finally { busy = false; }
        return;
      }
      if(ed){ $("detail").close(); if(await okToLeave()) editUnit(ed.dataset.edit); }
      if(dup){
        const u = units.find(x => x.id === dup.dataset.dup); $("detail").close();
        if(u && await okToLeave()){ selId = null; tierTouched = true; pointsTouched = true; headTouched = true; clearPending(); writeForm({...u, name: u.name + " (copy)"}); setEditing(null); setPhotoUI(); setDirty(true); render(); openEditor(); msg("Copy ready. Change what you need and save."); }
      }
    }
    $("detail").addEventListener("click", onDetailClick);
    ["listdlg", "sharedlg"].forEach(id => $(id).addEventListener("click", e => { if(e.target.closest("[data-close]") || e.target === $(id)) $(id).close(); }));

    /* ---------- share read-only ---------- */
    if(canWrite){
      $("b-share").addEventListener("click", () => { $("sh-msg").textContent = ""; $("sharedlg").showModal(); });
      if(store.canShare){
        $("sh-on").addEventListener("change", async e => {
          const on = e.target.checked; e.target.disabled = true; $("sh-msg").textContent = on ? "Turning sharing on…" : "Turning sharing off…";
          try {
            army = await store.saveArmy({faction: army.faction, name: army.name, scheme: army.scheme, public: on}, army.id);
            $("sh-row").hidden = !army.public;
            $("share-label").textContent = army.public ? "Shared" : "Share";
            $("b-share").classList.toggle("on", army.public);
            $("b-share").querySelector(".dot").classList.toggle("on", army.public);
            $("sh-msg").textContent = army.public ? "Sharing is on. Copy the link and send it to anyone." : "Sharing is off. The link no longer works.";
          } catch(err){
            e.target.checked = !on;
            $("sh-msg").textContent = "Couldn't change sharing: " + errText(err) + (/column|public/i.test(errText(err)) ? " Run the latest supabase-setup.sql to add sharing." : "");
          } finally { e.target.disabled = false; }
        });
        $("sh-copy").addEventListener("click", async () => {
          const inp = $("sh-link");
          try { await navigator.clipboard.writeText(inp.value); $("sh-msg").textContent = "Link copied."; }
          catch(e){ inp.select(); $("sh-msg").textContent = "Press Ctrl+C (or Cmd+C) to copy the selected link."; }
        });
      }
    }

    /* ---------- army list import ---------- */
    const norm = s => String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/\[[^\]]*\]/g, " ").replace(/[^a-z0-9']+/g, " ").trim();
    const sheetIndex = new Map();
    sheets.slice().sort((a, b) => (a.t ? 1 : 0) - (b.t ? 1 : 0)).forEach(s => { const k = norm(s.n); if(!sheetIndex.has(k)) sheetIndex.set(k, s); });
    const sheetKeys = [...sheetIndex.keys()].sort((a, b) => b.length - a.length);
    function matchSheet(text){
      const k = norm(text);
      if(sheetIndex.has(k)) return sheetIndex.get(k);
      const hit = sheetKeys.find(s => k === s || k.startsWith(s + " "));
      return hit ? sheetIndex.get(hit) : null;
    }
    const HEAD = /^(?:[a-z]+\d*\s*:\s*)?(?:(\d+)\s*x\s+)?(.+?)\s*[\(\[]\s*([\d,]+)\s*(?:pts?|points)\s*[\)\]]\s*:?\s*(.*)$/i;
    function parseList(text){
      const lines = String(text || "").replace(/\r/g, "").split("\n");
      const out = [], unmatched = [];
      let cur = null, limit = 0, softLimit = 0, baseIndent = null;
      const finish = () => { if(!cur) return; if(!cur.models){ cur.count = guessCount(cur.sheet, cur.points); } else cur.count = cur.models; out.push(cur); cur = null; };
      lines.forEach((raw, idx) => {
        const indent = raw.match(/^\s*/)[0].replace(/\t/g, "    ").length;
        const line = raw.trim().replace(/^[•◦▪·*+\-–>]+\s*/, "");
        if(!line) return;
        if(idx < 15 && !limit){
          const hh = line.match(HEAD);
          if(!(hh && matchSheet(hh[2]))){
            const m = line.match(/([\d,]{3,6})\s*(?:pts|points)/i);
            const v = m ? parseInt(m[1].replace(/,/g, ""), 10) : 0;
            if(v >= 500 && v <= 10000){ if(/strike force|incursion|onslaught|combat patrol|\+\+|roster/i.test(line)) limit = v; else if(!softLimit) softLimit = v; }
          }
        }
        const h = line.match(HEAD);
        if(h){
          const sh = matchSheet(h[2]);
          if(sh){
            finish();
            cur = {sheet: sh, name: sh.n, points: parseInt(h[3].replace(/,/g, ""), 10) || 0, models: 0, melee: [], ranged: [], notes: [], include: true};
            baseIndent = null;
            if(h[4]) parseItems(h[4], 0);
            return;
          }
          if(!/^(characters?|battleline|other datasheets|dedicated transports?|allied units|epic hero)/i.test(h[2]) && !/(strike force|incursion|onslaught|combat patrol|detachment)/i.test(h[2]) && idx > 0) unmatched.push(h[2]);
          return;
        }
        if(!cur) return;
        if(/^(characters?|battleline|other datasheets|dedicated transports?|allied units|exported with|\+\+|=+)/i.test(line)){ finish(); return; }
        if(/^warlord\b/i.test(line)){ cur.notes.push("Warlord"); return; }
        const enh = line.match(/^enhancements?\s*:\s*(.+)$/i); if(enh){ cur.notes.push("Enhancement: " + enh[1]); return; }
        if(baseIndent === null) baseIndent = indent;
        parseItems(line, indent - baseIndent);
      });
      finish();
      if(!limit) limit = softLimit;
      function parseItems(text, depth){
        text.split(/,(?![^()]*\))/).forEach(part => {
          const inner = (part.match(/\(([^)]*)\)/) || [])[1];
          const p = part.replace(/\(.*?\)/g, "").trim();
          const m = p.match(/^(\d+)\s*x\s+(.+)$/i);
          const qty = m ? parseInt(m[1], 10) : 1, name = (m ? m[2] : p).trim();
          if(!name) return;
          const wn = norm(name);
          const w = (list) => (list || []).find(x => norm(x) === wn || wn.startsWith(norm(x) + " "));
          const mw = w(cur.sheet.wm), rw = w(cur.sheet.wr);
          if(mw || rw){ if(mw && !cur.melee.includes(mw)) cur.melee.push(mw); if(rw && !cur.ranged.includes(rw)) cur.ranged.push(rw); }
          else if(m && depth <= 0) cur.models += qty;
          if(inner) parseItems(inner, depth + 1);
        });
      }
      function guessCount(sh, pts){
        if(singleRole(sh.r)) return 1;
        const br = sh.pb || [];
        const hit = br.filter(b => b[2] === pts).pop();
        if(hit) return hit[1] || Math.max(hit[0], (hit[0] - 1) * 2);
        return br.length ? (br[0][0] === br[0][1] ? br[0][0] : Math.max(1, br[0][0] - 1)) : 1;
      }
      return {units: out, unmatched, limit};
    }
    let parsed = null;
    function renderParsed(){
      const box = $("ld-out");
      if(!parsed){ box.innerHTML = ""; return; }
      const us = parsed.units;
      $("ld-sum").textContent = us.length ? `${plural(us.length, "unit")} · ${fmt(us.reduce((a, u) => a + (u.include ? u.points : 0), 0))} pts` : "";
      box.innerHTML = (us.length ? `<div class="ld-table" role="table">
          <div class="ld-row ld-head" role="row"><span></span><span>Datasheet</span><span>Models</span><span>Points</span><span>Weapons</span></div>
          ${us.map((u, i) => `<label class="ld-row" role="row"><span><input type="checkbox" data-inc="${i}" ${u.include ? "checked" : ""}></span><span><strong>${esc(u.name)}</strong><small>${esc(u.sheet.r)}${u.notes.length ? " · " + esc(u.notes.join(", ")) : ""}</small></span><span><input type="number" min="1" max="99" data-cnt="${i}" value="${u.count}"></span><span>${u.points}</span><span>${esc([...u.melee, ...u.ranged].slice(0, 3).join(", ") || "—")}</span></label>`).join("")}
        </div>` : `<p class="hint">No ${esc(f.name)} datasheets found in that text. Check the list is for this faction.</p>`)
        + (parsed.unmatched.length ? `<p class="hint">Not matched to a datasheet: ${esc(parsed.unmatched.slice(0, 12).join(", "))}${parsed.unmatched.length > 12 ? "…" : ""}</p>` : "");
      $("ld-actions").hidden = !us.length;
      $("ld-add").textContent = `Add ${plural(us.filter(u => u.include).length, "unit")}`;
      $("ld-lim-wrap").hidden = !parsed.limit || parsed.limit === scheme.limit;
      $("ld-lim-text").textContent = `Set points limit to ${fmt(parsed.limit)}`;
    }
    if(canWrite){
      $("b-list").addEventListener("click", () => { $("ld-msg").textContent = ""; $("listdlg").showModal(); $("ld-text").focus(); });
      $("ld-read").addEventListener("click", () => { parsed = parseList($("ld-text").value); renderParsed(); });
      $("ld-text").addEventListener("paste", () => setTimeout(() => { parsed = parseList($("ld-text").value); renderParsed(); }, 0));
      $("ld-out").addEventListener("input", e => {
        const t = e.target;
        if(t.dataset.inc != null){ parsed.units[+t.dataset.inc].include = t.checked; renderParsed(); }
        if(t.dataset.cnt != null){ parsed.units[+t.dataset.cnt].count = Math.min(99, Math.max(1, parseInt(t.value, 10) || 1)); }
      });
      $("ld-add").addEventListener("click", async () => {
        const pick = parsed.units.filter(u => u.include);
        if(!pick.length) return;
        const c = scheme.colors;
        const rows = pick.map(u => {
          const tierIdx = (u.sheet.r === "Epic Hero" || u.sheet.r === "Character") ? Math.min(2, scheme.tiers.length - 1) : 0;
          return {datasheet: u.sheet.n, role: u.sheet.r, name: u.name, count: u.count, points: u.points, stages: [], painted: 0, tier: tierIdx,
            helmet: scheme.tiers[tierIdx].color, head: autoHead(u.sheet.r), skin: c.skin, lens: c.lens, armour: c.armour, secondary: c.secondary, trim: c.trim, emblem: c.emblem, shape: "",
            cloth: c.cloth, metal: c.metal, melee: u.melee.join(", "), ranged: u.ranged.join(", "), notes: u.notes.join(". ")};
        });
        const b = $("ld-add"); b.disabled = true; $("ld-msg").textContent = "Adding units…";
        try {
          const n = await store.importUnits(army.id, rows);
          if(parsed.limit && !$("ld-lim-wrap").hidden && $("ld-lim").checked) await setLimit(parsed.limit);
          units = await store.listUnits(army.id); render();
          $("listdlg").close(); $("ld-text").value = ""; parsed = null; renderParsed();
          toast(`Added ${plural(n, "unit")} from your list`);
        } catch(err){ console.error(err); $("ld-msg").textContent = "Couldn't add units: " + errText(err); }
        finally { b.disabled = false; }
      });
    }

    $("b-export").addEventListener("click", () => {
      downloadJSON({app: "livery-ledger", version: 4, exported: new Date().toISOString(),
        army: {faction: army.faction, name: army.name, scheme: army.scheme},
        units: units.map(u => ({...S.cleanUnit(u), image: u.image || ""}))}, `livery-${slug(army.name)}-${new Date().toISOString().slice(0, 10)}.json`);
      msg("Backup downloaded.");
    });
    if(canWrite){
      $("b-import").addEventListener("click", () => $("f-import").click());
      $("f-import").addEventListener("change", async e => {
        const file = e.target.files && e.target.files[0]; e.target.value = "";
        if(!file) return;
        try {
          const d = JSON.parse(await file.text());
          const rows = (Array.isArray(d) ? d : d.units || []).filter(r => r && typeof r === "object" && (r.name || r.datasheet));
          if(!rows.length) throw new Error("empty");
          msg("Importing…");
          const n = await store.importUnits(army.id, rows);
          units = await store.listUnits(army.id); newUnit(false); msg(`Imported ${plural(n, "unit")}.`);
        } catch(err){ console.error(err); msg("That file isn't a Livery Ledger backup.", true); }
      });
    }
    const onBeforeUnload = e => { if(dirty && canWrite){ e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    view.guard = () => okToLeave();
    view.cleanup = () => {
      window.removeEventListener("beforeunload", onBeforeUnload); $("detail").removeEventListener("click", onDetailClick); clearPending();
      clearTimeout(toastTimer); $("toast").hidden = true; if(toastDone){ const fn = toastDone; toastDone = null; fn(); }
      view.guard = null;
    };

    /* ============================================================
       Paint recipes and paints you own
       ============================================================ */
    const PU = window.LEDGER_PAINTUI;
    const TECHNIQUES = ["Prime","Basecoat","Layer","Shade / wash","Contrast","Dry brush","Edge highlight","Highlight","Glaze","Technical","Varnish","Other"];
    const AREAS = PROF.areas;
    let owned = new Set(), ownedList = [];
    const isOwned = label => owned.has(PU.norm(label));
    const recipesOf = u => (u.recipes || []).map(id => (scheme.recipes || []).find(r => r.id === id)).filter(Boolean);
    const paintsOf = r => (r.steps || []).map(s => s.p).filter(Boolean);
    const missingFor = u => [...new Set(recipesOf(u).flatMap(paintsOf).filter(p => !isOwned(p)).map(PU.norm))];
    function stepsHtml(r){
      if(!r.steps.length) return `<p class="prose">No steps yet.</p>`;
      return `<ol class="steps">${r.steps.map(st => `<li>${PU.swatch(st.p)}<span class="st-t">${esc(st.t || "Step")}</span><span class="st-p">${esc(st.p || "—")}</span>${canWrite && st.p ? (isOwned(st.p) ? `<span class="own ok">Owned</span>` : `<span class="own no">To buy</span>`) : ""}</li>`).join("")}</ol>${r.notes ? `<p class="prose r-notes">${esc(r.notes)}</p>` : ""}`;
    }
    function renderRecipePicks(checked){
      const box = $("f-recipes"), list = scheme.recipes || [];
      const on = new Set(checked || [...box.querySelectorAll("input:checked")].map(i => i.value));
      box.innerHTML = list.length ? list.map(r => `<label class="stage"><input type="checkbox" value="${esc(r.id)}" ${on.has(r.id) ? "checked" : ""}><span>${esc(r.name)}${r.area ? `<small>${esc(r.area)}</small>` : ""}</span></label>`).join("")
        : `<p class="hint-sm">No recipes yet. Write one once, then tick it on every unit that uses it.</p>`;
      $("f-manage-recipes").textContent = list.length ? "Manage recipes" : "Create a recipe";
    }
    async function saveRecipes(list){
      army = await store.saveArmy({faction: army.faction, name: army.name, scheme: {...army.scheme, recipes: list}, public: army.public}, army.id);
      scheme.recipes = army.scheme.recipes;
      renderRecipePicks(); render(); updateBuyBadge();
    }
    async function saveOwned(list){
      ownedList = await store.setPaints(list);
      owned = new Set(ownedList.map(PU.norm));
      render(); updateBuyBadge();
    }
    function shoppingList(onlyUsed){
      const used = new Set(units.flatMap(u => u.recipes || []));
      const need = new Map();
      (scheme.recipes || []).filter(r => !onlyUsed || used.has(r.id)).forEach(r => paintsOf(r).forEach(p => {
        if(isOwned(p)) return;
        const k = PU.norm(p); if(!need.has(k)) need.set(k, {label: p, recipes: []});
        if(!need.get(k).recipes.includes(r.name)) need.get(k).recipes.push(r.name);
      }));
      return [...need.values()].sort((a, b) => a.label.localeCompare(b.label));
    }
    function updateBuyBadge(){
      if(!canWrite) return;
      const n = shoppingList(true).length;
      [$("buy-badge"), $("buy-tab")].forEach(b => { if(!b) return; b.hidden = !n; b.textContent = n; });
    }

    let pdTab = "recipes", editingRecipe = null, buyAll = false, ownedQuery = "";
    function openPaints(tab){
      pdTab = tab || pdTab; editingRecipe = null;
      $("pd-tabs").querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === pdTab));
      renderPaints();
      if(!$("paintdlg").open) $("paintdlg").showModal();
      PU.load().then(renderPaints);
    }
    function renderPaints(){
      const body = $("pd-body");
      $("pd-tabs").querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tab === pdTab));
      if(editingRecipe){ renderRecipeEditor(body); return; }
      if(pdTab === "recipes"){
        const list = scheme.recipes || [];
        body.innerHTML = `
          <div class="pd-head"><p class="hint">Write a recipe once, then tick it on every unit that uses it. Paints you don't own show as <span class="own no">To buy</span>.</p>
          ${canWrite ? `<button type="button" class="primary btn-sm" data-act="new-recipe">+ New recipe</button>` : ""}</div>
          ${list.length ? `<div class="recipes">${list.map(r => {
            const n = units.filter(u => (u.recipes || []).includes(r.id)).length;
            return `<article class="recipe">
              <header><div><h3>${esc(r.name)}</h3><small>${esc([r.area, n ? plural(n, "unit") : "Not used yet"].filter(Boolean).join(" · "))}</small></div>
              ${canWrite ? `<div class="row-actions"><button type="button" class="btn-sm" data-act="edit-recipe" data-id="${esc(r.id)}">Edit</button><button type="button" class="btn-sm" data-act="dup-recipe" data-id="${esc(r.id)}">Copy</button></div>` : ""}</header>
              ${stepsHtml(r)}</article>`; }).join("")}</div>`
            : `<div class="empty">No recipes yet.${canWrite ? " Start with your main armour colour." : ""}</div>`}`;
      } else if(pdTab === "owned"){
        const q = PU.norm(ownedQuery);
        const shown = ownedList.filter(p => !q || PU.norm(p).includes(q)).sort((a, b) => a.localeCompare(b));
        body.innerHTML = `
          <p class="hint">Paints you own are saved to your ${store.kind === "supabase" ? "account" : "browser"} and shared by all your ledgers.</p>
          <div class="add-paint"><span class="pwrap-host"><input id="op-add" placeholder="Add a paint, e.g. Abaddon Black" aria-label="Add a paint"></span><button type="button" class="primary" data-act="add-owned">Add</button></div>
          <div class="owned-head"><strong>${plural(ownedList.length, "paint")}</strong>${ownedList.length > 8 ? `<input type="search" id="op-q" class="search" placeholder="Filter" value="${esc(ownedQuery)}">` : ""}</div>
          <div class="owned">${shown.map(p => `<span class="ochip">${PU.swatch(p)}<span>${esc(p)}</span><button type="button" data-act="rm-owned" data-p="${esc(p)}" aria-label="Remove ${esc(p)}">×</button></span>`).join("") || `<p class="hint">${ownedList.length ? "No paints match." : "Nothing here yet. Add the paints on your shelf."}</p>`}</div>`;
        PU.picker($("op-add"), {owned: () => owned, extra: () => [], onPick: () => {}});
        $("op-add").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); addOwned(); } });
        const oq = $("op-q"); if(oq) oq.addEventListener("input", e => { ownedQuery = e.target.value; const pos = e.target.selectionStart; renderPaints(); const n = $("op-q"); if(n){ n.focus(); n.setSelectionRange(pos, pos); } });
      } else {
        const list = shoppingList(!buyAll);
        body.innerHTML = `
          <div class="pd-head"><p class="hint">Paints in your recipes that aren't in <em>My paints</em>.</p>
          <label class="check"><input type="checkbox" id="buy-all" ${buyAll ? "checked" : ""}> Include recipes not used by any unit</label></div>
          ${list.length ? `<ul class="buy">${list.map(it => `<li>${PU.swatch(it.label)}<span class="b-n"><strong>${esc(it.label)}</strong><small>For ${esc(it.recipes.join(", "))}</small></span><button type="button" class="btn-sm" data-act="got" data-p="${esc(it.label)}">I have it</button></li>`).join("")}</ul>
            <div class="row-actions"><button type="button" class="btn-sm" data-act="copy-buy">Copy list</button><span class="hint" id="buy-msg"></span></div>`
          : `<div class="empty">${(scheme.recipes || []).length ? "You have every paint you need." : "Add some recipes first."}</div>`}`;
        $("buy-all").addEventListener("change", e => { buyAll = e.target.checked; renderPaints(); });
      }
    }
    function renderRecipeEditor(body){
      const r = editingRecipe;
      body.innerHTML = `
        <div class="r-edit">
          <div class="r-grid">
            <label>Recipe name<input id="re-name" maxlength="60" value="${esc(r.name)}" placeholder="e.g. Black armour"></label>
            <label>Used for<select id="re-area"><option value="">Choose…</option>${(r.area && !AREAS.includes(r.area) ? [r.area, ...AREAS] : AREAS).map(a => `<option ${a === r.area ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>
          </div>
          <h4 class="em-h">Steps</h4>
          <ol class="r-steps" id="re-steps">${r.steps.map((st, i) => `<li>
            <span class="r-num">${i + 1}</span>
            <select data-st="${i}" aria-label="Technique for step ${i + 1}">${TECHNIQUES.map(t => `<option ${t === st.t ? "selected" : ""}>${t}</option>`).join("")}</select>
            <span class="pwrap-host">${PU.swatch(st.p, "in-input")}<input data-sp="${i}" value="${esc(st.p)}" placeholder="Paint" aria-label="Paint for step ${i + 1}"></span>
            <span class="r-btns"><button type="button" class="btn-sm" data-act="up" data-i="${i}" ${i ? "" : "disabled"} aria-label="Move up">↑</button><button type="button" class="btn-sm" data-act="down" data-i="${i}" ${i < r.steps.length - 1 ? "" : "disabled"} aria-label="Move down">↓</button><button type="button" class="btn-sm" data-act="rm-step" data-i="${i}" aria-label="Remove step">×</button></span>
          </li>`).join("")}</ol>
          <button type="button" class="btn-sm" data-act="add-step">+ Add step</button>
          <label>Notes<textarea id="re-notes" rows="2" maxlength="300" placeholder="e.g. thin the highlight, only on top edges">${esc(r.notes)}</textarea></label>
          <div class="r-bar">
            ${r.isNew ? "" : `<button type="button" class="danger" data-act="del-recipe">Delete recipe</button>`}
            <span class="hint" id="re-msg"></span>
            <div class="ed-bar-actions"><button type="button" data-act="cancel-recipe">Cancel</button><button type="button" class="primary" data-act="save-recipe">Save recipe</button></div>
          </div>
        </div>`;
      body.querySelectorAll("[data-sp]").forEach(inp => PU.picker(inp, {owned: () => owned, extra: () => ownedList}));
      if(r.isNew && !r.name) $("re-name").focus();
    }
    function syncRecipeDraft(){
      const r = editingRecipe; if(!r || !$("re-name")) return;
      r.name = $("re-name").value; r.area = $("re-area").value; r.notes = $("re-notes").value;
      $("pd-body").querySelectorAll("[data-st]").forEach(el => r.steps[+el.dataset.st].t = el.value);
      $("pd-body").querySelectorAll("[data-sp]").forEach(el => r.steps[+el.dataset.sp].p = el.value.trim());
    }
    async function addOwned(){
      const inp = $("op-add"); const v = inp.value.trim(); if(!v) return;
      const cat = await PU.load(); const hit = PU.find(v) || PU.search(v, [], 1)[0];
      const label = hit && PU.norm(hit.label) === PU.norm(v) ? hit.label : v;
      if(isOwned(label)){ inp.value = ""; return; }
      try { await saveOwned(ownedList.concat(label)); renderPaints(); $("op-add").focus(); }
      catch(err){ toast("Couldn't save your paints: " + errText(err)); }
    }
    let delArmed = false;
    $("paintdlg").addEventListener("input", e => {
      const t = e.target;
      if(t.dataset.sp != null){ const sw = t.parentElement.querySelector(".pswatch"); const p = PU.find(t.value); if(sw) sw.style.background = p ? p.hex : ""; }
    });
    $("paintdlg").addEventListener("click", async e => {
      if(e.target === $("paintdlg")){ $("paintdlg").close(); return; }
      const tab = e.target.closest("[data-tab]");
      if(tab){ syncRecipeDraft(); if(editingRecipe && !confirmDropRecipe()) return; editingRecipe = null; pdTab = tab.dataset.tab; renderPaints(); return; }
      const b = e.target.closest("[data-act]"); if(!b) return;
      const act = b.dataset.act;
      if(editingRecipe) syncRecipeDraft();
      if(act === "new-recipe"){ editingRecipe = {id: S.newId(), name: "", area: "", notes: "", steps: [{t: "Prime", p: ""}, {t: "Basecoat", p: ""}, {t: "Shade / wash", p: ""}, {t: "Edge highlight", p: ""}], isNew: true}; renderPaints(); }
      else if(act === "edit-recipe" || act === "dup-recipe"){
        const r = (scheme.recipes || []).find(x => x.id === b.dataset.id); if(!r) return;
        editingRecipe = JSON.parse(JSON.stringify(r));
        if(act === "dup-recipe"){ editingRecipe.id = S.newId(); editingRecipe.name = r.name + " (copy)"; editingRecipe.isNew = true; }
        delArmed = false; renderPaints();
      }
      else if(act === "add-step"){ editingRecipe.steps.push({t: "Layer", p: ""}); renderPaints(); const last = $("pd-body").querySelectorAll("[data-sp]"); if(last.length) last[last.length - 1].focus(); }
      else if(act === "rm-step"){ editingRecipe.steps.splice(+b.dataset.i, 1); renderPaints(); }
      else if(act === "up" || act === "down"){ const i = +b.dataset.i, j = act === "up" ? i - 1 : i + 1; const st = editingRecipe.steps; [st[i], st[j]] = [st[j], st[i]]; renderPaints(); }
      else if(act === "cancel-recipe"){ editingRecipe = null; renderPaints(); }
      else if(act === "save-recipe"){
        const r = editingRecipe; r.name = r.name.trim(); r.steps = r.steps.filter(st => st.p || st.t === "Other");
        if(!r.name){ $("re-msg").textContent = "Give the recipe a name."; $("re-name").focus(); return; }
        const list = (scheme.recipes || []).filter(x => x.id !== r.id);
        const idx = (scheme.recipes || []).findIndex(x => x.id === r.id);
        const clean = {id: r.id, name: r.name, area: r.area, notes: r.notes, steps: r.steps};
        if(idx >= 0) list.splice(idx, 0, clean); else list.push(clean);
        b.disabled = true;
        try { await saveRecipes(list); editingRecipe = null; renderPaints(); toast(`Saved recipe ${clean.name}`); }
        catch(err){ $("re-msg").textContent = "Couldn't save: " + errText(err); b.disabled = false; }
      }
      else if(act === "del-recipe"){
        if(!delArmed){ delArmed = true; b.classList.add("armed"); b.textContent = "Click again to delete"; return; }
        const gone = editingRecipe;
        try {
          await saveRecipes((scheme.recipes || []).filter(x => x.id !== gone.id)); editingRecipe = null; delArmed = false; renderPaints();
          toast(`Deleted recipe ${gone.name}`, async () => { await saveRecipes((scheme.recipes || []).concat({id: gone.id, name: gone.name, area: gone.area, notes: gone.notes, steps: gone.steps})); renderPaints(); });
        } catch(err){ $("re-msg").textContent = "Couldn't delete: " + errText(err); }
      }
      else if(act === "add-owned") addOwned();
      else if(act === "rm-owned"){ try { await saveOwned(ownedList.filter(p => p !== b.dataset.p)); renderPaints(); } catch(err){ toast("Couldn't save: " + errText(err)); } }
      else if(act === "got"){ try { await saveOwned(ownedList.concat(b.dataset.p)); renderPaints(); } catch(err){ toast("Couldn't save: " + errText(err)); } }
      else if(act === "copy-buy"){
        const text = shoppingList(!buyAll).map(it => "- " + it.label).join("\n");
        try { await navigator.clipboard.writeText(text); $("buy-msg").textContent = "Copied."; } catch(err){ $("buy-msg").textContent = "Couldn't copy. Select the list and copy it instead."; }
      }
    });
    function confirmDropRecipe(){ return true; }
    $("pd-close").addEventListener("click", () => $("paintdlg").close());
    $("paintdlg").addEventListener("close", () => { editingRecipe = null; renderRecipePicks(); });
    $("b-paints").addEventListener("click", () => openPaints("recipes"));
    $("f-manage-recipes").addEventListener("click", () => openPaints("recipes"));
    $("f-recipes").addEventListener("change", () => { setDirty(true); preview(); });

    /* ---------- load ---------- */
    if(canWrite){ try { ownedList = await store.getPaints(); owned = new Set(ownedList.map(PU.norm)); } catch(e){} }
    PU.load().then(() => { render(); updateBuyBadge(); });
    writeForm(defaults()); setPhotoUI();
    try { units = await store.listUnits(army.id); }
    catch(err){ console.error(err); $("cards").innerHTML = `<div class="empty">Couldn't load units: ${esc(errText(err))}</div>`; return; }
    newUnit(false);
  }

  /* ============================================================
     Dialogs, auth, start
     ============================================================ */
  document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => {
    if(e.target.closest("[data-close]") || e.target === d) d.close();
  }));
  $("b-signin").addEventListener("click", openAuth);
  $("b-signout").addEventListener("click", async () => { try { await store.signOut(); } catch(e){} });
  async function doAuth(mode){
    const email = $("au-email").value.trim(), pass = $("au-pass").value, m = $("au-msg");
    if(!email || !pass){ m.textContent = "Enter your email and password."; return; }
    if(pass.length < 6){ m.textContent = "Passwords need at least 6 characters."; return; }
    $("au-in").disabled = $("au-up").disabled = true; m.textContent = mode === "up" ? "Creating account…" : "Signing in…";
    try {
      if(mode === "up"){
        const d = await store.signUp(email, pass);
        m.textContent = d && d.session ? "Account created. You're signed in." : "Account created. Check your email to confirm it, then sign in.";
        if(d && d.session) setTimeout(() => $("authdlg").close(), 700);
      } else { await store.signIn(email, pass); m.textContent = ""; $("authdlg").close(); }
    } catch(err){ m.textContent = errText(err); }
    finally { $("au-in").disabled = $("au-up").disabled = false; }
  }
  $("authform").addEventListener("submit", e => { e.preventDefault(); doAuth("in"); });
  $("au-up").addEventListener("click", () => doAuth("up"));

  /* Background picker (remembered in this browser) */
  (function(){
    const btn = $("b-bg"), menu = $("bg-menu");
    const mark = () => menu.querySelectorAll("[data-bg]").forEach(b => b.setAttribute("aria-pressed", b.dataset.bg === (document.documentElement.dataset.bg || "1")));
    const toggle = on => { menu.hidden = !on; btn.setAttribute("aria-expanded", on); if(on) mark(); };
    btn.addEventListener("click", e => { e.stopPropagation(); toggle(menu.hidden); });
    menu.addEventListener("click", e => {
      const o = e.target.closest("[data-bg]"); if(!o) return;
      document.documentElement.dataset.bg = o.dataset.bg;
      try { localStorage.setItem("ll-bg", o.dataset.bg); } catch(err){}
      mark();
    });
    document.addEventListener("click", e => { if(!menu.hidden && !e.target.closest(".bgpick")) toggle(false); });
    document.addEventListener("keydown", e => { if(e.key === "Escape" && !menu.hidden){ toggle(false); btn.focus(); } });
  })();

  ART.injectDefs();
  store = S.create();
  window.addEventListener("hashchange", route);
  if(store.kind === "supabase"){
    let first = true;
    store.client.auth.onAuthStateChange((event, session) => {
      const was = store.session;
      const changed = first || (!!session) !== (!!was) || (session && was && session.user.id !== was.user.id);
      store.setSession(session); first = false;
      setTop();
      if(changed) setTimeout(route, 0);
    });
  } else {
    route();
  }
})();
