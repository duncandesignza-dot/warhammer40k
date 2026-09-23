/* Livery Ledger app: routing, faction picker, colour setup and the ledger itself. */
(function(){
  "use strict";
  const DATA = window.LEDGER_FACTIONS || {factions: []};
  const P = window.LEDGER_PRESETS, ART = window.LEDGER_ART, S = window.LEDGER_STORE;
  const STATUS = S.STATUS;
  const FACTIONS = DATA.factions;
  const FBY = Object.fromEntries(FACTIONS.map(f => [f.id, f]));
  const ROLE_ORDER = ["Epic Hero","Character","Battleline","Infantry","Mounted","Beast","Swarm","Monster","Vehicle","Dedicated Transport","Fortification","Other"];
  const COLOR_KEYS = [["armour","Armour"],["secondary","Secondary"],["trim","Trim"],["emblem","Emblem"],["lens","Lenses / eyes"],["cloth","Robes / cloth"],["metal","Weapons / metal"]];
  const QUICK = ["Black","White","Bone","Silver","Gunmetal","Gold","Brass","Red","Crimson","Blue","Navy","Green","Purple","Yellow"];

  const $ = id => document.getElementById(id);
  const app = $("app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeImg = u => typeof u === "string" && /^(https:\/\/|data:image\/(jpeg|png|webp|gif);base64,|blob:)/i.test(u) ? u : "";
  const cname = hex => P.colorName(hex) || hex;
  const chip = hex => ART.hexOk(hex) ? `<span class="chip" style="background:${hex}"></span>` : "";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const quickHex = n => (P.NAMED.find(x => x[0] === n) || [,"#1f1f22"])[1];

  let store = null;
  let view = {name: "", cleanup: null};

  /* ============================================================
     Shared bits
     ============================================================ */
  function unitBadge(u, scheme, size){
    const c = scheme.colors;
    const tier = scheme.tiers[u.tier] || scheme.tiers[0];
    const v = {
      helmet: u.helmet || (tier && tier.color) || c.armour, lens: u.lens || c.lens, armour: u.armour || c.armour,
      secondary: u.secondary || c.secondary, trim: u.trim || c.trim, emblem: u.emblem || c.emblem,
      shape: u.shape || scheme.shape, noHelmet: u.noHelmet
    };
    return ART.badge(v, scheme.style, size, `${cname(v.helmet)} helmet, ${cname(v.armour)} armour with ${cname(v.trim)} trim`);
  }
  function tierBadge(scheme, t, size){
    const c = scheme.colors;
    return ART.badge({helmet: t.color, lens: c.lens, armour: c.armour, secondary: c.secondary, trim: c.trim, emblem: c.emblem, shape: scheme.shape}, scheme.style, size, `${t.name}: ${cname(t.color)} helmet`);
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
  async function route(){
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
      <p class="source">Unit and weapon names come from the community BattleScribe data for Warhammer 40,000 11th edition (${esc(DATA.source || "BSData")}${DATA.commit ? ", " + esc(DATA.commit) : ""}). Starting colours are suggestions you can change. Warhammer 40,000 is a trademark of Games Workshop; this is an unofficial fan tool.</p>
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
    const draft = army ? {name: army.name, scheme: JSON.parse(JSON.stringify(army.scheme))} : {name: "", scheme: P.presetFor(f.id)};
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
          <div class="panel">
            <h3>Colours</h3>
            <p class="hint">Pick a colour, or tap a swatch.</p>
            <div class="cgrid">${COLOR_KEYS.map(([k, label]) => `
              <div class="cfield">
                <label for="s-${k}">${label}</label>
                <input type="color" id="s-${k}" value="${esc(draft.scheme.colors[k])}">
                <span class="cname" id="s-${k}-n">${esc(cname(draft.scheme.colors[k]))}</span>
                <div class="swatches">${QUICK.map(n => `<button type="button" class="sw" style="background:${quickHex(n)}" title="${n}" aria-label="${label}: ${n}" data-sw="${k}" data-hex="${quickHex(n)}"></button>`).join("")}</div>
              </div>`).join("")}</div>
          </div>
          <div class="panel">
            <h3>Emblem</h3>
            <p class="hint">Shown on the shoulder pad. These are simple shapes, not official chapter icons.</p>
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
            <p class="hint">Each rank gets its own helmet colour. When you pick a rank for a unit, its helmet uses this colour.</p>
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
      $("s-preview").innerHTML = sch.tiers.map(t => `<div class="pv-tier">${tierBadge(sch, t, 60)}<span><strong>${esc(t.name || "Rank")}</strong><small>${esc(t.note || cname(t.color) + " helmet")}</small></span></div>`).join("");
      $("s-shapes").querySelectorAll("[data-shape]").forEach(b => { b.setAttribute("aria-pressed", b.dataset.shape === sch.shape); b.innerHTML = ART.shapeIcon(b.dataset.shape, sch.colors.emblem, 34) + esc(P.SHAPES.find(s => s[0] === b.dataset.shape)[1]); });
      COLOR_KEYS.forEach(([k]) => { $("s-" + k).value = sch.colors[k]; $("s-" + k + "-n").textContent = cname(sch.colors[k]); });
      app.querySelectorAll("[data-style]").forEach(b => b.setAttribute("aria-pressed", b.dataset.style === sch.style));
    }
    renderTiers(); renderPreview();

    app.addEventListener("input", onInput);
    app.addEventListener("click", onClick);
    view.cleanup = () => { app.removeEventListener("input", onInput); app.removeEventListener("click", onClick); };

    function onInput(e){
      const t = e.target;
      const ck = COLOR_KEYS.find(([k]) => t.id === "s-" + k);
      if(ck){ sch.colors[ck[0]] = t.value; renderPreview(); return; }
      if(t.dataset.tname != null){ sch.tiers[+t.dataset.tname].name = t.value; renderPreview(); }
      if(t.dataset.tnote != null){ sch.tiers[+t.dataset.tnote].note = t.value; renderPreview(); }
      if(t.dataset.tcolor != null){ sch.tiers[+t.dataset.tcolor].color = t.value; renderPreview(); }
      if(t.id === "s-reset" && t.checked){ const p = P.presetFor(f.id); Object.assign(sch, p); renderTiers(); renderPreview(); t.checked = false; }
    }
    let armed = false;
    async function onClick(e){
      const t = e.target.closest("button"); if(!t) return;
      if(t.dataset.sw){ sch.colors[t.dataset.sw] = t.dataset.hex; renderPreview(); return; }
      if(t.dataset.shape){ sch.shape = t.dataset.shape; renderPreview(); return; }
      if(t.dataset.style){ sch.style = t.dataset.style; renderPreview(); return; }
      if(t.dataset.tdel != null){ sch.tiers.splice(+t.dataset.tdel, 1); renderTiers(); renderPreview(); return; }
      if(t.id === "s-addtier"){ sch.tiers.push({name: "New rank", note: "", color: sch.colors.secondary}); renderTiers(); renderPreview(); return; }
      if(t.id === "s-save"){
        const name = $("s-name").value.trim() || (f.name + " army");
        t.disabled = true; $("s-msg").textContent = "Saving…";
        try {
          const saved = await store.saveArmy({faction: f.id, name, scheme: sch}, editing ? army.id : null);
          location.hash = "#/army/" + saved.id;
        } catch(err){ console.error(err); $("s-msg").textContent = "Couldn't save: " + errText(err); $("s-msg").classList.add("err"); t.disabled = false; }
        return;
      }
      if(t.id === "s-del"){
        if(!armed){ armed = true; t.classList.add("armed"); t.textContent = "Click again to delete ledger and all its units"; return; }
        t.disabled = true;
        try { await store.removeArmy(army); location.hash = "#/"; }
        catch(err){ $("s-msg").textContent = "Couldn't delete: " + errText(err); t.disabled = false; }
      }
    }
  }

  /* ============================================================
     Ledger
     ============================================================ */
  async function viewLedger(armyId){
    view.name = "ledger";
    const army = await store.getArmy(armyId);
    if(!army){
      app.innerHTML = `<div class="banner"><span class="dot warn"></span>${store.kind === "supabase" && !store.session ? "Sign in to open this ledger." : "This ledger doesn't exist any more."}</div><p class="row-actions"><a class="btn" href="#/">Back to start</a>${store.kind === "supabase" && !store.session ? `<button type="button" class="primary" data-signin>Sign in</button>` : ""}</p>`;
      app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));
      return;
    }
    const f = FBY[army.faction] || {name: army.faction, units: []};
    const scheme = army.scheme;
    document.title = army.name + " · Livery Ledger";
    const canWrite = store.canWrite && (!army.owner || !store.session || army.owner === store.session.user.id);

    // datasheet list grouped by role
    const sheets = f.units || [];
    const byRole = {};
    sheets.filter(u => !u.t).forEach(u => (byRole[u.r] = byRole[u.r] || []).push(u));
    const legends = sheets.filter(u => u.t);
    const sheetOptions = ROLE_ORDER.filter(r => byRole[r]).map(r => `<optgroup label="${esc(r)}">${byRole[r].map(u => `<option value="${esc(u.n)}">${esc(u.n)}</option>`).join("")}</optgroup>`).join("")
      + (legends.length ? `<optgroup label="Legends and other">${legends.map(u => `<option value="${esc(u.n)}" data-legend="1">${esc(u.n)} (${esc(u.t)})</option>`).join("")}</optgroup>` : "");
    const sheetFor = n => sheets.find(u => u.n === n && !u.t) || sheets.find(u => u.n === n);
    const schemeColors = [...new Set([...Object.values(scheme.colors), ...scheme.tiers.map(t => t.color)])];

    const colorField = (id, label) => `<label>${label}<span class="cpair" style="display:flex;gap:8px;align-items:center"><input type="color" id="f-${id}" list="dl-scheme" style="width:56px;flex:none"><span class="cname" data-cn="${id}" style="font-family:var(--mono);font-size:.72rem"></span></span></label>`;

    app.innerHTML = `
      <div class="crumbs"><a href="#/">Livery Ledger</a> / ${esc(f.name)}</div>
      <header class="top">
        <div>
          <h1>${esc(army.name)}</h1>
          <p class="sub">${esc(f.name)} · Set each unit's colours and weapons, add a photo, and track how far along it is.</p>
        </div>
        <div class="stats" aria-live="polite">
          <div class="stat"><b id="st-units">0</b><span>Units</span></div>
          <div class="stat"><b id="st-models">0</b><span>Models</span></div>
          <div class="stat"><b id="st-done">0</b><span>Painted</span></div>
          <div class="stat"><b id="st-pct">0%</b><span>Complete</span></div>
        </div>
      </header>
      <div class="bar" aria-hidden="true"><i id="bar"></i></div>
      <div class="toolbar">
        ${noteHtml()}
        <div class="tools">
          ${canWrite ? `<a class="btn btn-sm" href="#/army/${esc(army.id)}/colours">Edit colours</a>` : ""}
          <button type="button" class="btn-sm" id="b-export">Export backup</button>
          ${canWrite ? `<button type="button" class="btn-sm" id="b-import">Import units</button><input type="file" id="f-import" accept="application/json,.json" hidden>` : ""}
        </div>
      </div>

      <section class="key" aria-label="Rank colours">${scheme.tiers.map(t => `<div>${tierBadge(scheme, t, 44)}<span><strong>${esc(t.name)}</strong><small>${esc(t.note || cname(t.color) + " helmet")}</small></span></div>`).join("")}</section>

      <div class="layout">
        <form class="editor" id="form" autocomplete="off" novalidate>
          <div class="ed-head"><h2 class="eyebrow" id="ed-title">New unit</h2><span class="dirty" id="dirty" hidden>Unsaved changes</span></div>
          <div class="preview"><span id="pv-svg"></span><div><div class="pv-name" id="pv-name">Unnamed unit</div><div class="pv-meta" id="pv-meta">—</div></div></div>
          ${canWrite ? "" : `<div class="locked">${store.kind === "supabase" && !store.session ? `Sign in to add or edit units. <button type="button" class="btn-sm" data-signin>Sign in</button>` : "You can view this ledger but not change it."}</div>`}
          <fieldset class="wrapper" id="fs-all" ${canWrite ? "" : "disabled"}>
          <fieldset>
            <legend>Unit</legend>
            <label class="full">Datasheet<select id="f-sheet"><option value="">Choose a datasheet…</option>${sheetOptions}<option value="__custom">Not listed (type it in)</option></select></label>
            <label class="full" id="custom-wrap" hidden>Datasheet name<input id="f-sheet-custom" maxlength="80" placeholder="Unit type"></label>
            <label class="full">Unit name<input id="f-name" maxlength="80" placeholder="e.g. Brother Aldric's squad"></label>
            <label>Rank<select id="f-tier">${scheme.tiers.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join("")}</select></label>
            <label>Models<input id="f-count" type="number" inputmode="numeric" min="1" max="99" value="5"></label>
            <label class="full">Status<select id="f-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
          </fieldset>
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
            <legend>Helmet</legend>
            ${colorField("helmet", "Helmet colour")}
            ${colorField("lens", "Lenses / eyes")}
            <label class="full">Helmet detail<input id="f-hdetail" list="dl-hdetail" maxlength="60" placeholder="e.g. laurel wreath, centre stripe"></label>
            <label class="full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="f-noHelmet" style="width:auto"> Bare head (no helmet)</label>
          </fieldset>
          <fieldset>
            <legend>Armour &amp; pauldrons</legend>
            ${colorField("armour", "Armour")}
            ${colorField("secondary", "Secondary")}
            ${colorField("trim", "Trim")}
            ${colorField("emblem", "Emblem colour")}
            <label class="full">Emblem<select id="f-shape">${P.SHAPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>
          </fieldset>
          <fieldset>
            <legend>Cloth &amp; details</legend>
            ${colorField("cloth", "Robes / cloth")}
            ${colorField("metal", "Weapons / metal")}
            <label class="full">Purity seals, freehand &amp; extras<input id="f-extras" maxlength="120" placeholder="e.g. red wax seals, freehand on kneepad"></label>
          </fieldset>
          <fieldset>
            <legend>Weapons</legend>
            <label class="full">Melee weapon<input id="f-melee" list="dl-melee" maxlength="80" placeholder="Choose or type"></label>
            <label class="full">Ranged weapon<input id="f-ranged" list="dl-ranged" maxlength="80" placeholder="Choose or type"></label>
          </fieldset>
          <fieldset>
            <legend>Paints &amp; notes</legend>
            <label class="full">Paint recipe<textarea id="f-paints" rows="2" maxlength="600" placeholder="e.g. black basecoat → grey edge highlight"></textarea></label>
            <label class="full">Notes<textarea id="f-notes" rows="2" maxlength="600" placeholder="Leader attached, magnetised arms, ideas…"></textarea></label>
          </fieldset>
          </fieldset>
          <div class="actions">
            <button type="submit" class="primary" id="b-save" ${canWrite ? "" : "disabled"}>Add unit</button>
            <button type="button" id="b-new" ${canWrite ? "" : "disabled"}>New</button>
            <button type="button" class="danger" id="b-del" hidden>Delete</button>
          </div>
          <div class="msg" id="msg" role="status" aria-live="polite"></div>
        </form>

        <section class="list" aria-labelledby="army-h">
          <div class="list-head">
            <h2 class="eyebrow" id="army-h">Your army</h2>
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
          <div class="cards" id="cards"><div class="empty">Loading units…</div></div>
        </section>
      </div>
      <datalist id="dl-scheme">${schemeColors.map(c => `<option value="${c}"></option>`).join("")}</datalist>
      <datalist id="dl-melee"></datalist><datalist id="dl-ranged"></datalist>
      <datalist id="dl-hdetail"><option>Laurel wreath</option><option>Centre stripe</option><option>Crest</option><option>Battle damage</option><option>Squad markings</option></datalist>
    `;
    app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));

    /* ---------- state ---------- */
    let units = [], selId = null, filter = "all", query = "", armed = false, dirty = false, busy = false;
    let pendingPhoto = null, removePhoto = false, tierTouched = false;
    const form = $("form");
    const COLOR_IDS = ["helmet","lens","armour","secondary","trim","emblem","cloth","metal"];

    function defaults(){
      const c = scheme.colors, t = scheme.tiers[0];
      return {datasheet:"", role:"", name:"", count:5, status:"unbuilt", tier:0, helmet:t.color, lens:c.lens, hdetail:"", noHelmet:false,
        armour:c.armour, secondary:c.secondary, trim:c.trim, emblem:c.emblem, shape:scheme.shape, cloth:c.cloth, metal:c.metal,
        extras:"", melee:"", ranged:"", paints:"", notes:""};
    }
    function readForm(){
      const sel = $("f-sheet").value;
      const datasheet = sel === "__custom" ? $("f-sheet-custom").value.trim() : sel;
      const sh = sel && sel !== "__custom" ? sheetFor(sel) : null;
      const o = {datasheet, role: sh ? sh.r : "", name: $("f-name").value.trim(), count: Math.min(99, Math.max(1, parseInt($("f-count").value, 10) || 1)),
        status: $("f-status").value, tier: +$("f-tier").value || 0, hdetail: $("f-hdetail").value.trim(), noHelmet: $("f-noHelmet").checked,
        shape: $("f-shape").value, extras: $("f-extras").value.trim(), melee: $("f-melee").value.trim(), ranged: $("f-ranged").value.trim(),
        paints: $("f-paints").value.trim(), notes: $("f-notes").value.trim()};
      COLOR_IDS.forEach(k => o[k] = $("f-" + k).value);
      return o;
    }
    function writeForm(u){
      const d = {...defaults(), ...u};
      const known = d.datasheet && sheets.some(s => s.n === d.datasheet);
      $("f-sheet").value = !d.datasheet ? "" : known ? d.datasheet : "__custom";
      $("f-sheet-custom").value = known ? "" : d.datasheet;
      $("custom-wrap").hidden = $("f-sheet").value !== "__custom";
      $("f-name").value = d.name; $("f-count").value = d.count; $("f-status").value = d.status;
      $("f-tier").value = String(Math.min(d.tier, scheme.tiers.length - 1));
      $("f-hdetail").value = d.hdetail; $("f-noHelmet").checked = !!d.noHelmet;
      $("f-shape").value = P.SHAPES.some(s => s[0] === d.shape) ? d.shape : scheme.shape;
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
    function preview(){
      const u = readForm();
      $("pv-svg").innerHTML = unitBadge(u, scheme, 120);
      $("pv-name").textContent = u.name || u.datasheet || "Unnamed unit";
      const tier = scheme.tiers[u.tier];
      $("pv-meta").textContent = [u.datasheet || "Unit", tier && tier.name, plural(u.count, "model")].filter(Boolean).join(" · ");
      app.querySelectorAll("[data-cn]").forEach(s => s.textContent = cname($("f-" + s.dataset.cn).value));
    }
    const msg = (t, err) => { const m = $("msg"); m.textContent = t; m.classList.toggle("err", !!err); };
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
    }
    function editUnit(id){
      const u = units.find(x => x.id === id); if(!u) return;
      selId = id; tierTouched = true; clearPending(); writeForm(u); disarm(); setEditing(u); setPhotoUI(); setDirty(false); msg(""); render();
      if(window.matchMedia("(max-width:900px)").matches) form.scrollIntoView({behavior: "smooth", block: "start"});
      $("f-name").focus({preventScroll: true});
    }
    function newUnit(focus){
      selId = null; tierTouched = false; clearPending(); writeForm(defaults()); disarm(); setEditing(null); setPhotoUI(); setDirty(false); msg(""); render();
      if(focus) $("f-sheet").focus();
    }

    /* ---------- list ---------- */
    const rankOf = u => ROLE_ORDER.indexOf(u.role) < 0 ? 99 : ROLE_ORDER.indexOf(u.role);
    function visible(){
      const q = query.toLowerCase();
      return units.filter(u => {
        if(filter === "done" && u.status !== "done") return false;
        if(filter === "progress" && !(u.status === "progress" || u.status === "primed")) return false;
        if(filter === "todo" && u.status === "done") return false;
        if(q && ![u.name, u.datasheet, u.role, u.melee, u.ranged, u.notes, (scheme.tiers[u.tier] || {}).name].join(" ").toLowerCase().includes(q)) return false;
        return true;
      }).sort((a, b) => (b.tier - a.tier) || (rankOf(a) - rankOf(b)) || String(a.name).localeCompare(String(b.name)));
    }
    const weaponsText = u => [u.melee, u.ranged].filter(Boolean).join(" + ") || "—";
    function render(){
      const list = visible(), c = $("cards");
      if(!list.length) c.innerHTML = `<div class="empty">${units.length ? "No units match." : canWrite ? "No units yet. Pick a datasheet in the form to add your first unit." : "No units in this ledger yet."}</div>`;
      else c.innerHTML = list.map(u => {
        const img = safeImg(u.image), tier = scheme.tiers[u.tier] || {};
        return `<div class="card${u.id === selId ? " sel" : ""}" tabindex="0" role="button" data-id="${esc(u.id)}" aria-label="View ${esc(u.name)}">
          ${img ? `<div class="photo"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>` : ""}
          <div class="body">
            <div class="card-top">${unitBadge(u, scheme, 60)}<div><h3>${esc(u.name)}</h3><div class="type">${esc([u.datasheet && u.datasheet !== u.name ? u.datasheet : "", u.role].filter(Boolean).join(" · ") || "Unit")}</div></div></div>
            <dl>
              <dt>Rank</dt><dd>${esc(tier.name || "—")}</dd>
              <dt>Helmet</dt><dd>${u.noHelmet ? "Bare head" : chip(u.helmet) + esc(cname(u.helmet))}${u.hdetail ? ", " + esc(u.hdetail) : ""}</dd>
              <dt>Armour</dt><dd>${chip(u.armour)}${esc(cname(u.armour))}, ${esc(cname(u.trim))} trim</dd>
              <dt>Weapons</dt><dd>${esc(weaponsText(u))}</dd>
            </dl>
            <div class="card-foot"><span class="pill s-${esc(u.status)}">${esc(STATUS[u.status] || u.status)}</span><span>${plural(u.count, "model")}</span></div>
          </div></div>`;
      }).join("");
      const models = units.reduce((a, u) => a + (+u.count || 0), 0);
      const done = units.filter(u => u.status === "done").reduce((a, u) => a + (+u.count || 0), 0);
      const pct = models ? Math.round(done / models * 100) : 0;
      $("st-units").textContent = units.length; $("st-models").textContent = models; $("st-done").textContent = done; $("st-pct").textContent = pct + "%";
      $("bar").style.width = pct + "%";
    }
    function openDetail(id){
      const u = units.find(x => x.id === id); if(!u) return;
      const img = safeImg(u.image), tier = scheme.tiers[u.tier] || {};
      const col = hex => ART.hexOk(hex) ? chip(hex) + esc(cname(hex)) : "";
      const sec = (title, rows) => { const r = rows.filter(x => x[1]); return r.length ? `<section><h4>${title}</h4><dl>${r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl></section>` : ""; };
      $("detail-body").innerHTML = `<div class="detail">
        <div class="media">${img ? `<img src="${esc(img)}" alt="Photo of ${esc(u.name)}">` : unitBadge(u, scheme, 180)}</div>
        <div class="info">
          <div><h2 id="dt-name">${esc(u.name)}</h2>
            <div class="meta">${esc(u.datasheet || "Unit")}${u.role ? " · " + esc(u.role) : ""} · ${plural(u.count, "model")}</div></div>
          <div class="row">${img ? unitBadge(u, scheme, 64) : ""}<span class="pill s-${esc(u.status)}">${esc(STATUS[u.status] || u.status)}</span></div>
          ${sec("Rank", [["Rank", esc(tier.name)], ["Who", esc(tier.note)]])}
          ${sec("Helmet", [["Colour", u.noHelmet ? "Bare head" : col(u.helmet)], ["Lenses", col(u.lens)], ["Detail", esc(u.hdetail)]])}
          ${sec("Armour &amp; pauldrons", [["Armour", col(u.armour)], ["Secondary", col(u.secondary)], ["Trim", col(u.trim)], ["Emblem", u.shape === "none" ? "None" : col(u.emblem) + " " + esc((P.SHAPES.find(s => s[0] === u.shape) || ["", ""])[1].toLowerCase())]])}
          ${sec("Cloth &amp; details", [["Cloth", col(u.cloth)], ["Metal", col(u.metal)], ["Extras", esc(u.extras)]])}
          ${sec("Weapons", [["Melee", esc(u.melee)], ["Ranged", esc(u.ranged)]])}
          ${u.paints ? `<section><h4>Paint recipe</h4><p class="prose">${esc(u.paints)}</p></section>` : ""}
          ${u.notes ? `<section><h4>Notes</h4><p class="prose">${esc(u.notes)}</p></section>` : ""}
          ${canWrite ? `<section class="row-actions"><button type="button" class="primary" data-edit="${esc(u.id)}">Edit unit</button><button type="button" data-dup="${esc(u.id)}">Duplicate</button></section>` : ""}
        </div></div>`;
      $("detail").showModal(); $("detail").scrollTop = 0;
    }

    /* ---------- events ---------- */
    form.addEventListener("input", e => { if(e.target.id !== "f-photo"){ setDirty(true); preview(); } });
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
      if(sh && !selId) $("f-count").value = (sh.r === "Epic Hero" || sh.r === "Character" || sh.r === "Vehicle" || sh.r === "Monster" || sh.r === "Dedicated Transport") ? 1 : 5;
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
      if(busy || !canWrite) return;
      const u = readForm();
      if(!u.datasheet && !u.name){ msg("Choose a datasheet or give the unit a name.", true); $("f-sheet").focus(); return; }
      if(!u.name) u.name = u.datasheet;
      const cur = currentUnit();
      busy = true; const b = $("b-save"), label = b.textContent; b.disabled = true; b.textContent = "Saving…";
      try {
        const row = await store.saveUnit(army.id, u, cur ? cur.id : null, pendingPhoto, removePhoto, cur);
        units = units.filter(x => x.id !== row.id).concat(row);
        clearPending(); selId = row.id; setEditing(row); setPhotoUI(); disarm(); setDirty(false);
        msg(cur ? "Saved." : "Unit added."); render();
      } catch(err){ console.error(err); msg("Couldn't save: " + errText(err), true); }
      finally { busy = false; b.disabled = !canWrite; if(b.textContent === "Saving…") b.textContent = label; }
    });
    $("b-new").addEventListener("click", () => newUnit(true));
    $("b-del").addEventListener("click", async () => {
      const cur = currentUnit(); if(!cur || busy) return;
      const b = $("b-del");
      if(!armed){ armed = true; b.classList.add("armed"); b.textContent = "Click again to delete"; return; }
      busy = true; b.disabled = true;
      try { await store.removeUnit(cur); units = units.filter(x => x.id !== cur.id); newUnit(false); msg("Unit deleted."); }
      catch(err){ msg("Couldn't delete: " + errText(err), true); }
      finally { busy = false; b.disabled = false; }
    });
    $("b-del").addEventListener("blur", () => setTimeout(() => { if(armed && document.activeElement !== $("b-del")) disarm(); }, 0));

    $("cards").addEventListener("click", e => { const c = e.target.closest(".card"); if(c) openDetail(c.dataset.id); });
    $("cards").addEventListener("keydown", e => { if((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")){ e.preventDefault(); openDetail(e.target.dataset.id); } });
    $("filters").addEventListener("click", e => {
      const b = e.target.closest("button[data-f]"); if(!b) return;
      filter = b.dataset.f; $("filters").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false")); render();
    });
    $("q").addEventListener("input", e => { query = e.target.value.trim(); render(); });

    function onDetailClick(e){
      const ed = e.target.closest("[data-edit]"), dup = e.target.closest("[data-dup]");
      if(ed){ $("detail").close(); editUnit(ed.dataset.edit); }
      if(dup){
        const u = units.find(x => x.id === dup.dataset.dup); $("detail").close();
        if(u){ selId = null; tierTouched = true; clearPending(); writeForm({...u, name: u.name + " (copy)"}); setEditing(null); setPhotoUI(); setDirty(true); msg("Copy ready. Change what you need and save."); render(); }
      }
    }
    $("detail").addEventListener("click", onDetailClick);

    $("b-export").addEventListener("click", () => {
      downloadJSON({app: "livery-ledger", version: 3, exported: new Date().toISOString(),
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
    view.cleanup = () => { window.removeEventListener("beforeunload", onBeforeUnload); $("detail").removeEventListener("click", onDetailClick); clearPending(); };

    /* ---------- load ---------- */
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
