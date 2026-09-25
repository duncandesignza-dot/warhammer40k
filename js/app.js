/* Livery Ledger app: routing, faction picker, colour setup and the ledger itself. */
(function(){
  "use strict";
  const DATA = window.LEDGER_FACTIONS || {factions: []};
  const P = window.LEDGER_PRESETS, ART = window.LEDGER_ART, S = window.LEDGER_STORE, PU = window.LEDGER_PAINTUI;
  const STATUS = S.STATUS;
  const FACTIONS = DATA.factions;
  const FBY = Object.fromEntries(FACTIONS.map(f => [f.id, f]));
  // Datasheet helpers: the smallest unit size, and the cost for a number of models.
  const minModels = sh => sh.ms ? sh.ms[0] : ["Epic Hero","Character","Vehicle","Monster","Dedicated Transport","Fortification"].includes(sh.r) ? 1
    : sh.pb && sh.pb[0] ? (sh.pb[0][0] === sh.pb[0][1] ? sh.pb[0][0] : Math.max(1, sh.pb[0][0] - 1)) : 5;
  const sheetPts = (sh, count) => { if(!sh || sh.p == null) return null; let p = sh.p; (sh.pb || []).forEach(([lo, hi, v]) => { if(count >= lo && (!hi || count <= hi)) p = v; }); return p; };
  const ROLE_ORDER = ["Epic Hero","Character","Battleline","Infantry","Mounted","Beast","Swarm","Monster","Vehicle","Dedicated Transport","Fortification","Other"];
  // What each colour slot means for the faction on screen (set when a page opens).
  let PROF = P.profileFor("space-marines");
  const colorKeys = () => PROF.keys.map(k => [k, PROF.labels[k]]);
  // Armies saved before skin existed pick up the faction's starting skin.
  function fillSkin(scheme, fid){
    if(!ART.hexOk(scheme.colors.skin)) scheme.colors.skin = P.presetFor(fid).colors.skin;
    // Space Marine pauldrons saved before they had their own colours: same as the armour's.
    if(P.profileFor(fid).pauldrons) PAULDRONS.forEach(k => {
      if(ART.hexOk(scheme.colors[k])) return;
      const b = P.PAULDRON_BASE[k];
      scheme.colors[k] = scheme.colors[b];
      const bp = (scheme.slotPaints || {})[b]; if(bp) (scheme.slotPaints = scheme.slotPaints || {})[k] = bp;
    });
  }
  const PAULDRONS = P.PAULDRON_KEYS;
  /* Extra paint areas: the added ones as paint pickers (with × to remove), then a "+ area" pill for each
     one not added yet, so only what the models need takes up space. state maps area id -> {hex, paint}. */
  function xaUI(host, areas, state, opts){
    function draw(){
      const on = areas.filter(a => state[a.id]), off = areas.filter(a => !state[a.id]);
      host.innerHTML = (on.length ? `<div class="xa-list">${on.map(a => `<div class="xa-item"><span class="xa-l">${esc(a.label)}</span><span class="xa-pick" data-xa="${esc(a.id)}"></span><button type="button" class="xa-rm" data-xrm="${esc(a.id)}" aria-label="Remove ${esc(a.label)}" title="Remove">×</button></div>`).join("")}</div>` : "")
        + (off.length ? `<div class="xa-add" role="group" aria-label="Add a paint area">${off.map(a => `<button type="button" class="xa-pill" data-xadd="${esc(a.id)}">+ ${esc(a.label)}</button>`).join("")}</div>` : "");
      host.querySelectorAll("[data-xa]").forEach(h => {
        const id = h.dataset.xa, a = areas.find(x => x.id === id);
        PU.slot(h, {...opts.slot, label: a.label, value: state[id], onChange: v => { state[id] = {hex: v.hex, paint: v.paint}; opts.onChange(); }});
      });
    }
    host.addEventListener("click", e => {
      const add = e.target.closest("[data-xadd]"), rm = e.target.closest("[data-xrm]");
      if(add){ const a = areas.find(x => x.id === add.dataset.xadd); state[a.id] = opts.start ? opts.start(a) : {hex: a.hex, paint: a.paint}; draw(); opts.onChange(); host.querySelector(`[data-xa="${a.id}"] .cp`).focus(); }
      else if(rm){ delete state[rm.dataset.xrm]; draw(); opts.onChange(); }
    });
    draw();
    return {redraw(next){ state = next; draw(); }};
  }
  const BASE_OF = P.PAULDRON_BASE;
  // When the armour, secondary or emblem colour changes, pauldron colours still matching the old one follow it.
  function followBase(base, get, set, old, now){
    PAULDRONS.filter(k => BASE_OF[k] === base).forEach(k => { const p = get(k); if(p && p.hex.toLowerCase() === old.hex.toLowerCase() && (p.paint || "") === (old.paint || "")) set(k, now); });
  }
  // Colours for the badge's shoulder pad: the left pauldron's own when they're painted differently.
  const padColours = (o, split) => split && PROF.pauldrons ? {pauldron: o.lpauldron, ptrim: o.lpsecondary, pemblem: o.lpemblem} : {};
  const STAR = on => `<svg width="18" height="18" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8Z"/></svg>`;
  const HEART = on => `<svg width="15" height="15" viewBox="0 0 24 24" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.3a4.4 4.4 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z"/></svg>`;
  const QUICK = ["Black","White","Bone","Silver","Gunmetal","Gold","Brass","Red","Crimson","Blue","Navy","Green","Purple","Yellow"];

  const $ = id => document.getElementById(id);
  const app = $("app");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeImg = u => typeof u === "string" && /^(https:\/\/|data:image\/(jpeg|png|webp|gif);base64,|blob:)/i.test(u) ? u : "";
  const cname = hex => P.colorName(hex) || hex;
  const chip = hex => ART.hexOk(hex) ? `<span class="chip" style="background:${hex}"></span>` : "";
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const quickHex = n => (P.NAMED.find(x => x[0] === n) || [,"#1f1f22"])[1];
  const PLAIN = QUICK.map(n => ({name: n, hex: quickHex(n)}));

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
      shape: u.shape || scheme.shape, skin: u.skin || c.skin || SKIN, head: headOf(u),
      ...padColours({lpauldron: u.lpauldron || u.armour || c.armour, lpsecondary: u.lpsecondary || u.secondary || c.secondary, lpemblem: u.lpemblem || u.emblem || c.emblem}, u.splitPauldrons)
    };
    const hd = v.head === "bare" ? `bare head (${cname(v.skin)} skin)` : v.head === "none" ? "no head" : `${cname(v.helmet)} ${PROF.head}`;
    return ART.badge(v, scheme.style, size, `${hd}, ${cname(v.armour)} ${PROF.labels.armour.toLowerCase()} with ${cname(v.trim)} ${PROF.labels.trim.toLowerCase()}`);
  }
  /* Suggestion dropdown for a text input, styled like the paint picker (the browser's own datalist
     popup can't be styled). getList() returns the options; typing filters them, and any other
     text is still allowed. */
  const comboBoxes = new Map();
  function combo(input, getList){
    // Clear out lists left behind by pages that have since been replaced.
    comboBoxes.forEach((inp, b) => { if(!inp.isConnected){ b.remove(); comboBoxes.delete(b); } });
    const box = document.createElement("div");
    comboBoxes.set(box, input);
    box.className = "psuggest"; box.hidden = true; box.setAttribute("role", "listbox");
    input.classList.add("combo");
    input.setAttribute("autocomplete", "off"); input.setAttribute("role", "combobox"); input.setAttribute("aria-expanded", "false");
    // Straight on the page (or the open dialog), not inside a panel: a blurred panel would pin the
    // fixed-position list to itself instead of the screen. Also keeps option clicks off the label.
    (input.closest("dialog") || document.body).appendChild(box);
    let items = [], active = -1;
    function show(typed){
      const all = getList() || [], q = input.value.trim().toLowerCase();
      // Typed a name in full: nothing left to choose, so get out of the way of the form.
      if(typed && q && all.some(o => o.toLowerCase() === q)){ hide(); return; }
      // Everything when the box is empty or already holds one of the options, otherwise the matches.
      items = !q || all.some(o => o.toLowerCase() === q) ? all : all.filter(o => o.toLowerCase().includes(q));
      if(!items.length){ hide(); return; }
      box.innerHTML = items.map((o, i) => `<div class="psug${i === active ? " on" : ""}" role="option" data-i="${i}"><span class="pn"><strong>${esc(o)}</strong></span></div>`).join("");
      box.hidden = false; input.setAttribute("aria-expanded", "true");
      place();
    }
    // Float over everything, below the input or above it if there's no room.
    function place(){
      if(box.hidden) return;
      const r = input.getBoundingClientRect(), vh = window.innerHeight, gap = 6;
      const below = vh - r.bottom - gap - 12, above = r.top - gap - 12;
      const up = below < 220 && above > below;
      Object.assign(box.style, {left: r.left + "px", width: r.width + "px", maxHeight: Math.max(140, Math.min(320, up ? above : below)) + "px",
        top: up ? "" : (r.bottom + gap) + "px", bottom: up ? (vh - r.top + gap) + "px" : ""});
    }
    function hide(){ box.hidden = true; active = -1; input.setAttribute("aria-expanded", "false"); }
    function pick(i){ if(items[i] == null) return; input.value = items[i]; hide(); input.dispatchEvent(new Event("input", {bubbles: true})); input.dispatchEvent(new Event("change", {bubbles: true})); }
    const onMove = () => { if(!input.isConnected){ box.remove(); comboBoxes.delete(box); }
      if(!box.isConnected){ window.removeEventListener("resize", onMove); document.removeEventListener("scroll", onMove, true); return; } place(); };
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    // Opens on a click, typing or the down arrow, not on focus alone, so the page can put the
    // cursor back in the box (say after adding a kit) without the list covering what's below.
    input.addEventListener("click", () => { if(box.hidden) show(); });
    input.addEventListener("input", e => { active = -1; if(e.isTrusted) show(true); });
    input.addEventListener("blur", () => setTimeout(() => { if(document.activeElement !== input) hide(); }, 150));
    input.addEventListener("keydown", e => {
      if(e.key === "ArrowDown"){ e.preventDefault(); if(box.hidden){ show(); return; } active = Math.min(items.length - 1, active + 1); show(); }
      else if(box.hidden) return;
      else if(e.key === "ArrowUp"){ e.preventDefault(); active = Math.max(0, active - 1); show(); }
      else if(e.key === "Enter" && active >= 0){ e.preventDefault(); pick(active); }
      else if(e.key === "Escape"){ e.stopPropagation(); e.preventDefault(); hide(); }
    });
    box.addEventListener("mousedown", e => { const o = e.target.closest("[data-i]"); if(o){ e.preventDefault(); pick(+o.dataset.i); } });
  }
  function tierBadge(scheme, t, size){
    const c = scheme.colors;
    return ART.badge({helmet: t.color, lens: c.lens, armour: c.armour, secondary: c.secondary, trim: c.trim, emblem: c.emblem, shape: scheme.shape, ...padColours(c, scheme.splitPauldrons)}, scheme.style, size, `${t.name}: ${cname(t.color)} ${PROF.head}`);
  }
  function factionBadge(fid, size){
    const pr = P.presetFor(fid);
    return ART.badge({...pr.colors, helmet: pr.tiers[0].color, shape: pr.shape}, pr.style, size, "");
  }
  /* ---------- account: who's signed in, the top-bar menu and the log in / sign up / reset forms ---------- */
  const num = n => Number(n || 0).toLocaleString("en");
  /* ---------- settings: saved in this browser, and on the account when logged in (so they follow you) ---------- */
  const SETTINGS_KEY = "ll-settings";
  const CURRENCIES = [["R", "South African rand (R)"], ["$", "US dollar ($)"], ["£", "British pound (£)"], ["€", "Euro (€)"], ["A$", "Australian dollar (A$)"], ["C$", "Canadian dollar (C$)"], ["NZ$", "New Zealand dollar (NZ$)"]];
  let settings = {hidePoints: false, currency: "R"};
  function loadSettings(){
    try { settings = {...settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")}; } catch(e){}
    const acc = store && store.session && (store.session.user.user_metadata || {}).settings;
    if(acc && typeof acc === "object") settings = {...settings, ...acc};
    settings.hidePoints = settings.hidePoints === true;
    if(!CURRENCIES.some(c => c[0] === settings.currency)) settings.currency = "R";
    document.body.classList.toggle("no-points", settings.hidePoints);
  }
  async function saveSettings(patch){
    settings = {...settings, ...patch};
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e){}
    document.body.classList.toggle("no-points", settings.hidePoints);
    if(store.kind === "supabase" && store.session) await store.updateProfile({settings});
  }
  function acct(){
    const u = store && store.session && store.session.user;
    if(!u) return null;
    const email = u.email || "", meta = u.user_metadata || {};
    const name = String(meta.display_name || meta.name || email.split("@")[0] || "Painter").trim();
    const bits = name.split(/[\s._-]+/).filter(Boolean);
    const initials = ((bits[0] || "?")[0] + (bits.length > 1 ? bits[bits.length - 1][0] : (bits[0] || "").slice(1, 2))).toUpperCase();
    const avatar = /^https:\/\//.test(meta.avatar_url || "") ? meta.avatar_url : "";
    return {name, email, initials, since: u.created_at || "", avatar, avatarPath: meta.avatar_path || "", custom: !!meta.display_name};
  }
  // Profile picture if there is one, otherwise initials.
  const avatarInner = a => a.avatar ? `<img src="${esc(a.avatar)}" alt="" decoding="async">` : esc(a.initials);
  // Who a shared ledger belongs to: you, or its painter's shared name and picture (initials if no picture).
  function ownerOf(army){
    const me = acct();
    if(me && store.session && army.owner === store.session.user.id) return {...me, you: true};
    const name = (army.scheme && army.scheme.by) || "";
    const bits = name.split(/[\s._-]+/).filter(Boolean);
    const initials = bits.length ? (bits[0][0] + (bits.length > 1 ? bits[bits.length - 1][0] : bits[0].slice(1, 2))).toUpperCase() : "?";
    return {name: name || "A painter", initials, avatar: (army.scheme && army.scheme.byPic) || "", you: false};
  }
  const ownerLine = (army, cls) => {
    const o = ownerOf(army);
    return `<div class="owner-line${cls ? " " + cls : ""}">${avatarHtml(o, cls === "big" ? "lg" : "")}<span><small>${o.you ? "Your" : "Collection of"}</small><strong>${o.you ? "collection" : esc(o.name)}</strong></span></div>`;
  };
  const avatarHtml = (a, cls) => `<span class="avatar${cls ? " " + cls : ""}${a.avatar ? " has-img" : ""}" aria-hidden="true">${avatarInner(a)}</span>`;
  const monthYear = d => { const t = new Date(d); return isNaN(t) ? "" : t.toLocaleDateString("en-GB", {month: "long", year: "numeric"}); };
  const CARET = `<svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
  /* ---------- installable app (PWA) ---------- */
  let installEvt = null;
  const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const installable = () => !!installEvt && !standalone();
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if(store) setTop(); });
  window.addEventListener("appinstalled", () => { installEvt = null; if(store) setTop(); });
  async function installApp(){
    if(!installEvt) return false;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch(e){}
    installEvt = null; setTop();
    return true;
  }
  const clearOfflineData = () => { try { navigator.serviceWorker && navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({type: "clear-data"}); } catch(e){} };
  function setTop(){
    const nav = $("topnav"), a = store.kind === "supabase" ? acct() : null, war = isWar();
    const sw = `<div class="mode-switch" role="group" aria-label="Switch between Livery Ledger and War Ledger"><a href="#/livery"${war ? "" : ` aria-current="true"`}><span class="ms-long">Livery</span><span class="ms-short" aria-hidden="true">L</span><span class="sr-only"> Ledger: painting</span></a><a href="#/war"${war ? ` aria-current="true"` : ""}><span class="ms-long">War</span><span class="ms-short" aria-hidden="true">W</span><span class="sr-only"> Ledger: your fighting force</span></a></div>`;
    if(store.kind !== "supabase"){ nav.innerHTML = sw; return; }
    if(!a){
      nav.innerHTML = `<button type="button" class="btn-sm ghost" data-auth-open="in">Log in</button><button type="button" class="btn-sm primary" data-auth-open="up">Sign up</button>`;
      return;
    }
    nav.innerHTML = sw + `<div class="acct">
      <button type="button" class="acct-btn" id="b-acct" aria-haspopup="menu" aria-expanded="false" aria-controls="acct-menu" aria-label="Account menu for ${esc(a.name)}">${avatarHtml(a)}<span class="acct-name">${esc(a.name)}</span>${CARET}</button>
      <div class="acct-menu" id="acct-menu" role="menu" hidden>
        <div class="acct-head">${avatarHtml(a, "lg")}<span><strong>${esc(a.name)}</strong><small>${esc(a.email)}</small></span></div>
        <a role="menuitem" href="#/">Home</a>
        ${war ? `<a role="menuitem" href="#/war">Overview</a>
        <a role="menuitem" href="#/war/armies">My armies</a>
        <a role="menuitem" href="#/war/collection">My collection</a>
        <a role="menuitem" href="#/war/lists">Army lists</a>
        <a role="menuitem" href="#/war/battles">Battle reports</a>`
        : `<a role="menuitem" href="#/livery">Overview</a>
        <a role="menuitem" href="#/livery/ledgers">My ledgers</a>
        <a role="menuitem" href="#/livery/roster">Your roster</a>
        <a role="menuitem" href="#/livery/paints">Paints &amp; recipes</a>
        <a role="menuitem" href="#/livery/activity">Painting activity</a>`}
        <a role="menuitem" href="#/shame">Pile of shame</a>
        <a role="menuitem" href="#/shared">Shared armies</a>
        <a role="menuitem" href="#/settings">Settings</a>
        ${installable() ? `<button type="button" role="menuitem" data-install>Install app</button>` : ""}
        <hr>
        <button type="button" role="menuitem" data-logout>Log out</button>
      </div>
    </div>`;
  }
  function noteHtml(){ const n = store.note(); return `<span class="note"><span class="dot ${n.cls}"></span>${esc(n.text)}</span>`; }
  async function logOut(){
    if(view.guard && !(await view.guard())) return;
    view.guard = null;
    try { await store.signOut(); } catch(e){ console.error(e); }
    clearOfflineData();
    if(location.hash !== "#/") location.hash = "#/";
  }
  const AUTH = {
    in: {h: "Welcome back", p: () => isWar() ? "Log in to see your armies." : "Log in to see your ledgers.", go: "Log in", busy: "Logging in…"},
    up: {h: "Create your free account", p: () => isWar() ? "Track your armies, lists and battles." : "Plan and track every army you paint.", go: "Create account", busy: "Creating your account…"},
    forgot: {h: "Reset your password", p: "Enter the email you signed up with and we'll send you a link to choose a new password.", go: "Send reset link", busy: "Sending…"},
    reset: {h: "Choose a new password", p: "You're nearly done. Pick a new password for your account.", go: "Save new password", busy: "Saving…"}
  };
  function authErr(err){
    const m = errText(err);
    if(/invalid login credentials/i.test(m)) return "That email and password don't match an account. Check them, or reset your password.";
    if(/email not confirmed/i.test(m)) return "Confirm your email first. Check your inbox for the link we sent you.";
    if(/already (been )?registered/i.test(m)) return "There's already an account for that email. Log in instead.";
    if(/rate limit|security purposes|too many/i.test(m)) return "Too many tries in a short time. Wait a minute, then try again.";
    if(/different from the old|same (as the )?(old )?password/i.test(m)) return "Choose a password that's different from your old one.";
    return m;
  }
  /* One form for logging in, signing up, asking for a reset link and setting a new password.
     Used in the homepage hero and in the dialog. onDone runs once someone is logged in. */
  function authForm(host, mode, opts){
    host.innerHTML = `
      <div class="auth-tabs" role="tablist" aria-label="Log in or sign up">
        <button type="button" role="tab" data-mode="in">Log in</button><button type="button" role="tab" data-mode="up">Sign up</button>
      </div>
      <h2 class="auth-h"></h2>
      <p class="auth-p"></p>
      <form novalidate>
        <label class="af-email">Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label>
        <label class="af-pass">Password<span class="pw"><input name="pass" type="password" minlength="6" required><button type="button" class="pw-show" aria-pressed="false">Show</button></span></label>
        <label class="af-pass2">Confirm password<input name="pass2" type="password" autocomplete="new-password" minlength="6" required></label>
        <p class="af-hint">At least 6 characters.</p>
        <p class="af-forgot"><button type="button" class="linkish" data-mode="forgot">Forgot password?</button></p>
        <button type="submit" class="primary af-go"></button>
        <div class="msg" role="status" aria-live="polite"></div>
        <p class="af-back"><button type="button" class="linkish" data-mode="in">Back to log in</button></p>
      </form>`;
    const q = sel => host.querySelector(sel), form = q("form"), msg = q(".msg");
    let busy = false;
    const say = (t, bad) => { msg.textContent = t || ""; msg.classList.toggle("err", !!bad); };
    function set(m, note){
      mode = AUTH[m] ? m : "in";
      const t = AUTH[mode], pick = mode === "in" || mode === "up";
      host.dataset.mode = mode;
      q(".auth-tabs").hidden = !pick;
      host.querySelectorAll(".auth-tabs [data-mode]").forEach(b => b.setAttribute("aria-selected", b.dataset.mode === mode));
      q(".auth-h").textContent = t.h; q(".auth-p").textContent = typeof t.p === "function" ? t.p() : t.p;
      q(".af-email").hidden = mode === "reset";
      q(".af-pass").hidden = mode === "forgot";
      q(".af-pass2").hidden = q(".af-hint").hidden = mode !== "up" && mode !== "reset";
      q(".af-forgot").hidden = mode !== "in";
      q(".af-back").hidden = mode !== "forgot";
      form.pass.autocomplete = mode === "in" ? "current-password" : "new-password";
      q(".af-go").textContent = t.go;
      say(note);
    }
    function focus(){ const f = [...form.querySelectorAll("input")].find(i => !i.closest("[hidden]") && !i.value) || [...form.querySelectorAll("input")].find(i => !i.closest("[hidden]")); if(f) f.focus(); }
    host.addEventListener("click", e => {
      const m = e.target.closest("button[data-mode]");   // not the host, which carries data-mode too
      if(m){ set(m.dataset.mode); focus(); return; }
      const sh = e.target.closest(".pw-show");
      if(sh){
        const on = sh.getAttribute("aria-pressed") !== "true";
        sh.setAttribute("aria-pressed", on); sh.textContent = on ? "Hide" : "Show";
        form.pass.type = form.pass2.type = on ? "text" : "password";
      }
    });
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if(busy) return;
      const email = form.email.value.trim(), pass = form.pass.value, pass2 = form.pass2.value;
      if(mode !== "reset" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ say("Enter your email address.", true); form.email.focus(); return; }
      if(mode !== "forgot" && pass.length < 6){ say("Passwords need at least 6 characters.", true); form.pass.focus(); return; }
      if((mode === "up" || mode === "reset") && pass !== pass2){ say("The two passwords don't match.", true); form.pass2.focus(); return; }
      busy = true; q(".af-go").disabled = true; say(AUTH[mode].busy);
      try {
        if(mode === "in"){ await store.signIn(email, pass); say("You're logged in."); if(opts.onDone) opts.onDone(mode); }
        else if(mode === "up"){
          const d = await store.signUp(email, pass);
          // With email protection on, signing up an address that's already registered "succeeds" with no identities.
          if(d && d.user && Array.isArray(d.user.identities) && !d.user.identities.length) say("There's already an account for that email. Log in instead, or reset your password.", true);
          else if(d && d.session){ say("Account created. You're logged in."); if(opts.onDone) opts.onDone(mode); }
          else say("Account created. Check your email for a link to confirm it, then log in.");
        }
        else if(mode === "forgot"){ await store.resetPassword(email); say("If there's an account for that email, a reset link is on its way. Check your inbox, and your spam folder too."); }
        else { await store.updatePassword(pass); say("Password saved. You're logged in."); form.pass.value = form.pass2.value = ""; if(opts.onDone) opts.onDone(mode); }
      } catch(err){ say(authErr(err), true); }
      finally { busy = false; q(".af-go").disabled = false; }
    });
    set(mode);
    return {set, focus};
  }
  let dlgAuth = null;
  function openAuth(mode, note){
    if(store.kind !== "supabase") return;
    const d = $("authdlg");
    if(!dlgAuth) dlgAuth = authForm($("auth-host"), "in", {onDone: () => { if(view.name === "landing" && !/^#\/(shared|livery|war|settings|shame)\b/.test(location.hash)) location.hash = "#/livery"; setTimeout(() => { if(d.open) d.close(); }, 700); }});
    dlgAuth.set(typeof mode === "string" ? mode : "in", note);
    if(!d.open) d.showModal();
    dlgAuth.focus();
  }
  function downloadJSON(obj, filename){
    const blob = new Blob([JSON.stringify(obj, null, 2)], {type: "application/json"});
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  /* ---------- backups ---------- */
  // A backup keeps each item's id so a restore can link lists to their units and battles to their lists.
  const backupUnit = u => ({...S.cleanUnit(u), id: u.id, image: u.image || "", photos: (u.photos || []).map(p => store.photoUrl(p))});
  const backupLedger = (a, units) => ({id: a.id, faction: a.faction, name: a.name, scheme: a.scheme, public: a.public, units: units.filter(u => u.armyId === a.id).map(backupUnit)});
  async function warRecords(armyIds){
    try {
      const [ls, gs] = await Promise.all([store.listLists(), store.listGames()]);
      const keep = x => !armyIds || armyIds.includes(x.armyId);
      return {lists: ls.filter(keep).map(({createdAt, updatedAt, ...l}) => l), games: gs.filter(keep).map(({createdAt, updatedAt, ...g}) => g)};
    } catch(e){ return {lists: [], games: []}; }
  }
  // Any backup file (everything, one ledger, or older versions) as {ledgers, lists, games, ...}.
  function readBackup(d){
    if(!d || typeof d !== "object") return null;
    if(Array.isArray(d.ledgers)) return {ledgers: d.ledgers, lists: d.lists || [], games: d.games || [], recipes: d.recipeLibrary || [], paints: d.paintsOwned || [], kits: d.pileOfShame || [], exported: d.exported};
    const units = Array.isArray(d) ? d : d.units;
    if(!Array.isArray(units)) return null;
    const a = d.army || {};
    return {ledgers: [{id: a.id || "army", faction: a.faction || "", name: a.name || "", scheme: a.scheme, units}], lists: d.lists || [], games: d.games || [], recipes: [], paints: [], kits: [], exported: d.exported, single: true};
  }
  const toBlob = async src => { const r = await fetch(src); if(!r.ok) throw new Error("photo"); return r.blob(); };
  // Adds a backup's ledgers, units (with photos), lists and battles alongside what's already here. into: restore one
  // ledger's units into an existing army instead of making a new one. Units not in an army go back to the faction's holder.
  async function restoreBackup(b, {into = null, progress = () => {}} = {}){
    const out = {ledgers: 0, units: 0, photosMissed: 0, lists: 0, games: 0, warFailed: false};
    const armyMap = {}, unitMap = {}, listMap = {};
    const existing = into ? [] : await store.listArmies();
    const total = b.ledgers.reduce((n, L) => n + (L.units || []).length, 0);
    let done = 0;
    for(const L of b.ledgers){
      let target = into;
      if(!target){
        const pool = L.scheme && L.scheme.pool && existing.find(a => a.scheme && a.scheme.pool && a.faction === L.faction);
        target = pool ? pool.id : (await store.saveArmy({faction: L.faction, name: L.name || factionName(L.faction), scheme: L.scheme, public: L.public === true})).id;
        if(!(L.scheme && L.scheme.pool)) out.ledgers++;
      }
      armyMap[L.id] = target;
      for(const u of (L.units || []).filter(r => r && typeof r === "object" && (r.name || r.datasheet))){
        const {id, image, photos, ...rest} = u;
        let main = null;
        if(image){ try { main = {file: await toBlob(image)}; } catch(e){ out.photosMissed++; } }
        let row = await store.saveUnit(target, {...rest, photos: []}, null, main, false, null);
        for(const p of (photos || []).slice(0, 12)){
          try { row = await store.addUnitPhoto(target, row, await toBlob(p)); } catch(e){ out.photosMissed++; }
        }
        if(id) unitMap[id] = row.id;
        out.units++; progress(++done, total);
      }
    }
    try {
      for(const l of b.lists || []){
        const armyId = armyMap[l.armyId] || (b.single && into) || null; if(!armyId) continue;
        const units = (l.units || []).map(e => !e || !e.u ? e : unitMap[e.u] ? {...e, u: unitMap[e.u]} : null).filter(Boolean);
        const {id, ...rest} = l;
        const saved = await store.saveList({...rest, armyId, units});
        if(id) listMap[id] = saved.id; out.lists++;
      }
      for(const g of b.games || []){
        const armyId = armyMap[g.armyId] || (b.single && into) || null; if(!armyId) continue;
        const {id, ...rest} = g;
        await store.saveGame({...rest, armyId, listId: listMap[g.listId] || "", mvp: unitMap[g.mvp] || ""});
        out.games++;
      }
      if(out.games) await syncRecords(Object.values(armyMap));
    } catch(e){ console.warn("Couldn't restore lists and battles", e); out.warFailed = true; }
    return out;
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
    if(/access_token=|error_description=/.test(location.hash)){ history.replaceState(null, "", location.pathname + location.search + "#/"); lastHash = location.hash; }
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
    // War Ledger pages are red, Livery Ledger's own pages green; shared pages keep the last one used.
    // Old links to the profile page now open Livery Ledger's overview.
    if(parts[0] === "profile"){ history.replaceState(null, "", "#/livery"); lastHash = location.hash; parts.splice(0, parts.length, "livery"); }
    setMode(parts[0] === "war" ? "war" : ["livery", "army", "new"].includes(parts[0]) ? "livery" : savedMode());
    document.querySelectorAll("dialog.wdlg[open]").forEach(d => d.close());
    setTop();
    try {
      if(parts[0] === "war"){
        if(store.kind === "supabase" && !store.session){ await viewLanding(); setTimeout(() => openAuth("in", "Log in to open War Ledger."), 0); }
        else if(parts[1] === "new" && FBY[parts[2]]) await viewWarNewFaction(parts[2]);
        else if(parts[1] === "new") await viewWarNew();
        else if(parts[1] === "army" && parts[2]) await viewWarArmy(parts[2]);
        else if(parts[1] === "armies") await viewWarArmies();
        else if(parts[1] === "collection") await viewWarCollection();
        else if(parts[1] === "list" && parts[2]) await viewWarList(parts[2]);
        else if(parts[1] === "lists") await viewWarLists();
        else if(parts[1] === "battles") await viewWarBattles();
        else await viewWarDash();
      } else
      if(parts[0] === "new" && FBY[parts[1]]) await viewSetup({factionId: parts[1]});
      else if(parts[0] === "army" && parts[1] && parts[2] === "colours") await viewSetup({armyId: parts[1]});
      else if(parts[0] === "army" && parts[1] && parts[2] === "guide") await viewGuide(parts[1]);
      else if(parts[0] === "army" && parts[1] && parts[2] === "unit" && parts[3]) await viewLedger(parts[1], parts[3]);
      else if(parts[0] === "army" && parts[1]) await viewLedger(parts[1]);
      // The list of shared armies is for logged-in painters; a shared ledger itself still opens from its link.
      else if(parts[0] === "shame"){
        if(store.kind === "supabase" && !store.session){ await viewLanding(); setTimeout(() => openAuth("in", "Log in to see your pile of shame."), 0); }
        else await viewShame();
      }
      else if(parts[0] === "settings"){
        if(store.kind === "supabase" && !store.session){ await viewLanding(); setTimeout(() => openAuth("in", "Log in to change your settings."), 0); }
        else await viewSettings();
      }
      else if(parts[0] === "shared"){
        if(store.kind === "supabase" && !store.session){ await viewLanding(); setTimeout(() => openAuth("in", "Log in to browse shared armies."), 0); }
        else await viewShared();
      }
      else if(parts[0] === "livery"){
        // Livery Ledger: your profile, ledgers, roster and painting activity; logged out, the homepage with the log in form open.
        if(store.kind === "supabase" && !store.session){ await viewLanding(); setTimeout(() => openAuth("in", "Log in to see your ledgers."), 0); }
        else if(parts[1] === "new" && FBY[parts[2]]) await viewSetup({factionId: parts[2]});
        else if(parts[1] === "new") await viewLiveryNew();
        else if(parts[1] === "ledgers") await viewLiveryLedgers();
        else if(parts[1] === "roster") await viewLiveryRoster();
        else if(parts[1] === "activity") await viewLiveryActivity();
        else if(parts[1] === "paints") await viewLiveryPaints();
        else await viewLivery();
      }
      // "#/" (and the old "#/welcome"): the homepage.
      else await viewLanding();
    } catch(err){
      console.error(err);
      app.innerHTML = `<div class="banner"><span class="dot warn"></span>Couldn't load this page: ${esc(errText(err))}</div><p><a class="btn" href="${isWar() ? "#/war" : "#/livery"}">Back to your ${isWar() ? "armies" : "ledgers"}</a></p>`;
    }
    window.scrollTo(0, 0);
  }

  /* ============================================================
     War Ledger: the same collection, seen as a fighting force.
     What you own, what you can field, whether it's ready, and how it fared.
     (Painting stays in Livery Ledger; both read the same armies and units.)
     ============================================================ */
  const MODE_KEY = "ll-mode";
  // Units in your collection that aren't in an army live in a hidden holder army, one per faction.
  const isPool = a => !!(a && a.scheme && a.scheme.pool);
  async function poolFor(faction, pools){
    const p = (pools || []).find(a => a.faction === faction); if(p) return p;
    const f = FBY[faction] || {name: faction};
    return store.saveArmy({faction, name: `${f.name} (not in an army)`, scheme: {...P.presetFor(faction), pool: true, wonly: true}, public: false});
  }
  const isWar = () => document.documentElement.dataset.mode === "war";
  function setMode(m){
    if(m === "war") document.documentElement.dataset.mode = "war"; else delete document.documentElement.dataset.mode;
    try { localStorage.setItem(MODE_KEY, m === "war" ? "war" : "livery"); } catch(e){}
  }
  const savedMode = () => { try { return localStorage.getItem(MODE_KEY) === "war" ? "war" : "livery"; } catch(e){ return "livery"; } };

  const READY_RULES = [["painted", "Painted"], ["based", "Painted and based"], ["built", "Built"]];
  const readyRule = () => READY_RULES.some(r => r[0] === settings.ready) ? settings.ready : "painted";
  const readyRuleText = () => ({painted: "Ready means painted", based: "Ready means painted and based", built: "Ready means built"})[readyRule()];
  // Owned, built, painted and battle-ready models for one unit.
  function readiness(u){
    const owned = Math.max(1, +u.count || 1), st = u.stages || [];
    if(u.own === "planned") return {owned, built: 0, painted: 0, ready: 0, auto: 0, points: +u.points || 0, planned: true};
    const painted = Math.min(owned, Math.max(0, +u.painted || 0));
    const built = Math.min(owned, Math.max(u.built != null ? +u.built : (st.includes("built") ? owned : 0), painted));
    const rule = readyRule();
    const auto = rule === "built" ? built : rule === "based" ? (st.includes("basing") ? painted : 0) : painted;
    const ready = u.ready != null ? Math.min(owned, +u.ready) : auto;
    return {owned, built, painted, ready, auto, points: +u.points || 0};
  }
  // Every model in exactly one bucket, for the collection status bar.
  const BUCKETS = [["sprue", "On sprue"], ["built", "Built"], ["primed", "Primed"], ["painting", "Painting"], ["painted", "Painted"], ["ready", "Battle ready"]];
  function buckets(units, kits){
    const b = {sprue: 0, built: 0, primed: 0, painting: 0, painted: 0, ready: 0};
    units.filter(u => u.own !== "planned").forEach(u => {
      const r = readiness(u), st = u.stages || [], made = Math.max(r.built, r.ready);
      b.ready += r.ready; b.sprue += r.owned - made;
      let rest = made - r.ready;
      const p = Math.min(rest, Math.max(0, r.painted - r.ready)); b.painted += p; rest -= p;
      b[st.some(k => ["base", "shade", "highlight", "basing", "varnish"].includes(k)) ? "painting" : st.includes("primed") ? "primed" : "built"] += rest;
    });
    (kits || []).forEach(k => { b.sprue += k.models; });
    return b;
  }
  // Totals of what you own; planned units are only counted in "planned".
  const sumUp = units => units.reduce((t, u) => { if(u.own === "planned"){ t.planned++; return t; } const r = readiness(u); t.models += r.owned; t.ready += r.ready; t.points += r.points; t.built += r.built; t.painted += r.painted; return t; }, {models: 0, ready: 0, points: 0, built: 0, painted: 0, planned: 0});
  const pctOf = (a, b) => b ? Math.round(a / b * 100) : 0;
  const recordOf = games => games.reduce((r, g) => { r[g.result]++; return r; }, {w: 0, l: 0, d: 0});
  const recText = r => `${r.w}–${r.l}${r.d ? "–" + r.d : ""}`;
  const RES = {w: "Win", l: "Loss", d: "Draw"};
  const ptsText = n => num(n) + " pts";
  const factionName = id => (FBY[id] || {}).name || id || "Unknown";
  const byNewest = (a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || "");
  const dayText = d => { const t = new Date(d + "T12:00:00"); return isNaN(t) ? d : t.toLocaleDateString("en-GB", {day: "numeric", month: "short", year: "numeric"}); };

  // A star you can click, shared with Livery Ledger's starred units.
  const warStar = u => `<button type="button" class="star wstar${u.fav ? " on" : ""}" data-wstar="${esc(u.id)}" aria-pressed="${!!u.fav}" aria-label="${u.fav ? "Unstar" : "Star"} ${esc(u.name)}" title="${u.fav ? "Starred" : "Star this unit"}">${STAR(u.fav)}</button>`;
  async function toggleWarStar(D, id, redraw){
    const u = D.units.find(x => x.id === id); if(!u) return;
    const next = {...u, fav: !u.fav};
    D.units = D.units.map(x => x.id === id ? next : x); redraw();
    try { const row = await store.saveUnit(u.armyId, next, u.id, null, false, u); D.units = D.units.map(x => x.id === id ? {...next, ...row} : x); }
    catch(err){ D.units = D.units.map(x => x.id === id ? u : x); redraw(); flash("Couldn't star it: " + errText(err)); }
  }
  const WAR_TABS = [["", "Overview"], ["armies", "Armies"], ["collection", "Collection"], ["lists", "Army lists"], ["battles", "Battles"]];
  const warTabs = on => `<nav class="war-tabs" aria-label="War Ledger">${WAR_TABS.map(([k, l]) => `<a href="#/war${k ? "/" + k : ""}"${k === on ? ` aria-current="page"` : ""}>${l}</a>`).join("")}</nav>`;
  const missingBanner = D => D.warMissing ? `<div class="banner"><span class="dot warn"></span><span>Army lists and battle reports need a quick database update. Run <strong>supabase/features.sql</strong> in Supabase to turn them on.</span></div>` : "";

  let flashTimer = 0;
  function flash(text){
    const t = $("toast"); t.querySelector("span").textContent = text; t.querySelector("button").hidden = true; t.hidden = false;
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { t.hidden = true; }, 4000);
  }
  // Clicks on the page, removed again when the page changes.
  function onApp(handler){
    app.addEventListener("click", handler);
    const prev = view.cleanup;
    view.cleanup = () => { app.removeEventListener("click", handler); if(prev) prev(); };
  }
  // A dialog built on the fly and removed when it closes.
  function modal(title, body, cls){
    const d = document.createElement("dialog");
    d.className = "wdlg" + (cls ? " " + cls : ""); d.setAttribute("aria-labelledby", "wd-h");
    d.innerHTML = `<form class="wd-form" novalidate><div class="wd-top"><h2 id="wd-h">${title}</h2><button type="button" class="btn-sm" data-x>Close</button></div><div class="wd-body">${body}</div></form>`;
    document.body.appendChild(d);
    d.querySelector("[data-x]").addEventListener("click", () => d.close());
    d.addEventListener("close", () => d.remove());
    d.addEventListener("mousedown", e => { if(e.target === d) d.close(); });
    d.showModal();
    return d;
  }
  // Two taps to delete: the first arms the button, the second does it.
  function armButton(b, label, go){
    b.addEventListener("click", async () => {
      if(b.dataset.armed !== "1"){ b.dataset.armed = "1"; b.textContent = label; setTimeout(() => { if(b.isConnected){ b.dataset.armed = ""; b.textContent = b.dataset.label; } }, 4000); return; }
      b.disabled = true; try { await go(); } finally { if(b.isConnected) b.disabled = false; }
    });
    b.dataset.label = b.textContent;
  }

  // Everything War Ledger shows: armies, units, lists and battles (and the pile of shame for the dashboard).
  async function warData(withKits){
    const [armies, units] = await Promise.all([store.listArmies(), store.listAllUnits()]);
    let lists = [], games = [], warMissing = false;
    try { [lists, games] = await Promise.all([store.listLists(), store.listGames()]); }
    catch(e){ if(e.code === "nowar") warMissing = true; else throw e; }
    const kits = withKits ? await getShame().catch(() => []) : [];
    games.sort(byNewest);
    const mine = store.session ? store.session.user.id : null;
    const own = armies.filter(a => !mine || !a.owner || a.owner === mine);
    const D = {armies: own.filter(a => !isPool(a)), pools: own.filter(isPool), units, lists, games, kits, warMissing};
    D.byArmy = id => D.units.filter(u => u.armyId === id);   // reads the current units, so edits show straight away
    return D;
  }
  // Every unit of a faction you own or plan to: all its armies plus the ones not in an army.
  // Army lists draw from this, so a faction split across several ledgers still makes one pool.
  const armyById = (D, id) => D.armies.find(a => a.id === id) || D.pools.find(a => a.id === id);
  function factionUnits(D, armyId){
    const a = armyById(D, armyId); if(!a) return [];
    const ids = new Set(D.armies.concat(D.pools).filter(x => x.faction === a.faction).map(x => x.id));
    return D.units.filter(u => ids.has(u.armyId));
  }
  // Where a unit lives, for list builder rows from another army.
  const homeOf = (D, u, listArmyId) => { if(u.armyId === listArmyId) return ""; const a = armyById(D, u.armyId); return !a ? "" : isPool(a) ? "Not in an army" : "From " + a.name; };
  function armyBadge(a, size){
    const keep = PROF; PROF = P.profileFor(a.faction);
    const html = a.scheme && a.scheme.tiers ? tierBadge(a.scheme, a.scheme.tiers[0], size) : factionBadge(a.faction, size);
    PROF = keep; return html;
  }
  function armyCard(a, D){
    const t = sumUp(D.byArmy(a.id)), gs = D.games.filter(g => g.armyId === a.id), r = recordOf(gs), p = pctOf(t.ready, t.models);
    return `<a class="lcard war-card" href="#/war/army/${esc(a.id)}">
      <div class="card-top">${armyBadge(a, 52)}<div><h3>${esc(a.name)}</h3><div class="meta">${esc(factionName(a.faction))}</div></div></div>
      <div class="wc-nums"><span><b>${num(t.points)}</b>${a.scheme.limit ? ` / ${num(a.scheme.limit)}` : ""} pts</span><span><b>${num(t.models)}</b> ${t.models === 1 ? "model" : "models"}</span><span><b>${gs.length}</b> ${gs.length === 1 ? "game" : "games"}</span></div>
      <div class="prog" aria-hidden="true"><i style="width:${p}%"></i></div>
      <div class="foot"><span>${p}% battle ready</span><span>${gs.length ? `${r.w} W · ${r.l} L${r.d ? ` · ${r.d} D` : ""}` : "No games yet"}</span></div>
    </a>`;
  }
  const warEmpty = () => `<section class="panel war-empty">
      <span class="we-mark" aria-hidden="true">${SWORDS}</span>
      <h2>Muster your first army</h2>
      <p class="sub">Pick a faction and name your force. Then add the units you own, or paste an army list to add them all at once.</p>
      <a class="btn primary" href="#/war/new">+ New army</a>
      <p class="hint">Already painting in Livery Ledger? Those armies show up here automatically.</p>
    </section>`;
  const SWORDS = `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3l10.5 12.5M20 3 9.5 15.5"/><path d="M12.5 17.5l3.5-3M11.5 17.5 8 14.5"/><path d="M15.5 16l3.5 4.5M8.5 16 5 20.5"/></svg>`;

  function gameRows(games, D){
    const an = id => (D.armies.find(a => a.id === id) || {}).name || "Deleted army";
    const ln = id => (D.lists.find(l => l.id === id) || {}).name || "";
    return `<ul class="games">${games.map(g => `<li class="game r-${g.result}">
        <span class="res" aria-label="${RES[g.result]}">${g.result.toUpperCase()}</span>
        <div class="g-main"><strong>${esc(an(g.armyId))}${ln(g.listId) ? ` <small>· ${esc(ln(g.listId))}</small>` : ""}</strong>
          <small>vs ${esc(g.oppName || factionName(g.opp))}${g.mission ? ` · ${esc(g.mission)}` : ""} · ${esc(dayText(g.date))}</small></div>
        ${g.us != null || g.them != null ? `<span class="score">${g.us ?? "–"}–${g.them ?? "–"}</span>` : ""}
        <button type="button" class="btn-sm" data-game="${esc(g.id)}" aria-label="Edit battle on ${esc(dayText(g.date))}">Edit</button>
      </li>`).join("")}</ul>`;
  }

  /* ---------- dashboard ---------- */
  async function viewWarDash(){
    view.name = "war"; document.title = "Overview · War Ledger";
    let D = null;
    const render = async () => { D = await warData(true); drawWarDash(D); };
    await render();
    onApp(e => warClicks(e, D, render));
  }
  function drawWarDash(D){
    const all = sumUp(D.units), bk = buckets(D.units, D.kits), total = Object.values(bk).reduce((a, b) => a + b, 0);
    const rec = recordOf(D.games), shown = D.armies.slice(0, 6);
    app.innerHTML = `
      ${profileHead({war: true,
        stats: [[D.armies.length, D.armies.length === 1 ? "Army" : "Armies"], [num(total), "Models"], [num(all.points), "Points"], [`${pctOf(bk.ready, total)}%`, "Battle ready"]],
        actions: D.armies.length ? `<a class="btn btn-sm" href="#/war/collection">${LIST_ICON}Your collection<span class="count">${num(D.units.filter(u => D.armies.concat(D.pools).some(a => a.id === u.armyId)).length)}</span></a>${shameBtn()}${settingsBtn}` : ""})}
      ${warTabs("")}
      ${missingBanner(D)}
      ${D.armies.length ? `
      <section class="panel war-status" aria-labelledby="ws-h">
        <h2 class="ph" id="ws-h">Collection status <small class="ws-rule">${esc(readyRuleText())}</small></h2>
        <div class="stack" role="img" aria-label="${esc(BUCKETS.map(([k, l]) => `${l}: ${bk[k]}`).join(", "))}">${BUCKETS.map(([k]) => bk[k] ? `<i class="b-${k}" style="flex:${bk[k]}"></i>` : "").join("")}</div>
        <ul class="stack-key">${BUCKETS.map(([k, l]) => `<li><span class="sw b-${k}"></span><span><b>${num(bk[k])}</b><small>${l}</small></span></li>`).join("")}</ul>
      </section>
      <section class="war-sec" aria-labelledby="wa-h"><div class="sec-h"><h2 id="wa-h">Your armies</h2><div class="sec-acts">${D.armies.length > shown.length ? `<a href="#/war/armies">All ${D.armies.length} armies</a>` : ""}<a class="btn primary btn-sm" href="#/war/new">+ New army</a></div></div>
        <div class="ledgers">${shown.map(a => armyCard(a, D)).join("")}</div></section>
      <section class="war-sec" aria-labelledby="wb-h"><div class="sec-h"><h2 id="wb-h">Recent battles</h2><div class="sec-acts">${D.games.length ? `<a href="#/war/battles">All battles · ${recText(rec)}</a>` : ""}${D.warMissing ? "" : `<button type="button" class="btn-sm" data-log="">Log a battle</button>`}</div></div>
        ${D.games.length ? gameRows(D.games.slice(0, 5), D) : `<p class="hint">No battles logged yet. After your next game, log it here to start your record.</p>`}</section>
      ` : warEmpty()}`;
    wireProfileHead();
  }
  // Buttons that appear on several War Ledger pages.
  function warClicks(e, D, again){
    const t = e.target.closest("button"); if(!t) return;
    if(t.matches("[data-log]")) openGame(D, {armyId: t.dataset.log || "", listId: t.dataset.list || ""}, again);
    else if(t.matches("[data-game]")) openGame(D, D.games.find(g => g.id === t.dataset.game), again);
  }

  /* ---------- armies ---------- */
  async function viewWarArmies(){
    view.name = "war-armies"; document.title = "Armies · War Ledger";
    let D = null;
    const render = async () => { D = await warData(false); app.innerHTML = `
      <section class="page-head war-head">
        <div><p class="eyebrow">War Ledger</p><h1>My armies</h1><p class="sub">Every force you own, how ready it is and how it has fared.</p></div>
        <div class="war-actions"><a class="btn primary" href="#/war/new">+ New army</a></div>
      </section>
      ${warTabs("armies")}
      ${D.armies.length ? `<h2 class="sr-only">Your armies</h2><div class="ledgers">${D.armies.map(a => armyCard(a, D)).join("")}</div>` : warEmpty()}`; };
    await render();
    onApp(e => warClicks(e, D, render));
  }
  function factionSelect(id, value, blank){
    const groups = {};
    FACTIONS.forEach(f => { (groups[f.group || "Other"] = groups[f.group || "Other"] || []).push(f); });
    return `<select id="${id}">${blank ? `<option value="">${esc(blank)}</option>` : ""}${Object.entries(groups).map(([g, fs]) => `<optgroup label="${esc(g)}">${fs.map(f => `<option value="${esc(f.id)}"${f.id === value ? " selected" : ""}>${esc(f.name)}</option>`).join("")}</optgroup>`).join("")}</select>`;
  }
  // A new unit, coloured from the army's scheme so it also looks right in Livery Ledger.
  function unitRow(army, sh, extra){
    const scheme = army.scheme, c = scheme.colors, role = sh ? sh.r : ((extra && extra.role) || "Infantry");
    const keep = PROF; PROF = P.profileFor(army.faction);
    const tierIdx = (role === "Epic Hero" || role === "Character") ? Math.min(2, scheme.tiers.length - 1) : 0;
    const row = {datasheet: sh ? sh.n : "", role, name: sh ? sh.n : "", count: 1, points: sh ? sh.p || 0 : 0, stages: [], painted: 0, tier: tierIdx,
      helmet: scheme.tiers[tierIdx].color, head: autoHead(role), skin: c.skin, lens: c.lens, armour: c.armour, secondary: c.secondary, trim: c.trim, emblem: c.emblem, shape: "",
      cloth: c.cloth, metal: c.metal, ...(extra || {})};
    PROF = keep; return row;
  }
  const sheetsOf = fid => ((FBY[fid] || {}).units || []);
  function sheetSelect(fid, value){
    const all = sheetsOf(fid), byRole = {};
    all.forEach(s => { const k = s.t ? "Legends and other" : s.r; (byRole[k] = byRole[k] || []).push(s); });
    const order = [...ROLE_ORDER, "Legends and other"].filter(r => byRole[r]);
    return `<select id="w-sheet"><option value="">Custom unit (not in the list)</option>${order.map(r => `<optgroup label="${esc(r)}">${byRole[r].map(s => `<option value="${esc(s.n)}"${s.n === value ? " selected" : ""}>${esc(s.n)}${s.p ? ` · ${s.p} pts` : ""}</option>`).join("")}</optgroup>`).join("")}</select>`;
  }

  /* ---------- a unit's record ---------- */
  // army: the unit's army, a holder army, or {faction, pool: true} for a new unit not in an army yet.
  // opts.armies / opts.pools: offer a choice of army, so a unit can be moved (or kept out of any army).
  function openUnit(army, u, done, opts){
    opts = opts || {};
    const r = u ? readiness(u) : {owned: 1, built: 0, painted: 0, ready: 0};
    const choices = opts.armies ? opts.armies.slice().sort((a, b) => (a.faction === army.faction ? 0 : 1) - (b.faction === army.faction ? 0 : 1) || a.name.localeCompare(b.name)) : null;
    const curArmy = isPool(army) || !army.id ? "" : army.id;
    const cur = settings.currency;
    const d = modal(u ? esc(u.name) : "Add a unit", `
      <div class="wgrid">
        <label class="span2">Datasheet${sheetSelect(army.faction, u ? u.datasheet : "")}</label>
        <label class="span2">Name<input id="w-uname" maxlength="80" value="${esc(u ? u.name : "")}" placeholder="Leave blank to use the datasheet name"></label>
        <label>Role<select id="w-role">${(u && u.role && !ROLE_ORDER.includes(u.role) ? [u.role, ...ROLE_ORDER] : ROLE_ORDER).map(x => `<option${(u ? u.role || "Infantry" : "Infantry") === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
        <label>Models<input id="w-count" type="number" min="1" max="99" inputmode="numeric" value="${r.owned}"></label>
        <label>Points<input id="w-pts" type="number" min="0" max="9999" inputmode="numeric" value="${u ? u.points : 0}"></label>
        ${choices ? `<label class="span3">Army<select id="w-army"><option value="">Not in an army (just in your collection)</option>${choices.map(a => `<option value="${esc(a.id)}"${a.id === curArmy ? " selected" : ""}>${esc(a.name)}${a.faction !== army.faction ? ` (${esc(factionName(a.faction))})` : ""}</option>`).join("")}</select></label>` : ""}
        <label class="span3">Ownership<select id="w-own"><option value="owned"${!u || u.own !== "planned" ? " selected" : ""}>I own it</option><option value="planned"${u && u.own === "planned" ? " selected" : ""}>Planned: not bought yet</option></select></label>
        <label class="chk span3"><input type="checkbox" id="w-fav"${u && u.fav ? " checked" : ""}><span>Starred <small>(shows with a star here and in Livery Ledger)</small></span></label>
      </div>
      <fieldset class="wfs"><legend>Readiness</legend>
        <div class="wgrid">
          <label>Built<input id="w-built" type="number" min="0" max="99" inputmode="numeric" value="${r.built}"></label>
          <label>Painted<input id="w-painted" type="number" min="0" max="99" inputmode="numeric" value="${r.painted}"></label>
          <label>Battle ready<input id="w-ready" type="number" min="0" max="99" inputmode="numeric" value="${r.ready}"></label>
          <label class="chk span3"><input type="checkbox" id="w-auto"${!u || u.ready == null ? " checked" : ""}><span>Work out battle ready for me <small>(${esc(readyRuleText().toLowerCase())})</small></span></label>
        </div>
        <p class="hint">Painted is shared with Livery Ledger, so painting progress there updates this too.</p>
      </fieldset>
      <fieldset class="wfs"><legend>Wargear</legend>
        <div class="wgrid">
          <label class="span3">Ranged weapons<input id="w-ranged" maxlength="600" value="${esc(u ? u.ranged : "")}" placeholder="e.g. Bolt rifles, Astartes grenade launcher"></label>
          <label class="span3">Melee weapons<input id="w-melee" maxlength="600" value="${esc(u ? u.melee : "")}" placeholder="e.g. Close combat weapons"></label>
        </div>
      </fieldset>
      <fieldset class="wfs"><legend>Purchase</legend>
        <div class="wgrid">
          <label>Bought<input id="w-bought" type="date" value="${esc(u ? u.bought : "")}" max="${isoDay(new Date())}"></label>
          <label>Price (${esc(cur)})<input id="w-price" type="number" min="0" step="0.01" inputmode="decimal" value="${u && u.price ? u.price : ""}"></label>
          <label>Bought from<input id="w-shop" maxlength="80" value="${esc(u ? u.shop : "")}" placeholder="e.g. local store"></label>
        </div>
      </fieldset>
      <label>Assembly notes<textarea id="w-asm" rows="2" maxlength="600" placeholder="e.g. magnetised arms, built with the heavy bolter">${esc(u ? u.assembly : "")}</textarea></label>
      <label>Notes<textarea id="w-notes" rows="2" maxlength="600">${esc(u ? u.notes : "")}</textarea></label>
      <div class="row-actions"><button type="submit" class="primary">${u ? "Save unit" : "Add unit"}</button>${u ? `<button type="button" class="danger" id="w-del">Delete unit</button>` : ""}<span class="msg" id="w-msg" role="status"></span></div>`, "wide");
    const v = id => $(id).value, n = (id, max) => Math.min(max, Math.max(0, parseInt(v(id), 10) || 0));
    const syncReady = () => {
      const auto = $("w-auto").checked, count = Math.max(1, n("w-count", 99));
      $("w-ready").disabled = auto;
      if(auto){ const built = Math.min(count, Math.max(n("w-built", 99), n("w-painted", 99))), painted = Math.min(count, n("w-painted", 99)), st = u ? u.stages || [] : [];
        const rule = readyRule(); $("w-ready").value = rule === "built" ? built : rule === "based" ? (st.includes("basing") ? painted : 0) : painted; }
    };
    ["w-auto", "w-count", "w-built", "w-painted"].forEach(id => $(id).addEventListener("input", syncReady));
    syncReady();
    $("w-sheet").addEventListener("change", () => {
      const sh = sheetsOf(army.faction).find(s => s.n === v("w-sheet")); if(!sh) return;
      $("w-role").value = ROLE_ORDER.includes(sh.r) ? sh.r : "Other";
      if(!u){ $("w-pts").value = sh.p || 0; $("w-count").value = minModels(sh);
        if(!$("w-ranged").value && sh.wr) $("w-ranged").value = sh.wr.slice(0, 4).join(", ");
        if(!$("w-melee").value && sh.wm) $("w-melee").value = sh.wm.slice(0, 3).join(", "); }
      syncReady();
    });
    d.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault();
      const sh = sheetsOf(army.faction).find(s => s.n === v("w-sheet"));
      const name = v("w-uname").trim() || (sh ? sh.n : "");
      if(!name){ $("w-msg").textContent = "Choose a datasheet or give the unit a name."; $("w-uname").focus(); return; }
      const count = Math.max(1, n("w-count", 99)), painted = Math.min(count, n("w-painted", 99)), built = Math.min(count, Math.max(n("w-built", 99), painted));
      const base = u ? {...u} : unitRow(army, sh, {});
      const row = {...base, datasheet: sh ? sh.n : (u ? u.datasheet : ""), role: v("w-role"), name, count, points: n("w-pts", 9999), painted, built,
        ready: $("w-auto").checked ? null : Math.min(count, n("w-ready", 99)), ranged: v("w-ranged").trim(), melee: v("w-melee").trim(),
        bought: v("w-bought"), price: v("w-price"), shop: v("w-shop").trim(), assembly: v("w-asm").trim(), notes: v("w-notes").trim(), fav: $("w-fav").checked, own: v("w-own")};
      // Keep Livery Ledger's Built stage in step with a fully built unit.
      const st = (row.stages || []).slice();
      if(built >= count && !st.includes("built")) st.unshift("built");
      if(built === 0 && painted === 0) { const i = st.indexOf("built"); if(i >= 0 && st.length === 1) st.splice(i, 1); }
      row.stages = st;
      const b = e.submitter || d.querySelector("[type=submit]"); b.disabled = true; $("w-msg").textContent = "Saving…";
      try {
        // Where it goes: the chosen army, or the faction's holder when it isn't in an army.
        const pick = $("w-army") ? $("w-army").value : curArmy;
        // A loose unit belongs with its datasheet's faction (a Necron unit moved out of a Tyranid army stays Necron).
        const ownFaction = row.datasheet && !sheetsOf(army.faction).some(x => x.n === row.datasheet) ? ((FACTIONS.find(f => f.units.some(x => x.n === row.datasheet)) || {}).id || army.faction) : army.faction;
        const target = pick ? pick : (isPool(army) && army.id && ownFaction === army.faction ? army.id : (await poolFor(ownFaction, opts.pools)).id);
        await store.saveUnit(target, row, u ? u.id : null, null, false, u || null);
        d.close(); flash(u ? (target !== army.id && u ? `Moved ${name}` : `Saved ${name}`) : `Added ${name}`); done();
      }
      catch(err){ console.error(err); $("w-msg").textContent = "Couldn't save: " + errText(err); b.disabled = false; }
    });
    if(u) armButton($("w-del"), "Tap again to delete", async () => {
      try { await store.removeUnit(u); d.close(); flash(`Deleted ${u.name}`); done(); }
      catch(err){ $("w-msg").textContent = "Couldn't delete: " + errText(err); }
    });
  }

  // Paste an army list or share code to add its units to an army's collection.
  function openAddFromList(army, done){
    const d = modal("Add units from a list", `
      <p class="sub">Paste a list from the Warhammer 40,000 app, New Recruit, BattleScribe or a list-builder share code.</p>
      <label>Army list<textarea id="w-list" rows="8" placeholder="Captain (80 points)&#10;Intercessor Squad (160 points)&#10;  • 10x Intercessor"></textarea></label>
      <div id="w-found" class="w-found" aria-live="polite"></div>
      <div class="row-actions"><button type="submit" class="primary" id="w-add" disabled>Add units</button><span class="msg" id="w-msg" role="status"></span></div>`, "wide");
    const reader = makeListReader(army.faction);
    let parsed = null;
    const read = () => {
      const t = $("w-list").value; parsed = t.trim() ? (reader.parseCode(t) || reader.parseList(t)) : null;
      const us = parsed ? parsed.units : [];
      $("w-found").innerHTML = !parsed ? "" : us.length ? `<p><strong>${plural(us.length, "unit")}</strong> found · ${ptsText(us.reduce((a, x) => a + x.points, 0))}</p><ul>${us.map(x => `<li>${esc(x.name)} <small>${x.count} · ${x.points} pts</small></li>`).join("")}</ul>${parsed.unmatched.length ? `<p class="hint">Not matched: ${esc(parsed.unmatched.join(", "))}</p>` : ""}` : `<p class="hint">No units found yet. Paste the whole list, including the points.</p>`;
      $("w-add").disabled = !us.length; $("w-add").textContent = us.length ? `Add ${plural(us.length, "unit")}` : "Add units";
    };
    $("w-list").addEventListener("input", read);
    d.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault(); if(!parsed || !parsed.units.length) return;
      $("w-add").disabled = true; $("w-msg").textContent = "Adding…";
      try {
        const rows = parsed.units.map(x => unitRow(army, x.sheet, {name: x.name, count: x.count, points: x.points, melee: x.melee.join(", "), ranged: x.ranged.join(", "), notes: x.notes.join(". ")}));
        const n = await store.importUnits(army.id, rows);
        if(parsed.limit && !army.scheme.limit) await store.saveArmy({faction: army.faction, name: army.name, scheme: {...army.scheme, limit: parsed.limit}, public: army.public}, army.id);
        d.close(); flash(`Added ${plural(n, "unit")}`); done();
      } catch(err){ console.error(err); $("w-msg").textContent = "Couldn't add units: " + errText(err); $("w-add").disabled = false; }
    });
    $("w-list").focus();
  }

  /* ---------- an army's command page ---------- */
  async function viewWarArmy(id){
    let army = await store.getArmy(id);
    const mine = store.kind !== "supabase" || (army && store.session && army.owner === store.session.user.id);
    if(!army || !mine){
      app.innerHTML = `${warTabs("armies")}<div class="banner"><span class="dot warn"></span><span>${army ? "This army belongs to another painter." : "That army couldn't be found. It may have been deleted."}</span></div><p>${army ? `<a class="btn" href="#/army/${esc(id)}">View their ledger</a> ` : ""}<a class="btn" href="#/war/armies">Your armies</a></p>`;
      return;
    }
    view.name = "war-army"; document.title = `${army.name} · War Ledger`;
    let D = await warData(false), filter = "all";
    async function reload(){ army = await store.getArmy(id) || army; D = await warData(false); draw(); }
    function draw(){
      const units = D.byArmy(id).slice().sort((a, b) => (ROLE_ORDER.indexOf(a.role) + 99) % 99 - (ROLE_ORDER.indexOf(b.role) + 99) % 99 || a.name.localeCompare(b.name));
      const t = sumUp(units), gs = D.games.filter(g => g.armyId === id), rec = recordOf(gs), ls = D.lists.filter(l => l.armyId === id);
      const roles = ROLE_ORDER.map(r => [r, units.filter(u => u.own !== "planned" && (ROLE_ORDER.includes(u.role) ? u.role : "Other") === r)]).filter(x => x[1].length);
      const shown = filter === "notready" ? units.filter(u => { const r = readiness(u); return r.ready < r.owned; }) : filter === "fav" ? units.filter(u => u.fav) : units;
      app.innerHTML = `
        <div class="crumbs"><a href="#/war">War Ledger</a> / <a href="#/war/armies">Armies</a> / ${esc(army.name)}</div>
        <section class="page-head war-head">
          <div class="wh-id">${armyBadge(army, 64)}<div><p class="eyebrow">${esc(factionName(army.faction))}</p><h1>${esc(army.name)}</h1>
            <p class="sub"><a href="#/army/${esc(id)}">Open in Livery Ledger</a> to plan its colours and painting.</p></div></div>
          <div class="war-actions"><button type="button" class="primary" data-add-unit>+ Add unit</button><button type="button" data-from-list>Add from a list</button></div>
        </section>
        ${warTabs("armies")}
        ${missingBanner(D)}
        <section class="war-stats five" aria-label="Army overview">
          <div class="wstat"><b>${num(t.points)}</b><span>Points</span><small>${army.scheme.limit ? `Building to ${ptsText(army.scheme.limit)}` : "Total of all units"}</small></div>
          <div class="wstat"><b>${num(t.models)}</b><span>Models</span><small>${plural(units.length - t.planned, "unit")}${t.planned ? ` · ${t.planned} planned` : ""}</small></div>
          <div class="wstat ready"><b>${num(t.ready)}<small> / ${num(t.models)}</small></b><span>Battle ready</span><div class="wbar" aria-hidden="true"><i style="width:${pctOf(t.ready, t.models)}%"></i></div></div>
          <div class="wstat"><b>${gs.length}</b><span>${gs.length === 1 ? "Game" : "Games"}</span><small>${gs[0] ? "Last on " + esc(dayText(gs[0].date)) : "None logged yet"}</small></div>
          <div class="wstat"><b>${recText(rec)}</b><span>Record</span><small>${gs.length ? `${pctOf(rec.w, gs.length)}% won` : "Wins – losses"}</small></div>
        </section>
        ${units.length ? `
        <section class="panel" aria-labelledby="fc-h"><h2 class="ph" id="fc-h">Force composition</h2>
          <ul class="comp">${roles.map(([r, us]) => `<li><b>${us.length}</b><span>${esc(r)}</span><small>${plural(us.reduce((a, u) => a + readiness(u).owned, 0), "model")}</small></li>`).join("")}</ul>
        </section>
        <section class="war-sec" aria-labelledby="cf-h">
          <div class="sec-h"><h2 id="cf-h">Current force</h2>
            <div class="seg" role="group" aria-label="Show"><button type="button" data-filter="all" aria-pressed="${filter === "all"}">All units</button><button type="button" data-filter="notready" aria-pressed="${filter === "notready"}">Not battle ready</button><button type="button" data-filter="fav" aria-pressed="${filter === "fav"}">${STAR(true)} Starred</button></div></div>
          ${shown.length ? `<div class="wt-scroll"><table class="wtable cards" role="table">
            <thead><tr><th scope="col">Unit</th><th scope="col">Role</th><th scope="col" class="n">Owned</th><th scope="col" class="n">Built</th><th scope="col" class="n">Painted</th><th scope="col" class="n">Ready</th><th scope="col" class="n">Points</th></tr></thead>
            <tbody>${shown.map(u => { const r = readiness(u); return `<tr><th scope="row"><span class="wt-unit">${warStar(u)}<span><button type="button" class="linkish" data-unit="${esc(u.id)}">${esc(u.name)}</button>${u.own === "planned" ? PLANNED_TAG : ""}${u.datasheet && u.datasheet !== u.name ? `<small>${esc(u.datasheet)}</small>` : ""}</span></span></th>
              <td class="wt-sub">${esc(u.role || "—")}</td>${statCells(r)}</tr>`; }).join("")}</tbody>
            ${filter === "all" ? `<tfoot><tr><th scope="row">Total</th><td class="wt-sub"></td><td class="n" data-label="Models">${t.models}</td><td class="n" data-label="Built">${t.built}</td><td class="n" data-label="Painted">${t.painted}</td><td class="n" data-label="Ready">${t.ready}</td><td class="n" data-label="Points">${num(t.points)}</td></tr></tfoot>` : ""}
          </table></div>` : `<p class="hint">${filter === "fav" ? "No starred units yet. Tap the star beside a unit to keep it handy." : "Every unit is battle ready."}</p>`}
        </section>` : `<section class="panel war-empty"><h2>No units yet</h2><p class="sub">Add the units you own one at a time, or paste an army list to add them all at once.</p><div class="war-actions"><button type="button" class="primary" data-add-unit>+ Add unit</button><button type="button" data-from-list>Add from a list</button></div></section>`}
        <section class="war-sec" aria-labelledby="al-h"><div class="sec-h"><h2 id="al-h">Army lists</h2>${D.warMissing ? "" : `<button type="button" class="btn-sm" data-new-list="${esc(id)}">+ New list</button>`}</div>
          ${ls.length ? `<div class="ledgers">${ls.map(l => listCard(l, D)).join("")}</div>` : `<p class="hint">Build lists from this collection for the games you play, and see whether each one is ready for the table.</p>`}</section>
        <section class="war-sec" aria-labelledby="ab-h"><div class="sec-h"><h2 id="ab-h">Battles</h2>${D.warMissing ? "" : `<button type="button" class="btn-sm" data-log="${esc(id)}">Log a battle</button>`}</div>
          ${gs.length ? gameRows(gs.slice(0, 8), D) : `<p class="hint">No battles with this army yet.</p>`}</section>
        <section class="war-sec danger-zone" aria-labelledby="dz-h"><h2 id="dz-h" class="sr-only">Manage army</h2>
          <p class="hint dz-note">Deleting removes this army from War Ledger and Livery Ledger: its ${plural(units.length, "unit")} and their photos, colours and recipes${ls.length ? `, ${plural(ls.length, "army list")}` : ""}${gs.length ? `, ${plural(gs.length, "battle report")}` : ""}. It can't be undone.</p>
          <div class="row-actions"><button type="button" class="btn-sm" data-rename>Rename army</button><button type="button" class="btn-sm danger" id="w-delarmy">Delete army</button><span class="msg" id="w-amsg" role="status"></span></div></section>`;
      tableRoles(app);
      armButton($("w-delarmy"), "Tap again to delete it everywhere", async () => {
        try { await store.removeArmy(army); flash(`Deleted ${army.name}`); location.hash = "#/war/armies"; }
        catch(err){ $("w-amsg").textContent = "Couldn't delete: " + errText(err); }
      });
    }
    draw();
    onApp(async e => {
      const b = e.target.closest("button"); if(!b) return;
      if(b.matches("[data-add-unit]")) openUnit(army, null, reload, {armies: D.armies, pools: D.pools});
      else if(b.matches("[data-from-list]")) openAddFromList(army, reload);
      else if(b.matches("[data-unit]")) { const u = D.units.find(x => x.id === b.dataset.unit); if(u) openUnit(army, u, reload, {armies: D.armies, pools: D.pools}); }
      else if(b.matches("[data-filter]")) { filter = b.dataset.filter; draw(); }
      else if(b.dataset.wstar) toggleWarStar(D, b.dataset.wstar, draw);
      else if(b.matches("[data-new-list]")) openNewList(D, id);
      else if(b.matches("[data-rename]")) {
        const d = modal("Rename army", `<label>Army name<input id="w-rn" maxlength="80" value="${esc(army.name)}"></label><div class="row-actions"><button type="submit" class="primary">Save</button><span class="msg" id="w-msg" role="status"></span></div>`);
        d.querySelector("form").addEventListener("submit", async ev => {
          ev.preventDefault(); const name = $("w-rn").value.trim(); if(!name) return;
          try { army = await store.saveArmy({faction: army.faction, name, scheme: army.scheme, public: army.public}, army.id); d.close(); document.title = `${army.name} · War Ledger`; reload(); }
          catch(err){ $("w-msg").textContent = "Couldn't rename: " + errText(err); }
        });
      }
      else warClicks(e, D, reload);
    });
  }

  /* ---------- the whole collection ---------- */
  // Adding a unit from the collection: pick its faction, and an army only if you want one.
  function openCollectionAdd(D, armyF, done){
    const pre = D.armies.find(a => a.id === armyF) || D.pools.find(a => a.id === armyF);
    const fav = pre ? pre.faction : (D.armies[0] || D.pools[0] || {}).faction || "";
    const d = modal("Add a unit to your collection", `
      <p class="sub">Units don't need an army. Keep them in your collection and move them into an army whenever you like.</p>
      <label>Faction${factionSelect("w-cf", fav, "Choose a faction…")}</label>
      <label>Army<select id="w-ca"></select></label>
      <div class="row-actions"><button type="submit" class="primary">Next</button><span class="msg" id="w-msg" role="status"></span></div>`);
    const fillArmies = () => {
      const fid = $("w-cf").value, same = D.armies.filter(a => a.faction === fid), other = D.armies.filter(a => a.faction !== fid);
      $("w-ca").innerHTML = `<option value="">Not in an army</option>${same.map(a => `<option value="${esc(a.id)}"${pre && pre.id === a.id ? " selected" : ""}>${esc(a.name)}</option>`).join("")}${other.length ? `<optgroup label="Other armies">${other.map(a => `<option value="${esc(a.id)}">${esc(a.name)} (${esc(factionName(a.faction))})</option>`).join("")}</optgroup>` : ""}`;
    };
    $("w-cf").addEventListener("change", fillArmies); fillArmies();
    d.querySelector("form").addEventListener("submit", e => {
      e.preventDefault();
      const fid = $("w-cf").value; if(!FBY[fid]){ $("w-msg").textContent = "Choose a faction."; $("w-cf").focus(); return; }
      const aid = $("w-ca").value;
      // The unit's faction decides its datasheets; with no army it goes to that faction's holder (made on save if needed).
      const army = D.armies.find(a => a.id === aid) || D.pools.find(a => a.faction === fid) || {id: null, faction: fid, scheme: {...P.presetFor(fid), pool: true}};
      d.close(); openUnit(army, null, done, {armies: D.armies, pools: D.pools});
    });
    $("w-cf").focus();
  }
  async function viewWarCollection(){
    view.name = "war-collection"; document.title = "Collection · War Ledger";
    let D = await warData(true), q = "", armyF = "", notReady = false, favOnly = false;
    const armyOf = id => D.armies.find(a => a.id === id) || D.pools.find(a => a.id === id);
    async function reload(){ D = await warData(true); draw(); }
    app.innerHTML = `
      <section class="page-head war-head">
        <div><p class="eyebrow">War Ledger</p><h1>My collection</h1><p class="sub">Everything you own, in an army or not.</p></div>
        <div class="war-actions"><button type="button" class="primary" data-coll-add>+ Add unit</button></div>
      </section>
      ${warTabs("collection")}
      <div class="war-filters">
        <input type="search" id="wc-q" placeholder="Search units" aria-label="Search units">
        <select id="wc-army" aria-label="Army"><option value="">All units</option>${D.armies.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}<option value="__pool">Not in an army</option></select>
        <label class="chk"><input type="checkbox" id="wc-nr"><span>Not battle ready only</span></label>
        <label class="chk"><input type="checkbox" id="wc-fav"><span>Starred only</span></label>
      </div>
      <div id="wc-out"></div>`;
    function draw(){
      const list = D.units.filter(u => armyOf(u.armyId) && (!armyF || (armyF === "__pool" ? isPool(armyOf(u.armyId)) : u.armyId === armyF)) && (!q || [u.name, u.datasheet, u.role].join(" ").toLowerCase().includes(q))
        && (!notReady || readiness(u).ready < readiness(u).owned) && (!favOnly || u.fav)).sort((a, b) => a.name.localeCompare(b.name));
      const t = sumUp(list), kits = D.kits.filter(k => !armyF || (armyOf(armyF) && k.faction === armyOf(armyF).faction));
      const armyCell = a => isPool(a) ? `<span class="wc-loose">Not in an army</span><small>${esc(factionName(a.faction))}</small>` : `<a href="#/war/army/${esc(a.id)}">${esc(a.name)}</a>`;
      $("wc-out").innerHTML = `
        <p class="wc-sum">${plural(list.length - t.planned, "unit")} · ${plural(t.models, "model")} · ${ptsText(t.points)} · ${pctOf(t.ready, t.models)}% battle ready${t.planned ? ` · ${t.planned} planned` : ""}</p>
        ${list.length ? `<div class="wt-scroll"><table class="wtable cards" role="table">
          <thead><tr><th scope="col">Unit</th><th scope="col">Army</th><th scope="col" class="n">Owned</th><th scope="col" class="n">Built</th><th scope="col" class="n">Painted</th><th scope="col" class="n">Ready</th><th scope="col" class="n">Points</th></tr></thead>
          <tbody>${list.map(u => { const r = readiness(u), a = armyOf(u.armyId); return `<tr><th scope="row"><span class="wt-unit">${warStar(u)}<span><button type="button" class="linkish" data-unit="${esc(u.id)}">${esc(u.name)}</button>${u.own === "planned" ? PLANNED_TAG : ""}<small>${esc(u.role || "")}</small></span></span></th>
            <td class="wt-sub">${armyCell(a)}</td>${statCells(r)}</tr>`; }).join("")}</tbody>
        </table></div>` : `<p class="hint">${D.units.length ? "No units match." : "No units yet. Add one here, or add them to one of your armies."}</p>`}
        ${kits.length ? `<p class="hint wc-kits"><a href="#/shame">Pile of shame</a>: ${plural(kits.length, "kit")} and ${plural(kits.reduce((a, k) => a + k.models, 0), "model")} still on the sprue.</p>` : ""}`;
      tableRoles($("wc-out"));
    }
    $("wc-q").addEventListener("input", e => { q = e.target.value.trim().toLowerCase(); draw(); });
    $("wc-army").addEventListener("change", e => { armyF = e.target.value; draw(); });
    $("wc-nr").addEventListener("change", e => { notReady = e.target.checked; draw(); });
    $("wc-fav").addEventListener("change", e => { favOnly = e.target.checked; draw(); });
    draw();
    onApp(e => {
      const st = e.target.closest("[data-wstar]"); if(st){ toggleWarStar(D, st.dataset.wstar, draw); return; }
      if(e.target.closest("[data-coll-add]")){ openCollectionAdd(D, armyF, reload); return; }
      const b = e.target.closest("[data-unit]"); if(!b) return;
      const u = D.units.find(x => x.id === b.dataset.unit), a = u && armyOf(u.armyId);
      if(u && a) openUnit(a, u, reload, {armies: D.armies, pools: D.pools});
    });
  }

  /* ---------- army lists ---------- */
  // Battle sizes and list statuses. Sizes only suggest a points limit; the limit can always be changed.
  // From the datasheet data when it has them: points limit, Detachment Points (dp, or dp3 with a 3 DP detachment) and enhancements allowed.
  const BATTLE_SIZES = (DATA.sizes || []).length ? DATA.sizes : [{id: "incursion", name: "Incursion", pts: 1000, dp: 2, dp3: 3, enh: 2}, {id: "strike", name: "Strike Force", pts: 2000, dp: 3, enh: 4}, {id: "onslaught", name: "Onslaught", pts: 3000, dp: 4, enh: 4}];
  // Size rules for a list: its battle size, or Strike Force's when it has none.
  const sizeRules = l => BATTLE_SIZES.find(z => z.id === sizeOf(l)) || BATTLE_SIZES.find(z => z.id === "strike") || BATTLE_SIZES[0];
  const factionDets = fid => (FBY[fid] || {}).dets || [];
  const detByName = (fid, n) => factionDets(fid).find(d => d.n.toLowerCase() === String(n || "").trim().toLowerCase());
  // Enhancements from the list's detachments, or every one the faction has when none are chosen: [name, pts, only, detachment].
  function enhOptions(fid, dets){
    const chosen = (dets || []).map(n => detByName(fid, n)).filter(Boolean);
    return (chosen.length ? chosen : factionDets(fid)).flatMap(d => (d.e || []).map(e => [e[0], e[1], e[2] || null, d.n]));
  }
  const LIST_STATUS = [["draft", "Draft"], ["theory", "Theorycraft"], ["tournament", "Tournament"], ["narrative", "Narrative"], ["archived", "Archived"]];
  const statusName = id => (LIST_STATUS.find(x => x[0] === id) || LIST_STATUS[0])[1];
  const sizeOf = l => l.size || (BATTLE_SIZES.find(z => z.pts === l.limit) || {}).id || (l.limit ? "custom" : "");
  const sizeName = l => { const id = sizeOf(l), z = BATTLE_SIZES.find(x => x.id === id); return z ? z.name : ""; };
  const statusTag = l => `<span class="tag st-${esc(l.status || "draft")}">${esc(statusName(l.status))}</span>`;
  const detText = l => (l.detachments || []).join(" + ");
  const entryKey = () => "k" + Math.random().toString(36).slice(2, 10);
  const isCharRole = role => role === "Character" || role === "Epic Hero";
  const niceDay = d => { const t = d && new Date(d + "T12:00:00"); return t && !isNaN(t) ? t.toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"}) : ""; };
  const DOTS = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>`;
  // Enhancement and leader pairings for a row in the list, as a short line.
  function entryNotes(x, rows){
    const name = k => (rows.find(r => r.k === k && !r.gone) || {}).name, led = rows.filter(r => r.lead === x.k && !r.gone).map(r => r.name);
    return [x.enh ? `Enhancement: ${esc(x.enh.n)}${x.enh.p ? ` (+${x.enh.p})` : ""}` : "", x.lead && name(x.lead) ? `Leading ${esc(name(x.lead))}` : "",
      led.length ? `Led by ${esc(led.join(" and "))}` : "", x.u && x.e.pts != null ? `Points set for this list (unit: ${num(+x.u.points || 0)})` : ""].filter(Boolean).join(" · ");
  }
  // Pull "Warlord" and "Enhancement: X (+20 pts)" out of a pasted unit's notes.
  function entryExtras(notes){
    const out = {};
    (notes || []).forEach(n => {
      if(/^warlord$/i.test(n)) out.warlord = true;
      const m = String(n).match(/^enhancements?:\s*(.+)$/i); if(!m) return;
      const pm = m[1].match(/^(.*?)\s*[\(\[]\s*\+?\s*(\d+)\s*(?:pts?|points)?\s*[\)\]]\s*$/i);
      out.enh = pm ? {n: pm[1].trim(), p: +pm[2]} : {n: m[1].trim(), p: 0};
    });
    return out;
  }
  // "Things to check": friendly notes about a list. They're suggestions only and never stop you using it,
  // because house rules, missions and new rules all change what's allowed.
  const listChecksOn = () => settings.listChecks !== false;
  const DAY_MS = 864e5;
  function listChecks(l, s, faction){
    const out = [], add = (id, text, more) => out.push({id, text, more});
    const rows = s.rows.filter(x => !x.gone), sheets = sheetsOf(faction);
    const sheetName = x => x.u ? x.u.datasheet || x.name : x.sheet || x.name;
    const sheetOf = x => sheets.find(z => z.n === sheetName(x));
    const epic = x => x.role === "Epic Hero" || !!(sheetOf(x) || {}).eh;
    if(!rows.length) return out;
    if(l.limit && s.points > l.limit) add("over", `${num(s.points - l.limit)} pts over the limit.`, `The list comes to ${ptsText(s.points)} against a limit of ${ptsText(l.limit)}.`);
    if(!rows.some(x => x.warlord)) add("warlord", "No warlord chosen.", rows.some(x => isCharRole(x.role)) ? "Choose one with the ⋯ button on a character." : "There are no characters in this list to lead it.");
    if(!(l.detachments || []).length) add("detachment", "No detachment chosen.", "Add one in Edit details.");
    const z = sizeRules(l), sizeIdx = Math.max(0, BATTLE_SIZES.indexOf(z)), known = (l.detachments || []).map(n => detByName(faction, n)).filter(Boolean);
    if(known.length){
      const used = known.reduce((a, d) => a + d.dp, 0), cap = z.dp3 && known.some(d => d.dp === 3) ? z.dp3 : z.dp;
      if(cap && used > cap) add(`dp:${used}:${z.id}`, `Detachments cost ${used} Detachment Points.`, `${z.name} usually allows ${cap}.`);
    }
    const bySheet = {};
    rows.forEach(x => { const n = sheetName(x); (bySheet[n] = bySheet[n] || []).push(x); });
    Object.entries(bySheet).forEach(([n, xs]) => {
      if(xs.length < 2) return;
      if(xs.some(epic)) add("epic:" + n, `${n} is in the list ${xs.length} times.`, "Epic Heroes are usually limited to one each.");
      else {
        const sh = sheetOf(xs[0]), big = ["Battleline", "Dedicated Transport"].includes(xs[0].role);
        const cap = sh && sh.mx ? sh.mx[sizeIdx] : (sizeOf(l) === "incursion" ? (big ? 4 : 2) : (big ? 6 : 3));
        if(xs.length > cap) add(`copies:${n}:${cap}`, `${xs.length} units of ${n}.`, sh && sh.mx ? `This datasheet is usually limited to ${cap} at ${z.name}.` : `Most games allow up to ${cap} of each datasheet at ${z.name}${big ? "" : ` (${sizeOf(l) === "incursion" ? 4 : 6} for Battleline and Dedicated Transports)`}.`);
      }
    });
    const enh = rows.filter(x => x.enh);
    if(z.enh && enh.length > z.enh) add(`enh-count:${z.id}`, `${enh.length} enhancements.`, `${z.name} usually allows up to ${z.enh}.`);
    const byEnh = {};
    enh.forEach(x => { const n = x.enh.n.toLowerCase(); (byEnh[n] = byEnh[n] || []).push(x); });
    Object.values(byEnh).forEach(xs => { if(xs.length > 1) add("enh-dup:" + xs[0].enh.n.toLowerCase(), `${xs[0].enh.n} is on ${xs.length} units.`, "Each enhancement can usually only be taken once."); });
    enh.filter(epic).forEach(x => add("enh-epic:" + x.k, `${x.name} has an enhancement.`, "Epic Heroes usually can't take enhancements."));
    enh.filter(x => !isCharRole(x.role)).forEach(x => add("enh-role:" + x.k, `${x.name} has an enhancement but isn't a character.`, "Enhancements usually go on characters."));
    // Against the datasheet data: is it one of this list's detachments' enhancements, for whom, and at what cost.
    const opts = enhOptions(faction, l.detachments), names = new Set(sheets.map(z => z.n));
    enh.forEach(x => {
      const o = opts.find(e => e[0].toLowerCase() === x.enh.n.toLowerCase());
      if(!o){ if(known.length && known.length === (l.detachments || []).length) add(`enh-det:${x.k}:${x.enh.n}`, `${x.enh.n} isn't one of your detachments' enhancements.`, `Enhancements usually come from the detachment${known.length > 1 ? "s" : ""} you've chosen.`); return; }
      if(o[2] && o[2].every(n => names.has(n)) && !o[2].includes(sheetName(x))) add(`enh-only:${x.k}:${o[0]}`, `${o[0]} is usually for ${o[2].join(" or ")} only.`, `${x.name} has it in this list.`);
      if(x.enh.p !== o[1]) add(`enh-pts:${x.k}:${o[1]}`, `${o[0]} is ${ptsText(x.enh.p)} here but ${ptsText(o[1])} in the latest points.`, "Update it with the ⋯ button if the points have changed.");
    });
    rows.forEach(x => {
      const leaders = rows.filter(r => r.lead === x.k);
      if(leaders.length > 1) add("lead:" + x.k, `${x.name} is led by ${leaders.map(r => r.name).join(" and ")}.`, "A unit usually has one leader, unless a datasheet says it can have more.");
    });
    // Unit sizes and points from the datasheet: a size outside its range, or points that don't match that size.
    rows.forEach(x => {
      const sh = sheetOf(x); if(!sh) return;
      if(sh.ms && (x.count < sh.ms[0] || x.count > sh.ms[1])){
        add(`size:${x.k}:${x.count}`, `${x.name} has ${plural(x.count, "model")}.`, `The datasheet's unit size is ${sh.ms[0] === sh.ms[1] ? sh.ms[0] : `${sh.ms[0]} to ${sh.ms[1]}`} models.`);
        return;
      }
      if(!sh.ms && !sh.pb && x.count !== 1) return;
      const want = sheetPts(sh, x.count);
      if(want == null || (x.u && x.e.pts != null) || x.base === want) return;
      add("pts:" + x.k + ":" + want, `${x.name} is ${ptsText(x.base)} here but ${ptsText(want)} in the latest datasheet points${x.count > 1 ? ` for ${x.count} models` : ""}.`, x.u ? "If the points have changed, update the unit." : "If the points have changed, update them with the ⋯ button.");
    });
    if(l.ptsAsOf){
      const days = Math.floor((Date.now() - new Date(l.ptsAsOf + "T12:00:00")) / DAY_MS);
      if(days > 90) add("date:" + l.ptsAsOf, `Points last checked ${niceDay(l.ptsAsOf)}.`, "Points change a few times a year, so check they're still current.");
    } else if(l.status === "tournament") add("date", "No points date set.", "Note when you checked the points in Edit details, so you know they're current.");
    return out;
  }
  // What a list holds, set against the collection: what's owned, what's ready, what's missing.
  // A row's points are the unit's (or the list's override for it) plus any enhancement.
  function listState(l, D){
    const armyUnits = factionUnits(D, l.armyId);
    const rows = l.units.map((e, i) => {
      const extra = {k: e.k, e, warlord: !!e.warlord, enh: e.enh || null, lead: e.lead || ""}, ep = e.enh ? e.enh.p : 0;
      if(e.u){
        const u = armyUnits.find(x => x.id === e.u);
        if(!u) return {i, ...extra, gone: true, name: "A unit you've since deleted", role: "Other", count: 0, points: 0, base: 0};
        const base = e.pts != null ? e.pts : +u.points || 0;
        return {i, ...extra, u, name: u.name, role: u.role, count: readiness(u).owned, base, points: base + ep, r: readiness(u)};
      }
      return {i, ...extra, missing: true, name: e.n, sheet: e.sheet, role: e.role || "Other", count: e.count, base: e.points, points: e.points + ep};
    });
    const live = rows.filter(x => !x.gone), owned = rows.filter(x => x.u && x.u.own !== "planned");
    const models = live.reduce((a, x) => a + x.count, 0), have = owned.reduce((a, x) => a + x.count, 0), ready = owned.reduce((a, x) => a + x.r.ready, 0);
    return {rows, models, have, ready, points: live.reduce((a, x) => a + x.points, 0), avail: pctOf(have, models), readyPct: pctOf(ready, models),
      notReady: owned.filter(x => x.r.ready < x.r.owned), missing: rows.filter(x => x.missing), gone: rows.filter(x => x.gone),
      planned: rows.filter(x => x.u && x.u.own === "planned")};
  }
  function listCard(l, D){
    const s = listState(l, D), a = D.armies.find(x => x.id === l.armyId), gs = D.games.filter(g => g.listId === l.id), r = recordOf(gs);
    const hidden = new Set(l.ignored || []), checks = listChecksOn() && a ? listChecks(l, s, a.faction).filter(c => !hidden.has(c.id)).length : 0;
    const note = !s.rows.length ? "No units yet" : checks ? `<span class="tc-chip">${plural(checks, "thing")} to check</span>` : s.avail < 100 ? `${s.avail}% in your collection` : "All in your collection";
    return `<a class="lcard war-card${l.status === "archived" ? " archived" : ""}" href="#/war/list/${esc(l.id)}">
      <div class="card-top">${a ? armyBadge(a, 44) : ""}<div><h3>${esc(l.name)}</h3><div class="meta">${esc([a ? a.name : "Deleted army", sizeName(l), detText(l)].filter(Boolean).join(" · "))}</div></div>${statusTag(l)}</div>
      <div class="wc-nums"><span><b>${num(s.points)}</b>${l.limit ? ` / ${num(l.limit)}` : ""} pts</span><span><b>${s.rows.length}</b> ${s.rows.length === 1 ? "unit" : "units"}</span>${gs.length ? `<span><b>${recText(r)}</b> record</span>` : ""}</div>
      <div class="prog" aria-hidden="true"><i style="width:${s.readyPct}%"></i></div>
      <div class="foot"><span>${s.readyPct}% battle ready</span><span>${note}</span></div>
    </a>`;
  }
  async function viewWarLists(){
    view.name = "war-lists"; document.title = "Army lists · War Ledger";
    let D = null;
    const render = async () => { D = await warData(false); drawWarLists(D); };
    await render();
    onApp(e => {
      const b = e.target.closest("[data-new-list]");
      if(b) openNewList(D, b.dataset.newList || ""); else warClicks(e, D, render);
    });
  }
  function drawWarLists(D){
    const groups = D.armies.map(a => [a, D.lists.filter(l => l.armyId === a.id).sort((x, y) => (x.status === "archived") - (y.status === "archived"))]).filter(x => x[1].length);
    app.innerHTML = `
      <section class="page-head war-head">
        <div><p class="eyebrow">War Ledger</p><h1>Army lists</h1><p class="sub">Your collection is everything you own. A list is what you take to a particular game.</p></div>
        <div class="war-actions">${D.armies.length && !D.warMissing ? `<button type="button" class="primary" data-new-list="">+ New list</button>` : ""}</div>
      </section>
      ${warTabs("lists")}
      ${missingBanner(D)}
      ${!D.armies.length ? warEmpty() : groups.length ? groups.map(([a, ls]) => `<section class="war-sec"><div class="sec-h"><h2>${esc(a.name)}</h2><a href="#/war/army/${esc(a.id)}">View army</a></div><div class="ledgers">${ls.map(l => listCard(l, D)).join("")}</div></section>`).join("")
        : D.warMissing ? "" : `<section class="panel war-empty"><h2>No army lists yet</h2><p class="sub">Build a list from one of your armies, or paste one you've made elsewhere, and War Ledger checks whether it's ready for the table.</p><button type="button" class="primary" data-new-list="">+ New list</button></section>`}`;
  }
  // Battle size, points limit, detachments, status and points date: shared by the New list and List details dialogs.
  function listFields(l, D, faction){
    const size = sizeOf(l), dets = l.detachments && l.detachments.length ? l.detachments : [""];
    const data = factionDets(faction), used = D.lists.filter(x => { const a = D.armies.find(y => y.id === x.armyId); return a && a.faction === faction; }).flatMap(x => x.detachments || []);
    const known = [...data.map(d => [d.n, `${d.dp} DP${d.c ? " · " + d.c : ""}`]), ...[...new Set(used)].filter(n => !detByName(faction, n)).sort().map(n => [n, "Used in your lists"])];
    const built = (window.LEDGER_FACTIONS || {}).built;
    return `
      <div class="wgrid">
        <label class="span2">Battle size<select id="w-lsz">${BATTLE_SIZES.map(z => `<option value="${z.id}"${size === z.id ? " selected" : ""}>${esc(z.name)} (${num(z.pts)} points)</option>`).join("")}<option value="custom"${size === "custom" ? " selected" : ""}>Custom points</option><option value=""${!size ? " selected" : ""}>No points limit</option></select></label>
        <label>Points limit<input id="w-ll" type="number" min="0" max="20000" step="250" inputmode="numeric" value="${l.limit || ""}" placeholder="No limit"></label>
      </div>
      <fieldset class="wfs"><legend>Detachments</legend>
        <div id="w-dets">${dets.map((v, i) => detRow(v, i)).join("")}</div>
        <datalist id="w-det-dl">${known.map(([v, l]) => `<option value="${esc(v)}" label="${esc(l)}">`).join("")}</datalist>
        <button type="button" class="btn-sm" id="w-det-add"${dets.length >= 4 ? " hidden" : ""}>+ Add another detachment</button>
        <p class="hint" id="w-dp" aria-live="polite"></p>
      </fieldset>
      <div class="wgrid">
        <label class="span2">Status<select id="w-lst">${LIST_STATUS.map(([id, n]) => `<option value="${id}"${(l.status || "draft") === id ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Points as of<input id="w-lpd" type="date" value="${esc(l.ptsAsOf || "")}" max="${isoDay(new Date())}"></label>
      </div>
      <p class="hint">Points change when Games Workshop updates them, so note when you last checked this list's.${built ? ` Datasheet points in War Ledger were last updated ${esc(niceDay(built))}.` : ""}</p>`;
  }
  const detRow = (v, i) => `<div class="det-row"><input class="w-det" list="w-det-dl" maxlength="80" value="${esc(v)}" aria-label="Detachment ${i + 1}" placeholder="e.g. Gladius Task Force"><button type="button" class="btn-sm icon-x" data-det-rm aria-label="Remove this detachment">×</button></div>`;
  // Detachment Points against what the battle size allows. Only detachments in the datasheet data count.
  function dpText(faction, detNames, l){
    const ds = detNames.map(n => detByName(faction, n)).filter(Boolean);
    if(!ds.length) return factionDets(faction).length ? "Pick from the list to see each detachment's Detachment Points." : "";
    const used = ds.reduce((a, x) => a + x.dp, 0), z = sizeRules(l), cap = z.dp3 && ds.some(x => x.dp === 3) ? z.dp3 : z.dp;
    return `Detachment Points: ${used} used${cap ? ` of ${cap} for ${z.name}` : ""}.${detNames.length > ds.length ? ` ${plural(detNames.length - ds.length, "detachment")} not in the datasheet data, so not counted.` : ""}`;
  }
  function wireListFields(d, faction){
    const sz = d.querySelector("#w-lsz"), lim = d.querySelector("#w-ll"), box = d.querySelector("#w-dets"), add = d.querySelector("#w-det-add");
    const dp = () => { const f = readListFields(d), el = d.querySelector("#w-dp"), t = dpText(typeof faction === "function" ? faction() : faction, f.detachments, f); el.textContent = t; el.hidden = !t; };
    box.addEventListener("input", dp); sz.addEventListener("change", dp); lim.addEventListener("input", dp); box.addEventListener("click", () => setTimeout(dp)); dp();
    sz.addEventListener("change", () => { const z = BATTLE_SIZES.find(x => x.id === sz.value); if(z) lim.value = z.pts; else if(!sz.value) lim.value = ""; });
    lim.addEventListener("input", () => { const v = parseInt(lim.value, 10) || 0, z = BATTLE_SIZES.find(x => x.pts === v); sz.value = z ? z.id : v ? "custom" : ""; });
    const renum = () => { box.querySelectorAll(".w-det").forEach((x, i) => x.setAttribute("aria-label", `Detachment ${i + 1}`)); add.hidden = box.children.length >= 4; };
    add.addEventListener("click", () => { box.insertAdjacentHTML("beforeend", detRow("", box.children.length)); renum(); box.lastElementChild.querySelector("input").focus(); });
    box.addEventListener("click", e => {
      if(!e.target.closest("[data-det-rm]")) return;
      const row = e.target.closest(".det-row");
      if(box.children.length > 1) row.remove(); else row.querySelector("input").value = "";
      renum(); box.querySelector("input").focus();
    });
  }
  const readListFields = d => ({size: d.querySelector("#w-lsz").value, limit: Math.max(0, parseInt(d.querySelector("#w-ll").value, 10) || 0),
    detachments: [...d.querySelectorAll(".w-det")].map(x => x.value.trim()).filter(Boolean), status: d.querySelector("#w-lst").value, ptsAsOf: d.querySelector("#w-lpd").value});
  function openNewList(D, armyId){
    if(!D.armies.length){ flash("Create an army first."); return; }
    if(D.warMissing){ flash("Run supabase/features.sql in Supabase to turn on army lists."); return; }
    const first = D.armies.find(a => a.id === armyId) || D.armies[0];
    const d = modal("New army list", `
      <label>Army<select id="w-la">${D.armies.map(a => `<option value="${esc(a.id)}"${a.id === first.id ? " selected" : ""}>${esc(a.name)} (${esc(factionName(a.faction))})</option>`).join("")}</select></label>
      <label>List name<input id="w-ln" maxlength="80" placeholder="e.g. Club night 2,000"></label>
      <div id="w-lf">${listFields({size: "strike", limit: 2000, status: "draft", ptsAsOf: isoDay(new Date())}, D, first.faction)}</div>
      <div class="row-actions"><button type="submit" class="primary">Create list</button><span class="msg" id="w-msg" role="status"></span></div>`, "wide");
    const fac = () => (D.armies.find(x => x.id === $("w-la").value) || first).faction;
    wireListFields(d, fac);
    // Detachment suggestions follow the army's faction.
    $("w-la").addEventListener("change", () => {
      const keep = readListFields(d);
      $("w-lf").innerHTML = listFields({...keep, detachments: keep.detachments}, D, fac()); wireListFields(d, fac);
    });
    d.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault();
      const f = readListFields(d), name = $("w-ln").value.trim() || (f.limit ? `${num(f.limit)} points` : "Army list");
      try { const l = await store.saveList({armyId: $("w-la").value, name, ...f, units: []}); d.close(); location.hash = `#/war/list/${l.id}`; }
      catch(err){ console.error(err); $("w-msg").textContent = "Couldn't create the list: " + errText(err); }
    });
    $("w-ln").focus();
  }

  async function viewWarList(id){
    let D = await warData(false), list = D.lists.find(l => l.id === id);
    const army0 = list && D.armies.find(a => a.id === list.armyId);
    if(!list || !army0){
      app.innerHTML = `${warTabs("lists")}<div class="banner"><span class="dot warn"></span><span>${D.warMissing ? "Army lists need a quick database update first. Run supabase/features.sql in Supabase." : list ? "The army for this list was deleted." : "That list couldn't be found. It may have been deleted."}</span></div><p><a class="btn" href="#/war/lists">Your army lists</a></p>`;
      return;
    }
    let army = army0, q = "", chain = Promise.resolve();
    view.name = "war-list"; document.title = `${list.name} · War Ledger`;
    // Saves run one after another, so the last change always wins.
    function save(patch){
      list = {...list, ...patch}; draw();
      chain = chain.then(() => store.saveList(list, list.id)).then(saved => { list = {...list, updatedAt: saved.updatedAt}; D.lists = D.lists.map(l => l.id === list.id ? list : l); })
        .catch(err => { console.error(err); flash("Couldn't save the list: " + errText(err)); });
      return chain;
    }
    async function reload(){ D = await warData(false); list = D.lists.find(l => l.id === id) || list; army = D.armies.find(a => a.id === list.armyId) || army; draw(); }
    const why = r => r.built < r.owned ? "not all built" : readyRule() === "based" && r.painted >= r.owned ? "needs basing" : readyRule() === "built" ? "not ready" : `${r.owned - r.painted} to paint`;
    const byRole = rows => ROLE_ORDER.map(role => [role, rows.filter(x => (ROLE_ORDER.includes(x.role) ? x.role : "Other") === role)]).filter(x => x[1].length);
    function checksPanel(s){
      if(!listChecksOn()) return "";
      const hidden = new Set(list.ignored || []), all = listChecks(list, s, army.faction), shown = all.filter(c => !hidden.has(c.id)), nHid = all.length - shown.length;
      if(!all.length) return "";
      return `<section class="panel tc" aria-labelledby="tc-h"><h2 class="ph" id="tc-h">Things to check${shown.length ? ` <span class="tc-n">${shown.length}</span>` : ""}</h2>
        ${shown.length ? `<p class="hint">Suggestions only. Nothing here stops you using this list.</p>
        <ul class="tc-list">${shown.map(c => `<li><span><strong>${esc(c.text)}</strong>${c.more ? ` <small>${esc(c.more)}</small>` : ""}</span><button type="button" class="btn-sm" data-hide-check="${esc(c.id)}" aria-label="Hide: ${esc(c.text)}">Hide</button></li>`).join("")}</ul>`
          : `<p class="hint">Nothing new to check.</p>`}
        ${nHid ? `<p class="hint tc-hid">${plural(nHid, "check")} hidden. <button type="button" class="linkish" data-unhide-checks>Show ${nHid === 1 ? "it" : "them"} again</button></p>` : ""}
      </section>`;
    }
    function draw(){
      const s = listState(list, D), used = new Set(list.units.filter(e => e.u).map(e => e.u));
      const pool = factionUnits(D, army.id), coll = pool.filter(u => !used.has(u.id) && (!q || [u.name, u.datasheet, u.role].join(" ").toLowerCase().includes(q)))
        .sort((a, b) => (a.armyId === army.id ? 0 : 1) - (b.armyId === army.id ? 0 : 1) || a.name.localeCompare(b.name));
      const over = list.limit && s.points > list.limit, gs = D.games.filter(g => g.listId === list.id), rec = recordOf(gs);
      const verdict = !s.rows.length ? ["", "Add units to see whether this list is ready for the table."]
        : s.avail >= 100 && s.readyPct >= 100 && !s.gone.length ? ["ok", "Yes. Every model in this list is in your collection and battle ready."]
        : s.avail >= 100 ? ["part", `Nearly. You own everything, and ${s.readyPct}% of the models are battle ready.`]
        : ["no", `Not yet. ${s.avail}% of the models are in your collection and ${s.readyPct}% are battle ready.`];
      app.innerHTML = `
        <div class="crumbs"><a href="#/war">War Ledger</a> / <a href="#/war/lists">Army lists</a> / ${esc(list.name)}</div>
        <section class="page-head war-head">
          <div class="wh-id">${armyBadge(army, 56)}<div><p class="eyebrow"><a href="#/war/army/${esc(army.id)}">${esc(army.name)}</a> · ${esc(factionName(army.faction))}</p><h1>${esc(list.name)}</h1>
            <p class="sub">${esc([sizeName(list), detText(list), list.limit ? ptsText(list.limit) + " limit" : "No points limit", gs.length ? `${recText(rec)} record` : ""].filter(Boolean).join(" · "))}</p>
            <p class="lst-meta">${statusTag(list)}<span>${list.ptsAsOf ? `Points as of ${esc(niceDay(list.ptsAsOf))}` : "Points date not set"}</span></p></div></div>
          <div class="war-actions"><button type="button" class="primary" data-log="${esc(army.id)}" data-list="${esc(list.id)}">Log a battle</button><button type="button" data-import>Paste a list</button><button type="button" data-details>Edit details</button></div>
        </section>
        ${warTabs("lists")}
        <section class="war-stats" aria-label="List summary">
          <div class="wstat${over ? " over" : ""}"><b>${num(s.points)}${list.limit ? `<small> / ${num(list.limit)}</small>` : ""}</b><span>Points</span>${list.limit ? `<div class="wbar" aria-hidden="true"><i style="width:${Math.min(100, pctOf(s.points, list.limit))}%"></i></div><small>${over ? `${num(s.points - list.limit)} over the limit` : `${num(list.limit - s.points)} left`}</small>` : ""}</div>
          <div class="wstat"><b>${s.rows.length}</b><span>${s.rows.length === 1 ? "Unit" : "Units"}</span><small>${plural(s.models, "model")}</small></div>
          <div class="wstat"><b>${s.avail}%</b><span>Models available</span><small>${num(s.have)} of ${num(s.models)} in your collection</small></div>
          <div class="wstat ready"><b>${s.readyPct}%</b><span>Battle ready</span><div class="wbar" aria-hidden="true"><i style="width:${s.readyPct}%"></i></div><small>${num(s.ready)} of ${num(s.models)} models</small></div>
        </section>
        ${checksPanel(s)}
        <section class="panel lr" aria-labelledby="lr-h"><h2 class="ph" id="lr-h">Ready for the table?</h2>
          <p class="verdict ${verdict[0]}">${verdict[1]}</p>
          ${s.notReady.length ? `<h3 class="lr-sub">Not battle ready</h3><ul class="lr-list">${s.notReady.map(x => `<li><button type="button" class="linkish" data-unit="${esc(x.u.id)}">${esc(x.name)}</button> <small>${x.r.ready} of ${x.r.owned} ready · ${why(x.r)}</small></li>`).join("")}</ul>` : ""}
          ${s.planned.length ? `<h3 class="lr-sub">Planned, not bought yet</h3><ul class="lr-list">${s.planned.map(x => `<li><button type="button" class="linkish" data-unit="${esc(x.u.id)}">${esc(x.name)}</button> <small>${plural(x.count, "model")} · ${x.points} pts</small> <button type="button" class="btn-sm" data-bought="${esc(x.u.id)}">I bought it</button></li>`).join("")}</ul>` : ""}
          ${s.missing.length ? `<h3 class="lr-sub">Not in your collection</h3><ul class="lr-list">${s.missing.map(x => `<li>${esc(x.name)} <small>${plural(x.count, "model")} · ${x.points} pts</small> <button type="button" class="btn-sm" data-own="${x.i}">I own this</button><button type="button" class="btn-sm" data-own="${x.i}" data-planned="1">I plan to get this</button></li>`).join("")}</ul>` : ""}
          ${s.gone.length ? `<p class="hint">${plural(s.gone.length, "unit")} in this list ${s.gone.length === 1 ? "was" : "were"} deleted from the army. <button type="button" class="btn-sm" data-prune>Remove from list</button></p>` : ""}
        </section>
        <div class="lb">
          <section class="panel lb-in" aria-labelledby="lb-in-h"><h2 class="ph" id="lb-in-h">In this list</h2>
            ${s.rows.length ? byRole(s.rows.filter(x => !x.gone)).map(([role, rows]) => `<h3 class="lb-role">${esc(role)} <small>${ptsText(rows.reduce((a, x) => a + x.points, 0))}</small></h3>
              <ul class="lb-rows">${rows.map(x => { const extra = entryNotes(x, s.rows); return `<li class="${x.missing ? "missing" : x.r.planned ? "missing planned" : x.r.ready >= x.r.owned ? "ready" : "notready"}">
                <span class="lb-name"><span class="lb-title">${x.u ? `<button type="button" class="linkish" data-unit="${esc(x.u.id)}">${x.u.fav ? `<span class="star on" aria-label="Starred">${STAR(true)}</span> ` : ""}${esc(x.name)}</button>` : esc(x.name)}${x.warlord ? `<span class="tag wl">Warlord</span>` : ""}</span><small>${x.missing ? "Not owned" : x.r.planned ? "Planned" : `${x.r.ready}/${x.r.owned} ready`}${x.count > 1 ? ` · ${x.count} models` : ""}</small>${extra ? `<small class="lb-extra">${extra}</small>` : ""}</span>
                <span class="lb-pts">${num(x.points)}</span>
                <button type="button" class="btn-sm icon-x" data-opts="${x.i}" aria-label="Options for ${esc(x.name)} in this list" title="Warlord, enhancement, leader and points">${DOTS}</button>
                <button type="button" class="btn-sm icon-x" data-rm="${x.i}" aria-label="Remove ${esc(x.name)} from the list">×</button></li>`; }).join("")}</ul>`).join("")
              : `<p class="hint">Add units from your collection, or paste a list you've built elsewhere.</p>`}
          </section>
          <section class="panel lb-coll" aria-labelledby="lb-c-h"><h2 class="ph" id="lb-c-h">Your collection</h2>
            <p class="hint lb-note">Every ${esc(factionName(army.faction))} unit you have: this army's first, then your other ${esc(factionName(army.faction))} armies and units not in an army.</p>
            <input type="search" id="lb-q" placeholder="Search your ${esc(factionName(army.faction))} units" aria-label="Search your collection" value="${esc(q)}">
            ${coll.length ? `<ul class="lb-rows">${coll.map(u => { const r = readiness(u), home = homeOf(D, u, army.id); return `<li><span class="lb-name">${esc(u.name)}${u.own === "planned" ? PLANNED_TAG : ""}<small>${esc(u.role || "")} · ${r.planned ? "not bought yet" : `${r.ready}/${r.owned} ready`}${home ? ` · ${esc(home)}` : ""}</small></span><span class="lb-pts">${num(u.points)}</span><button type="button" class="btn-sm" data-add="${esc(u.id)}" aria-label="Add ${esc(u.name)} to the list">Add</button></li>`; }).join("")}</ul>`
              : `<p class="hint">${pool.length ? (q ? "No units match." : "Every unit you have is already in the list.") : "No units of this faction yet."}</p>`}
            <button type="button" class="btn-sm" data-add-unit>+ Add a new unit to the army</button>
          </section>
        </div>
        <section class="war-sec danger-zone"><div class="row-actions"><button type="button" class="btn-sm" data-copy>Copy as text</button><button type="button" class="btn-sm" data-dup>Duplicate list</button><button type="button" class="btn-sm danger" id="w-dellist">Delete list</button></div></section>`;
      const inp = $("lb-q");
      inp.addEventListener("input", () => { q = inp.value.trim().toLowerCase(); const pos = inp.selectionStart; draw(); const n = $("lb-q"); n.focus(); n.setSelectionRange(pos, pos); });
      armButton($("w-dellist"), "Tap again to delete", async () => {
        try { await chain; await store.removeList(list.id); flash(`Deleted ${list.name}`); location.hash = "#/war/lists"; }
        catch(err){ flash("Couldn't delete: " + errText(err)); }
      });
    }
    // Warlord, enhancement, leader and points for one unit in this list. Nothing here is checked against the rules.
    function openEntryOptions(i){
      const s = listState(list, D), x = s.rows.find(r => r.i === i); if(!x || x.gone) return;
      const e = list.units[i], ch = isCharRole(x.role);
      // Suggestions: the enhancements of this list's detachments (or the whole faction's), then any you've typed in other lists.
      const known = {}, labels = {};
      D.lists.forEach(l => { const a = D.armies.find(y => y.id === l.armyId); if(a && a.faction === army.faction) l.units.forEach(u => { if(u.enh && u.enh.n) known[u.enh.n] = u.enh.p; }); });
      const opts = enhOptions(army.faction, list.detachments);
      opts.forEach(([n, p, only, det]) => { known[n] = p; labels[n] = [`${p} pts`, det, only ? only.join(" or ") + " only" : ""].filter(Boolean).join(" · "); });
      const bodies = s.rows.filter(r => !r.gone && r.i !== i && !isCharRole(r.role));
      const d = modal(`${esc(x.name)} in this list`, `
        <label>Points in this list<input id="w-ep" type="number" min="0" max="9999" inputmode="numeric" value="${x.u ? (e.pts ?? "") : e.points}" placeholder="${x.u ? num(+x.u.points || 0) : ""}"></label>
        <p class="hint">${x.u ? `Leave blank to use the unit's own points (${num(+x.u.points || 0)}). A change here only affects this list.` : "The points this unit costs in this list."}</p>
        ${ch ? `<label class="chk"><input type="checkbox" id="w-ewl"${x.warlord ? " checked" : ""}><span>Warlord of this list</span></label>
        <fieldset class="wfs"><legend>Enhancement</legend>
          <div class="wgrid"><label class="span2">Name<input id="w-een" maxlength="80" list="w-een-dl" value="${esc(x.enh ? x.enh.n : "")}" placeholder="None"></label>
          <label>Points<input id="w-eep" type="number" min="0" max="999" inputmode="numeric" value="${x.enh && x.enh.p ? x.enh.p : ""}"></label></div>
          <datalist id="w-een-dl">${[...opts.map(o => o[0]), ...Object.keys(known).filter(n => !labels[n]).sort()].filter((n, j, a) => a.indexOf(n) === j).map(n => `<option value="${esc(n)}"${labels[n] ? ` label="${esc(labels[n])}"` : ""}>`).join("")}</datalist>
        </fieldset>
        <label>Leading<select id="w-eld"><option value="">Not leading a unit</option>${bodies.map(r => { const other = s.rows.find(o => o.lead === r.k && o.i !== i && !o.gone); return `<option value="${esc(r.k)}"${x.lead === r.k ? " selected" : ""}>${esc(r.name)}${other ? ` (led by ${esc(other.name)})` : ""}</option>`; }).join("")}</select></label>`
        : `<p class="hint">Warlord, enhancements and leading a unit are for characters. This unit's role is ${esc(x.role || "not set")}.</p>`}
        <div class="row-actions"><button type="submit" class="primary">Save</button></div>`);
      // Fill in the points for a known enhancement, unless you've typed your own.
      let autoP = x.enh && known[x.enh.n] === x.enh.p ? String(x.enh.p || "") : null;
      if(ch) $("w-een").addEventListener("input", ev => {
        const p = known[ev.target.value.trim()], cur = $("w-eep").value;
        if(p != null && (!cur || cur === autoP)){ $("w-eep").value = p || ""; autoP = String(p || ""); }
      });
      d.querySelector("form").addEventListener("submit", ev => {
        ev.preventDefault();
        const pv = $("w-ep").value.trim(), n = {...e};
        if(x.u){ if(pv === "") delete n.pts; else n.pts = Math.max(0, parseInt(pv, 10) || 0); } else n.points = Math.max(0, parseInt(pv, 10) || 0);
        let wl = false;
        if(ch){
          wl = $("w-ewl").checked; if(wl) n.warlord = true; else delete n.warlord;
          const en = $("w-een").value.trim(); if(en) n.enh = {n: en, p: Math.max(0, parseInt($("w-eep").value, 10) || 0)}; else delete n.enh;
          const ld = $("w-eld").value; if(ld) n.lead = ld; else delete n.lead;
        }
        // One warlord per list: choosing this one steps the last one down.
        save({units: list.units.map((u, j) => j === i ? n : wl && u.warlord ? (({warlord, ...r}) => r)(u) : u)});
        d.close();
      });
    }
    draw();
    onApp(async e => {
      const b = e.target.closest("button"); if(!b) return;
      if(b.dataset.add) save({units: list.units.concat({u: b.dataset.add, k: entryKey()})});
      else if(b.dataset.rm != null) {
        // Anyone leading the removed unit stops leading it.
        const gone = list.units[+b.dataset.rm];
        save({units: list.units.filter((x, i) => i !== +b.dataset.rm).map(x => gone && x.lead === gone.k ? (({lead, ...r}) => r)(x) : x)});
      }
      else if(b.dataset.opts != null) openEntryOptions(+b.dataset.opts);
      else if(b.dataset.hideCheck){
        // Keep focus in the panel after the redraw.
        await save({ignored: [...new Set((list.ignored || []).concat(b.dataset.hideCheck))]});
        const next = app.querySelector("[data-hide-check]") || app.querySelector("[data-unhide-checks]"); if(next) next.focus();
      }
      else if(b.matches("[data-unhide-checks]")) { await save({ignored: []}); const f = app.querySelector("[data-hide-check]"); if(f) f.focus(); }
      else if(b.matches("[data-prune]")) { const ids = new Set(factionUnits(D, army.id).map(u => u.id)); save({units: list.units.filter(x => !x.u || ids.has(x.u))}); }
      else if(b.dataset.unit) { const u = D.units.find(x => x.id === b.dataset.unit); if(u) openUnit(armyById(D, u.armyId) || army, u, reload, {armies: D.armies, pools: D.pools}); }
      else if(b.dataset.bought) {
        const u = D.units.find(x => x.id === b.dataset.bought); if(!u) return;
        b.disabled = true;
        try { await store.saveUnit(u.armyId, {...u, own: "owned"}, u.id, null, false, u); await reload(); flash(`${u.name} is now in your collection`); }
        catch(err){ flash("Couldn't update: " + errText(err)); b.disabled = false; }
      }
      else if(b.matches("[data-add-unit]")) openUnit(army, null, reload);
      else if(b.dataset.own != null) {
        // A unit from the list you do own after all: add it to the collection and link it.
        const e2 = list.units[+b.dataset.own]; if(!e2 || e2.u) return;
        b.disabled = true;
        try {
          const sh = sheetsOf(army.faction).find(s => s.n === e2.sheet);
          const planned = b.dataset.planned === "1";
          const row = await store.saveUnit(army.id, unitRow(army, sh, {name: e2.n, role: e2.role || (sh ? sh.r : "Other"), count: e2.count, points: e2.points, own: planned ? "planned" : "owned"}), null, null, false, null);
          D = await warData(false);
          await save({units: list.units.map((x, i) => { if(i !== +b.dataset.own) return x; const {n, sheet, role, count, points, ...keep} = x; return {...keep, u: row.id}; })});
          flash(planned ? `${e2.n} added to ${army.name} as planned. Plan its colours in Livery Ledger.` : `Added ${e2.n} to ${army.name}`);
        } catch(err){ flash("Couldn't add it: " + errText(err)); b.disabled = false; }
      }
      else if(b.matches("[data-details]")) {
        const d = modal("List details", `
          <label>List name<input id="w-ln" maxlength="80" value="${esc(list.name)}"></label>
          ${listFields(list, D, army.faction)}
          <label>Notes<textarea id="w-lnote" rows="3" maxlength="600">${esc(list.notes)}</textarea></label>
          <div class="row-actions"><button type="submit" class="primary">Save</button></div>`, "wide");
        wireListFields(d, army.faction);
        d.querySelector("form").addEventListener("submit", ev => {
          ev.preventDefault();
          save({name: $("w-ln").value.trim() || list.name, ...readListFields(d), notes: $("w-lnote").value.trim()});
          document.title = `${list.name} · War Ledger`; d.close();
        });
      }
      else if(b.matches("[data-import]")) openListImport(army, list, D, patch => save(patch));
      else if(b.matches("[data-copy]")) {
        const s = listState(list, D);
        const text = [`${list.name} (${ptsText(s.points)}${list.limit ? ` of ${num(list.limit)}` : ""})`, [sizeName(list), detText(list)].filter(Boolean).join(" · "),
          `${army.name} · ${factionName(army.faction)}`, list.ptsAsOf ? `Points as of ${niceDay(list.ptsAsOf)}` : "", ""].filter((x, i) => x || i === 4)
          .concat(...byRole(s.rows.filter(x => !x.gone)).map(([role, rows]) => [role.toUpperCase(), ...rows.flatMap(x => {
            const lead = x.lead && (s.rows.find(r => r.k === x.lead && !r.gone) || {}).name;
            return [`  ${x.name}${x.count > 1 ? ` (${x.count} models)` : ""} · ${x.points} pts${x.warlord ? " · Warlord" : ""}`,
              x.enh ? `    Enhancement: ${x.enh.n}${x.enh.p ? ` (+${x.enh.p} pts)` : ""}` : "", lead ? `    Leading: ${lead}` : ""].filter(Boolean);
          }), ""])).join("\n").trim();
        try { await navigator.clipboard.writeText(text); flash("List copied."); } catch(err){ flash("Couldn't copy. Your browser blocked the clipboard."); }
      }
      else if(b.matches("[data-dup]")) {
        try { await chain; const c = await store.saveList({...list, name: `${list.name} (copy)`, status: "draft"}); flash("List duplicated."); location.hash = `#/war/list/${c.id}`; }
        catch(err){ flash("Couldn't duplicate: " + errText(err)); }
      }
      else warClicks(e, D, reload);
    });
  }
  // Paste a list: its units are matched to the collection, and anything you don't own is marked.
  function openListImport(army, list, D, apply){
    const d = modal("Paste an army list", `
      <p class="sub">Paste a list from the Warhammer 40,000 app, New Recruit, BattleScribe or a list-builder share code. Each unit is matched to one you own in ${esc(army.name)}.</p>
      <label>Army list<textarea id="w-list" rows="8"></textarea></label>
      <div id="w-found" class="w-found" aria-live="polite"></div>
      <label class="chk"><input type="checkbox" id="w-repl"${list.units.length ? "" : " checked"}><span>Replace the units already in this list</span></label>
      <div class="row-actions"><button type="submit" class="primary" id="w-add" disabled>Use this list</button></div>`, "wide");
    const reader = makeListReader(army.faction);
    let plan = null;
    const read = () => {
      const t = $("w-list").value, parsed = t.trim() ? (reader.parseCode(t) || reader.parseList(t)) : null;
      if(!parsed || !parsed.units.length){ plan = null; $("w-found").innerHTML = parsed ? `<p class="hint">No units found yet. Paste the whole list, including the points.</p>` : ""; $("w-add").disabled = true; return; }
      // This army's units are matched first, then the rest of the faction's collection.
      const taken = new Set($("w-repl").checked ? [] : list.units.filter(x => x.u).map(x => x.u)), pool = factionUnits(D, army.id).sort((a, b) => (a.armyId === army.id ? 0 : 1) - (b.armyId === army.id ? 0 : 1));
      const entries = parsed.units.map(x => {
        const cands = pool.filter(u => !taken.has(u.id) && u.datasheet === x.sheet.n);
        const hit = cands.find(u => u.count === x.count) || cands[0];
        const ex = entryExtras(x.notes);
        if(hit){ taken.add(hit.id); return {e: {u: hit.id, k: entryKey(), ...ex}, name: x.name, owned: true}; }
        return {e: {n: x.name, sheet: x.sheet.n, role: x.sheet.r, count: x.count, points: Math.max(0, x.points - (ex.enh ? ex.enh.p : 0)), k: entryKey(), ...ex}, name: x.name, owned: false};
      });
      plan = {parsed, entries};
      const own = entries.filter(x => x.owned).length;
      $("w-found").innerHTML = `<p><strong>${plural(entries.length, "unit")}</strong> · ${ptsText(parsed.units.reduce((a, x) => a + x.points, 0))} · ${own} matched to your collection</p>
        <ul>${entries.map(x => `<li>${esc(x.name)} <small>${x.owned ? "In your collection" : "Not owned"}</small></li>`).join("")}</ul>${parsed.unmatched.length ? `<p class="hint">Not recognised: ${esc(parsed.unmatched.join(", "))}</p>` : ""}`;
      $("w-add").disabled = false;
    };
    $("w-list").addEventListener("input", read); $("w-repl").addEventListener("change", read);
    d.querySelector("form").addEventListener("submit", e => {
      e.preventDefault(); if(!plan) return;
      const units = ($("w-repl").checked ? [] : list.units).concat(plan.entries.map(x => x.e));
      const patch = {units};
      if(plan.parsed.limit && !list.limit) patch.limit = plan.parsed.limit;
      if(plan.parsed.detachment && !(list.detachments || []).length) patch.detachments = [plan.parsed.detachment];
      if(patch.limit && !list.size){ const z = BATTLE_SIZES.find(x => x.pts === patch.limit); patch.size = z ? z.id : "custom"; }
      apply(patch); d.close(); flash("List updated.");
    });
    $("w-list").focus();
  }

  /* ---------- battle reports ---------- */
  const oppText = g => [g.opp ? factionName(g.opp) : "", g.oppName].filter(Boolean).join(" · ") || "Unknown opponent";
  // Keep each army's record on the army itself, so Shared armies can show it.
  async function syncRecords(armyIds){
    try {
      const games = await store.listGames();
      for(const id of [...new Set(armyIds.filter(Boolean))]){
        const a = await store.getArmy(id); if(!a) continue;
        await store.setArmyRecord(a, recordOf(games.filter(g => g.armyId === id)));
      }
    } catch(e){ console.warn("Couldn't update the army record", e); }
  }
  function openGame(D, g, again){
    if(!D.armies.length){ flash("Create an army first."); return; }
    if(D.warMissing){ flash("Run supabase/features.sql in Supabase to turn on battle reports."); return; }
    const edit = !!(g && g.id), seed = g || {};
    const armyId = D.armies.some(a => a.id === seed.armyId) ? seed.armyId : D.armies[0].id;
    const d = modal(edit ? "Edit battle" : "Log a battle", `
      <div class="wgrid">
        <label class="span2">Your army<select id="w-ga">${D.armies.map(a => `<option value="${esc(a.id)}"${a.id === armyId ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>
        <label>Date<input id="w-gd" type="date" value="${esc(seed.date || isoDay(new Date()))}" max="${isoDay(new Date())}"></label>
        <label class="span3">Army list<select id="w-gl"></select></label>
        <label class="span2">Opponent's faction${factionSelect("w-go", seed.opp || "", "Not sure / other")}</label>
        <label><span>Opponent <span class="opt">(optional)</span></span><input id="w-gp" maxlength="60" value="${esc(seed.oppName || "")}" placeholder="Name"></label>
        <label class="span3"><span>Mission <span class="opt">(optional)</span></span><input id="w-gm" maxlength="80" value="${esc(seed.mission || "")}"></label>
      </div>
      <fieldset class="wfs"><legend>Result</legend>
        <div class="res-pick" role="radiogroup" aria-label="Result">${["w", "l", "d"].map(k => `<label class="r-${k}"><input type="radio" name="w-gr" value="${k}"${(seed.result || "w") === k ? " checked" : ""}><span>${RES[k]}</span></label>`).join("")}</div>
        <div class="wgrid"><label>Your score<input id="w-gu" type="number" min="0" max="999" inputmode="numeric" value="${seed.us ?? ""}"></label><label>Their score<input id="w-gt" type="number" min="0" max="999" inputmode="numeric" value="${seed.them ?? ""}"></label></div>
      </fieldset>
      <label><span>Most valuable unit <span class="opt">(optional)</span></span><select id="w-gv"></select></label>
      <label>Notes<textarea id="w-gn" rows="3" maxlength="1000" placeholder="What worked, what didn't, what to try next time">${esc(seed.notes || "")}</textarea></label>
      <div class="row-actions"><button type="submit" class="primary">${edit ? "Save battle" : "Log battle"}</button>${edit ? `<button type="button" class="danger" id="w-gdel">Delete</button>` : ""}<span class="msg" id="w-msg" role="status"></span></div>`, "wide");
    const fill = () => {
      const a = $("w-ga").value, ls = D.lists.filter(l => l.armyId === a), us = factionUnits(D, a);
      $("w-gl").innerHTML = `<option value="">No list / not recorded</option>${ls.map(l => `<option value="${esc(l.id)}"${l.id === seed.listId ? " selected" : ""}>${esc(l.name)}</option>`).join("")}`;
      $("w-gv").innerHTML = `<option value="">None</option>${us.map(u => `<option value="${esc(u.id)}"${u.id === seed.mvp ? " selected" : ""}>${esc(u.name)}</option>`).join("")}`;
    };
    $("w-ga").addEventListener("change", fill); fill();
    d.querySelector("form").addEventListener("submit", async e => {
      e.preventDefault();
      const row = {armyId: $("w-ga").value, listId: $("w-gl").value, date: $("w-gd").value, opp: $("w-go").value, oppName: $("w-gp").value.trim(), mission: $("w-gm").value.trim(),
        result: (d.querySelector("[name=w-gr]:checked") || {}).value || "w", us: $("w-gu").value, them: $("w-gt").value, mvp: $("w-gv").value, notes: $("w-gn").value.trim()};
      const b = e.submitter || d.querySelector("[type=submit]"); b.disabled = true; $("w-msg").textContent = "Saving…";
      try { await store.saveGame(row, edit ? g.id : null); await syncRecords([row.armyId, edit ? g.armyId : ""]); d.close(); flash(edit ? "Battle saved." : `${RES[row.result]} logged.`); again(); }
      catch(err){ console.error(err); $("w-msg").textContent = "Couldn't save: " + errText(err); b.disabled = false; }
    });
    if(edit) armButton($("w-gdel"), "Tap again to delete", async () => {
      try { await store.removeGame(g.id); await syncRecords([g.armyId]); d.close(); flash("Battle deleted."); again(); }
      catch(err){ $("w-msg").textContent = "Couldn't delete: " + errText(err); }
    });
  }
  async function viewWarBattles(){
    view.name = "war-battles"; document.title = "Battles · War Ledger";
    let D = await warData(false), armyF = "";
    const again = async () => { D = await warData(false); draw(); };
    app.innerHTML = `
      <section class="page-head war-head">
        <div><p class="eyebrow">War Ledger</p><h1>Battle reports</h1><p class="sub">Every game you've played, and how each army and list has fared.</p></div>
        <div class="war-actions">${D.armies.length && !D.warMissing ? `<button type="button" class="primary" data-log="">Log a battle</button>` : ""}</div>
      </section>
      ${warTabs("battles")}
      ${missingBanner(D)}
      <div id="wb-out"></div>`;
    function table(title, rows){
      return rows.length ? `<section class="panel wrec"><h2 class="ph">${title}</h2><div class="wt-scroll"><table class="wtable compact">
        <thead><tr><th scope="col">${title.replace(/^By /, "")}</th><th scope="col" class="n">Games</th><th scope="col" class="n">W</th><th scope="col" class="n">L</th><th scope="col" class="n">D</th><th scope="col" class="n">Won</th></tr></thead>
        <tbody>${rows.map(([name, gs]) => { const r = recordOf(gs); return `<tr><th scope="row">${name}</th><td class="n">${gs.length}</td><td class="n">${r.w}</td><td class="n">${r.l}</td><td class="n">${r.d}</td><td class="n">${pctOf(r.w, gs.length)}%</td></tr>`; }).join("")}</tbody></table></div></section>` : "";
    }
    const group = (gs, key, name) => { const m = new Map(); gs.forEach(g => { const k = key(g); if(!m.has(k)) m.set(k, []); m.get(k).push(g); }); return [...m.entries()].map(([k, v]) => [name(k, v), v]).sort((a, b) => b[1].length - a[1].length); };
    function draw(){
      if(!D.armies.length){ $("wb-out").innerHTML = warEmpty(); return; }
      const gs = D.games.filter(g => !armyF || g.armyId === armyF), rec = recordOf(gs);
      const an = id => { const a = D.armies.find(x => x.id === id); return a ? esc(a.name) : "Deleted army"; };
      $("wb-out").innerHTML = `
        <div class="war-filters"><select id="wb-army" aria-label="Army"><option value="">All armies</option>${D.armies.map(a => `<option value="${esc(a.id)}"${a.id === armyF ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></div>
        ${gs.length ? `
        <section class="war-stats five" aria-label="Record">
          <div class="wstat"><b>${gs.length}</b><span>${gs.length === 1 ? "Game" : "Games"}</span></div>
          <div class="wstat"><b>${rec.w}</b><span>Wins</span></div>
          <div class="wstat"><b>${rec.l}</b><span>Losses</span></div>
          <div class="wstat"><b>${rec.d}</b><span>Draws</span></div>
          <div class="wstat"><b>${pctOf(rec.w, gs.length)}%</b><span>Won</span><small class="form" aria-label="Last five results">${gs.slice(0, 5).map(g => `<i class="r-${g.result}" title="${RES[g.result]}">${g.result.toUpperCase()}</i>`).join("")}</small></div>
        </section>
        <div class="wrec-grid">
          ${armyF ? "" : table("By army", group(gs, g => g.armyId, k => an(k)))}
          ${table("By opponent", group(gs, g => g.opp || g.oppName || "", (k, v) => esc(oppText(v[0]))))}
          ${table("By list", group(gs.filter(g => g.listId), g => g.listId, k => esc((D.lists.find(l => l.id === k) || {}).name || "Deleted list")))}
        </div>
        <section class="war-sec"><div class="sec-h"><h2>History</h2></div>${gameRows(gs, D)}</section>`
        : `<section class="panel war-empty"><h2>No battles yet</h2><p class="sub">After a game, log the result here. War Ledger keeps each army's record, and shows it on Shared armies when you share that army.</p>${D.warMissing ? "" : `<button type="button" class="primary" data-log="${esc(armyF)}">Log a battle</button>`}</section>`}`;
      $("wb-army").addEventListener("change", e => { armyF = e.target.value; draw(); });
    }
    draw();
    onApp(e => warClicks(e, D, again));
  }

  /* ============================================================
     Home: your ledgers + faction picker
     ============================================================ */
  /* ============================================================
     Livery Ledger and War Ledger share one layout: the same profile header
     on each overview, a tab bar on every page, and the same way to start
     something new (a faction page, then a name).
     ============================================================ */
  const LIST_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>`;
  // Your picture, name and join date, a row of buttons, and the numbers that matter on this side.
  function profileHead({war, stats, actions}){
    const me = acct(), since = me ? monthYear(me.since) : "";
    return `<section class="profile-head">
        ${me ? `<div class="ph-avatar">
          <button type="button" class="avatar xl avatar-btn${me.avatar ? " has-img" : ""}" id="b-avatar" aria-label="${me.avatar ? "Change or remove your profile picture" : "Add a profile picture"}" title="${me.avatar ? "Change your picture" : "Add a picture"}">${avatarInner(me)}</button>
          <span class="avatar-cam" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/></svg></span>
          <div class="more-menu av-menu" id="av-menu" hidden>
            <button type="button" data-av="upload">Upload a new picture</button>
            <button type="button" class="menu-danger" data-av="remove">Remove picture</button>
          </div>
          <input type="file" id="f-avatar" accept="image/*" hidden>
        </div>` : ""}
        <div class="ph-text">
          <p class="eyebrow">${me ? "Your profile" : war ? "War Ledger" : "Livery Ledger"}</p>
          ${me ? `<div class="ph-name" id="ph-name"><h1 id="ph-h">${esc(me.name)}</h1><button type="button" class="icon-btn edit-name" id="b-name" aria-label="Change your display name" title="Change your display name"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg></button></div>
          <form class="name-edit" id="name-form" hidden>
            <input id="name-in" maxlength="40" autocomplete="nickname" aria-label="Display name" placeholder="${esc(me.email.split("@")[0])}">
            <button type="submit" class="primary btn-sm">Save</button>
            <button type="button" class="btn-sm" id="name-cancel">Cancel</button>
          </form>` : `<h1>${war ? "Your armies" : "Your ledgers"}</h1>`}
          ${me ? `<p class="sub">${esc(me.email)}${since ? ` · ${war ? "Commanding" : "Painting"} with us since ${esc(since)}` : ""}</p>`
            : `<p class="sub">${war ? "Track what you own, build lists from it, check it's ready for the table and log how every game went." : "Plan how you'll paint your army. Pick your faction, choose your colours, then track every unit with photos, weapons and paint recipes."}</p>`}
          ${me ? `<p class="msg" id="ph-msg" role="status" aria-live="polite"></p>` : `<div class="ph-note">${noteHtml()}</div>`}
          ${actions ? `<div class="ph-actions">${actions}</div>` : ""}
        </div>
        <div class="stats" aria-label="${war ? "Your forces" : "Your painting so far"}">${stats.map(([b, l]) => `<div class="stat"><b>${b}</b><span>${l}</span></div>`).join("")}</div>
      </section>`;
  }
  // After a profile header is on the page: picture and name editing, and the pile of shame count.
  function wireProfileHead(){
    const me = acct();
    app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", () => openAuth("in")));
    if(me && store.updateProfile) profileEdits();
    if(me) getShame().then(l => { const a = app.querySelector('.ph-actions a[href="#/shame"]'); if(a) a.innerHTML = "Pile of shame" + (l.length ? `<span class="count">${l.length}</span>` : ""); }).catch(() => {});
  }
  const shameBtn = () => `<a class="btn btn-sm" href="#/shame">Pile of shame${shameCount() ? `<span class="count">${shameCount()}</span>` : ""}</a>`;
  const settingsBtn = `<a class="btn btn-sm" href="#/settings">Settings</a>`;

  const LIV_TABS = [["", "Overview"], ["ledgers", "Ledgers"], ["roster", "Roster"], ["paints", "Paints & recipes"], ["activity", "Painting activity"]];
  const livTabs = on => `<nav class="war-tabs" aria-label="Livery Ledger">${LIV_TABS.map(([k, l]) => `<a href="#/livery${k ? "/" + k : ""}"${k === on ? ` aria-current="page"` : ""}>${esc(l)}</a>`).join("")}</nav>`;
  // A page's heading on the tab pages (the overview has the profile header instead).
  const tabHead = (eyebrow, title, sub, actions) => `<section class="page-head war-head">
      <div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</div>
      ${actions ? `<div class="war-actions">${actions}</div>` : ""}
    </section>`;

  async function liveryData(){
    let armies = [], sum = {};
    if(store.canWrite || store.kind === "supabase"){
      try { [armies, sum] = await Promise.all([store.listArmies(), store.summary()]); }
      catch(err){ console.error(err); armies = []; }
    }
    const mine = store.session ? store.session.user.id : null;
    armies = armies.filter(a => (!mine || !a.owner || a.owner === mine) && !isPool(a));
    const tot = armies.reduce((t, x) => { const s = sum[x.id] || {}; t.units += s.units || 0; t.models += s.models || 0; t.done += s.done || 0; return t; }, {units: 0, models: 0, done: 0});
    return {armies, sum, tot};
  }
  function ledgerCard(a, sum){
    const s = sum[a.id] || {units: 0, models: 0, done: 0}, f = FBY[a.faction];
    const pct = s.models ? Math.round(s.done / s.models * 100) : 0;
    return `<a class="lcard" href="#/army/${esc(a.id)}">
      <div class="card-top">${armyBadge(a, 56)}<div><h3>${esc(a.name)}</h3><div class="meta">${esc(f ? f.name : a.faction)}</div></div></div>
      <div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div>
      <div class="foot"><span>${plural(s.units, "unit")} · ${plural(s.models, "model")}</span><span>${pct}% painted</span></div>
    </a>`;
  }
  const newLedgerBtn = (cls) => store.canWrite || store.session ? `<a class="btn ${cls || "primary"}" href="#/livery/new">+ New ledger</a>` : "";
  const livEmpty = () => `<section class="panel war-empty">
      <span class="we-mark" aria-hidden="true">${LOGO_DROP}</span>
      <h2>Start your first ledger</h2>
      <p class="sub">Pick your faction, choose your colours, then add your units one at a time or paste your army list.</p>
      ${newLedgerBtn()}
      <p class="hint">Already using War Ledger? Those armies show up here too, ready to paint.</p>
    </section>`;

  /* ---------- Livery overview ---------- */
  async function viewLivery(){
    view.name = "home"; document.title = "Livery Ledger";
    const {armies, sum, tot} = await liveryData();
    const signedOut = store.kind === "supabase" && !store.session;
    const shown = armies.slice(0, 6);
    app.innerHTML = `
      ${profileHead({war: false,
        stats: [[armies.length, armies.length === 1 ? "Ledger" : "Ledgers"], [num(tot.units), "Units"], [`${num(tot.done)}/${num(tot.models)}`, "Models painted"], [`${tot.models ? Math.round(tot.done / tot.models * 100) : 0}%`, "Complete"]],
        actions: armies.length ? `<a class="btn btn-sm" href="#/livery/roster">${LIST_ICON}Your roster<span class="count">${num(tot.units)}</span></a>${shameBtn()}${settingsBtn}` : ""})}
      ${livTabs("")}
      ${signedOut ? `<div class="banner"><span class="dot"></span>Log in to create a ledger and see the ones you've made. <button type="button" class="btn-sm" data-signin>Log in</button></div>` : ""}
      ${armies.length ? `
      <section class="war-sec" aria-labelledby="yl-h"><div class="sec-h"><h2 id="yl-h">Your ledgers</h2><div class="sec-acts">${armies.length > shown.length ? `<a href="#/livery/ledgers">All ${armies.length} ledgers</a>` : ""}${newLedgerBtn("primary btn-sm")}</div></div>
        <div class="ledgers">${shown.map(a => ledgerCard(a, sum)).join("")}</div></section>
      <section class="war-sec" aria-labelledby="pa-h"><div class="sec-h"><h2 id="pa-h">Painting activity</h2><a href="#/livery/activity">See your painting activity</a></div>
        <div id="act-sum" class="act-sum"><p class="hint">Adding up your painting…</p></div></section>`
      : signedOut ? "" : livEmpty()}`;
    wireProfileHead();
    if(armies.length) store.listAllUnits().then(us => {
      const box = $("act-sum"); if(!box) return;
      const A = activityOf(us), goal = getGoal();
      box.innerHTML = `<div class="war-stats" aria-label="Painting activity">
          <div class="wstat"><b>${A.thisMonth}</b><span>This month</span><small>${A.lastMonth.n ? `${A.lastMonth.n} last month` : "Models painted"}</small></div>
          <div class="wstat"><b>${A.thisYear}</b><span>This year</span></div>
          <div class="wstat"><b>${A.streak}</b><span>Week streak</span><small>${A.streak ? `${plural(A.streak, "week")} in a row` : "Paint this week to start one"}</small></div>
          <div class="wstat ready"><b>${goal ? `${A.thisMonth}<small> / ${goal}</small>` : "–"}</b><span>Monthly goal</span>${goal ? `<div class="wbar" aria-hidden="true"><i style="width:${Math.min(100, Math.round(A.thisMonth / goal * 100))}%"></i></div>` : `<small><a href="#/livery/activity">Set a goal</a></small>`}</div>
        </div>`;
    }).catch(err => { console.error(err); if($("act-sum")) $("act-sum").innerHTML = `<p class="hint">Couldn't load your painting history.</p>`; });
  }

  /* ---------- Livery tab pages ---------- */
  async function viewLiveryLedgers(){
    view.name = "liv-ledgers"; document.title = "Ledgers · Livery Ledger";
    const {armies, sum} = await liveryData();
    app.innerHTML = `${tabHead("Livery Ledger", "Your ledgers", "Every army you're painting, and how far along it is.", newLedgerBtn())}
      ${livTabs("ledgers")}
      ${armies.length ? `<h2 class="sr-only">Ledgers</h2><div class="ledgers">${armies.map(a => ledgerCard(a, sum)).join("")}</div>` : livEmpty()}`;
  }
  async function viewLiveryRoster(){
    view.name = "liv-roster"; document.title = "Roster · Livery Ledger";
    app.innerHTML = `${tabHead("Livery Ledger", "Your roster", `<span id="ro-sum">Every unit across all your ledgers.</span>`, "")}
      ${livTabs("roster")}
      <div class="ro-tools war-filters">
        <input type="search" id="ro-q" placeholder="Search your units" aria-label="Search your roster">
        <div class="filters" id="ro-f" role="group" aria-label="Filter by status">
          ${[["all", "All"], ["todo", "To paint"], ["progress", "In progress"], ["done", "Painted"], ["fav", "Starred"]].map(([k, l]) => `<button type="button" data-rf="${k}" aria-pressed="${rosterFilter === k}">${l}</button>`).join("")}
        </div>
        <label class="ro-by">Group by<select id="ro-g"><option value="army">Ledger</option><option value="role">Role</option><option value="status">Status</option></select></label>
      </div>
      <h2 class="sr-only">Units</h2>
      <div class="ro-page" id="ro-body"><p class="hint">Loading your units…</p></div>`;
    try { $("ro-g").value = localStorage.getItem("ll-roster-group") || "army"; } catch(e){}
    if(!$("ro-g").value) $("ro-g").value = "army";
    $("ro-q").addEventListener("input", drawRoster);
    $("ro-g").addEventListener("change", () => { try { localStorage.setItem("ll-roster-group", $("ro-g").value); } catch(e){} drawRoster(); });
    $("ro-f").addEventListener("click", e => {
      const b = e.target.closest("[data-rf]"); if(!b) return;
      rosterFilter = b.dataset.rf;
      $("ro-f").querySelectorAll("[data-rf]").forEach(x => x.setAttribute("aria-pressed", x === b));
      drawRoster();
    });
    try {
      const {armies} = await liveryData(), units = await store.listAllUnits();
      const byId = Object.fromEntries(armies.map(a => [a.id, a]));
      roster = {armies, byId, units: units.filter(u => byId[u.armyId])};
      if($("ro-body")) drawRoster();
    } catch(err){ console.error(err); if($("ro-body")) $("ro-body").innerHTML = `<p class="hint">Couldn't load your roster: ${esc(errText(err))}</p>`; }
  }
  async function viewLiveryActivity(){
    view.name = "liv-activity"; document.title = "Painting activity · Livery Ledger";
    app.innerHTML = `${tabHead("Livery Ledger", "Painting activity", "Models you've marked painted across all your ledgers, month by month.", "")}
      ${livTabs("activity")}
      <section class="activity panel" id="activity" aria-labelledby="act-h"><h2 class="act-title" id="act-h">Painting activity</h2><p class="loading">Adding up your painting…</p></section>`;
    try { const us = await store.listAllUnits(); if($("activity")) drawActivity(us); }
    catch(err){ console.error(err); if($("activity")) $("activity").querySelector(".loading").textContent = "Couldn't load your painting history."; }
  }


  /* ---------- Livery: paints and recipes across every ledger ---------- */
  const RECIPE_TECHS = ["Prime","Basecoat","Layer","Shade / wash","Contrast","Dry brush","Edge highlight","Highlight","Glaze","Technical","Varnish","Other"];
  const RECIPE_AREAS = ["Armour", "Secondary", "Trim", "Robes / cloth", "Weapons / metal", "Skin", "Lenses", "Base", "Other"];
  let paintsTab = "recipes";
  async function viewLiveryPaints(){
    view.name = "liv-paints"; document.title = "Paints & recipes · Livery Ledger";
    let armies = [], units = [], library = null, libMsg = "", ownedList = [], editing = null, q = "", delArmed = "";
    app.innerHTML = `${tabHead("Livery Ledger", "Paints &amp; recipes", "Your recipes, the paints on your shelf and what you still need, across all your ledgers.", "")}
      ${livTabs("paints")}
      <div class="seg pp-tabs" role="group" aria-label="Section" id="pp-tabs">
        <button type="button" data-pt="recipes">Recipes</button><button type="button" data-pt="owned">My paints</button><button type="button" data-pt="buy">To buy <span class="buy-badge" id="pp-buy" hidden></span></button>
      </div>
      <div id="pp-body" class="pp-body"><p class="hint">Loading…</p></div>`;
    try {
      const res = await Promise.all([liveryData(), store.listAllUnits(), store.getPaints().catch(() => []), PU.load()]);
      armies = res[0].armies; units = res[1]; ownedList = res[2] || [];
    } catch(err){ console.error(err); $("pp-body").innerHTML = `<p class="hint">Couldn't load your paints: ${esc(errText(err))}</p>`; return; }
    try { library = store.getLibrary ? await store.getLibrary() : []; }
    catch(err){ library = null; libMsg = err.code === "nolib" ? "To keep a recipe library, add the recipes table to Supabase: run supabase/features.sql or supabase-setup.sql in the SQL editor." : "Couldn't load your recipe library."; }
    const owned = () => new Set(ownedList.map(PU.norm));
    const isOwned = p => owned().has(PU.norm(p));
    const live = () => (library || []).filter(r => !r.deleted);
    // Which ledgers use each recipe (their own copy carries the same id).
    const usedIn = id => armies.filter(a => (a.scheme.recipes || []).some(r => r.id === id));
    const paintLine = label => { const d = PU.describe(label); return `<strong>${esc(d.name)}</strong>${d.meta ? `<small class="pmeta">${esc(d.meta)}</small>` : ""}`; };
    const steps = r => r.steps.length ? `<ol class="steps">${r.steps.map(st => { const d = PU.describe(st.p);
      return `<li>${PU.swatch(st.p)}<span class="st-x"><span class="st-t">${esc(st.t || "Step")}</span><span class="st-p">${esc(d.name || "—")}${d.meta ? `<small>${esc(d.meta)}</small>` : ""}</span></span>${st.p ? (isOwned(st.p) ? `<span class="own ok">Owned</span>` : `<span class="own no">To buy</span>`) : ""}</li>`; }).join("")}</ol>` : `<p class="prose">No steps yet.</p>`;
    // Every paint your ledgers call for that isn't on your shelf.
    function shopping(){
      const need = new Map();
      const add = (p, why) => { if(!p || isOwned(p)) return; const k = PU.norm(p); if(!need.has(k)) need.set(k, {label: p, why: []}); if(!need.get(k).why.includes(why)) need.get(k).why.push(why); };
      armies.forEach(a => {
        const us = units.filter(u => u.armyId === a.id), used = new Set(us.flatMap(u => u.recipes || []));
        (a.scheme.recipes || []).filter(r => used.has(r.id)).forEach(r => r.steps.forEach(st => add(st.p, a.name)));
        Object.values(a.scheme.slotPaints || {}).forEach(p => add(p, a.name));
        (a.scheme.tiers || []).forEach(t => add(t.paint, a.name));
        Object.values(a.scheme.xareas || {}).forEach(v => add(v && v.paint, a.name));
        us.forEach(u => { Object.values(u.slotPaints || {}).forEach(p => add(p, a.name)); Object.values(u.xareas || {}).forEach(v => add(v && v.paint, a.name)); });
      });
      return [...need.values()].sort((a, b) => a.label.localeCompare(b.label));
    }
    async function saveLib(rows){ await store.putLibrary(rows); library = await store.getLibrary(); }
    function draw(){
      $("pp-tabs").querySelectorAll("[data-pt]").forEach(b => b.setAttribute("aria-pressed", b.dataset.pt === paintsTab));
      const buy = shopping(); $("pp-buy").hidden = !buy.length; $("pp-buy").textContent = buy.length;
      const body = $("pp-body");
      if(editing){ drawEditor(body); return; }
      if(paintsTab === "recipes"){
        const list = live().filter(r => !q || [r.name, r.area, ...r.steps.map(s => s.p)].join(" ").toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
        body.innerHTML = library === null ? `<p class="hint">${esc(libMsg)}</p>` : `
          <div class="pp-head"><p class="hint">Recipes saved in any ledger are kept here. Edit one and the change reaches every ledger that uses it. To use a recipe, open a ledger's Paints &amp; recipes and add it from your library.</p>
            <div class="row-actions">${live().length > 6 ? `<input type="search" id="pp-q" placeholder="Search recipes" aria-label="Search recipes" value="${esc(q)}">` : ""}<button type="button" class="primary btn-sm" data-pa="new">+ New recipe</button></div></div>
          ${list.length ? `<div class="recipes">${list.map(r => { const us = usedIn(r.id); return `<article class="recipe">
            <header><div><h3>${esc(r.name)}</h3><small>${esc([r.area, plural(r.steps.length, "step")].filter(Boolean).join(" · "))}</small></div>
              <div class="row-actions"><button type="button" class="btn-sm" data-pa="edit" data-id="${esc(r.id)}">Edit</button><button type="button" class="btn-sm" data-pa="dup" data-id="${esc(r.id)}">Duplicate</button><button type="button" class="btn-sm danger${delArmed === r.id ? " armed" : ""}" data-pa="del" data-id="${esc(r.id)}">${delArmed === r.id ? "Tap again to delete" : "Delete"}</button></div></header>
            ${steps(r)}
            ${r.notes ? `<p class="prose r-notes">${esc(r.notes)}</p>` : ""}
            <p class="r-used">${us.length ? `Used in ${us.map(a => `<a href="#/army/${esc(a.id)}">${esc(a.name)}</a>`).join(", ")}` : "Not in any ledger yet"}</p>
          </article>`; }).join("")}</div>`
          : `<div class="empty">${live().length ? "No recipes match." : "No recipes yet. Write your first one, like your main armour colour, and add it to any ledger."}</div>`}`;
        const pq = $("pp-q"); if(pq) pq.addEventListener("input", () => { q = pq.value.trim().toLowerCase(); const pos = pq.selectionStart; draw(); const n = $("pp-q"); if(n){ n.focus(); n.setSelectionRange(pos, pos); } });
      } else if(paintsTab === "owned"){
        const shown = ownedList.filter(p => !q || PU.norm(p).includes(PU.norm(q))).sort((a, b) => a.localeCompare(b));
        body.innerHTML = `
          <p class="hint">Paints you own are saved to your ${store.kind === "supabase" ? "account" : "browser"} and shared by all your ledgers.</p>
          <div class="add-paint"><span class="pwrap-host"><input id="op-add" placeholder="Add a paint, e.g. Abaddon Black" aria-label="Add a paint"></span><button type="button" class="primary" data-pa="add-owned">Add</button></div>
          <div class="owned-head"><strong>${plural(ownedList.length, "paint")}</strong>${ownedList.length > 8 ? `<input type="search" id="op-q" class="search" placeholder="Filter" aria-label="Filter your paints" value="${esc(q)}">` : ""}</div>
          ${ownedList.length ? `<div class="owned">${shown.map(p => `<span class="ochip" title="${esc(p)}">${PU.swatch(p)}<span>${esc(PU.describe(p).name)}</span><button type="button" data-pa="rm-owned" data-p="${esc(p)}" aria-label="Remove ${esc(p)}">×</button></span>`).join("")}</div>` : `<div class="empty">No paints yet. Add the ones on your shelf and Livery Ledger shows what you still need.</div>`}`;
        PU.picker($("op-add"), {owned: () => owned(), extra: () => [], onPick: () => {}});
        $("op-add").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); addOwned(); } });
        const oq = $("op-q"); if(oq) oq.addEventListener("input", () => { q = oq.value; const pos = oq.selectionStart; draw(); const n = $("op-q"); if(n){ n.focus(); n.setSelectionRange(pos, pos); } });
      } else {
        body.innerHTML = `
          <p class="hint">Paints in your ledgers' colours and the recipes your units use that aren't in <em>My paints</em>.</p>
          ${buy.length ? `<ul class="buy">${buy.map(it => `<li>${PU.swatch(it.label)}<span class="b-n">${paintLine(it.label)}<small>For ${esc(it.why.slice(0, 3).join(", "))}${it.why.length > 3 ? ` and ${it.why.length - 3} more` : ""}</small></span><button type="button" class="btn-sm" data-pa="got" data-p="${esc(it.label)}">I have it</button></li>`).join("")}</ul>
            <div class="row-actions"><button type="button" class="btn-sm" data-pa="copy-buy">Copy list</button><span class="hint" id="buy-msg" role="status"></span></div>`
          : `<div class="empty">${armies.length ? "You have every paint your ledgers need." : "Start a ledger and pick your colours to see what to buy."}</div>`}`;
      }
    }
    function drawEditor(body){
      const r = editing;
      body.innerHTML = `
        <div class="r-edit panel">
          <h2 class="ph">${r.isNew ? "New recipe" : "Edit recipe"}</h2>
          <div class="r-grid">
            <label>Recipe name<input id="re-name" maxlength="60" value="${esc(r.name)}" placeholder="e.g. Black armour"></label>
            <label>Used for<input id="re-area" maxlength="30" list="re-areas" value="${esc(r.area)}" placeholder="e.g. Armour"><datalist id="re-areas">${RECIPE_AREAS.map(a => `<option value="${esc(a)}">`).join("")}</datalist></label>
          </div>
          <h3 class="em-h">Steps</h3>
          <ol class="r-steps">${r.steps.map((st, i) => `<li>
            <span class="r-num">${i + 1}</span>
            <select data-st="${i}" aria-label="Technique for step ${i + 1}">${(RECIPE_TECHS.includes(st.t) ? RECIPE_TECHS : [st.t, ...RECIPE_TECHS]).map(t => `<option ${t === st.t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>
            <span class="pwrap-host">${PU.swatch(st.p, "in-input")}<input data-sp="${i}" value="${esc(st.p)}" placeholder="Paint" aria-label="Paint for step ${i + 1}"></span>
            <span class="r-btns"><button type="button" class="btn-sm" data-pa="up" data-i="${i}" ${i ? "" : "disabled"} aria-label="Move step ${i + 1} up">↑</button><button type="button" class="btn-sm" data-pa="down" data-i="${i}" ${i < r.steps.length - 1 ? "" : "disabled"} aria-label="Move step ${i + 1} down">↓</button><button type="button" class="btn-sm" data-pa="rm-step" data-i="${i}" aria-label="Remove step ${i + 1}">×</button></span>
          </li>`).join("")}</ol>
          <button type="button" class="btn-sm" data-pa="add-step">+ Add step</button>
          <label>Notes<textarea id="re-notes" rows="2" maxlength="300" placeholder="e.g. thin the highlight, only on top edges">${esc(r.notes)}</textarea></label>
          <div class="r-bar"><span class="hint" id="re-msg" role="status"></span>
            <div class="ed-bar-actions"><button type="button" data-pa="cancel">Cancel</button><button type="button" class="primary" data-pa="save">Save recipe</button></div></div>
        </div>`;
      body.querySelectorAll("[data-sp]").forEach(inp => PU.picker(inp, {owned: () => owned(), extra: () => ownedList}));
      if(r.isNew && !r.name) $("re-name").focus();
    }
    const syncDraft = () => {
      const r = editing; if(!r || !$("re-name")) return;
      r.name = $("re-name").value; r.area = $("re-area").value; r.notes = $("re-notes").value;
      $("pp-body").querySelectorAll("[data-st]").forEach(el => r.steps[+el.dataset.st].t = el.value);
      $("pp-body").querySelectorAll("[data-sp]").forEach(el => r.steps[+el.dataset.sp].p = el.value.trim());
    };
    async function addOwned(){
      const inp = $("op-add"), v = inp.value.trim(); if(!v) return;
      const hit = PU.find(v) || PU.search(v, [], 1)[0];
      const label = hit && PU.norm(hit.label) === PU.norm(v) ? hit.label : v;
      try { ownedList = await store.setPaints(ownedList.concat(label)); q = ""; draw(); $("op-add").focus(); }
      catch(err){ flash("Couldn't save: " + errText(err)); }
    }
    $("pp-tabs").addEventListener("click", e => { const b = e.target.closest("[data-pt]"); if(!b) return; syncDraft(); editing = null; q = ""; paintsTab = b.dataset.pt; draw(); });
    $("pp-body").addEventListener("click", async e => {
      const b = e.target.closest("[data-pa]"); if(!b) return;
      const act = b.dataset.pa, find = () => live().find(r => r.id === b.dataset.id);
      if(act === "new") { editing = {id: S.newId(), name: "", area: "", notes: "", steps: [{t: "Prime", p: ""}, {t: "Basecoat", p: ""}, {t: "Shade / wash", p: ""}, {t: "Layer", p: ""}], isNew: true}; draw(); }
      else if(act === "edit") { const r = find(); if(r){ editing = JSON.parse(JSON.stringify(r)); draw(); } }
      else if(act === "dup") { const r = find(); if(r){ editing = {...JSON.parse(JSON.stringify(r)), id: S.newId(), name: r.name + " (copy)", isNew: true}; draw(); } }
      else if(act === "del") {
        if(delArmed !== b.dataset.id){ delArmed = b.dataset.id; draw(); setTimeout(() => { if(delArmed === b.dataset.id){ delArmed = ""; if(!editing && paintsTab === "recipes" && $("pp-body")) draw(); } }, 4000); return; }
        const r = find(); delArmed = "";
        // Removed from the library; ledgers that use it keep their own copy.
        try { await saveLib([{...r, deleted: true, at: new Date().toISOString()}]); flash(`Deleted ${r.name}`); draw(); } catch(err){ flash("Couldn't delete: " + errText(err)); }
      }
      else if(act === "add-step") { syncDraft(); editing.steps.push({t: "Layer", p: ""}); draw(); const l = $("pp-body").querySelectorAll("[data-sp]"); if(l.length) l[l.length - 1].focus(); }
      else if(act === "rm-step") { syncDraft(); editing.steps.splice(+b.dataset.i, 1); draw(); }
      else if(act === "up" || act === "down") { syncDraft(); const i = +b.dataset.i, j = act === "up" ? i - 1 : i + 1; [editing.steps[i], editing.steps[j]] = [editing.steps[j], editing.steps[i]]; draw(); }
      else if(act === "cancel") { editing = null; draw(); }
      else if(act === "save") {
        syncDraft(); const r = editing;
        r.name = r.name.trim(); r.steps = r.steps.filter(st => st.p || st.t === "Other");
        if(!r.name){ $("re-msg").textContent = "Give the recipe a name."; $("re-name").focus(); return; }
        b.disabled = true;
        try { const {isNew, ...clean} = r; await saveLib([{...clean, at: new Date().toISOString()}]); editing = null; flash(`Saved ${r.name}`); draw(); }
        catch(err){ $("re-msg").textContent = "Couldn't save: " + errText(err); b.disabled = false; }
      }
      else if(act === "add-owned") addOwned();
      else if(act === "rm-owned") { try { ownedList = await store.setPaints(ownedList.filter(p => p !== b.dataset.p)); draw(); } catch(err){ flash("Couldn't save: " + errText(err)); } }
      else if(act === "got") { try { ownedList = await store.setPaints(ownedList.concat(b.dataset.p)); draw(); } catch(err){ flash("Couldn't save: " + errText(err)); } }
      else if(act === "copy-buy") {
        const text = shopping().map(it => "- " + PU.describe(it.label).name + (PU.describe(it.label).meta ? ` (${PU.describe(it.label).meta})` : "")).join("\n");
        try { await navigator.clipboard.writeText(text); $("buy-msg").textContent = "List copied."; } catch(err){ $("buy-msg").textContent = "Your browser blocked the clipboard."; }
      }
    });
    draw();
  }

  /* ---------- starting something new: pick a faction ---------- */
  function factionPage({war, crumbs, title, sub, href, extra}){
    const groups = [
      ["Imperium", FACTIONS.filter(f => f.group === "Imperium" && !f.parent)],
      ["Space Marine chapters", FACTIONS.filter(f => f.parent === "space-marines")],
      ["Chaos", FACTIONS.filter(f => f.group === "Chaos")],
      ["Xenos", FACTIONS.filter(f => f.group === "Xenos")]
    ];
    app.innerHTML = `
      <div class="crumbs">${crumbs}</div>
      ${tabHead(war ? "War Ledger" : "Livery Ledger", title, sub, "")}
      <div class="row-actions fpick-tools">
        <input type="search" class="fsearch" id="fq" placeholder="Search factions" aria-label="Search factions">
        ${extra || ""}
      </div>
      <div id="fgroups">${groups.map(([g, list]) => `
        <div class="fgroup" data-group>
          <h2 class="fg-h">${esc(g)}</h2>
          <div class="fgrid">${list.map(f => `<a class="fcard" href="${href(f.id)}" data-fname="${esc(f.name.toLowerCase())}">
            ${factionBadge(f.id, 34)}<span><strong>${esc(f.name)}</strong><small>${f.units.filter(u => !u.t).length} datasheets</small></span></a>`).join("")}</div>
        </div>`).join("")}</div>
      <p class="source">Unit and weapon names come from the community BattleScribe data for Warhammer 40,000 11th edition (${esc(DATA.source || "BSData")}${DATA.commit ? ", " + esc(DATA.commit) : ""}). Emblem icons from <a href="https://github.com/Certseeds/wh40k-icon" target="_blank" rel="noopener">wh40k-icon</a> by shitake, farvig, 夜行漫记 and Certseeds (<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>), recoloured for this site. Paint names and colours from <a href="https://github.com/Arcturus5404/miniature-paints" target="_blank" rel="noopener">miniature-paints</a> by Rick Fleuren (MIT). Starting colours are suggestions you can change.</p>`;
    const fq = $("fq");
    fq.addEventListener("input", () => {
      const q = fq.value.trim().toLowerCase();
      app.querySelectorAll(".fcard").forEach(c => c.hidden = q && !c.dataset.fname.includes(q));
      app.querySelectorAll("[data-group]").forEach(g => g.hidden = !g.querySelector(".fcard:not([hidden])"));
    });
    fq.focus({preventScroll: true});
  }
  async function viewLiveryNew(){
    view.name = "liv-new"; document.title = "New ledger · Livery Ledger";
    factionPage({war: false, crumbs: `<a href="#/livery">Livery Ledger</a> / New ledger`, title: "Start a new ledger",
      sub: "Choose your faction. You'll pick your colours next, then add your units.", href: id => `#/livery/new/${id}`,
      extra: store.canWrite ? `<button type="button" class="btn-sm" id="b-import-army">Import a ledger backup</button><input type="file" id="f-import-army" accept="application/json,.json" hidden>` : ""});
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
  async function viewWarNew(){
    view.name = "war-new"; document.title = "New army · War Ledger";
    factionPage({war: true, crumbs: `<a href="#/war">War Ledger</a> / New army`, title: "Muster a new army",
      sub: "Choose your faction. You'll name your army next, then add your units.", href: id => `#/war/new/${id}`});
  }
  // Second step of a new army: its name and the points you're building to.
  async function viewWarNewFaction(fid){
    const f = FBY[fid];
    view.name = "war-new"; document.title = `New ${f.name} army · War Ledger`;
    app.innerHTML = `
      <div class="crumbs"><a href="#/war">War Ledger</a> / <a href="#/war/new">New army</a> / ${esc(f.name)}</div>
      <section class="page-head war-head"><div class="wh-id">${factionBadge(fid, 64)}<div><p class="eyebrow">War Ledger · ${esc(f.group || "")}</p><h1>New ${esc(f.name)} army</h1><p class="sub">Name your force. You can add units straight after.</p></div></div></section>
      <form class="panel war-newform" id="wn-form" novalidate>
        <label>Army name<input id="w-name" maxlength="80" placeholder="e.g. ${esc(f.name)} Strike Force" autocomplete="off"></label>
        <label><span>Points you're building to <span class="opt">(optional)</span></span><input id="w-lim" type="number" min="0" max="20000" step="250" inputmode="numeric" placeholder="e.g. 2000"></label>
        <p class="hint">War Ledger uses the faction's official colours behind the scenes. If you start painting, you can choose your own in Livery Ledger.</p>
        <div class="row-actions"><button type="submit" class="primary">Create army</button><a class="btn" href="#/war/new">Back</a><span class="msg" id="w-msg" role="status"></span></div>
      </form>`;
    $("w-name").focus();
    $("wn-form").addEventListener("submit", async e => {
      e.preventDefault();
      const b = e.submitter || $("wn-form").querySelector("[type=submit]"); b.disabled = true; $("w-msg").textContent = "Creating…";
      try {
        const scheme = {...P.presetFor(fid), wonly: true, limit: Math.max(0, parseInt($("w-lim").value, 10) || 0)};
        const a = await store.saveArmy({faction: fid, name: $("w-name").value.trim() || `${f.name} army`, scheme, public: false});
        location.hash = `#/war/army/${a.id}`;
      } catch(err){ console.error(err); $("w-msg").textContent = "Couldn't create the army: " + errText(err); b.disabled = false; }
    });
  }
  /* ============================================================
     Homepage: what Livery Ledger does, with log in / sign up in the hero
     ============================================================ */
  // A feature's picture: img/shots/<name>.webp when it's been added, otherwise a drawing made from the app's own parts.
  const WAR_FIELDS = ["built", "ready", "bought", "price", "shop", "assembly", "own"];
  // A unit's numbers in the War tables. data-label names each one when the table becomes cards on phones.
  const statCells = r => `<td class="n" data-label="Owned">${r.planned ? `<span title="Planned: not bought yet">–</span>` : r.owned}</td><td class="n" data-label="Built">${r.built}</td><td class="n" data-label="Painted">${r.painted}</td>
    <td class="n" data-label="Ready"><span class="rdy ${r.ready >= r.owned ? "ok" : r.ready ? "part" : "no"}">${r.ready}</span></td><td class="n" data-label="Points">${num(r.points)}</td>`;
  // Tables restyled as cards lose their table meaning in some screen readers unless every part says what it is.
  function tableRoles(root){
    root.querySelectorAll("table.cards").forEach(t => {
      t.querySelectorAll("thead,tbody,tfoot").forEach(x => x.setAttribute("role", "rowgroup"));
      t.querySelectorAll("tr").forEach(x => x.setAttribute("role", "row"));
      t.querySelectorAll("th").forEach(x => x.setAttribute("role", x.getAttribute("scope") === "row" ? "rowheader" : "columnheader"));
      t.querySelectorAll("td").forEach(x => x.setAttribute("role", "cell"));
    });
  }
  const PLANNED_TAG = `<span class="tag plan" title="Planned: not bought yet">Planned</span>`;
  const singleRole = r => ["Epic Hero","Character","Vehicle","Monster","Dedicated Transport","Fortification"].includes(r);
  /* ---------- army list import: reads pasted lists and list-builder share codes for one faction ---------- */
  function makeListReader(factionId){
    const army = {faction: factionId}, sheets = (FBY[factionId] || {}).units || [];
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
    function guessCount(sh, pts){
      if(sh.ms && sh.ms[0] === sh.ms[1]) return sh.ms[0];
      if(!sh.ms && singleRole(sh.r)) return 1;
      const br = sh.pb || [];
      const hit = br.filter(b => b[2] === pts).pop();
      // The price bracket gives the size; open-ended brackets run to the datasheet's largest size.
      if(hit) return hit[1] || (sh.ms ? sh.ms[1] : Math.max(hit[0], (hit[0] - 1) * 2));
      return sh.ms ? sh.ms[0] : br.length ? (br[0][0] === br[0][1] ? br[0][0] : Math.max(1, br[0][0] - 1)) : 1;
    }
    // Allied units (e.g. Imperial Knights in a Space Marine list) live in another faction's datasheets.
    function allySheet(text, prefer){
      const k = norm(text);
      const order = [FBY[prefer], ...FACTIONS].filter(x => x && x.id !== army.faction);
      for(const fx of order){
        const sh = (fx.units || []).find(u => !u.t && norm(u.n) === k) || (fx.units || []).find(u => norm(u.n) === k);
        if(sh) return {sheet: sh, from: fx.name};
      }
      return null;
    }

    /* List codes from list-building sites: base64 JSON like
       {"f":"black-templars","d":"","l":2000,"u":[["ancient",0,{"w":1,"o":{"wargear-weapon-option":"bolt-rifle-close-combat-weapon"}}]]}
       u = [datasheet slug, size option (0 = smallest), {w: warlord, o: chosen options}]. */
    const codeSlug = s => String(s || "").toLowerCase().replace(/[’']/g, "").replace(/armour/g, "armor").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    function decodeListCode(text){
      const raw = String(text || "").replace(/%3D/gi, "=");
      const tokens = (raw.match(/[A-Za-z0-9_\-+/]{24,}={0,2}/g) || []).sort((a, b) => b.length - a.length);
      for(const tk of tokens){
        try {
          let b64 = tk.replace(/-/g, "+").replace(/_/g, "/"); b64 += "===".slice((b64.length + 3) % 4);
          const bin = atob(b64), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
          const d = JSON.parse(new TextDecoder().decode(bytes));
          if(d && typeof d === "object" && Array.isArray(d.u)) return d;
        } catch(e){ /* not a list code */ }
      }
      return null;
    }
    // "emperor-s-shield" -> "Emperor's Shield"
    const titleCase = sl => String(sl || "").replace(/([a-z0-9])-s(?=-|$)/g, "$1's").split("-").filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
    function parseCode(text){
      const d = decodeListCode(text);
      if(!d) return null;
      const out = [], unmatched = [];
      const own = new Map(), from = FBY[d.f];
      sheets.slice().sort((a, b) => (a.t ? 1 : 0) - (b.t ? 1 : 0)).forEach(s => { const k = codeSlug(s.n); if(!own.has(k)) own.set(k, s); });
      d.u.forEach(entry => {
        if(!Array.isArray(entry) || typeof entry[0] !== "string") return;
        const [id, size, extra] = entry, ex = extra && typeof extra === "object" ? extra : {};
        let sh = own.get(codeSlug(id)), ally = null;
        if(!sh){
          for(const fx of [from, ...FACTIONS].filter(x => x && x.id !== army.faction)){
            const hit = (fx.units || []).find(u => !u.t && codeSlug(u.n) === codeSlug(id)) || (fx.units || []).find(u => codeSlug(u.n) === codeSlug(id));
            if(hit){ sh = hit; ally = fx.name; break; }
          }
        }
        if(!sh){ unmatched.push(titleCase(id)); return; }
        // Size option 0 is the base unit; 1+ step through the larger squad sizes.
        const br = sh.pb || [], k = Math.max(0, parseInt(size, 10) || 0);
        const points = k && br[k - 1] ? br[k - 1][2] : (sh.p || 0);
        const u = {sheet: sh, name: sh.n, points, count: guessCount(sh, points), melee: [], ranged: [], notes: [], include: true};
        if(ally) u.notes.push("Allied: " + ally);
        if(ex.w) u.notes.push("Warlord");
        if(typeof ex.e === "string" && ex.e) u.notes.push("Enhancement: " + titleCase(ex.e));
        // Chosen options: pull out any weapons we recognise; keep the rest as a note.
        const weapons = [...(sh.wm || []).map(n => [n, "melee"]), ...(sh.wr || []).map(n => [n, "ranged"])]
          .map(([n, kind]) => [n, kind, codeSlug(n)]).filter(w => w[2]).sort((a, b) => b[2].length - a[2].length);
        const other = [];
        Object.entries(ex.o && typeof ex.o === "object" ? ex.o : {}).forEach(([group, val]) => {
          // A choice is a slug, a list of slugs, or {slug: how many}.
          const picks = typeof val === "string" ? [val] : Array.isArray(val) ? val : val && typeof val === "object" ? Object.keys(val).filter(k => val[k]) : [];
          picks.forEach(v => pickOption(group, v));
        });
        function pickOption(group, v){
          if(typeof v !== "string") return;
          const vs = codeSlug(v).split("-").filter(x => x !== "w").join("-"); // "initiate-w-bolt-rifle": w = with
          let rest = "-" + vs + "-", hit = false;
          weapons.forEach(([n, kind, ws]) => {
            if(!rest.includes("-" + ws + "-")) return;
            rest = rest.replace("-" + ws + "-", "-"); hit = true;
            const list = kind === "melee" ? u.melee : u.ranged; if(!list.includes(n)) list.push(n);
          });
          // Skip picks that only say which model is which ("devastator-centurion", "...-sergeant").
          const g = codeSlug(group);
          if(!hit && !/sergeant$/.test(vs) && !g.startsWith(vs) && !codeSlug(sh.n).includes(vs)) other.push(titleCase(vs));
        }
        if(other.length) u.notes.push(other.join(", "));
        out.push(u);
      });
      const limit = parseInt(d.l, 10);
      return {units: out, unmatched, limit: limit >= 500 && limit <= 10000 ? limit : 0, codeFaction: from ? from.name : (d.f || ""), codeFactionId: d.f || "", detachment: typeof d.d === "string" && d.d ? titleCase(d.d) : ""};
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
          const al = !/(strike force|incursion|onslaught|combat patrol|detachment)/i.test(h[2]) && allySheet(h[2]);
          if(al){
            finish();
            cur = {sheet: al.sheet, name: al.sheet.n, points: parseInt(h[3].replace(/,/g, ""), 10) || 0, models: 0, melee: [], ranged: [], notes: ["Allied: " + al.from], include: true};
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
      return {units: out, unmatched, limit};
    }
    return {parseCode, parseList, matchSheet};
  }
  const LOGO_DROP = `<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><path d="M32 3.5 55 10.5V29c0 14.6-9.6 25.5-23 31.5C18.6 54.5 9 43.6 9 29V10.5Z" fill="#3ddc84"/><path d="M32 17.5s-9 10.4-9 17.2a9 9 0 0 0 18 0c0-6.8-9-17.2-9-17.2Z" fill="#f2f6f3" stroke="#06080a" stroke-width="3" stroke-linejoin="round"/></svg>`;
  const LOGO_SWORDS = `<svg viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><path d="M32 3.5 55 10.5V29c0 14.6-9.6 25.5-23 31.5C18.6 54.5 9 43.6 9 29V10.5Z" fill="#ec5a5f"/><g stroke-linecap="round" stroke-linejoin="round"><g stroke="#06080a"><path d="M22 17.5 38 39M42 17.5 26 39" stroke-width="7"/><path d="M33.5 42.5 42.5 35.5M30.5 42.5 21.5 35.5" stroke-width="6"/></g><path d="M22 17.5 38 39M42 17.5 26 39" stroke="#f2f6f3" stroke-width="3.4"/><path d="M33.5 42.5 42.5 35.5M30.5 42.5 21.5 35.5" stroke="#cdd5d1" stroke-width="2.6"/></g></svg>`;
  const shot = (name, alt, art) => `<figure class="shot" data-shot="${name}"><div class="shot-art" aria-hidden="true">${art}</div><img src="img/shots/${name}.webp" alt="${esc(alt)}" loading="lazy" decoding="async"></figure>`;
  const paintName = l => String(l || "").replace(/^Citadel\s+/, "").replace(/\s*\([^)]*\)\s*$/, "");
  async function viewLanding(){
    view.name = "landing";
    const war = isWar();
    document.title = war ? "War Ledger · Track your Warhammer 40,000 armies, lists and battles" : "Livery Ledger · Plan and track your Warhammer 40,000 painting";
    PROF = P.profileFor("ultramarines");
    const me = acct(), online = store.kind === "supabase";
    const nSheets = FACTIONS.reduce((n, f) => n + f.units.filter(u => !u.t).length, 0);
    const nSchemes = FACTIONS.reduce((n, f) => n + P.schemesFor(f.id).length, 0);
    const demo = P.presetFor("ultramarines"), c = demo.colors, sp = demo.slotPaints || {};
    const b = (tierColor, size, extra) => ART.badge({...c, helmet: tierColor, shape: demo.shape, ...(extra || {})}, demo.style, size, "");
    const show = ["ultramarines", "blood-angels", "necrons", "orks", "tau-empire", "death-guard", "adepta-sororitas", "tyranids", "space-wolves", "aeldari"].filter(id => FBY[id]);
    const swatch = (label, k) => `<div class="ill-row"><span class="sw" style="background:${ART.hexOk(c[k]) ? c[k] : "#777"}"></span><span>${label}</span><em>${esc(paintName(sp[k]) || cname(c[k]))}</em></div>`;
    const ICON = {
      share: '<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
      photo: '<rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="12" cy="12.5" r="3.5"/><path d="M8 5l1.5-2h5L16 5"/>',
      points: '<path d="M4 19V9"/><path d="M10 19V5"/><path d="M16 19v-7"/><path d="M22 19H2"/>',
      cart: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.2a2 2 0 0 0 2-1.5L22 8H6"/>',
      backup: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
      phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
      swap: '<path d="M4 8h13"/><path d="m14 4 4 4-4 4"/><path d="M20 16H7"/><path d="m10 12-4 4 4 4"/>',
      box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
      print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
      star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z"/>',
      layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
      list: '<path d="M9 6h12"/><path d="M9 12h12"/><path d="M9 18h12"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
      check: '<path d="M12 3 4 6v6c0 4.6 3.4 8 8 9 4.6-1 8-4.4 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
      copy: '<rect x="8" y="8" width="13" height="13" rx="2.5"/><path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8"/>',
      trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
      brush: '<path d="M14.5 4.5 19.5 9.5 11 18l-5-5Z"/><path d="M6 13c-2 0-3 1.5-3 3.5S2 20 2 20s3.5.5 5.5-1 1.5-3.5 1.5-3.5"/><path d="m17 2 5 5"/>'
    };
    const icon = k => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
    const tick = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
    const cta = me ? `<a class="btn primary lg" href="${isWar() ? "#/war" : "#/livery"}">${isWar() ? "Go to your armies" : "Go to your ledgers"}</a>` : online ? `<button type="button" class="primary lg" data-cta="up">Create your free account</button>` : `<a class="btn primary lg" href="${war ? "#/war" : "#/livery"}">${war ? "Open War Ledger" : "Start a ledger"}</a>`;

    const liveryBody = () => `
      <section class="lp-features" id="features" aria-labelledby="lp-feat-h">
        <div class="lp-head">
          <p class="eyebrow">What you get</p>
          <h2 id="lp-feat-h">Everything from sprue to display shelf</h2>
          <p class="sub">Stop keeping your recipes in your head and your progress on scraps of paper.</p>
        </div>

        <article class="lp-feat">
          <div class="lp-text">
            <p class="eyebrow">Colour schemes</p>
            <h3>Your army's colours, area by area</h3>
            <p>Pick your faction and start from its official Citadel colours, or a known scheme like a successor chapter. Then make it yours: armour, trim, lenses and cloth, each pauldron, and extra areas for weapons and details.</p>
            <ul class="lp-list"><li>${tick}Official colours for every faction</li><li>${tick}Rank colours for sergeants, veterans and heroes</li><li>${tick}Colour badges that show how each unit will look</li></ul>
          </div>
          ${shot("colours", "Choosing an army's colours in Livery Ledger", `<div class="ill ill-scheme">
            <div class="ill-badges">${demo.tiers.map(t => `<div>${b(t.color, 92)}<small>${esc(t.name)}</small></div>`).join("")}</div>
            <div class="ill-rows">${swatch("Armour", "armour")}${swatch("Trim", "trim")}${swatch("Markings", "secondary")}${swatch("Lenses", "lens")}</div>
          </div>`)}
        </article>

        <article class="lp-feat flip">
          <div class="lp-text">
            <p class="eyebrow">Unit tracker</p>
            <h3>Every unit, from built to varnished</h3>
            <p>Add units from real datasheets with their weapons, points and model count. Tick off each stage as you go and watch your army's progress climb.</p>
            <ul class="lp-list"><li>${tick}Stages from built and primed to based and varnished</li><li>${tick}Search, filter and group your units</li><li>${tick}Points total against your list's limit</li></ul>
          </div>
          ${shot("units", "A unit card with painting stages and progress", `<div class="ill ill-unit">
            <div class="ill-card">
              <div class="ill-top">${b(c.armour, 64)}<div><strong>Intercessor Squad</strong><small>Battleline · 10 models · 160 pts</small></div></div>
              <div class="ill-stages">${S.STAGES.map(([, l], i) => `<span class="${i < 3 ? "on" : i === 3 ? "now" : ""}">${esc(l)}</span>`).join("")}</div>
              <div class="ill-prog"><i style="width:40%"></i></div>
              <div class="ill-foot"><span>4 of 10 painted</span><span>40%</span></div>
            </div>
            <div class="ill-card ghost">
              <div class="ill-top">${b(c.trim, 52)}<div><strong>Captain</strong><small>Character · 80 pts</small></div></div>
              <div class="ill-prog"><i style="width:100%"></i></div>
            </div>
          </div>`)}
        </article>

        <article class="lp-feat">
          <div class="lp-text">
            <p class="eyebrow">Paints and recipes</p>
            <h3>Recipes you write once and use everywhere</h3>
            <p>Write down each step: prime, basecoat, shade, layer, highlight. Your recipes are saved to your account, so the next army can reuse them. Mark the paints you own and Livery Ledger tells you what to buy.</p>
            <ul class="lp-list"><li>${tick}Over 3,700 paints from 11 brands</li><li>${tick}Recipes shared across all your ledgers</li><li>${tick}A shopping list of paints you don't have yet</li></ul>
          </div>
          ${shot("recipes", "A step-by-step paint recipe", `<div class="ill ill-recipe">
            <div class="ill-rh"><strong>Ultramarine armour</strong><small>5 steps</small></div>
            ${[["Prime", "Chaos Black", "#0b0b0b"], ["Basecoat", "Macragge Blue", "#0f3d7c"], ["Shade", "Nuln Oil", "#1a1b1f"], ["Layer", "Calgar Blue", "#2a5aa6"], ["Edge highlight", "Fenrisian Grey", "#7d9cbc"]].map(([t, n, h], i) =>
              `<div class="ill-step"><span class="n">${i + 1}</span><span class="sw" style="background:${h}"></span><span><strong>${n}</strong><small>${t}</small></span>${i === 3 ? `<em class="buy">To buy</em>` : `<em class="own">Owned</em>`}</div>`).join("")}
          </div>`)}
        </article>

        <article class="lp-feat flip">
          <div class="lp-text">
            <p class="eyebrow">List import</p>
            <h3>Paste your army list, get your units</h3>
            <p>Bring your list over from the Warhammer 40,000 app, New Recruit, BattleScribe or a list-builder share code. Units, sizes, points and wargear come straight in, ready to paint.</p>
            <ul class="lp-list"><li>${tick}Matches units to real datasheets</li><li>${tick}Picks up allies, like Knights and Assassins</li><li>${tick}Sets your points limit for you</li></ul>
          </div>
          ${shot("import", "Importing an army list", `<div class="ill ill-import">
            <pre>Captain (80 points)
  • Warlord
Intercessor Squad (160 points)
  • 10x Intercessor
Redemptor Dreadnought (210 points)</pre>
            <div class="ill-arrow" aria-hidden="true">→</div>
            <div class="ill-rows">${[["Captain", "1", "80"], ["Intercessor Squad", "10", "160"], ["Redemptor Dreadnought", "1", "210"]].map(([n, m, pt]) => `<div class="ill-row"><span class="ck">${tick}</span><span>${n}</span><em>${m} · ${pt}\u00a0pts</em></div>`).join("")}</div>
          </div>`)}
        </article>

        <article class="lp-feat">
          <div class="lp-text">
            <p class="eyebrow">Painting history</p>
            <h3>Watch your painted pile grow, month by month</h3>
            <p>Every model you mark as painted is dated, so you can see how much you get done each month. Set a monthly goal, keep a weekly streak going and look back over the whole year.</p>
            <ul class="lp-list"><li>${tick}A monthly goal with progress as you paint</li><li>${tick}Weekly streaks and your best month</li><li>${tick}A chart of the last twelve months</li></ul>
          </div>
          ${shot("activity", "Painting activity with a monthly goal and chart", `<div class="ill ill-activity">
            <div class="ill-stats">
              <div><b>14</b><small>This month</small></div>
              <div><b>5</b><small>Week streak</small></div>
              <div><b>22</b><small>Best month</small></div>
            </div>
            <div class="ill-goal"><div class="ill-rh"><strong>Monthly goal</strong><small>14 of 20 models</small></div><div class="ill-prog"><i style="width:70%"></i></div></div>
            <div class="ill-bars">${[4, 7, 3, 10, 6, 12, 8, 15, 9, 22, 11, 14].map((v, i, a) => `<span class="${i === a.length - 1 ? "now" : ""}" style="height:${Math.round(v / 22 * 100)}%"></span>`).join("")}</div>
          </div>`)}
        </article>

        <article class="lp-feat flip">
          <div class="lp-text">
            <p class="eyebrow">Community</p>
            <h3>Share your army and see what others are painting</h3>
            <p>Share a ledger and it joins the Shared armies page, with your name and picture on it. Browse other painters' schemes for ideas, like the ones you love and follow the painters you want to keep up with.</p>
            <ul class="lp-list"><li>${tick}Read-only links anyone can open</li><li>${tick}Likes and follows</li><li>${tick}Private until you choose to share</li></ul>
          </div>
          ${shot("community", "Shared armies from other painters", `<div class="ill ill-community">
            ${[["Brother Dmitri", "BD", "Crusade of Sigismund", "Black Templars", "black-templars", 47, 12, true], ["Kaylee R", "KR", "The Silver Host", "Necrons", "necrons", 81, 31, false]].filter(x => FBY[x[4]]).map(([who, ini, name, fac, fid, pct, likes, fol]) => `<div class="ill-card ill-share">
              <div class="owner-line"><span class="avatar" aria-hidden="true">${ini}</span><span><small>Collection of</small><strong>${who}</strong></span></div>
              <div class="ill-top">${factionBadge(fid, 48)}<div><strong>${name}</strong><small>${fac}</small></div></div>
              <div class="ill-prog"><i style="width:${pct}%"></i></div>
              <div class="ill-foot"><span>${pct}% painted</span><span class="ill-soc"><em class="like">♥ ${likes}</em><em class="${fol ? "on" : ""}">${fol ? "Following" : "Follow"}</em></span></div>
            </div>`).join("")}
          </div>`)}
        </article>
      </section>

      <section class="lp-war panel" aria-labelledby="lp-war-h">
        <div class="lpw-copy">
          <p class="eyebrow">The companion: War Ledger</p>
          <h2 id="lp-war-h">Livery Ledger records the hobby. <span class="grad">War Ledger records the war.</span></h2>
          <p>Flip the switch at the top and your collection becomes a fighting force. Same account, same armies, no painting required: track what you own, build lists from it, check it's ready for the table and log how every game went.</p>
          <div class="lpw-cols">
            <div><h3>Livery Ledger · the hobby</h3><ul class="lp-list"><li>${tick}Colour schemes and recipes</li><li>${tick}Painting stages and progress</li><li>${tick}Photos of every unit</li></ul></div>
            <div><h3>War Ledger · the fighting force</h3><ul class="lp-list"><li>${tick}Your collection, points and battle readiness</li><li>${tick}Army lists that check what's ready to field</li><li>${tick}Battle reports and win–loss records</li></ul></div>
          </div>
          <div class="lp-cta-btns"><button type="button" class="primary" data-lp-mode="war">See War Ledger</button>${me || !online ? `<a class="btn" href="#/war">Open War Ledger</a>` : ""}</div>
        </div>
        <div class="lpw-art" aria-hidden="true">
          <div class="ill-stats">
            <div><b>247</b><small>Models</small></div>
            <div><b>4,850</b><small>Points</small></div>
            <div class="rdy-tile"><b>66%</b><small>Battle ready</small></div>
          </div>
          <div class="ill-card lpw-list">
            <div class="ill-rh"><strong>Club night · 2,000 pts</strong><small>List</small></div>
            <div class="ill-prog"><i style="width:86%"></i></div>
            <p class="lpw-verdict">Nearly ready: 86% battle ready</p>
            <div class="ill-row"><span>Redemptor Dreadnought</span><em>Unpainted</em></div>
            <div class="ill-row"><span>4× Intercessors</span><em>Unpainted</em></div>
          </div>
          <div class="lpw-games"><span class="r-w">W</span><span class="r-w">W</span><span class="r-l">L</span><span class="r-w">W</span><span class="r-d">D</span><em>17 games · 10–6–1</em></div>
        </div>
      </section>

      <section class="lp-grid" aria-labelledby="lp-more-h">
        <h2 id="lp-more-h" class="lp-grid-h">And the little things that help</h2>
        <div class="lp-cards">
          ${[["box", "Pile of shame", "Log the kits you've bought but haven't started, what they cost and how long they've waited."],
             ["swap", "Paint swaps", "Out of a paint? Find the closest match from the other ten brands."],
             ["photo", "Photo gallery", "Up to twelve photos per unit, from bare plastic to finished."],
             ["print", "Printable guide", "Print your army's colours, recipes and paint list to keep by the brushes."],
             ["cart", "Shopping list", "Every paint your recipes need that you don't own yet, ready to copy."],
             ["list", "Your roster", "Every unit you own, across all your ledgers, in one list."],
             ["star", "Starred units", "Star the units you're painting next and find them in a tap."],
             ["layers", "Batch updates", "Pick several units and set their stage, mark them painted or star them in one go."],
             ["points", "Points at a glance", "See your army's total against the limit you're building to."],
             ["share", "Share a link", "Send a read-only link so friends can see your colours and progress."],
             ["backup", "Backups", "Download a ledger any time, and bring it back whenever you like."],
             ["phone", "Install it like an app", "Add it to your home screen and it opens full screen, right beside the brushes."]]
            .map(([k, h, t]) => `<div class="panel lp-mini"><span class="lp-ico">${icon(k)}</span><h3>${h}</h3><p>${t}</p></div>`).join("")}
        </div>
      </section>

      <section class="lp-steps" aria-labelledby="lp-steps-h">
        <div class="lp-head"><p class="eyebrow">How it works</p><h2 id="lp-steps-h">From idea to painted army in three steps</h2></div>
        <ol>
          <li><span class="n">1</span><h3>Pick your faction</h3><p>Choose from ${FACTIONS.length} factions and Space Marine chapters.</p></li>
          <li><span class="n">2</span><h3>Set your colours</h3><p>Start from the official scheme, then change anything you like.</p></li>
          <li><span class="n">3</span><h3>Paint and track</h3><p>Add your units, follow your recipes and tick off each stage.</p></li>
        </ol>
      </section>

      <section class="lp-faq" aria-labelledby="lp-faq-h">
        <div class="lp-head"><p class="eyebrow">Questions</p><h2 id="lp-faq-h">Good to know</h2></div>
        <div class="lp-faq-list">
          ${[["Is it free?", "Yes. Every feature is free to use."],
             online ? ["Do I need an account?", "A free account keeps your ledgers, recipes and photos safe online, so they follow you from your phone to your computer. Sign up with just an email and password."]
                    : ["Do I need an account?", "Not on this copy. Everything is saved in this browser, so use Backups now and then to keep a copy somewhere safe."],
             ["Can other people see my ledgers?", "Only if you share them. Ledgers are private until you press Share, and you can stop sharing at any time."],
             ["Which paints are included?", "Over 3,700 paints from Citadel, Army Painter, Vallejo, Scale75, AK Interactive, Pro Acryl, Reaper, P3, Green Stuff World, Two Thin Coats and Turbo Dork. You can also use any colour of your own."],
             ["Where do the units come from?", `Unit names, weapons and points come from the community BattleScribe data for 11th edition, covering ${num(nSheets)} datasheets across ${FACTIONS.length} factions and chapters.`],
             ["Is this made by Games Workshop?", "No. Livery Ledger is an unofficial fan tool and isn't endorsed by Games Workshop."]]
            .map(([q, a]) => `<details class="lp-q"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
        </div>
      </section>

      <section class="lp-cta panel">
        <div><h2>Your army deserves a plan</h2><p class="sub">Free, and ready in under a minute.</p></div>
        <div class="lp-cta-btns">${me ? `<a class="btn lg" href="#/shared">Browse shared armies</a>` : ""}${cta}</div>
      </section>
    `;
    // The War Ledger homepage: the same shell, with War Ledger's own features.
    const warBody = () => `
      <section class="lp-features" id="features" aria-labelledby="lp-feat-h">
        <div class="lp-head">
          <p class="eyebrow">What you get</p>
          <h2 id="lp-feat-h">Your command centre, from sprue to tabletop</h2>
          <p class="sub">Know what you own, what you can field and how every game went.</p>
        </div>

        <article class="lp-feat">
          <div class="lp-text">
            <p class="eyebrow">Your collection</p>
            <h3>Everything you own, and what's ready to fight</h3>
            <p>Add the units you own, or paste an army list to add them all at once. War Ledger counts every model from the sprue to battle ready, so you always know where your collection stands.</p>
            <ul class="lp-list"><li>${tick}Owned, built, painted and battle ready for every unit</li><li>${tick}You decide what battle ready means</li><li>${tick}Points and models across all your armies</li></ul>
          </div>
          ${shot("war-collection", "War Ledger's collection status", `<div class="ill ill-wcoll">
            <div class="ill-stats"><div><b>247</b><small>Models</small></div><div><b>4,850</b><small>Points</small></div><div class="rdy-tile"><b>66%</b><small>Battle ready</small></div></div>
            <div class="ill-card">
              <div class="ill-stack">${[["sprue", 42], ["built", 41], ["primed", 27], ["painting", 36], ["painted", 38], ["ready", 63]].map(([k, v]) => `<i class="b-${k}" style="flex:${v}"></i>`).join("")}</div>
              <ul class="ill-key">${[["sprue", "On sprue", 42], ["built", "Built", 41], ["primed", "Primed", 27], ["painting", "Painting", 36], ["painted", "Painted", 38], ["ready", "Battle ready", 63]].map(([k, l, v]) => `<li><span class="sw b-${k}"></span><b>${v}</b><small>${l}</small></li>`).join("")}</ul>
            </div>
          </div>`)}
        </article>

        <article class="lp-feat flip">
          <div class="lp-text">
            <p class="eyebrow">Army command</p>
            <h3>Every army at a glance</h3>
            <p>Each army gets its own command page: points, models, readiness, games played and its win–loss record, with its force broken down by role and a table of every unit.</p>
            <ul class="lp-list"><li>${tick}Force composition by role</li><li>${tick}Owned, built, painted and ready for each unit</li><li>${tick}One tap to see what isn't battle ready</li></ul>
          </div>
          ${shot("war-army", "An army's current force in War Ledger", `<div class="ill ill-wforce">
            <div class="ill-card">
              <div class="ill-top">${b(c.armour, 56)}<div><strong>Ultramarines 2nd Company</strong><small>1,980 pts · 34 models · 10–7 record</small></div></div>
              <div class="ill-force">${[["Captain", "Character", 1, 1, "ok"], ["Intercessor Squad", "Battleline", 10, 6, "part"], ["Terminator Squad", "Infantry", 5, 5, "ok"], ["Redemptor Dreadnought", "Vehicle", 1, 0, "no"]].map(([n, r, o, rd, k]) => `<div class="ill-row"><span>${n}<small>${r}</small></span><em>${o} owned</em><span class="rdy ${k}">${rd}</span></div>`).join("")}</div>
            </div>
          </div>`)}
        </article>

        <article class="lp-feat">
          <div class="lp-text">
            <p class="eyebrow">Army lists</p>
            <h3>Can I take this army to the table?</h3>
            <p>Build as many lists as you like from the same collection. Each one is checked against what you own, so you can see what's ready, what still needs paint and what you haven't bought yet.</p>
            <ul class="lp-list"><li>${tick}Paste a list from the app, New Recruit or BattleScribe</li><li>${tick}Points against the limit as you build</li><li>${tick}Copy any list as text to send to your opponent</li></ul>
          </div>
          ${shot("war-list", "An army list's readiness check", `<div class="ill ill-wlist">
            <div class="ill-card lpw-list">
              <div class="ill-rh"><strong>Club night · 2,000 pts</strong><small>1,990 / 2,000</small></div>
              <div class="ill-prog"><i style="width:86%"></i></div>
              <p class="lpw-verdict">Nearly ready: 86% battle ready</p>
              <div class="ill-row"><span>Redemptor Dreadnought</span><em>Needs paint</em></div>
              <div class="ill-row"><span>4× Intercessors</span><em>Needs paint</em></div>
              <div class="ill-row miss"><span>Gladiator Lancer</span><em>Not owned</em></div>
            </div>
          </div>`)}
        </article>

        <article class="lp-feat flip">
          <div class="lp-text">
            <p class="eyebrow">Battle reports</p>
            <h3>Every game, every result</h3>
            <p>Log each game with the list you took, who you faced, the mission, the score and your most valuable unit. See how each army and list performs, and against which factions.</p>
            <ul class="lp-list"><li>${tick}A win–loss record for every army and list</li><li>${tick}Results by opponent faction</li><li>${tick}Your record shown when you share an army</li></ul>
          </div>
          ${shot("war-battles", "Battle reports and records", `<div class="ill ill-wbattles">
            <div class="ill-stats"><div><b>17</b><small>Games</small></div><div><b>10–7</b><small>Record</small></div><div class="rdy-tile"><b>59%</b><small>Won</small></div></div>
            <div class="ill-games">${[["w", "vs Necrons", "Take and Hold", "85–62"], ["l", "vs Orks", "Purge the Foe", "40–70"], ["w", "vs T'au Empire", "Supply Drop", "78–55"]].map(([r, o, m, s]) => `<div class="ill-row"><span class="res r-${r}">${r.toUpperCase()}</span><span>${o}<small>${m}</small></span><em>${s}</em></div>`).join("")}</div>
            <div class="lpw-games"><span class="r-w">W</span><span class="r-w">W</span><span class="r-l">L</span><span class="r-w">W</span><span class="r-d">D</span><em>Recent form</em></div>
          </div>`)}
        </article>
      </section>

      <section class="lp-war lp-liv panel" aria-labelledby="lp-liv-h">
        <div class="lpw-copy">
          <p class="eyebrow">The companion: Livery Ledger</p>
          <h2 id="lp-liv-h">War Ledger records the war. <span class="grad">Livery Ledger records the hobby.</span></h2>
          <p>Painting your army too? Switch to Livery Ledger to plan colour schemes, write paint recipes and track every unit from bare plastic to finished. It's the same collection, so every model you paint counts towards battle readiness here.</p>
          <div class="lpw-cols">
            <div><h3>War Ledger · the fighting force</h3><ul class="lp-list"><li>${tick}Collection, points and battle readiness</li><li>${tick}Army lists checked against what you own</li><li>${tick}Battle reports and win–loss records</li></ul></div>
            <div><h3>Livery Ledger · the hobby</h3><ul class="lp-list"><li>${tick}Colour schemes and paint recipes</li><li>${tick}Painting stages and progress</li><li>${tick}Photos of every unit</li></ul></div>
          </div>
          <div class="lp-cta-btns"><button type="button" class="primary" data-lp-mode="livery">See Livery Ledger</button>${me || !online ? `<a class="btn" href="#/livery">Open Livery Ledger</a>` : ""}</div>
        </div>
        <div class="lpw-art" aria-hidden="true">
          <div class="ill-card"><div class="ill-badges">${demo.tiers.map(t => `<div>${b(t.color, 72)}<small>${esc(t.name)}</small></div>`).join("")}</div></div>
          <div class="ill-rows">${swatch("Armour", "armour")}${swatch("Trim", "trim")}${swatch("Lenses", "lens")}</div>
        </div>
      </section>

      <section class="lp-grid" aria-labelledby="lp-more-h">
        <h2 id="lp-more-h" class="lp-grid-h">And the little things that help</h2>
        <div class="lp-cards">
          ${[["check", "Battle ready, your way", "Decide whether ready means painted, based or simply built, and set any unit by hand."],
             ["box", "Pile of shame", "Kits still on the sprue count towards your collection until you start them."],
             ["cart", "Purchase records", "Keep the date, price and shop for every unit you buy."],
             ["layers", "Wargear and assembly", "Note each unit's loadout and how it's built, magnets and all."],
             ["list", "Your whole collection", "Every unit across every army in one list, with a not-battle-ready filter."],
             ["copy", "Copy a list", "Copy any list as text to send to an opponent or tournament organiser."],
             ["swap", "Duplicate lists", "Try a variation of a list without touching the original."],
             ["trophy", "Records by opponent", "See how you fare against each faction you face."],
             ["share", "Shared armies", "Share an army and its win–loss record shows alongside it."],
             ["brush", "Works with Livery Ledger", "Paint in Livery Ledger and battle readiness updates by itself."],
             ["backup", "Backups", "Download an army any time, and bring it back whenever you like."],
             ["phone", "Install it like an app", "Add it to your home screen and have it ready on game night."]]
            .map(([k, h, t]) => `<div class="panel lp-mini"><span class="lp-ico">${icon(k)}</span><h3>${h}</h3><p>${t}</p></div>`).join("")}
        </div>
      </section>

      <section class="lp-steps" aria-labelledby="lp-steps-h">
        <div class="lp-head"><p class="eyebrow">How it works</p><h2 id="lp-steps-h">From collection to battlefield in three steps</h2></div>
        <ol>
          <li><span class="n">1</span><h3>Muster your army</h3><p>Pick your faction, then add your units or paste an army list.</p></li>
          <li><span class="n">2</span><h3>Build your lists</h3><p>Make lists from your collection and check they're ready for the table.</p></li>
          <li><span class="n">3</span><h3>Play and log</h3><p>Record each game and watch every army's record grow.</p></li>
        </ol>
      </section>

      <section class="lp-faq" aria-labelledby="lp-faq-h">
        <div class="lp-head"><p class="eyebrow">Questions</p><h2 id="lp-faq-h">Good to know</h2></div>
        <div class="lp-faq-list">
          ${[["Is it free?", "Yes. Every feature is free to use."],
             ["Do I need to paint my models?", "No. War Ledger works without choosing colours or tracking painting. If you do paint, Livery Ledger shares the same armies and keeps battle readiness up to date."],
             ["What counts as battle ready?", "You decide in Settings: painted (the default), painted and based, or simply built. You can also set any unit by hand."],
             online ? ["Do I need an account?", "A free account keeps your armies, lists and battles safe online, so they follow you from your phone to your computer. Sign up with just an email and password."]
                    : ["Do I need an account?", "Not on this copy. Everything is saved in this browser, so use Backups now and then to keep a copy somewhere safe."],
             ["Can other people see my lists and battles?", "No. Army lists and battle reports are private. If you share an army, only its win–loss record is shown with it."],
             ["Which army lists can I paste?", `Lists from the Warhammer 40,000 app, New Recruit and BattleScribe, and list-builder share codes. Units are matched to ${num(nSheets)} datasheets across ${FACTIONS.length} factions and chapters.`],
             ["Is this made by Games Workshop?", "No. War Ledger and Livery Ledger are an unofficial fan tool and aren't endorsed by Games Workshop."]]
            .map(([q, a]) => `<details class="lp-q"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
        </div>
      </section>

      <section class="lp-cta panel">
        <div><h2>Take command of your collection</h2><p class="sub">Free, and ready in under a minute.</p></div>
        <div class="lp-cta-btns">${me ? `<a class="btn lg" href="#/shared">Browse shared armies</a>` : ""}${cta}</div>
      </section>
    `;

    app.innerHTML = `
      <section class="lp-hero">
        <div class="lp-copy">
          <div class="lp-switch" role="group" aria-label="Show the homepage for">
            <button type="button" data-lp-mode="livery" aria-pressed="${!war}"><span class="lps-ico">${LOGO_DROP}</span><span><strong>Livery Ledger</strong><small>Paint your army</small></span></button>
            <button type="button" data-lp-mode="war" aria-pressed="${war}"><span class="lps-ico">${LOGO_SWORDS}</span><span><strong>War Ledger</strong><small>Command your army</small></span></button>
          </div>
          ${war ? `<p class="eyebrow">For Warhammer 40,000 players</p>
          <h1>Know what you own. <span class="grad">Field what's ready.</span></h1>
          <p class="lead">War Ledger keeps track of what you own, what you can field and how every game went. Build army lists from your collection, see what's battle ready, and keep a win–loss record for every army.</p>
          <ul class="lp-ticks">
            <li>${tick}Free to use</li><li>${tick}Import your army list</li><li>${tick}No painting required</li>
          </ul>` : `<p class="eyebrow">For Warhammer 40,000 painters</p>
          <h1>Plan every army you paint. <span class="grad">Track every brushstroke.</span></h1>
          <p class="lead">Livery Ledger keeps your colour scheme, paint recipes and painting progress for every unit in one place. It covers all ${FACTIONS.length} factions and chapters, with official Citadel colours ready to go.</p>
          <ul class="lp-ticks">
            <li>${tick}Free to use</li><li>${tick}Import your army list</li><li>${tick}Works on your phone</li>
          </ul>`}
          <div class="lp-parade" aria-hidden="true">${show.map(id => `<span title="${esc(FBY[id].name)}">${factionBadge(id, 46)}</span>`).join("")}</div>
        </div>
        <div class="lp-side">
          ${me ? `<div class="panel lp-card lp-welcome">
              ${avatarHtml(me, "xl")}
              <h2>Welcome back, ${esc(me.name)}</h2>
              <p class="sub">Your ledgers are waiting.</p>
              <a class="btn primary" href="${isWar() ? "#/war" : "#/livery"}">${isWar() ? "Go to your armies" : "Go to your ledgers"}</a>
            </div>`
          : online ? `<div class="panel lp-card auth" id="lp-auth"></div>`
          : `<div class="panel lp-card lp-welcome">
              <h2>${war ? "Take command" : "Start painting smarter"}</h2>
              <p class="sub">This copy saves everything in your browser, with no account needed.</p>
              <a class="btn primary" href="${war ? "#/war" : "#/livery"}">${war ? "Open War Ledger" : "Open your ledgers"}</a>
            </div>`}
        </div>
      </section>

      <section class="lp-numbers" aria-label="${war ? "War" : "Livery"} Ledger in numbers">
        <div><b>${FACTIONS.length}</b><span>Factions and chapters</span></div>
        <div><b>${num(nSheets)}</b><span>Datasheets${war ? " with points" : ", 11th edition"}</span></div>
        ${war ? `<div><b>4</b><span>List formats you can paste</span></div>
        <div><b>0</b><span>Brushes required</span></div>` : `<div><b>${num(nSchemes)}</b><span>Official and known colour schemes</span></div>
        <div><b>3,700+</b><span>Paints from 11 brands</span></div>`}
      </section>

      ${war ? warBody() : liveryBody()}
    `;
    app.querySelectorAll(".shot img").forEach(img => {
      const ok = () => img.closest(".shot").classList.add("has-img");
      if(img.complete && img.naturalWidth) ok(); else img.addEventListener("load", ok);
      img.addEventListener("error", () => img.remove());
    });
    let heroAuth = null;
    if($("lp-auth")) heroAuth = authForm($("lp-auth"), "in", {onDone: () => { location.hash = isWar() ? "#/war" : "#/livery"; }});
    // Switch the homepage between Livery Ledger and War Ledger without leaving it.
    app.querySelectorAll("[data-lp-mode]").forEach(btn => btn.addEventListener("click", async () => {
      const to = btn.dataset.lpMode, inHero = !!btn.closest(".lp-switch");
      if((to === "war") === isWar()) return;
      const y = window.scrollY;
      setMode(to); setTop(); await viewLanding();
      if(inHero){ window.scrollTo(0, y); const b = app.querySelector(`.lp-switch [data-lp-mode="${to}"]`); if(b) b.focus(); }
      else { window.scrollTo(0, 0); const b = app.querySelector(`.lp-switch [data-lp-mode="${to}"]`); if(b) b.focus({preventScroll: true}); }
    }));
    app.querySelectorAll("[data-cta]").forEach(btn => btn.addEventListener("click", () => {
      if(!heroAuth){ openAuth(btn.dataset.cta); return; }
      heroAuth.set(btn.dataset.cta);
      $("lp-auth").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center"});
      setTimeout(() => heroAuth.focus(), 350);
    }));
  }
  /* ============================================================
     Painting guide: one printable page with an army's colours, ranks, recipes, units and paints
     ============================================================ */
  async function viewGuide(armyId){
    view.name = "guide";
    const army = await store.getArmy(armyId);
    if(!army){ location.hash = "#/livery"; return; }
    const f = FBY[army.faction] || {name: army.faction};
    PROF = P.profileFor(army.faction);
    const scheme = army.scheme; fillSkin(scheme, army.faction);
    document.title = `${army.name} painting guide · Livery Ledger`;
    app.innerHTML = `<p class="loading">Building your painting guide…</p>`;
    const [units] = await Promise.all([store.listUnits(army.id), PU.load()]);
    const mine = store.canWrite && (!army.owner || !store.session || army.owner === store.session.user.id);
    let owned = new Set();
    if(mine){ try { owned = new Set((await store.getPaints()).map(PU.norm)); } catch(e){} }
    const c = scheme.colors, sp = scheme.slotPaints || {};
    const paints = new Map();   // label -> {label, hex}
    const note = (label, hex) => { if(label && !paints.has(PU.norm(label))){ const p = PU.find(label); paints.set(PU.norm(label), {label, hex: p ? p.hex : hex || ""}); } };
    const paintCell = (hex, label) => {
      note(label, hex);
      const d = PU.describe(label), p = label && PU.find(label);
      const sw = (p && p.hex) || (ART.hexOk(hex) ? hex : "");
      return `<span class="g-sw" style="${sw ? "background:" + sw : ""}"></span><span class="g-pn">${label ? esc(d.name) : esc(cname(hex))}${d.meta ? `<small>${esc(d.meta)}</small>` : ""}</span>`;
    };
    const keys = PROF.keys.filter(k => ART.hexOk(c[k]) && (!PAULDRONS.includes(k) || (scheme.splitPauldrons && PROF.pauldrons)) && (k !== "skin" || PROF.skinAlways || units.some(u => headOf(u) === "bare")));
    const XA = P.extrasFor(army.faction), xaAll = XA.details.concat(XA.weapons);
    const xa = Object.entries(scheme.xareas || {}).map(([id, v]) => ({label: (xaAll.find(a => a.id === id) || {label: id.slice(2)}).label, ...v}));
    const recipes = scheme.recipes || [];
    const tierOf = u => scheme.tiers[u.tier] || scheme.tiers[0] || {};
    const sorted = units.slice().sort((a, b) => (b.tier - a.tier) || String(a.name).localeCompare(String(b.name)));
    // Colours a unit paints differently from the army's scheme.
    const SLOT_ORDER = ["lens", "skin", "armour", "secondary", "trim", "emblem", "cloth", "metal", ...PAULDRONS];
    const ownColours = u => SLOT_ORDER.filter(k => ART.hexOk(u[k]) && k !== "helmet" && ART.hexOk(c[k]) && u[k].toLowerCase() !== c[k].toLowerCase())
      .map(k => { const lbl = (u.slotPaints || {})[k]; note(lbl, u[k]); return `${esc(PROF.labels[k] || k)}: ${esc(lbl ? PU.shortName(lbl) : cname(u[k]))}`; });
    const models = units.reduce((n, u) => n + (+u.count || 0), 0), done = units.reduce((n, u) => n + Math.min(+u.count || 0, +u.painted || 0), 0);
    const today = new Date().toLocaleDateString("en-GB", {day: "numeric", month: "long", year: "numeric"});
    const body = `
      <div class="guide-actions">
        <a class="btn btn-sm" href="#/army/${esc(army.id)}">← Back to the ledger</a>
        <button type="button" class="primary btn-sm" id="g-print">Print or save as PDF</button>
      </div>
      <article class="guide">
        <header class="g-head">
          <div class="g-badges">${scheme.tiers.slice(0, 4).map(t => tierBadge(scheme, t, 64)).join("")}</div>
          <div>
            <p class="eyebrow">Painting guide</p>
            <h1>${esc(army.name)}</h1>
            <p class="g-meta">${esc(f.name)} · ${plural(units.length, "unit")} · ${done}/${models} models painted${scheme.by ? ` · by ${esc(scheme.by)}` : ""} · ${esc(today)}</p>
          </div>
        </header>

        <section class="g-sec">
          <h2>Colour scheme</h2>
          <table class="g-table"><tbody>
            ${keys.map(k => `<tr><th>${esc(PROF.labels[k] || k)}</th><td>${paintCell(c[k], sp[k])}</td></tr>`).join("")}
            ${xa.map(a => `<tr><th>${esc(a.label)}</th><td>${paintCell(a.hex, a.paint)}</td></tr>`).join("")}
          </tbody></table>
        </section>

        <section class="g-sec">
          <h2>Ranks <small>${esc(PROF.head)} colour</small></h2>
          <table class="g-table"><tbody>
            ${scheme.tiers.map(t => `<tr><th>${esc(t.name)}${t.note ? `<small>${esc(t.note)}</small>` : ""}</th><td>${paintCell(t.color, t.paint)}</td></tr>`).join("")}
          </tbody></table>
        </section>

        ${recipes.length ? `<section class="g-sec g-recipes">
          <h2>Recipes</h2>
          ${recipes.map(r => `<div class="g-recipe">
            <h3>${esc(r.name)}${r.area ? ` <small>${esc(r.area)}</small>` : ""}</h3>
            <ol>${r.steps.map(st => `<li><span class="g-tech">${esc(st.t || "Step")}</span>${st.p ? paintCell("", st.p) : "<span></span><span></span>"}</li>`).join("")}</ol>
            ${r.notes ? `<p class="g-note">${esc(r.notes)}</p>` : ""}
          </div>`).join("")}
        </section>` : ""}

        ${sorted.length ? `<section class="g-sec">
          <h2>Units</h2>
          <div class="g-scroll"><table class="g-table g-units">
            <thead><tr><th>Unit</th><th>Models</th><th>Rank</th><th>Progress</th><th>Painted differently</th></tr></thead>
            <tbody>${sorted.map(u => {
              const rs = (u.recipes || []).map(id => recipes.find(r => r.id === id)).filter(Boolean).map(r => r.name);
              const own = ownColours(u);
              return `<tr><td><strong>${esc(u.name)}</strong>${u.datasheet && u.datasheet !== u.name ? `<small>${esc(u.datasheet)}</small>` : ""}${rs.length ? `<small>Recipes: ${esc(rs.join(", "))}</small>` : ""}</td>
                <td>${u.count}</td><td>${esc(tierOf(u).name || "")}</td>
                <td>${u.painted}/${u.count}${u.status === "done" ? " ✓" : ""}</td>
                <td>${own.length ? own.join("<br>") : "—"}</td></tr>`;
            }).join("")}</tbody>
          </table></div>
        </section>` : ""}

        <section class="g-sec">
          <h2>Paints for this army <small>${paints.size} paints</small></h2>
          <ul class="g-paints">${[...paints.values()].sort((a, b) => a.label.localeCompare(b.label)).map(p => {
            const d = PU.describe(p.label), have = owned.has(PU.norm(p.label));
            return `<li class="${have ? "have" : ""}"><span class="g-box" aria-hidden="true">${have ? "✓" : ""}</span><span class="g-sw" style="${p.hex ? "background:" + p.hex : ""}"></span><span class="g-pn">${esc(d.name)}${d.meta ? `<small>${esc(d.meta)}</small>` : ""}${!have && PU.swapsText(p.label) ? `<small class="swaps">${esc(PU.swapsText(p.label))}</small>` : ""}</span></li>`;
          }).join("")}</ul>
          ${mine ? `<p class="g-note">Ticked paints are ones you've marked as owned.</p>` : ""}
        </section>
        <footer class="g-foot">Made with Livery Ledger · ${esc(location.host || "liveryledger.co.za")}</footer>
      </article>`;
    app.innerHTML = body;
    $("g-print").addEventListener("click", () => window.print());
  }

  /* ============================================================
     Shared armies: every ledger someone has chosen to share
     ============================================================ */
  async function viewShared(){
    view.name = "shared";
    document.title = "Shared armies · Livery Ledger";
    const mine = store.session ? store.session.user.id : null;
    app.innerHTML = `
      <section class="page-head">
        <p class="eyebrow">Community</p>
        <h1>Shared armies</h1>
        <p class="sub">Ledgers other painters have chosen to share. Open one to see their colours, units and progress. To share one of yours, open the ledger and press <strong>Share</strong>.</p>
      </section>
      <div class="sh-tools">
        <input type="search" id="sh-q" placeholder="Search armies, factions or painters" aria-label="Search shared armies">
        <select id="sh-f" aria-label="Faction"><option value="">All factions</option></select>
        <div class="filters" id="sh-show" role="group" aria-label="Show">
          <button type="button" data-show="all" aria-pressed="true">All</button>
          <button type="button" data-show="following" aria-pressed="false" hidden>Following</button>
          <button type="button" data-show="mine" aria-pressed="false">Mine</button>
        </div>
        <label class="inline sh-sort">Sort<select id="sh-sort"><option value="recent">Recently updated</option><option value="liked" hidden>Most liked</option></select></label>
        <span class="sh-count" id="sh-count" aria-live="polite"></span>
      </div>
      <div id="sh-list"><p class="loading">Loading shared armies…</p></div>`;
    if(!store.canShare){ $("sh-list").innerHTML = `<div class="ro-empty"><strong>Sharing needs the online database</strong><p>This copy saves ledgers in your browser only, so there's nothing shared to show.</p></div>`; return; }
    let data;
    try { data = await store.listShared(); }
    catch(err){ console.error(err); if($("sh-list")) $("sh-list").innerHTML = `<div class="banner"><span class="dot warn"></span>Couldn't load shared armies: ${esc(errText(err))}</div>`; return; }
    if(!$("sh-list")) return;   // left the page while loading
    const {armies, sum} = data;
    let social = null, show = "all";
    try { social = await store.communityState(armies.map(a => a.id)); } catch(err){ console.warn("Likes and follows unavailable", err); }
    if(!social) console.info("Likes and follows need the one-time setup in supabase/features.sql.");
    if(social){ $("sh-show").querySelector('[data-show="following"]').hidden = false; $("sh-sort").querySelector('[value="liked"]').hidden = false; }
    const present = [...new Set(armies.map(a => a.faction))].filter(id => FBY[id]).sort((a, b) => FBY[a].name.localeCompare(FBY[b].name));
    $("sh-f").insertAdjacentHTML("beforeend", present.map(id => `<option value="${esc(id)}">${esc(FBY[id].name)}</option>`).join(""));
    const keep = PROF;
    function draw(){
      const q = $("sh-q").value.trim().toLowerCase(), fid = $("sh-f").value;
      const likesOf = a => (social && social.likes[a.id]) || 0;
      const list = armies.filter(a => (!fid || a.faction === fid) && (show !== "mine" || a.owner === mine) && (show !== "following" || (social && social.following.has(a.owner)))
        && (!q || [a.name, (FBY[a.faction] || {}).name, a.scheme.by].join(" ").toLowerCase().includes(q)));
      if($("sh-sort").value === "liked") list.sort((a, b) => likesOf(b) - likesOf(a) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
      $("sh-count").textContent = armies.length ? (list.length === armies.length ? `${armies.length} ${armies.length === 1 ? "army" : "armies"}` : `${list.length} of ${armies.length}`) : "";
      if(!armies.length){ $("sh-list").innerHTML = `<div class="ro-empty"><strong>No shared armies yet</strong><p>Be the first: open one of your ledgers and press Share.</p></div>`; return; }
      if(!list.length){ $("sh-list").innerHTML = `<p class="hint">${show === "following" && !q && !fid ? "You're not following anyone yet, or they haven't shared anything. Follow a painter from one of their armies." : "No shared armies match. Try a different search or faction."}</p>`; return; }
      $("sh-list").innerHTML = `<h2 class="sr-only">Armies</h2><div class="ledgers">${list.map(a => {
        const s = sum[a.id] || {units: 0, models: 0, done: 0}, f = FBY[a.faction];
        const pct = s.models ? Math.round(s.done / s.models * 100) : 0;
        PROF = P.profileFor(a.faction);
        const liked = social && social.liked.has(a.id), n = likesOf(a), follows = social && social.following.has(a.owner);
        return `<div class="lcard shcard">
          <a class="sh-open" href="#/army/${esc(a.id)}">
            ${ownerLine(a)}
            <div class="card-top">${tierBadge(a.scheme, a.scheme.tiers[0], 56)}<div><h3>${esc(a.name)}</h3><div class="meta">${esc(f ? f.name : a.faction)}${(a.scheme.rec.w + a.scheme.rec.l + a.scheme.rec.d) ? ` · <span class="rec-chip" title="Battle record: wins–losses${a.scheme.rec.d ? "–draws" : ""}">${recText(a.scheme.rec)}</span>` : ""}</div></div></div>
            <div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div>
            <div class="foot"><span>${plural(s.units, "unit")} · ${plural(s.models, "model")}</span><span>${pct}% painted</span></div>
          </a>
          ${social ? `<div class="sh-actions">
            <button type="button" class="btn-sm like${liked ? " on" : ""}" data-like="${esc(a.id)}" aria-pressed="${!!liked}" aria-label="${liked ? "Unlike" : "Like"} ${esc(a.name)}${n ? `, ${plural(n, "like")}` : ""}">${HEART(liked)}<span>${n || ""}</span></button>
            ${a.owner !== mine ? `<button type="button" class="btn-sm follow${follows ? " on" : ""}" data-follow="${esc(a.owner)}" aria-pressed="${!!follows}">${follows ? "Following" : "Follow"}${a.scheme.by ? ` ${esc(a.scheme.by)}` : " painter"}</button>` : ""}
          </div>` : ""}
        </div>`;
      }).join("")}</div>`;
      PROF = keep;
    }
    $("sh-q").addEventListener("input", draw);
    $("sh-f").addEventListener("change", draw);
    $("sh-sort").addEventListener("change", draw);
    $("sh-show").addEventListener("click", e => {
      const b = e.target.closest("[data-show]"); if(!b) return;
      show = b.dataset.show; $("sh-show").querySelectorAll("[data-show]").forEach(x => x.setAttribute("aria-pressed", x === b)); draw();
    });
    $("sh-list").addEventListener("click", async e => {
      const lk = e.target.closest("[data-like]"), fo = e.target.closest("[data-follow]");
      if(!social || (!lk && !fo)) return;
      const btn = lk || fo; btn.disabled = true;
      try {
        if(lk){
          const id = lk.dataset.like, on = !social.liked.has(id);
          await store.setLike(id, on);
          if(on){ social.liked.add(id); social.likes[id] = (social.likes[id] || 0) + 1; } else { social.liked.delete(id); social.likes[id] = Math.max(0, (social.likes[id] || 1) - 1); }
        } else {
          const uid = fo.dataset.follow, on = !social.following.has(uid);
          await store.setFollow(uid, on);
          if(on) social.following.add(uid); else social.following.delete(uid);
        }
        draw();
      } catch(err){ btn.disabled = false; alertBanner("Couldn't save that: " + errText(err)); }
    });
    draw();
  }

  /* ============================================================
     Pile of shame: kits bought but not started yet
     ============================================================ */
  const SHAME_KEY = "ll-shame";
  const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function cleanShame(list){
    return (Array.isArray(list) ? list : []).filter(k => k && k.name).slice(0, 200).map(k => ({
      id: String(k.id || S.newId()).slice(0, 40), name: String(k.name).replace(/\s+/g, " ").trim().slice(0, 80),
      faction: FBY[k.faction] ? k.faction : "", models: Math.min(999, Math.max(1, parseInt(k.models, 10) || 1)),
      price: Math.min(100000, Math.max(0, Math.round((parseFloat(k.price) || 0) * 100) / 100)),
      added: /^\d{4}-\d\d-\d\d$/.test(k.added) ? k.added : isoDay(new Date()), note: String(k.note || "").slice(0, 120)
    }));
  }
  function shameRaw(){
    if(store.kind === "supabase") return ((store.session && store.session.user.user_metadata) || {}).shame;
    try { return JSON.parse(localStorage.getItem(SHAME_KEY) || "[]"); } catch(e){ return []; }
  }
  let shameCache = null;   // kits from the kits table, once loaded
  const shameCount = () => (shameCache || cleanShame(shameRaw())).length;
  // Online the pile lives in the kits table; older piles saved on the account are moved there the first time.
  // Without the table (setup not run yet) it stays on the account.
  async function getShame(){
    if(store.kind !== "supabase") return cleanShame(shameRaw());
    const rows = await store.listKits();
    if(rows === null) return cleanShame(shameRaw());
    const old = cleanShame(shameRaw());
    if(old.length){
      const merged = cleanShame(rows.concat(old.filter(k => !rows.some(r => r.id === k.id))));
      try { await store.putKits(merged); await store.updateProfile({shame: null}); return (shameCache = merged); } catch(e){ console.warn("Couldn't move the pile of shame", e); }
    }
    return (shameCache = cleanShame(rows));
  }
  async function putShame(list){
    list = cleanShame(list);
    if(store.kind !== "supabase"){ localStorage.setItem(SHAME_KEY, JSON.stringify(list)); return list; }
    if(shameCache !== null || (await store.listKits()) !== null){ await store.putKits(list); shameCache = list; }
    else await store.updateProfile({shame: list});
    return list;
  }
  const money = n => settings.currency + "\u00a0" + Number(n || 0).toLocaleString("en", {minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2});
  function ageOf(day){
    const days = Math.max(0, Math.round((Date.now() - new Date(day + "T12:00:00")) / 864e5));
    if(days < 1) return "today";
    if(days < 31) return plural(days, "day") + " ago";
    const m = Math.round(days / 30.44);
    return m < 12 ? plural(m, "month") + " ago" : (m % 12 ? `${plural(Math.floor(m / 12), "year")}, ${plural(m % 12, "month")} ago` : plural(m / 12, "year") + " ago");
  }
  async function viewShame(){
    view.name = "shame";
    document.title = "Pile of shame · Livery Ledger";
    let list = await getShame(), armies = [];
    try { armies = (await store.listArmies()).filter(a => !isPool(a)); } catch(e){}
    const allNames = [...new Set(FACTIONS.flatMap(f => f.units.filter(u => !u.t).map(u => u.n)))].sort();
    app.innerHTML = `
      <div class="crumbs">${isWar() ? `<a href="#/war">War Ledger</a>` : `<a href="#/livery">Livery Ledger</a>`} / Pile of shame</div>
      <section class="page-head shame-head">
        <div><p class="eyebrow">No judgement</p><h1>Pile of shame</h1>
        <p class="sub">Kits you've bought but haven't started yet. When you start one, move it into a ledger.</p></div>
        <div class="stats" id="sh-stats"></div>
      </section>
      <form class="panel shame-add" id="kit-form" autocomplete="off" novalidate>
        <h2>Add a kit</h2>
        <div class="kit-grid">
          <label class="kit-name">Kit or datasheet<input id="kit-name" maxlength="80" placeholder="e.g. Intercessor Squad" required></label>
          <label>Faction<select id="kit-fac"><option value="">Any or not sure</option>${FACTIONS.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></label>
          <label>Models<input id="kit-models" type="number" min="1" max="999" inputmode="numeric" value="1"></label>
          <label>Price (${esc(settings.currency)})<input id="kit-price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0"></label>
          <label>Bought<input id="kit-date" type="date" value="${isoDay(new Date())}" max="${isoDay(new Date())}"></label>
        </div>
        <div class="row-actions"><button type="submit" class="primary btn-sm">Add to the pile</button><span class="msg" id="kit-msg" role="status"></span></div>
      </form>
      <div id="shame-list"></div>`;
    combo($("kit-name"), () => {
      const q = $("kit-name").value.trim().toLowerCase(), fid = $("kit-fac").value;
      const pool = fid ? FBY[fid].units.filter(u => !u.t).map(u => u.n) : q.length >= 2 ? allNames : [];
      return pool.filter(n => !q || n.toLowerCase().includes(q)).slice(0, 60);
    });
    // Picking a datasheet fills in its usual model count.
    $("kit-name").addEventListener("change", () => {
      const fid = $("kit-fac").value, name = $("kit-name").value.trim().toLowerCase();
      const sh = (fid ? FBY[fid].units : FACTIONS.flatMap(f => f.units)).find(u => u.n.toLowerCase() === name);
      if(sh && $("kit-models").value === "1") $("kit-models").value = sh.ms ? sh.ms[0] : minModels(sh) === 5 ? 1 : minModels(sh);
      if(sh && !fid){ const f = FACTIONS.find(f => f.units.includes(sh)); if(f) $("kit-fac").value = f.id; }
    });
    function draw(){
      const kits = list.slice().sort((a, b) => a.added.localeCompare(b.added));
      const models = kits.reduce((n, k) => n + k.models, 0), value = kits.reduce((n, k) => n + k.price, 0);
      $("sh-stats").innerHTML = `<div class="stat"><b>${kits.length}</b><span>${kits.length === 1 ? "Kit" : "Kits"}</span></div><div class="stat"><b>${num(models)}</b><span>Models</span></div><div class="stat"><b>${esc(money(value))}</b><span>Value</span></div><div class="stat"><b>${kits.length ? esc(ageOf(kits[0].added).replace(" ago", "")) : "—"}</b><span>Oldest kit</span></div>`;
      $("shame-list").innerHTML = kits.length ? `<div class="kits">${kits.map(k => `<article class="panel kit" data-kit="${esc(k.id)}">
          <div class="kit-top">${k.faction ? factionBadge(k.faction, 40) : `<span class="kit-box" aria-hidden="true"></span>`}
            <div><h3>${esc(k.name)}</h3><small>${esc([k.faction ? FBY[k.faction].name : "", plural(k.models, "model"), k.price ? money(k.price) : ""].filter(Boolean).join(" · "))}</small></div>
            <button type="button" class="kit-rm" data-rmkit="${esc(k.id)}" aria-label="Remove ${esc(k.name)} from the pile" title="Remove">×</button></div>
          <div class="kit-foot"><span class="kit-age">On the pile ${esc(ageOf(k.added))}</span><button type="button" class="btn-sm primary" data-start="${esc(k.id)}">Start painting</button></div>
          <div class="kit-start" hidden></div>
        </article>`).join("")}</div>`
        : `<div class="ro-empty"><strong>Your pile is empty</strong><p>Either you paint everything you buy, or you haven't added anything yet. Add kits above as you buy them.</p></div>`;
    }
    draw();
    $("kit-form").addEventListener("submit", async e => {
      e.preventDefault();
      const name = $("kit-name").value.trim();
      if(!name){ $("kit-msg").textContent = "Give the kit a name."; $("kit-name").focus(); return; }
      const kit = {id: S.newId(), name, faction: $("kit-fac").value, models: $("kit-models").value, price: $("kit-price").value, added: $("kit-date").value || isoDay(new Date())};
      try { list = await putShame(list.concat(kit)); $("kit-name").value = ""; $("kit-models").value = "1"; $("kit-price").value = ""; $("kit-date").value = isoDay(new Date()); $("kit-msg").textContent = `Added ${name}.`; draw(); $("kit-name").focus(); }
      catch(err){ $("kit-msg").textContent = "Couldn't save: " + errText(err); }
    });
    $("shame-list").addEventListener("click", async e => {
      const rm = e.target.closest("[data-rmkit]");
      if(rm){
        if(!rm.classList.contains("armed")){ rm.classList.add("armed"); rm.textContent = "Remove?"; setTimeout(() => { if(rm.isConnected){ rm.classList.remove("armed"); rm.textContent = "×"; } }, 3000); return; }
        try { list = await putShame(list.filter(k => k.id !== rm.dataset.rmkit)); draw(); } catch(err){ alertBanner("Couldn't remove it: " + errText(err)); }
        return;
      }
      const st = e.target.closest("[data-start]");
      if(st){
        const k = list.find(x => x.id === st.dataset.start), box = st.closest(".kit").querySelector(".kit-start");
        if(!armies.length){ box.innerHTML = `<p class="hint">Start a ledger first, then move this kit into it. <a href="#/livery/new">Start a ledger</a></p>`; box.hidden = false; return; }
        const pick = armies.find(a => a.faction === k.faction) || armies[0];
        box.innerHTML = `<label>Add to ledger<select data-to>${armies.map(a => `<option value="${esc(a.id)}"${a === pick ? " selected" : ""}>${esc(a.name)} (${esc((FBY[a.faction] || {name: a.faction}).name)})</option>`).join("")}</select></label>
          <div class="row-actions"><button type="button" class="btn-sm primary" data-move="${esc(k.id)}">Add as a unit</button><button type="button" class="btn-sm" data-cancel>Cancel</button></div>`;
        box.hidden = false; st.hidden = true; box.querySelector("select").focus();
        return;
      }
      if(e.target.closest("[data-cancel]")){ draw(); return; }
      const mv = e.target.closest("[data-move]");
      if(mv){
        const k = list.find(x => x.id === mv.dataset.move), armyId = mv.closest(".kit").querySelector("[data-to]").value, army = armies.find(a => a.id === armyId);
        const units = (FBY[army.faction] || {units: []}).units, low = k.name.toLowerCase();
        const sh = units.find(u => !u.t && u.n.toLowerCase() === low) || units.find(u => u.n.toLowerCase() === low);
        mv.disabled = true; mv.textContent = "Adding…";
        try {
          await store.importUnits(army.id, [{datasheet: sh ? sh.n : k.name, role: sh ? sh.r : "", name: k.name, count: k.models, points: sh && sh.p ? sh.p : 0, stages: [], painted: 0, tier: 0, notes: k.note || ""}]);
          list = await putShame(list.filter(x => x.id !== k.id)); draw();
          alertBanner(`${k.name} is now in ${army.name}. Open the ledger to start painting.`);
        } catch(err){ mv.disabled = false; mv.textContent = "Add as a unit"; alertBanner("Couldn't add it: " + errText(err)); }
      }
    });
  }

  /* ============================================================
     Settings
     ============================================================ */
  // Restore a backup: pick which ledgers to bring back (ones you already have start unticked), then add them.
  async function openRestore(b){
    const mine = await store.listArmies().catch(() => []), have = new Set(mine.map(a => a.name.trim().toLowerCase()));
    const havePool = new Set(mine.filter(a => a.scheme && a.scheme.pool).map(a => a.faction));
    const real = b.ledgers.map((L, i) => ({L, i})).filter(x => !(x.L.scheme && x.L.scheme.pool)), loose = b.ledgers.filter(L => L.scheme && L.scheme.pool);
    const count = (arr, fn) => arr.filter(fn).length;
    const d = modal("Restore from a file", `
      <p class="sub">${b.exported ? `This backup was made on ${esc(niceDay(String(b.exported).slice(0, 10)))}. ` : ""}What you pick is added alongside what's already here. Nothing is replaced or deleted.</p>
      ${real.length ? `<fieldset class="wfs"><legend>Ledgers</legend><div class="rs-list">${real.map(({L, i}) => { const dup = have.has(String(L.name || "").trim().toLowerCase());
        return `<label class="chk"><input type="checkbox" data-rs="${i}"${dup ? "" : " checked"}><span>${esc(L.name || "Untitled")} <small>${esc(factionName(L.faction))} · ${plural((L.units || []).length, "unit")}${count(b.lists, l => l.armyId === L.id) ? ` · ${plural(count(b.lists, l => l.armyId === L.id), "list")}` : ""}${count(b.games, g => g.armyId === L.id) ? ` · ${plural(count(b.games, g => g.armyId === L.id), "battle")}` : ""}${dup ? " · you already have a ledger with this name" : ""}</small></span></label>`; }).join("")}</div></fieldset>` : ""}
      ${loose.length ? (() => { const dup = loose.some(L => havePool.has(L.faction)); return `<label class="chk"><input type="checkbox" id="rs-loose"${dup ? "" : " checked"}><span>Units not in an army <small>${plural(loose.reduce((n, L) => n + (L.units || []).length, 0), "unit")}${dup ? " · you already have units not in an army, so these could double up" : ""}</small></span></label>`; })() : ""}
      ${b.recipes.length || b.paints.length || b.kits.length ? `<label class="chk"><input type="checkbox" id="rs-extra" checked><span>Recipes, paints and pile of shame <small>${[b.recipes.length ? plural(b.recipes.length, "recipe") : "", b.paints.length ? plural(b.paints.length, "paint") : "", b.kits.length ? plural(b.kits.length, "kit") : ""].filter(Boolean).join(" · ")}. Ones you already have are skipped.</small></span></label>` : ""}
      <p class="hint">Your settings stay as they are. Army lists and battle reports come back with their ledgers.</p>
      <div class="row-actions"><button type="submit" class="primary" id="rs-go">Restore</button><span class="msg" id="rs-msg" role="status"></span></div>`, "wide");
    d.querySelector("form").addEventListener("submit", async ev => {
      ev.preventDefault();
      const picked = [...d.querySelectorAll("[data-rs]:checked")].map(x => b.ledgers[+x.dataset.rs]).concat($("rs-loose") && $("rs-loose").checked ? loose : []);
      const extra = $("rs-extra") && $("rs-extra").checked;
      if(!picked.length && !extra){ $("rs-msg").textContent = "Pick something to restore."; return; }
      const go = $("rs-go"); go.disabled = true; d.querySelectorAll("input").forEach(x => x.disabled = true);
      try {
        const r = await restoreBackup({...b, ledgers: picked}, {progress: (i, n) => { $("rs-msg").textContent = `Restoring ${i} of ${n} units…`; }});
        let extraText = "";
        if(extra){
          if(b.recipes.length){ const mine = new Set((await store.getLibrary().catch(() => [])).map(x => x.id)); const add = b.recipes.filter(x => x && x.id && !mine.has(x.id)); if(add.length) await store.putLibrary(add); }
          if(b.paints.length) await store.setPaints([...(await store.getPaints()), ...b.paints]);
          if(b.kits.length){ const cur = await getShame(); await putShame(cur.concat(b.kits.filter(k => k && !cur.some(c => c.id === k.id)))); }
          extraText = " Recipes, paints and your pile of shame are merged in.";
        }
        $("rs-msg").textContent = `Restored ${[plural(r.ledgers, "ledger"), plural(r.units, "unit"), r.lists ? plural(r.lists, "army list") : "", r.games ? plural(r.games, "battle report") : ""].filter(Boolean).join(", ")}.${extraText}`
          + (r.photosMissed ? ` ${plural(r.photosMissed, "photo")} couldn't be brought back.` : "")
          + (r.warFailed ? " Army lists and battles couldn't be restored: their database tables may not be set up yet." : "");
        go.textContent = "Done"; go.disabled = false; go.type = "button"; go.addEventListener("click", () => { d.close(); location.hash = "#/livery"; });
      } catch(err){ console.error(err); $("rs-msg").textContent = "Couldn't finish restoring: " + errText(err) + " Anything already restored has been kept."; go.disabled = false; d.querySelectorAll("input").forEach(x => x.disabled = false); }
    });
  }
  async function viewSettings(){
    view.name = "settings";
    document.title = `Settings · ${isWar() ? "War" : "Livery"} Ledger`;
    const me = acct(), online = store.kind === "supabase";
    let listPrefs = {group: "role", sort: "rank"};
    try { listPrefs = {...listPrefs, ...JSON.parse(localStorage.getItem("ll-list-prefs") || "{}")}; } catch(e){}
    const bg = document.documentElement.dataset.bg || "1";
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(label)}</option>`;
    app.innerHTML = `
      <div class="crumbs">${isWar() ? `<a href="#/war">War Ledger</a>` : `<a href="#/livery">Livery Ledger</a>`} / Settings</div>
      <section class="page-head"><p class="eyebrow">${me ? esc(me.email) : "This browser"}</p><h1>Settings</h1></section>
      <div class="settings">
        ${me ? `<section class="panel set-sec">
          <h2>Profile</h2>
          <div class="set-row">${avatarHtml(me, "lg")}<div><strong>${esc(me.name)}</strong><small>${esc(me.email)}</small></div><a class="btn btn-sm" href="#/livery">Change name or picture</a></div>
        </section>
        <section class="panel set-sec">
          <h2>Password</h2>
          <form id="pw-form" class="set-form" novalidate>
            <label>New password<input type="password" id="pw-new" autocomplete="new-password" minlength="6"></label>
            <label>Confirm new password<input type="password" id="pw-new2" autocomplete="new-password" minlength="6"></label>
            <div class="row-actions"><button type="submit" class="primary btn-sm">Change password</button></div>
            <div class="msg" id="pw-msg" role="status"></div>
          </form>
        </section>` : ""}
        <section class="panel set-sec">
          <h2>Display</h2>
          <label class="switch"><input type="checkbox" id="set-points" ${settings.hidePoints ? "checked" : ""}><span class="track" aria-hidden="true"><i></i></span><span>Hide points<small>For painters who don't play: hides points on unit cards and ledger totals.</small></span></label>
          <div class="set-grid">
            <label>Group units by<select id="set-group">${[["none", "Nothing"], ["role", "Role"], ["rank", "Rank"], ["status", "Status"]].map(([v, l]) => opt(v, listPrefs.group, l)).join("")}</select></label>
            <label>Sort units by<select id="set-sort">${[["rank", "Rank"], ["name", "Name"], ["points", "Points"], ["progress", "Progress"], ["recent", "Recently changed"]].map(([v, l]) => opt(v, listPrefs.sort, l)).join("")}</select></label>
            <label>Currency<select id="set-cur">${CURRENCIES.map(([v, l]) => opt(v, settings.currency, l)).join("")}</select></label>
            <label>Background<select id="set-bg">${[["1", "Necrons and Ultramarines"], ["2", "Terminators"], ["3", "Orks and Blood Angels"], ["4", "Tyranids"], ["none", "None"]].map(([v, l]) => opt(v, bg, l)).join("")}</select></label>
          </div>
          <p class="hint">Currency is used for your pile of shame. Grouping and sorting are where every ledger starts; you can still change them on each ledger.</p>
          <div class="msg" id="set-msg" role="status"></div>
        </section>
        <section class="panel set-sec">
          <h2>War Ledger</h2>
          <div class="set-grid">
            <label>A model is battle ready when it's<select id="set-ready">${READY_RULES.map(([v, l]) => opt(v, readyRule(), l)).join("")}</select></label>
          </div>
          <p class="hint">Used for battle readiness across War Ledger. You can still set any unit by hand.</p>
          <label class="switch"><input type="checkbox" id="set-checks" ${listChecksOn() ? "checked" : ""}><span class="track" aria-hidden="true"><i></i></span><span>Things to check on army lists<small>Friendly notes such as going over the points limit or having no warlord. They never stop you using a list.</small></span></label>
          <div class="msg" id="set-wmsg" role="status"></div>
        </section>
        <section class="panel set-sec">
          <h2>App</h2>
          ${standalone() ? `<p class="hint">You're using Livery Ledger as an installed app.</p>`
            : installable() ? `<p class="hint">Add Livery Ledger to your home screen or desktop. It opens like an app, and still opens without a connection, showing what was last loaded.</p><div class="row-actions"><button type="button" class="primary btn-sm" id="set-install">Install app</button></div>`
            : iOS ? `<p class="hint">On iPhone or iPad: open this site in Safari, tap the Share button, then <strong>Add to Home Screen</strong>.</p>`
            : `<p class="hint">In Chrome or Edge, use the install icon in the address bar, or the browser menu's <strong>Install</strong> or <strong>Add to Home screen</strong> option. On iPhone, use Safari's Share button, then Add to Home Screen.</p>`}
        </section>
        <section class="panel set-sec">
          <h2>Your data</h2>
          <p class="hint">Download everything you've saved: ledgers, units and photos, army lists, battle reports, recipes, paints you own, your pile of shame and your settings, as one file.</p>
          <div class="row-actions"><button type="button" class="btn-sm" id="set-export">Download all my data</button>${store.canWrite && (online ? !!me : true) ? `<button type="button" class="btn-sm" id="set-restore">Restore from a file</button><input type="file" id="set-restore-f" accept="application/json,.json" hidden>` : ""}</div>
          <p class="hint" id="set-rmsg" role="status"></p>
        </section>
        <section class="panel set-sec danger-zone">
          <h2>${online ? "Delete my account" : "Clear everything in this browser"}</h2>
          <p class="hint">${online ? "This permanently deletes your account, all your ledgers, units, photos and recipes. It can't be undone." : "This deletes every ledger, unit, photo and recipe saved in this browser. It can't be undone."} Download your data first if you might want it later.</p>
          <label class="set-confirm"><span>Type <strong>DELETE</strong> to confirm</span><input id="del-confirm" autocomplete="off" spellcheck="false"></label>
          <div class="row-actions"><button type="button" class="danger armed" id="del-go" disabled>${online ? "Delete my account" : "Clear everything"}</button></div>
          <div class="msg" id="del-msg" role="status"></div>
        </section>
      </div>`;
    const say = (id, t, bad) => { $(id).textContent = t || ""; $(id).classList.toggle("err", !!bad); };
    const saved = async patch => { try { await saveSettings(patch); say("set-msg", "Saved."); } catch(err){ say("set-msg", "Saved on this device, but not to your account: " + errText(err), true); } };
    $("set-points").addEventListener("change", e => saved({hidePoints: e.target.checked}));
    $("set-cur").addEventListener("change", e => saved({currency: e.target.value}));
    $("set-checks").addEventListener("change", async e => {
      try { await saveSettings({listChecks: e.target.checked}); $("set-wmsg").textContent = "Saved."; } catch(err){ $("set-wmsg").textContent = "Couldn't save: " + errText(err); }
    });
    $("set-ready").addEventListener("change", async e => {
      try { await saveSettings({ready: e.target.value}); $("set-wmsg").textContent = "Saved."; } catch(err){ $("set-wmsg").textContent = "Couldn't save: " + errText(err); }
    });
    const listSave = () => { try { localStorage.setItem("ll-list-prefs", JSON.stringify({group: $("set-group").value, sort: $("set-sort").value})); } catch(e){} say("set-msg", "Saved."); };
    $("set-group").addEventListener("change", listSave); $("set-sort").addEventListener("change", listSave);
    $("set-bg").addEventListener("change", e => { document.documentElement.dataset.bg = e.target.value; try { localStorage.setItem("ll-bg", e.target.value); } catch(err){} say("set-msg", "Saved."); });
    if($("set-install")) $("set-install").addEventListener("click", async () => { await installApp(); viewSettings(); });
    if($("pw-form")) $("pw-form").addEventListener("submit", async e => {
      e.preventDefault();
      const a = $("pw-new").value, b = $("pw-new2").value;
      if(a.length < 6){ say("pw-msg", "Passwords need at least 6 characters.", true); $("pw-new").focus(); return; }
      if(a !== b){ say("pw-msg", "The two passwords don't match.", true); $("pw-new2").focus(); return; }
      say("pw-msg", "Saving…");
      try { await store.updatePassword(a); $("pw-new").value = $("pw-new2").value = ""; say("pw-msg", "Password changed."); }
      catch(err){ say("pw-msg", authErr(err), true); }
    });
    $("set-export").addEventListener("click", async () => {
      const b = $("set-export"); b.disabled = true; b.textContent = "Preparing…";
      try {
        const [armies, units, library, paints] = await Promise.all([store.listArmies(), store.listAllUnits(), store.getLibrary().catch(() => []), store.getPaints().catch(() => [])]);
        let shame = []; try { shame = await getShame(); } catch(e){}
        const war = await warRecords(null);
        downloadJSON({app: "livery-ledger", kind: "everything", version: 6, exported: new Date().toISOString(), account: me ? {name: me.name, email: me.email} : null,
          settings, goal: getGoal(), paintsOwned: paints, recipeLibrary: library, pileOfShame: shame,
          ledgers: armies.map(a => backupLedger(a, units)), lists: war.lists, games: war.games},
          `livery-ledger-everything-${new Date().toISOString().slice(0, 10)}.json`);
      } catch(err){ alertBanner("Couldn't prepare your data: " + errText(err)); }
      finally { b.disabled = false; b.textContent = "Download all my data"; }
    });
    if($("set-restore")){
      $("set-restore").addEventListener("click", () => $("set-restore-f").click());
      $("set-restore-f").addEventListener("change", async e => {
        const file = e.target.files && e.target.files[0]; e.target.value = ""; if(!file) return;
        let b = null;
        try { b = readBackup(JSON.parse(await file.text())); } catch(err){}
        if(!b || (!b.ledgers.length && !b.recipes.length && !b.kits.length && !b.paints.length)){ $("set-rmsg").textContent = "That file isn't a Livery Ledger backup."; return; }
        openRestore(b);
      });
    }
    $("del-confirm").addEventListener("input", e => { $("del-go").disabled = e.target.value.trim() !== "DELETE"; });
    $("del-go").addEventListener("click", async () => {
      const b = $("del-go"); if($("del-confirm").value.trim() !== "DELETE") return;
      b.disabled = true; say("del-msg", online ? "Deleting your account…" : "Clearing…");
      try {
        await store.deleteAccount(); clearOfflineData();
        if(online){ location.hash = "#/"; setTimeout(() => alertBanner("Your account has been deleted."), 300); }
        else { location.hash = "#/livery"; }
      } catch(err){ say("del-msg", errText(err), true); b.disabled = false; }
    });
  }

  /* ============================================================
     Painting activity (profile): models painted over time and a monthly goal
     ============================================================ */
  const GOAL_KEY = "ll-goal";
  function getGoal(){
    if(store.kind === "supabase") return Math.max(0, parseInt(((store.session && store.session.user.user_metadata) || {}).goal, 10) || 0);
    try { return Math.max(0, parseInt(localStorage.getItem(GOAL_KEY), 10) || 0); } catch(e){ return 0; }
  }
  async function setGoal(n){
    if(store.kind === "supabase"){ await store.updateProfile({goal: n || null}); return; }
    try { if(n) localStorage.setItem(GOAL_KEY, String(n)); else localStorage.removeItem(GOAL_KEY); } catch(e){}
  }
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  function activityOf(units){
    const byDay = new Map();
    units.forEach(u => (u.log || []).forEach(e => byDay.set(e.d, (byDay.get(e.d) || 0) + e.n)));
    const sumWhere = pre => { let n = 0; byDay.forEach((v, d) => { if(d.startsWith(pre)) n += v; }); return n; };
    const now = new Date();
    const months = [];
    for(let i = 11; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1), key = monthKey(d);
      months.push({key, n: sumWhere(key), short: d.toLocaleDateString("en-GB", {month: "short"}), long: d.toLocaleDateString("en-GB", {month: "long", year: "numeric"})});
    }
    // Weeks (Monday to Sunday) in a row with something painted, counting this week or, if nothing yet, last week.
    const weekOf = ds => { const [y, m, d] = ds.split("-").map(Number); const t = Date.UTC(y, m - 1, d); return Math.floor((t / 864e5 + 3) / 7); };
    const weeks = new Set([...byDay.keys()].map(weekOf));
    const tw = weekOf(monthKey(now) + "-" + String(now.getDate()).padStart(2, "0"));
    let streak = 0, w = weeks.has(tw) ? tw : tw - 1;
    while(weeks.has(w)){ streak++; w--; }
    const monthTotals = new Map(); byDay.forEach((v, d) => monthTotals.set(d.slice(0, 7), (monthTotals.get(d.slice(0, 7)) || 0) + v));
    let best = null; monthTotals.forEach((v, k) => { if(!best || v > best.n) best = {k, n: v}; });
    const total = [...byDay.values()].reduce((a, b) => a + b, 0);
    return {months, thisMonth: months[11].n, lastMonth: months[10], thisYear: sumWhere(String(now.getFullYear())), streak, best, total};
  }
  function drawActivity(units){
    const box = $("activity"), A = activityOf(units), goal = getGoal();
    const max = Math.max(...A.months.map(m => m.n), goal || 0, 4);
    const step = max <= 8 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : Math.ceil(max / 50) * 10;
    let top = Math.ceil(max / step) * step;
    if(top % 2) top += step;   // keep the middle gridline a whole number
    const peak = A.months.reduce((b, m, i) => m.n > A.months[b].n ? i : b, 0);
    const diff = A.thisMonth - A.lastMonth.n, lastName = A.lastMonth.long.split(" ")[0];
    const bestName = A.best ? new Date(A.best.k + "-01T12:00:00").toLocaleDateString("en-GB", {month: "long", year: "numeric"}) : "";
    const pct = goal ? Math.min(100, Math.round(A.thisMonth / goal * 100)) : 0;
    box.innerHTML = `
      <div class="act-head"><h2 class="act-title" id="act-h">Painting activity</h2><small>Models you've marked painted across all your ledgers</small></div>
      <div class="act-top">
        <div class="act-stats">
          <div class="stat"><b>${A.thisMonth}</b><span>This month</span><em>${A.lastMonth.n || A.thisMonth ? (diff === 0 ? `Same as ${lastName}` : `${Math.abs(diff)} ${diff > 0 ? "more" : "fewer"} than ${lastName}`) : "&nbsp;"}</em></div>
          <div class="stat"><b>${A.thisYear}</b><span>This year</span></div>
          <div class="stat"><b>${A.streak}</b><span>Week streak</span><em>${A.streak ? `${plural(A.streak, "week")} in a row` : "Paint this week to start one"}</em></div>
          <div class="stat"><b>${A.best ? A.best.n : 0}</b><span>Best month</span><em>${esc(bestName) || "&nbsp;"}</em></div>
        </div>
        <div class="act-goal" id="act-goal">
          ${goal ? `<div class="ag-row"><span class="ag-l">Monthly goal</span><button type="button" class="linkish" data-goal="edit">Change</button></div>
            <div class="ag-val"><b>${A.thisMonth}</b> of ${goal} models${A.thisMonth >= goal ? ` <span class="ag-done">Goal reached</span>` : ""}</div>
            <div class="meter" role="progressbar" aria-label="Monthly goal" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(A.thisMonth, goal)}"><i style="width:${pct}%"></i></div>
            <small>${A.thisMonth >= goal ? "Nice work. Anything more is a bonus." : `${goal - A.thisMonth} to go this month.`}</small>`
          : `<div class="ag-row"><span class="ag-l">Monthly goal</span></div>
            <p>Pick how many models you'd like to paint each month and track it here.</p>
            <button type="button" class="btn-sm primary" data-goal="edit">Set a goal</button>`}
        </div>
      </div>
      <figure class="act-chart">
        <figcaption>Models painted each month</figcaption>
        <div class="bars" style="--top:${top}">
          <div class="grid" aria-hidden="true"><span style="bottom:100%"><i>${top}</i></span><span style="bottom:50%"><i>${top / 2}</i></span><span style="bottom:0"><i>0</i></span></div>
          ${A.months.map((m, i) => `<div class="col${i === 11 ? " now" : ""}" tabindex="0" role="img" aria-label="${esc(m.long)}: ${plural(m.n, "model")} painted">
            <div class="bar-wrap"><div class="mbar" style="height:${m.n / top * 100}%">${m.n && (i === 11 || i === peak) ? `<span class="bar-val">${m.n}</span>` : ""}</div></div>
            <span class="tip" role="tooltip">${esc(m.long)}<b>${plural(m.n, "model")}</b></span>
            <span class="mo" aria-hidden="true">${esc(m.short)}</span>
          </div>`).join("")}
        </div>
        ${!A.total ? `<p class="hint act-empty">Your chart fills in as you mark models painted. History starts from today, so models painted before now aren't dated.</p>` : ""}
      </figure>`;
    box.querySelectorAll("[data-goal]").forEach(b => b.addEventListener("click", () => editGoal(units)));
  }
  function editGoal(units){
    const g = $("act-goal"), goal = getGoal();
    g.innerHTML = `<div class="ag-row"><span class="ag-l">Monthly goal</span></div>
      <form class="ag-form" id="goal-form"><label>Models a month<input type="number" id="goal-in" min="1" max="999" inputmode="numeric" value="${goal || ""}" placeholder="10"></label>
      <div class="row-actions"><button type="submit" class="btn-sm primary">Save</button><button type="button" class="btn-sm" id="goal-cancel">Cancel</button>${goal ? `<button type="button" class="btn-sm danger" id="goal-clear">Remove goal</button>` : ""}</div>
      <div class="msg" id="goal-msg" role="status"></div></form>`;
    $("goal-in").focus();
    const done = async n => {
      try { await setGoal(n); drawActivity(units); }
      catch(err){ $("goal-msg").textContent = "Couldn't save your goal: " + errText(err); $("goal-msg").classList.add("err"); }
    };
    $("goal-form").addEventListener("submit", e => { e.preventDefault(); const n = Math.min(999, Math.max(1, parseInt($("goal-in").value, 10) || 0)); if(!parseInt($("goal-in").value, 10)){ $("goal-in").focus(); return; } done(n); });
    $("goal-cancel").addEventListener("click", () => drawActivity(units));
    if($("goal-clear")) $("goal-clear").addEventListener("click", () => done(0));
  }

  /* Profile page: change your display name (pencil) and picture (click the circle). */
  function profileEdits(){
    const say = (t, bad) => { $("ph-msg").textContent = t || ""; $("ph-msg").classList.toggle("err", !!bad); };
    const btn = $("b-avatar"), menu = $("av-menu"), file = $("f-avatar");
    const menuOpen = on => { menu.hidden = !on; btn.setAttribute("aria-expanded", on); if(on) menu.querySelector("button").focus(); };
    // Redraw the circle here and in the top bar after a change.
    const paint = () => {
      const a = acct();
      btn.innerHTML = avatarInner(a); btn.classList.toggle("has-img", !!a.avatar);
      btn.setAttribute("aria-label", a.avatar ? "Change or remove your profile picture" : "Add a profile picture");
      setTop();
    };
    // Name
    const editing = on => {
      $("ph-name").hidden = on; $("name-form").hidden = !on;
      if(on){ const a = acct(); $("name-in").value = a.custom ? a.name : ""; $("name-in").focus(); $("name-in").select(); say(""); }
      else $("b-name").focus();
    };
    $("b-name").addEventListener("click", () => editing(true));
    $("name-cancel").addEventListener("click", () => editing(false));
    $("name-in").addEventListener("keydown", e => { if(e.key === "Escape"){ e.preventDefault(); editing(false); } });
    $("name-form").addEventListener("submit", async e => {
      e.preventDefault();
      const v = $("name-in").value.replace(/\s+/g, " ").trim().slice(0, 40), btn = $("name-form").querySelector("[type=submit]");
      btn.disabled = true; say("Saving…");
      try {
        await store.updateProfile({display_name: v || null});
        $("ph-h").textContent = acct().name; paint(); editing(false);
        say(v ? "Name saved." : "Name cleared. We'll use the start of your email.");
      } catch(err){ say("Couldn't save your name: " + errText(err), true); }
      finally { btn.disabled = false; }
    });
    // Picture
    btn.addEventListener("click", e => { e.stopPropagation(); if(acct().avatar) menuOpen(menu.hidden); else file.click(); });
    menu.addEventListener("click", async e => {
      const o = e.target.closest("[data-av]"); if(!o) return;
      menuOpen(false);
      if(o.dataset.av === "upload"){ file.click(); return; }
      const old = acct().avatarPath;
      btn.classList.add("busy"); say("Removing your picture…");
      try { await store.updateProfile({avatar_url: null, avatar_path: null}); store.removeAvatar(old); paint(); say("Picture removed."); }
      catch(err){ say("Couldn't remove your picture: " + errText(err), true); }
      finally { btn.classList.remove("busy"); }
    });
    file.addEventListener("change", async () => {
      const f = file.files && file.files[0]; file.value = "";
      if(!f) return;
      const old = acct().avatarPath;
      btn.classList.add("busy"); say("Uploading your picture…");
      try {
        const up = await store.uploadAvatar(f);
        await store.updateProfile({avatar_url: up.url, avatar_path: up.path});
        if(old && old !== up.path) store.removeAvatar(old);
        paint(); say("Picture updated.");
      } catch(err){ say("Couldn't update your picture: " + errText(err), true); }
      finally { btn.classList.remove("busy"); }
    });
    const onDoc = e => { if(!menu.isConnected){ document.removeEventListener("click", onDoc); return; } if(!e.target.closest(".ph-avatar")) menuOpen(false); };
    document.addEventListener("click", onDoc);
    menu.addEventListener("keydown", e => { if(e.key === "Escape"){ menuOpen(false); btn.focus(); } });
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
    if(armyId){ army = await store.getArmy(armyId); if(!army){ location.hash = "#/livery"; return; } factionId = army.faction; }
    const f = FBY[factionId] || FBY["space-marines"];
    PROF = P.profileFor(f.id);
    const draft = army ? {name: army.name, scheme: JSON.parse(JSON.stringify(army.scheme))} : {name: "", scheme: P.presetFor(f.id)};
    fillSkin(draft.scheme, f.id);
    draft.scheme.slotPaints = draft.scheme.slotPaints || {};
    const known = P.schemesFor(f.id);
    let ownedList = [];
    if(store.canWrite) store.getPaints().then(l => { ownedList = l; }).catch(() => {});
    const editing = !!army;
    document.title = (editing ? "Colours · " + army.name : "New " + f.name + " ledger") + " · Livery Ledger";
    const locked = !store.canWrite;

    app.innerHTML = `
      <div class="crumbs"><a href="#/livery">Livery Ledger</a> / ${editing ? `<a href="#/livery/ledgers">Ledgers</a> / <a href="#/army/${esc(army.id)}">${esc(army.name)}</a> / Colours` : `<a href="#/livery/new">New ledger</a> / ${esc(f.name)}`}</div>
      <div class="hero">
        <div><h1>${editing ? "Your colours" : esc(f.name)}</h1>
        <p class="sub">${editing ? "Change your army's colours. Units that use the scheme colours update to match." : "Name your army and choose its colours. These become the starting colours for every unit you add."}</p></div>
      </div>
      ${locked ? `<div class="banner"><span class="dot"></span>Sign in to create a ledger. <button type="button" class="btn-sm" data-signin>Sign in</button></div>` : ""}
      <div class="setup">
        <div>
          <div class="panel">
            <h2 class="ph">Army</h2>
            <label>Army name<input id="s-name" maxlength="80" placeholder="e.g. ${esc(f.name)} Crusade" value="${esc(draft.name)}"></label>
          </div>
          ${known.length ? `<div class="panel">
            <h2 class="ph">Start from a known scheme</h2>
            <p class="hint">Sets every colour to the Citadel paints for a well-known ${esc(f.name)} scheme, and the emblem to match. You can change anything afterwards.</p>
            <div class="schemes" id="s-schemes">${known.map((k, i) => `<button type="button" class="scheme" data-scheme="${i}">${ART.pauldron(k.colors.armour, k.colors.trim, k.colors.emblem, k.shape || draft.scheme.shape, 40)}<span>${esc(k.name)}</span></button>`).join("")}</div>
          </div>` : ""}
          <div class="panel">
            <h2 class="ph">Colours</h2>
            <p class="hint">Pick the paint you use for each area. The picker also has plain colours and a custom colour.</p>
            <div class="cgrid">${colorKeys().map(([k, label]) => `
              <div class="cfield${BASE_OF[k] ? " pd-when" : ""}"${BASE_OF[k] && !draft.scheme.splitPauldrons ? " hidden" : ""}>
                <span class="cf-l">${label}</span>
                <span id="s-${k}"></span>
              </div>`).join("")}</div>
            ${PROF.pauldrons ? `<label class="check split-check"><input type="checkbox" id="s-split" ${draft.scheme.splitPauldrons ? "checked" : ""}> Paint each pauldron differently <small>Gives the left and right pauldron their own colour, secondary and emblem colour. New units start with this setting.</small></label>` : ""}
            <div class="xa-wrap"><h3 class="em-h">Extra paint areas</h3>
              <p class="hint">Add the areas your models have, like leather or power weapons. They become the starting paints for new units.</p>
              <h4 class="pd-h">${esc(PROF.legends.details)}</h4><div class="xa" id="s-xa-d"></div>
              <h4 class="pd-h">Weapons</h4><div class="xa" id="s-xa-w"></div></div>
          </div>
          <div class="panel">
            <h2 class="ph">Emblem</h2>
            <p class="hint">Shown on your army badge in the emblem colour. Pick a faction icon or a simple shape.</p>
            <div class="em-current" id="s-emcur"></div>
            <input type="search" id="s-emq" class="em-search" placeholder="Search all ${EMB.icons.length} icons, e.g. Khorne, Iyanden, Goffs" aria-label="Search icons">
            <h3 class="em-h" id="s-emh">Suggested for ${esc(f.name)}</h3>
            <div class="icongrid" id="s-icons"></div>
            <div class="row-actions" style="margin-top:8px"><button type="button" class="btn-sm" id="s-emmore" hidden>Show more</button></div>
            <h3 class="em-h">Simple shapes</h3>
            <div class="shapes" id="s-shapes">${P.SHAPES.map(([k, label]) => `<button type="button" class="shape" data-shape="${k}" aria-pressed="${draft.scheme.shape === k}">${ART.shapeIcon(k, draft.scheme.colors.emblem, 34)}${label}</button>`).join("")}</div>
          </div>
          <div class="panel">
            <h2 class="ph">Badge style</h2>
            <div class="shapes">
              <button type="button" class="shape" style="width:auto;padding:8px 12px" data-style="astartes" aria-pressed="${draft.scheme.style === "astartes"}">Power-armour helmet</button>
              <button type="button" class="shape" style="width:auto;padding:8px 12px" data-style="roundel" aria-pressed="${draft.scheme.style === "roundel"}">Colour roundel</button>
            </div>
          </div>
          <div class="panel">
            <h2 class="ph">Ranks</h2>
            <p class="hint">Ranks group your units, such as ${esc(draft.scheme.tiers.slice(0, 3).map(t => t.name).join(", ").replace(/, ([^,]*)$/, " and $1"))}, so you can paint some a little differently from the rest of the army. Each rank has a colour for the ${esc(PROF.head)}; a unit starts with its rank's colour, and you can still change it per unit.</p>
            <div class="tiers" id="s-tiers"></div>
            <div class="row-actions" style="margin-top:10px"><button type="button" class="btn-sm" id="s-addtier">Add rank</button></div>
          </div>
        </div>
        <div class="side">
          <div class="panel">
            <h2 class="ph">Preview</h2>
            <div class="pv-tiers" id="s-preview"></div>
          </div>
          <div class="panel">
            <div class="row-actions">
              <button type="button" class="primary" id="s-save" ${locked ? "disabled" : ""}>${editing ? "Save colours" : "Create ledger"}</button>
              <a class="btn" href="${editing ? "#/army/" + esc(army.id) : "#/livery/new"}">Cancel</a>
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
          <label>Colour<span data-tslot="${i}"></span></label>
          <button type="button" class="btn-sm" data-tdel="${i}" ${sch.tiers.length < 2 ? "disabled" : ""} aria-label="Remove rank ${i + 1}">Remove</button>
          <label class="full" style="grid-column:1/-1">Who uses it<input data-tnote="${i}" maxlength="80" value="${esc(t.note)}" placeholder="e.g. Sword Brethren"></label>
        </div>`).join("");
      $("s-addtier").disabled = sch.tiers.length >= 8;
      $("s-tiers").querySelectorAll("[data-tslot]").forEach(h => {
        const i = +h.dataset.tslot;
        PU.slot(h, {...slotOpts, label: `Rank ${i + 1} colour`, value: {hex: sch.tiers[i].color, paint: sch.tiers[i].paint},
          onChange: v => { sch.tiers[i].color = v.hex; sch.tiers[i].paint = v.paint; setupDirty = true; renderPreview(); }});
      });
    }
    function renderPreview(){
      $("s-preview").innerHTML = sch.tiers.map(t => `<div class="pv-tier">${tierBadge(sch, t, 60)}<span><strong>${esc(t.name || "Rank")}</strong><small>${esc(t.note || cname(t.color) + " " + PROF.head)}</small></span></div>`).join("");
      $("s-shapes").querySelectorAll("[data-shape]").forEach(b => { b.setAttribute("aria-pressed", b.dataset.shape === sch.shape); b.innerHTML = ART.shapeIcon(b.dataset.shape, sch.colors.emblem, 34) + esc(P.SHAPES.find(s => s[0] === b.dataset.shape)[1]); });
      renderCurrent();
      colorKeys().forEach(([k]) => slots[k].set({hex: sch.colors[k], paint: sch.slotPaints[k] || ""}));
      app.querySelectorAll("[data-style]").forEach(b => b.setAttribute("aria-pressed", b.dataset.style === sch.style));
      if($("s-split")){ $("s-split").checked = !!sch.splitPauldrons; app.querySelectorAll(".cfield.pd-when").forEach(el => el.hidden = !sch.splitPauldrons); }
    }
    // Paint pickers for the army colours and rank colours.
    const slotOpts = {
      owned: () => new Set(ownedList.map(PU.norm)), mine: () => ownedList, plain: PLAIN,
      swatches: () => colorKeys().map(([k]) => ({hex: sch.colors[k], paint: sch.slotPaints[k] || ""})).concat(sch.tiers.map(t => ({hex: t.color, paint: t.paint || ""})))
    };
    const slots = {};
    colorKeys().forEach(([k, label]) => {
      slots[k] = PU.slot($("s-" + k), {...slotOpts, label, value: {hex: sch.colors[k], paint: sch.slotPaints[k]},
        onChange: v => {
          const old = {hex: sch.colors[k], paint: sch.slotPaints[k] || ""};
          const put = (key, x) => { sch.colors[key] = x.hex; if(x.paint) sch.slotPaints[key] = x.paint; else delete sch.slotPaints[key]; };
          put(k, v);
          if(["armour","secondary","emblem"].includes(k)) followBase(k, key => slots[key] ? {hex: sch.colors[key], paint: sch.slotPaints[key] || ""} : null, (key, x) => { put(key, x); slots[key].set(x); }, old, v);
          setupDirty = true; renderPreview();
        }});
    });
    sch.xareas = sch.xareas || {};
    const XA = P.extrasFor(f.id);
    xaUI($("s-xa-d"), XA.details, sch.xareas, {slot: slotOpts, onChange: () => { setupDirty = true; }});
    xaUI($("s-xa-w"), XA.weapons, sch.xareas, {slot: slotOpts, onChange: () => { setupDirty = true; }});
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
        // Choosing colours here settles them, so a War-made army stops asking.
        const saved = await store.saveArmy({faction: f.id, name, scheme: {...sch, wonly: false}, public: editing ? army.public : false}, editing ? army.id : null);
        const moved = editing ? await followColours(army.scheme, sch) : 0;
        setupDirty = false; $("s-msg").textContent = moved ? `Saved. ${plural(moved, "unit")} updated to the new colours.` : "Saved.";
        return saved;
      } catch(err){ console.error(err); $("s-msg").textContent = "Couldn't save: " + errText(err); $("s-msg").classList.add("err"); return null; }
      finally { b.disabled = false; }
    }

    /* Units still on the old army colour for an area follow it to the new colour (and paint).
       Units given their own colour or paint for that area keep it. Returns how many units changed. */
    async function followColours(before, after){
      const old = JSON.parse(JSON.stringify(before)); fillSkin(old, f.id);
      const op = old.slotPaints || {}, np = after.slotPaints || {};
      const keys = ["lens","armour",...PAULDRONS,"secondary","trim","emblem","cloth","metal","skin"]
        .filter(k => old.colors[k] !== after.colors[k] || (op[k] || "") !== (np[k] || ""));
      const tierMoved = after.tiers.map((t, i) => { const o = old.tiers[i]; return !!o && (o.color !== t.color || (o.paint || "") !== (t.paint || "")); });
      if(!keys.length && !tierMoved.some(Boolean)) return 0;
      let n = 0;
      for(const u of await store.listUnits(army.id)){
        const sp = {...(u.slotPaints || {})};
        let touched = false;
        const follow = (k, oldHex, oldPaint, newHex, newPaint) => {
          if(!ART.hexOk(u[k]) || u[k].toLowerCase() !== String(oldHex).toLowerCase()) return;
          if(sp[k] && sp[k] !== oldPaint) return;   // its own paint that happens to share the colour
          u[k] = newHex;
          if(sp[k]){ if(newPaint) sp[k] = newPaint; else delete sp[k]; }
          touched = true;
        };
        keys.forEach(k => follow(k, old.colors[k], op[k] || "", after.colors[k], np[k] || ""));
        const i = u.tier || 0;
        if(tierMoved[i]) follow("helmet", old.tiers[i].color, old.tiers[i].paint || "", after.tiers[i].color, after.tiers[i].paint || "");
        if(touched){ u.slotPaints = sp; await store.saveUnit(army.id, u, u.id, null, false, u); n++; }
      }
      return n;
    }

    function onInput(e){
      const t = e.target;
      if(t.id !== "s-emq") setupDirty = true;
      if(t.id === "s-split"){ sch.splitPauldrons = t.checked; app.querySelectorAll(".cfield.pd-when").forEach(el => el.hidden = !t.checked); renderPreview(); return; }
      if(t.id === "s-emq"){ emq = t.value.trim(); emLimit = 90; renderIcons(); return; }
      if(t.dataset.tname != null){ sch.tiers[+t.dataset.tname].name = t.value; renderPreview(); }
      if(t.dataset.tnote != null){ sch.tiers[+t.dataset.tnote].note = t.value; renderPreview(); }
      if(t.id === "s-reset" && t.checked){ const p = P.presetFor(f.id); Object.assign(sch, p); renderTiers(); renderPreview(); t.checked = false; $("s-msg").textContent = ""; }
    }
    let armed = false;
    async function onClick(e){
      const t = e.target.closest("button"); if(!t) return;
      if(t.dataset.shape || t.dataset.style || t.dataset.scheme || t.dataset.tdel != null || t.id === "s-addtier") setupDirty = true;
      if(t.dataset.scheme){
        // Keep rank names (they may have been edited) but recolour the standard ranks to match.
        const k = known[+t.dataset.scheme];
        sch.colors = {...sch.colors, ...k.colors};
        Object.keys(k.colors).forEach(c => { if(k.paints[c]) sch.slotPaints[c] = k.paints[c]; else delete sch.slotPaints[c]; });
        if(k.shape) sch.shape = k.shape;
        const std = P.tiersFor(f.id, sch.colors, sch.slotPaints);
        sch.tiers.forEach((tr, i) => { if(std[i]){ tr.color = std[i].color; tr.paint = std[i].paint || ""; } });
        renderTiers(); renderPreview();
        $("s-msg").classList.remove("err"); $("s-msg").textContent = `Using the ${k.name} scheme. Save to keep it.`;
        return;
      }
      if(t.dataset.shape){ sch.shape = t.dataset.shape; renderPreview(); return; }
      if(t.id === "s-emmore"){ emLimit += 90; renderIcons(); return; }
      if(t.dataset.style){ sch.style = t.dataset.style; renderPreview(); return; }
      if(t.dataset.tdel != null){ sch.tiers.splice(+t.dataset.tdel, 1); renderTiers(); renderPreview(); return; }
      if(t.id === "s-addtier"){ sch.tiers.push({name: "New rank", note: "", color: sch.colors.secondary, paint: sch.slotPaints.secondary || ""}); renderTiers(); renderPreview(); return; }
      if(t.id === "s-save"){
        const saved = await saveSetup();
        if(saved) location.hash = "#/army/" + saved.id;
        return;
      }
      if(t.id === "s-del"){
        if(!armed){ armed = true; t.classList.add("armed"); t.textContent = "Click again to delete ledger and all its units"; return; }
        t.disabled = true;
        try { await store.removeArmy(army); setupDirty = false; location.hash = "#/livery"; }
        catch(err){ $("s-msg").textContent = "Couldn't delete: " + errText(err); t.disabled = false; }
      }
    }
  }

  /* ============================================================
     Ledger
     ============================================================ */
  async function viewLedger(armyId, openUnit){
    view.name = "ledger";
    let army = await store.getArmy(armyId);
    if(!army){
      app.innerHTML = `<div class="banner"><span class="dot warn"></span>${store.kind === "supabase" && !store.session ? "Sign in to open this ledger." : "This ledger doesn't exist any more."}</div><p class="row-actions"><a class="btn" href="#/livery">Back to your ledgers</a>${store.kind === "supabase" && !store.session ? `<button type="button" class="primary" data-signin>Sign in</button>` : ""}</p>`;
      app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));
      return;
    }
    const f = FBY[army.faction] || {name: army.faction, units: []};
    const scheme = army.scheme;
    PROF = P.profileFor(army.faction);
    fillSkin(scheme, army.faction);
    const LB = PROF.labels;
    const XA = P.extrasFor(army.faction);
    // Unit-detail rows for the extra paint areas a unit has in one group ("details" or "weapons").
    const xaRows = (u, g) => XA[g].filter(a => (u.xareas || {})[a.id]).map(a => {
      const v = u.xareas[a.id], d = PU.describe(v.paint);
      return [esc(a.label), chip(v.hex) + (v.paint ? esc(d.name) + (d.meta ? ` <small class="pmeta">${esc(d.meta)}</small>` : "") : esc(cname(v.hex)))
        + (v.paint && canWrite ? (isOwned(v.paint) ? ` <span class="own ok">Owned</span>` : ` <span class="own no">To buy</span>`) : "")];
    });
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

    /* Points from the datasheet: base cost, then any model-count bracket that applies (later brackets win). */
    function ptsFor(sh, count){
      if(!sh || sh.p == null) return null;
      let p = sh.p;
      (sh.pb || []).forEach(([lo, hi, v]) => { if(count >= lo && (!hi || count <= hi)) p = v; });
      return p;
    }
    const fmt = n => Number(n || 0).toLocaleString("en");

    // A paint picker per colour area (the hidden input #f-<id> holds the colour).
    const colorField = (id, label) => `<label>${label}<span data-slot="${id}"></span></label>`;
    const PREF_KEY = "ll-list-prefs";
    let prefs = {group: "role", sort: "rank"};
    try { prefs = {...prefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}")}; } catch(e){}

    app.innerHTML = `
      <div class="crumbs">${canWrite ? `<a href="#/livery">Livery Ledger</a> / <a href="#/livery/ledgers">Ledgers</a>` : store.session ? `<a href="#/shared">Shared armies</a>` : `<a href="#/">Livery Ledger</a>`} / ${esc(f.name)}</div>
      <header class="top">
        <div class="wh-id">${armyBadge(army, 64)}<div>
          ${!canWrite ? ownerLine(army, "big") : ""}
          <p class="eyebrow">${esc(f.name)}</p>
          <h1>${esc(army.name)}</h1>
          <p class="sub">${canWrite ? `<a href="#/war/army/${esc(army.id)}">Open in War Ledger</a> to plan its lists and battles.`
            : (army.scheme.rec.w + army.scheme.rec.l + army.scheme.rec.d) ? `<span class="rec-chip">${recText(army.scheme.rec)}</span> battle record` : "Colours, units and painting progress."}</p>
        </div></div>
        <div class="stats" aria-live="polite">
          <div class="stat stat-pts"><b><span id="st-pts">0</span><small class="lim"${!canWrite && !scheme.limit ? " hidden" : ""}> / <button type="button" id="b-limit" class="lim-btn" ${canWrite ? "" : "disabled"} aria-label="Change points limit">${scheme.limit ? fmt(scheme.limit) : "set limit"}</button></small></b><span>Points</span><i class="pts-bar" aria-hidden="true"><i id="pts-bar"></i></i></div>
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
          <div class="more">
            <button type="button" class="btn-sm" id="b-more" aria-expanded="false" aria-controls="more-menu">More</button>
            <div class="more-menu" id="more-menu" hidden>
              <a href="#/army/${esc(army.id)}/guide">Painting guide (print)</a>
              <button type="button" id="b-export">Export backup</button>
              ${canWrite ? `<button type="button" id="b-import">Import backup</button>` : ""}
              ${canWrite ? `<hr><button type="button" class="menu-danger" id="b-delarmy">Delete ledger</button>` : ""}
            </div>
          </div>
          ${canWrite ? `<input type="file" id="f-import" accept="application/json,.json" hidden>` : ""}
        </div>
      </div>

      ${canWrite && scheme.wonly ? `<div class="banner colours-prompt" id="wonly-banner"><span class="dot"></span><span><strong>This army was set up in War Ledger</strong>, so it's using the official ${esc(f.name)} colours. Choose your own scheme before you start painting, or keep these.</span><span class="cp-acts"><a class="btn btn-sm primary" href="#/army/${esc(army.id)}/colours">Choose your colours</a><button type="button" class="btn-sm" id="b-keepcol">Keep these colours</button></span></div>` : ""}
      ${!canWrite ? `<div class="banner viewonly"><span class="dot on"></span><span>You're viewing a shared ledger. You can look but not change anything.</span>${store.kind === "supabase" && !store.session ? `<button type="button" class="btn-sm" data-signin>Sign in</button>` : `<span class="vo-social" id="vo-social"></span>`}</div>` : ""}
      <section class="key" id="key" aria-label="Rank colours">${scheme.tiers.map(t => `<div>${tierBadge(scheme, t, 44)}<span><strong>${esc(t.name)}</strong><small>${esc(t.note || cname(t.color) + " " + PROF.head)}</small></span></div>`).join("")}</section>

        <section class="list" aria-labelledby="army-h">
          <div class="list-head">
            <h2 class="eyebrow" id="army-h">${canWrite ? "Your army" : "Their army"}</h2>
            ${canWrite ? `<button type="button" class="primary btn-add" id="b-add">+ Add unit</button>` : ""}
            <div class="list-tools">
              <input type="search" class="search" id="q" placeholder="Search units" aria-label="Search units">
              <div class="filters" id="filters" role="group" aria-label="Filter by status">
                <button type="button" data-f="all" aria-pressed="true">All</button>
                <button type="button" data-f="todo" aria-pressed="false">To paint</button>
                <button type="button" data-f="progress" aria-pressed="false">In progress</button>
                <button type="button" data-f="done" aria-pressed="false">Painted</button>
                <button type="button" data-f="fav" aria-pressed="false" aria-label="Starred">${STAR(true).replace('width="18" height="18"', 'width="14" height="14"')}<span class="lbl-long">Starred</span></button>
              </div>
            </div>
          </div>
          <div class="list-tools arrange">
            ${canWrite ? `<button type="button" class="btn-sm b-select" id="b-select" aria-pressed="false"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/></svg>Select units</button>` : ""}
            <label class="inline">Group by<select id="g-by">
              <option value="none">Nothing</option><option value="role">Role</option><option value="rank">Rank</option><option value="status">Status</option></select></label>
            <label class="inline">Sort by<select id="s-by">
              <option value="rank">Rank</option><option value="name">Name</option><option value="points">Points</option><option value="progress">Progress</option><option value="recent">Recently changed</option></select></label>
          </div>
          <div class="cards" id="cards"><div class="empty">Loading units…</div></div>
        </section>
      ${canWrite ? `<button type="button" class="fab primary" id="b-fab" aria-label="Add a unit">+ Add unit</button>
      <div class="batch-bar" id="batch-bar" role="toolbar" aria-label="Update the selected units" hidden>
        <span class="bb-count" id="bb-count" aria-live="polite">0 selected</span>
        <button type="button" class="btn-sm" id="bb-all">Select all</button>
        <span class="bb-sep" aria-hidden="true"></span>
        <label class="bb-stage"><span>Set stage</span><select id="bb-stage"><option value="">Choose…</option><option value="none">Not started</option>${STAGES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("")}</select></label>
        <button type="button" class="btn-sm" id="bb-done">All painted</button>
        <button type="button" class="btn-sm" id="bb-star">${STAR(true).replace('width="18" height="18"', 'width="14" height="14"')}Star</button>
        <button type="button" class="btn-sm" id="bb-unstar">Unstar</button>
        <button type="button" class="btn-sm danger" id="bb-del">Delete</button>
        <button type="button" class="btn-sm primary" id="bb-exit">Done</button>
      </div>` : ""}

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
            <label class="full hd-when" data-when="helmet bare"><span id="hdetail-lbl">${esc(PROF.detail[0])}</span><input id="f-hdetail" maxlength="60" placeholder="${esc(PROF.detail[1])}"></label>
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
            ${PROF.pauldrons ? `<label class="full check"><input type="checkbox" id="f-split"> Paint each pauldron differently</label>
            ${["l", "r"].map(side => `<div class="pd-group full" data-side="${side}" hidden>
              <h5 class="pd-h">${side === "l" ? "Left" : "Right"} pauldron</h5>
              ${colorField(side + "pauldron", "Colour")}${colorField(side + "psecondary", "Secondary")}${colorField(side + "pemblem", "Emblem colour")}
            </div>`).join("")}` : ""}
          </fieldset>
          <fieldset>
            <legend>${esc(PROF.legends.details)}</legend>
            ${colorField("cloth", esc(LB.cloth))}
            ${colorField("metal", esc(LB.metal))}
            ${PROF.skinAlways ? colorField("skin", esc(LB.skin)) : ""}
            <div class="full xa-field"><span class="xa-cap">More paint areas</span><div class="xa" id="f-xa-d"></div></div>
            <label class="full">${esc(PROF.extras[0])}<input id="f-extras" maxlength="120" placeholder="${esc(PROF.extras[1])}"></label>
          </fieldset>
          <fieldset>
            <legend>Weapons</legend>
            <label class="full">Melee weapon<input id="f-melee" maxlength="120" placeholder="Choose or type"></label>
            <label class="full">Ranged weapon<input id="f-ranged" maxlength="120" placeholder="Choose or type"></label>
            <div class="full xa-field"><span class="xa-cap">Weapon paint areas</span><div class="xa" id="f-xa-w"></div></div>
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
              <button type="button" id="b-save-new"><span class="lbl-long">Save &amp; add another</span><span class="lbl-short">Save &amp; new</span></button>
              <button type="submit" class="primary" id="b-save">Add unit</button>
            </div>
          </footer>
        </form>
      </dialog>

      <dialog id="paintdlg" class="paintdlg" aria-labelledby="pd-h">
        <div class="pd-wrap">
          <header class="ed-top">
            <div class="ed-titles"><h2 id="pd-h">Paints &amp; recipes</h2></div>
            <button type="button" class="btn-sm" id="pd-close">Close</button>
          </header>
          <div class="pd-tabs"><div class="seg" role="group" aria-label="Section" id="pd-tabs">
            <button type="button" data-tab="recipes" aria-pressed="true">Recipes</button>
            ${canWrite ? `<button type="button" data-tab="owned" aria-pressed="false">My paints</button>
            <button type="button" data-tab="buy" aria-pressed="false">To buy <span class="buy-badge" id="buy-tab" hidden></span></button>` : ""}
          </div></div>
          <div class="pd-body" id="pd-body"></div>
        </div>
      </dialog>

      ${canWrite ? `<dialog id="deldlg" class="small" aria-labelledby="dl-h">
        <div class="leavebox">
          <h2 id="dl-h">Delete this ledger?</h2>
          <p id="dl-text"></p>
          <p class="dl-tip">Want a copy first? <button type="button" class="linkish" id="dl-export">Export a backup</button> before you delete.</p>
          <div class="msg" id="dl-msg" role="status"></div>
          <div class="row-actions">
            <button type="button" class="danger armed" id="dl-go">Delete ledger</button>
            <span class="spacer"></span>
            <button type="button" id="dl-cancel">Cancel</button>
          </div>
        </div>
      </dialog>` : ""}

      <dialog id="sharedlg" class="small" aria-labelledby="sh-h">
        <div class="dlg-close"><button type="button" data-close>Close</button></div>
        <div class="sharebox">
          <h2 id="sh-h">Share this ledger</h2>
          ${store.canShare ? `
          <label class="switch"><input type="checkbox" id="sh-on" ${army.public ? "checked" : ""}><span class="track" aria-hidden="true"><i></i></span><span>Share this ledger</span></label>
          <p class="hint">Anyone with the link can view it, and logged-in painters can find it on the <a href="#/shared">Shared armies</a> page. They'll see your units, colours, photos, points and progress, and your display name. They can't change anything, and they don't need an account. Turn this off at any time to stop sharing.</p>
          <div class="copyrow" id="sh-row" ${army.public ? "" : "hidden"}><input id="sh-link" readonly value="${esc(location.origin + location.pathname + "#/army/" + army.id)}" aria-label="Share link"><button type="button" class="primary" id="sh-copy">Copy link</button></div>`
          : `<p class="hint">Sharing needs the online database. Add your Supabase details in <code>js/config.js</code> and sign in to share ledgers.</p>`}
          <div class="msg" id="sh-msg" role="status"></div>
        </div>
      </dialog>

      <dialog id="listdlg" aria-labelledby="ld-h">
        <div class="dlg-close"><button type="button" data-close>Close</button></div>
        <div class="listimp">
          <h2 id="ld-h">Import army list</h2>
          <p class="hint">Paste the text export from the Warhammer 40,000 app, New Recruit or BattleScribe, or a list code or share link from a list-building site. Units are matched to ${esc(f.name)} datasheets.</p>
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
    let selecting = false, picked = new Set();   // batch updates
    let pendingPhoto = null, removePhoto = false, tierTouched = false, pointsTouched = false;
    const form = $("form");
    // Pauldrons last: an unset one copies the unit's armour, secondary or emblem colour.
    const COLOR_IDS = ["helmet","lens","skin","armour","secondary","trim","emblem","cloth","metal",...(PROF.pauldrons ? PAULDRONS : [])].filter(k => k !== "skin" || hasSkin);
    let headTouched = false;
    const getHead = () => (form.querySelector('input[name="head"]:checked') || {}).value || "helmet";
    function setHead(h){
      if(h === "bare" && !PROF.bare) h = "helmet";
      form.querySelectorAll('input[name="head"]').forEach(i => i.checked = i.value === h);
      form.querySelectorAll(".hd-when").forEach(el => el.hidden = !el.dataset.when.split(" ").includes(h));
      $("lens-lbl").textContent = h === "bare" ? "Eyes" : LB.lens;
      $("hdetail-lbl").textContent = h === "bare" ? "Face paint & detail" : PROF.detail[0];
      $("f-hdetail").placeholder = h === "bare" ? "e.g. war paint, scars, tattoos, bionic eye" : PROF.detail[1];
      $("head-hint").textContent = h === "bare" ? `For a painted face: pick a skin tone${skinInHead ? "" : " (under " + PROF.legends.details + ")"} and note any war paint or scars.` : h === "none" ? "No head to paint, e.g. vehicles, monsters and walkers." : "";
      $("head-hint").hidden = h === "helmet";
    }

    function defaults(){
      const c = scheme.colors, t = scheme.tiers[0];
      return {datasheet:"", role:"", name:"", count:5, points:0, stages:[], painted:0, recipes:[], tier:0, helmet:t.color, lens:c.lens, hdetail:"", head:PROF.defaultHead, skin:c.skin,
        armour:c.armour, ...Object.fromEntries(PAULDRONS.map(k => [k, c[k]])), splitPauldrons: !!scheme.splitPauldrons, xareas: JSON.parse(JSON.stringify(scheme.xareas || {})), secondary:c.secondary, trim:c.trim, emblem:c.emblem, shape:"", cloth:c.cloth, metal:c.metal,
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
      o.slotPaints = {};
      COLOR_IDS.forEach(k => { const p = slotApi[k].get().paint; if(p) o.slotPaints[k] = p; });
      o.splitPauldrons = !!($("f-split") && $("f-split").checked);
      o.xareas = JSON.parse(JSON.stringify(unitXa));
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
      COLOR_IDS.forEach(k => {
        // Pauldrons a unit hasn't set yet match that unit's own armour.
        const b = BASE_OF[k], unset = b && !ART.hexOk(d[k]);
        const hex = !unset && ART.hexOk(d[k]) ? d[k] : unset ? slotApi[b].get().hex : (defaults()[k] || "#1f1f22");
        slotApi[k].set({hex, paint: unset ? slotApi[b].get().paint : paintOf(d, k, hex)});
      });
      ["armour","secondary","emblem"].forEach(k => lastBase[k] = slotApi[k].get());
      if($("f-split")){ $("f-split").checked = !!d.splitPauldrons; showSplit(); }
      unitXa = JSON.parse(JSON.stringify(d.xareas != null ? d.xareas : scheme.xareas || {}));
      xaUIs.forEach(x => x.redraw(unitXa));
      fillWeapons(); preview();
    }
    // Paint pickers in the editor. A unit colour that matches the army (or rank) colour shows the
    // army's paint, so units made before paints were picked still read "Abaddon Black".
    function paintOf(u, k, hex){
      const own = (u.slotPaints || {})[k]; if(own) return own;
      const tier = scheme.tiers[u.tier] || scheme.tiers[0] || {};
      const armyHex = k === "helmet" ? tier.color : scheme.colors[k], armyPaint = k === "helmet" ? tier.paint : (scheme.slotPaints || {})[k];
      return armyPaint && hex === armyHex ? armyPaint : "";
    }
    const slotLabel = k => k === "emblem" ? LB.emblem + " colour" : LB[k];
    const slotApi = {};
    const lastBase = {};
    const showSplit = () => form.querySelectorAll(".pd-group").forEach(g => g.hidden = !$("f-split").checked);
    form.querySelectorAll("[data-slot]").forEach(h => {
      const k = h.dataset.slot;
      slotApi[k] = PU.slot(h, {id: "f-" + k, label: slotLabel(k), value: {hex: scheme.colors[k] || "#1f1f22", paint: ""},
        owned: () => owned, mine: () => ownedList, plain: PLAIN,
        swatches: () => Object.keys(scheme.colors).filter(c => COLOR_IDS.includes(c)).map(c => ({hex: scheme.colors[c], paint: (scheme.slotPaints || {})[c] || ""}))
          .concat(scheme.tiers.map(t => ({hex: t.color, paint: t.paint || ""}))),
        onChange: v => {
          if(lastBase[k]){ followBase(k, key => slotApi[key] ? slotApi[key].get() : null, (key, x) => slotApi[key].set(x), lastBase[k], v); lastBase[k] = {...v}; }
          setDirty(true); preview();
        }});
    });
    // Extra paint areas on this unit (start from the army's; adding one starts from the army's paint if it has one).
    let unitXa = {};
    const xaOpts = {slot: {owned: () => owned, mine: () => ownedList, plain: PLAIN,
        swatches: () => Object.keys(scheme.colors).filter(c => COLOR_IDS.includes(c)).map(c => ({hex: scheme.colors[c], paint: (scheme.slotPaints || {})[c] || ""}))},
      start: a => ({...((scheme.xareas || {})[a.id] || {hex: a.hex, paint: a.paint})}), onChange: () => setDirty(true)};
    const xaUIs = [xaUI($("f-xa-d"), XA.details, unitXa, xaOpts), xaUI($("f-xa-w"), XA.weapons, unitXa, xaOpts)];
    const sheetNow = () => { const sel = $("f-sheet").value; return sel && sel !== "__custom" ? sheetFor(sel) : null; };
    const FACE_OPTS = ["War paint","Scars","Tattoos","Bionic eye","Beard","Service studs"];
    combo($("f-melee"), () => (sheetNow() || {}).wm || []);
    combo($("f-ranged"), () => (sheetNow() || {}).wr || []);
    combo($("f-hdetail"), () => getHead() === "bare" ? FACE_OPTS : PROF.detailOpts);
    function fillWeapons(){
      const sh = sheetNow();
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
      const size = sh.ms && sh.ms[0] !== sh.ms[1] ? ` Unit size ${sh.ms[0]}–${sh.ms[1]} models.` : "";
      h.innerHTML = cur === auto ? `Datasheet cost for ${plural(count, "model")}${br ? ` <span>(${esc(sh.p)} base · ${esc(br)})</span>` : ""}.${size}`
        : `Datasheet cost is ${auto} pts.${size} <button type="button" class="linkbtn" id="pts-reset">Use ${auto}</button>`;
    }
    function preview(){
      const u = readForm();
      $("pv-svg").innerHTML = unitBadge(u, scheme, 120);
      $("pv-name").textContent = u.name || u.datasheet || "Unnamed unit";
      const tier = scheme.tiers[u.tier];
      $("pv-meta").textContent = [u.datasheet || "Unit", tier && tier.name, plural(u.count, "model"), u.points ? u.points + "\u00a0pts" : ""].filter(Boolean).join(" · ");
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
        if(filter === "fav" && !u.fav) return false;
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
      const unsetPauldron = k => BASE_OF[k] && !ART.hexOk(u[k]);
      // (Pauldrons come last in COLOR_IDS, so an unset one can copy the unit's armour, secondary or emblem.)
      COLOR_IDS.forEach(k => { if(!ART.hexOk(o[k])) o[k] = k === "helmet" ? (scheme.tiers[o.tier] || scheme.tiers[0]).color : unsetPauldron(k) ? o[BASE_OF[k]] : scheme.colors[k]; });
      o.head = headOf(o);
      o.xareas = u.xareas != null ? u.xareas : (scheme.xareas || {});
      o.slotPaints = {};
      COLOR_IDS.forEach(k => { const p = unsetPauldron(k) ? paintOf(u, BASE_OF[k], o[k]) : paintOf(u, k, o[k]); if(p) o.slotPaints[k] = p; });
      return o;
    };
    // Paint name for a colour area if one was picked, otherwise the colour's name.
    const nameOf = (u, k) => (u.slotPaints || {})[k] ? PU.shortName(u.slotPaints[k]) : cname(u[k]);
    // Star toggle for your own units; on a shared ledger a starred unit just shows the star.
    // big: the labelled "Star / Starred" pill in the unit details.
    const starBtn = (u, big) => canWrite
      ? `<button type="button" class="star${u.fav ? " on" : ""}${big ? " big" : ""}" data-star="${esc(u.id)}" aria-pressed="${!!u.fav}" ${big ? "" : `aria-label="${u.fav ? "Unstar" : "Star"} ${esc(u.name)}" `}title="${u.fav ? "Starred. Click to unstar" : "Star this unit"}">${STAR(u.fav)}${big ? `<span>${u.fav ? "Starred" : "Star"}</span>` : ""}</button>`
      : u.fav ? `<span class="star on${big ? " big" : ""}" title="Starred">${STAR(true)}${big ? "<span>Starred</span>" : ""}</span>` : "";
    // A planned unit has been bought: it now counts as owned (and starts on the sprue until it's built).
    async function markBought(id){
      const u = units.find(x => x.id === id); if(!u || busy || !canWrite) return;
      busy = true;
      try {
        const row = await store.saveUnit(army.id, {...u, own: "owned"}, u.id, null, false, u);
        units = units.map(x => x.id === row.id ? row : x);
        render();
        if($("detail").open && $("detail").dataset.unit === row.id) openDetail(row.id);
        toast(`${row.name} is now in your collection`);
      } catch(err){ msg("Couldn't update: " + errText(err), true); }
      finally { busy = false; }
    }
    async function toggleStar(id){
      const u = units.find(x => x.id === id); if(!u || busy || !canWrite) return;
      busy = true;
      try {
        const row = await store.saveUnit(army.id, {...u, fav: !u.fav}, u.id, null, false, u);
        units = units.map(x => x.id === row.id ? row : x);
        render();
        if($("detail").open && $("detail").dataset.unit === row.id) openDetail(row.id);
        toast(row.fav ? `Starred ${row.name}` : `Unstarred ${row.name}`);
      } catch(err){ msg("Couldn't update: " + errText(err), true); }
      finally { busy = false; }
    }
    const photoSrc = p => safeImg(store.photoUrl ? store.photoUrl(p) : p);
    function cardHtml(u){
      u = withColours(u);
      const img = safeImg(u.image) || ((u.photos || [])[0] ? photoSrc(u.photos[0]) : ""), tier = scheme.tiers[u.tier] || {};
      const nx = canWrite ? nextStep(u) : null;
      const segs = STAGE_KEYS.map(k => `<i class="${(u.stages || []).includes(k) ? "on" : ""}"></i>`).join("");
      const pk = selecting && picked.has(u.id);
      return `<div class="card${u.id === selId && !selecting ? " sel" : ""}${pk ? " picked" : ""}" data-id="${esc(u.id)}">
        ${selecting ? `<span class="pick" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span>` : ""}
        ${img ? `<div class="photo"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>` : ""}
        <div class="body">
          <div class="card-top">${unitBadge(u, scheme, 60)}<div><h3><button type="button" class="card-open" ${selecting ? `aria-pressed="${pk}" aria-label="Select ${esc(u.name)}"` : `aria-label="View ${esc(u.name)}"`}>${esc(u.name)}</button>${u.own === "planned" ? PLANNED_TAG : ""}</h3><div class="type">${esc([u.datasheet && u.datasheet !== u.name ? u.datasheet : "", u.role].filter(Boolean).join(" · ") || "Unit")}</div></div>${u.points ? `<span class="pts">${fmt(u.points)}<small>pts</small></span>` : ""}${starBtn(u)}</div>
          <dl>
            <dt>Rank</dt><dd>${esc(tier.name || "—")}</dd>
            ${u.head === "none" ? "" : `<dt>${u.head === "bare" ? "Face" : esc(LB.helmet)}</dt><dd>${u.head === "bare" ? chip(u.skin) + "Bare head" : chip(u.helmet) + esc(nameOf(u, "helmet"))}${u.hdetail ? ", " + esc(u.hdetail) : ""}</dd>`}
            <dt>${esc(LB.armour)}</dt><dd>${chip(u.armour)}${esc(nameOf(u, "armour"))}, ${esc(nameOf(u, "trim"))} ${esc(LB.trim.toLowerCase())}</dd>
            ${PROF.skinAlways ? `<dt>${esc(LB.skin)}</dt><dd>${chip(u.skin)}${esc(nameOf(u, "skin"))}</dd>` : ""}
            ${u.melee || u.ranged ? `<dt>Weapons</dt><dd>${esc(weaponsText(u))}</dd>` : ""}
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
      if(!$("cards")) return;   // the ledger was left while something was loading
      // Units saved before points existed pick up their datasheet cost (kept when the unit is next saved).
      units.forEach(u => { if(!u.points && u.datasheet){ const p = ptsFor(sheetFor(u.datasheet), u.count); if(p) u.points = p; } });
      const list = visible(), c = $("cards");
      if(!list.length){ c.innerHTML = `<div class="empty">${units.length ? (filter === "fav" && !query ? "No starred units yet. Tap the star on a unit to keep it here." : "No units match.") : canWrite ? "No units yet. Pick a datasheet in the form, or import your army list." : "No units in this ledger yet."}</div>`; }
      else {
        // Each group sizes to its cards, so small groups sit side by side instead of one card per row.
        const groups = groupsOf(list), grouped = !!groups[0][0];
        c.classList.toggle("grouped", grouped);
        c.innerHTML = grouped ? groups.map(([name, us]) => `<section class="grp" style="--n:${Math.min(us.length, 4)}">
            <h3 class="group-h"><span>${esc(name)}</span><small>${plural(us.length, "unit")} · ${fmt(us.reduce((a, u) => a + (u.points || 0), 0))} pts · ${us.reduce((a, u) => a + u.painted, 0)}/${us.reduce((a, u) => a + u.count, 0)} painted</small></h3>
            <div class="grp-cards">${us.map(cardHtml).join("")}</div></section>`).join("")
          : list.map(cardHtml).join("");
      }
      const ownedUnits = units.filter(u => u.own !== "planned");   // planned units aren't counted until they're bought
      const models = ownedUnits.reduce((a, u) => a + (+u.count || 0), 0);
      const done = ownedUnits.reduce((a, u) => a + (+u.painted || 0), 0);
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
    // Which unit-detail sections are open, remembered in this browser (recipes start closed).
    let detailOpen = {};
    try { detailOpen = JSON.parse(localStorage.getItem("ll-detail-open") || "{}") || {}; } catch(e){}
    $("detail-body").addEventListener("toggle", e => {
      const d = e.target; if(!d.matches || !d.matches("details.dsec")) return;
      detailOpen[d.dataset.k] = d.open;
      try { localStorage.setItem("ll-detail-open", JSON.stringify(detailOpen)); } catch(err){}
    }, true);
    function openDetail(id){
      const found = units.find(x => x.id === id); if(!found) return;
      const u = withColours(found);
      $("detail").dataset.unit = id;
      const img = safeImg(u.image), tier = scheme.tiers[u.tier] || {};
      const col = hex => ART.hexOk(hex) ? chip(hex) + esc(cname(hex)) : "";
      // Colour area: the paint (with Owned / To buy) or the plain colour.
      const colk = k => { if(!ART.hexOk(u[k])) return ""; const p = u.slotPaints[k];
        const d = PU.describe(p);
        return chip(u[k]) + (p ? esc(d.name) + (d.meta ? ` <small class="pmeta">${esc(d.meta)}</small>` : "") : esc(cname(u[k]))) + (p && canWrite ? (isOwned(p) ? ` <span class="own ok">Owned</span>` : ` <span class="own no">To buy</span>`) : ""); };
      // Collapsible sections: open unless closed before (remembered in this browser); recipes start closed.
      const box = (key, title, body, openByDefault = true) => {
        const open = key in detailOpen ? detailOpen[key] : openByDefault;
        return `<details class="dsec" data-k="${esc(key)}"${open ? " open" : ""}><summary><h3 class="dsec-h">${title}</h3></summary>${body}</details>`;
      };
      const sec = (title, rows, key) => { const r = rows.filter(x => x[1]); return r.length ? box(key || title, title, `<dl>${r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`) : ""; };
      $("detail-body").innerHTML = `<div class="detail">
        <div class="media">${(() => {
          const shots = [img ? {src: img, main: true} : null, ...(u.photos || []).map(p => ({src: photoSrc(p), path: p}))].filter(x => x && x.src);
          const first = shots[0];
          return `<div class="media-main" id="dt-main">${first ? `<img src="${esc(first.src)}" alt="Photo of ${esc(u.name)}">` : unitBadge(u, scheme, 180)}</div>
            ${shots.length > 1 || canWrite ? `<div class="gallery" role="group" aria-label="Photos of ${esc(u.name)}">
              ${shots.map((x, i) => `<div class="g-item${i === 0 ? " on" : ""}"><button type="button" class="g-thumb" data-show="${esc(x.src)}" aria-label="Show photo ${i + 1}"><img src="${esc(x.src)}" alt="" loading="lazy"></button>${canWrite && x.path ? `<button type="button" class="g-rm" data-rmphoto="${esc(x.path)}" aria-label="Remove this photo" title="Remove photo">×</button>` : ""}</div>`).join("")}
              ${canWrite && (u.photos || []).length < S.MAX_PHOTOS ? `<label class="g-add" title="Add photos"><input type="file" accept="image/*" multiple data-addphoto="${esc(u.id)}" hidden><span aria-hidden="true">+</span><small>Add photo</small></label>` : ""}
            </div>` : ""}`;
        })()}</div>
        <div class="info">
          <div><h2 id="dt-name">${esc(u.name)}</h2>
            <div class="meta">${esc(u.datasheet || "Unit")}${u.role ? " · " + esc(u.role) : ""} · ${plural(u.count, "model")}${u.points ? " · " + fmt(u.points) + "\u00a0pts" : ""}</div>
            ${u.own === "planned" ? `<p class="plan-note">${PLANNED_TAG}<span>Not bought yet. Plan its colours now; it counts towards your totals once you buy it.</span>${canWrite ? `<button type="button" class="btn-sm" data-bought="${esc(u.id)}">I bought it</button>` : ""}</p>` : ""}</div>
          <div class="row">${img ? unitBadge(u, scheme, 64) : ""}<span class="row-end">${starBtn(u, true)}<span class="pill s-${esc(u.status)}">${esc(u.status === "done" ? "Painted" : stageLabel(u))}</span></span></div>
          ${box("painting", "Painting", `<div class="stage-list">${STAGES.map(([k, l]) => `<span class="${(u.stages || []).includes(k) ? "on" : ""}">${l}</span>`).join("")}</div>
            <p class="prose" style="margin-top:10px">${u.painted} of ${plural(u.count, "model")} painted</p>`)}
          ${recipesOf(u).map(r => box("recipes", `Recipe · ${esc(r.name)}${r.area ? " · " + esc(r.area) : ""}`, stepsHtml(r), false)).join("")}
          ${sec("Rank", [["Rank", esc(tier.name)], ["Who", esc(tier.note)]], "rank")}
          ${u.head === "none" ? sec(esc(PROF.legends.head), [["Head", "None (vehicle or monster)"]], "head")
            : u.head === "bare" ? sec(esc(PROF.legends.head), [["Head", "Bare head"], ["Skin", colk("skin")], ["Eyes", colk("lens")], ["Face paint", esc(u.hdetail)]], "head")
            : sec(esc(PROF.legends.head), [[esc(LB.helmet), colk("helmet")], [esc(LB.lens), colk("lens")], ["Detail", esc(u.hdetail)]], "head")}
          ${sec(esc(PROF.legends.body), [[esc(LB.armour), colk("armour")], [esc(LB.secondary), colk("secondary")], [esc(LB.trim), colk("trim")], [esc(LB.emblem), (u.shape || scheme.shape) === "none" ? "None" : colk("emblem") + " · " + esc(P.emblemName(u.shape || scheme.shape))],
            ...(PROF.pauldrons && u.splitPauldrons ? PAULDRONS.map(k => [esc(LB[k]), colk(k)]) : [])], "body")}
          ${sec(esc(PROF.legends.details), [[esc(LB.cloth), colk("cloth")], [esc(LB.metal), colk("metal")], [esc(LB.skin), PROF.skinAlways ? colk("skin") : ""], ...xaRows(u, "details"), ["Extras", esc(u.extras)]], "details")}
          ${sec("Weapons", [["Melee", esc(u.melee)], ["Ranged", esc(u.ranged)], ...xaRows(u, "weapons")], "weapons")}
          ${u.paints ? box("paintnotes", "Paint notes", `<p class="prose">${esc(u.paints)}</p>`) : ""}
          ${u.notes ? box("notes", "Notes", `<p class="prose">${esc(u.notes)}</p>`) : ""}
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
        $("f-tier").value = String(t); slotApi.helmet.set({hex: scheme.tiers[t].color, paint: scheme.tiers[t].paint || ""});
      }
      if(!headTouched) setHead(sh ? autoHead(sh.r) : PROF.defaultHead);
      if(sh && !selId) $("f-count").value = minModels(sh);
      if(sh && !pointsTouched){ const p = ptsFor(sh, Math.max(1, parseInt($("f-count").value, 10) || 1)); if(p != null) $("f-points").value = p; }
      fillWeapons(); preview();
    });
    if($("f-split")) $("f-split").addEventListener("change", showSplit);
    $("f-tier").addEventListener("change", () => { tierTouched = true; const t = scheme.tiers[+$("f-tier").value]; if(t) slotApi.helmet.set({hex: t.color, paint: t.paint || ""}); preview(); });

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
      u.fav = !!(cur && cur.fav);
      u.photos = cur ? cur.photos || [] : [];
      // Kept from War Ledger: built count, battle-ready override and purchase details.
      if(cur) WAR_FIELDS.forEach(k => { u[k] = cur[k]; });
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
      if(selecting){ const c = e.target.closest(".card"); if(c){ e.stopPropagation(); togglePick(c.dataset.id); } return; }
      const st = e.target.closest("[data-step]");
      if(st){ e.stopPropagation(); stepUnit(st.dataset.step); return; }
      const sr = e.target.closest("[data-star]");
      if(sr){ e.stopPropagation(); toggleStar(sr.dataset.star); return; }
      const c = e.target.closest(".card"); if(c) openDetail(c.dataset.id);
    });
    $("cards").addEventListener("keydown", e => { if((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")){ e.preventDefault(); if(selecting) togglePick(e.target.dataset.id); else openDetail(e.target.dataset.id); } });

    /* ---------- batch updates: select several units, then change them together ---------- */
    function setSelecting(on){
      selecting = on; picked.clear();
      document.body.classList.toggle("selecting", on);
      $("batch-bar").hidden = !on;
      $("b-select").setAttribute("aria-pressed", on);
      $("bb-del").classList.remove("armed"); $("bb-del").textContent = "Delete";
      render(); updateBatch();
    }
    function togglePick(id){
      if(picked.has(id)) picked.delete(id); else picked.add(id);
      const c = $("cards").querySelector(`.card[data-id="${CSS.escape(id)}"]`);
      if(c){ c.classList.toggle("picked", picked.has(id)); const o = c.querySelector(".card-open"); if(o) o.setAttribute("aria-pressed", picked.has(id)); }
      updateBatch();
    }
    function updateBatch(){
      const n = picked.size;
      $("bb-count").textContent = `${n} selected`;
      ["bb-stage", "bb-done", "bb-star", "bb-unstar", "bb-del"].forEach(id => $(id).disabled = !n || busy);
      const vis = visible();
      $("bb-all").textContent = vis.length && vis.every(u => picked.has(u.id)) ? "Select none" : "Select all";
      $("bb-del").classList.remove("armed"); $("bb-del").textContent = n ? `Delete ${n}` : "Delete";
    }
    async function batchSave(label, change){
      const list = units.filter(u => picked.has(u.id)); if(!list.length || busy) return;
      busy = true; updateBatch(); $("bb-count").textContent = `Updating ${plural(list.length, "unit")}…`;
      let ok = 0;
      for(const u of list){
        try { const row = await store.saveUnit(army.id, {...u, ...change(u)}, u.id, null, false, u); units = units.map(x => x.id === row.id ? row : x); ok++; }
        catch(err){ console.error(err); }
      }
      busy = false; render(); updateBatch();
      toast(ok === list.length ? `${label}: ${plural(ok, "unit")}` : `Updated ${ok} of ${list.length}. Some couldn't be saved.`);
    }
    if(canWrite){
      $("b-select").addEventListener("click", () => setSelecting(!selecting));
      $("bb-exit").addEventListener("click", () => setSelecting(false));
      $("bb-all").addEventListener("click", () => {
        const vis = visible(), all = vis.length && vis.every(u => picked.has(u.id));
        vis.forEach(u => all ? picked.delete(u.id) : picked.add(u.id));
        render(); updateBatch();
      });
      $("bb-stage").addEventListener("change", e => {
        const k = e.target.value; e.target.value = ""; if(!k) return;
        const i = STAGE_KEYS.indexOf(k);
        const name = k === "none" ? "Not started" : STAGES[i][1];
        batchSave(`Set to ${name}`, u => k === "none" ? {stages: [], painted: 0} : {stages: STAGE_KEYS.slice(0, i + 1), painted: k === "varnish" ? u.count : Math.min(u.painted, u.count)});
      });
      $("bb-done").addEventListener("click", () => batchSave("All painted", u => ({stages: STAGE_KEYS.slice(), painted: u.count})));
      $("bb-star").addEventListener("click", () => batchSave("Starred", () => ({fav: true})));
      $("bb-unstar").addEventListener("click", () => batchSave("Unstarred", () => ({fav: false})));
      $("bb-del").addEventListener("click", async () => {
        const b = $("bb-del"), list = units.filter(u => picked.has(u.id)); if(!list.length || busy) return;
        if(!b.classList.contains("armed")){ b.classList.add("armed"); b.textContent = `Click again to delete ${list.length}`; return; }
        busy = true; updateBatch(); $("bb-count").textContent = `Deleting ${plural(list.length, "unit")}…`;
        let ok = 0;
        for(const u of list){ try { await store.removeUnit(u, false); units = units.filter(x => x.id !== u.id); picked.delete(u.id); ok++; } catch(err){ console.error(err); } }
        busy = false; render(); updateBatch();
        toast(ok === list.length ? `Deleted ${plural(ok, "unit")}` : `Deleted ${ok} of ${list.length}. Some couldn't be deleted.`);
      });
      document.addEventListener("keydown", onBatchKey);
    }
    function onBatchKey(e){ if(e.key === "Escape" && selecting && !document.querySelector("dialog[open]")) setSelecting(false); }
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
      const sr = e.target.closest("[data-star]");
      if(sr){ toggleStar(sr.dataset.star); return; }
      const bo = e.target.closest("[data-bought]");
      if(bo){ markBought(bo.dataset.bought); return; }
      const sh = e.target.closest("[data-show]");
      if(sh){
        $("dt-main").innerHTML = `<img src="${esc(sh.dataset.show)}" alt="">`;
        $("detail").querySelectorAll(".g-item").forEach(g => g.classList.toggle("on", g.contains(sh)));
        return;
      }
      const rp = e.target.closest("[data-rmphoto]");
      if(rp){
        const u = units.find(x => x.id === $("detail").dataset.unit); if(!u || busy) return;
        if(!rp.classList.contains("armed")){ rp.classList.add("armed"); rp.textContent = "Remove?"; setTimeout(() => { if(rp.isConnected){ rp.classList.remove("armed"); rp.textContent = "×"; } }, 3000); return; }
        busy = true;
        try { const row = await store.removeUnitPhoto(army.id, u, rp.dataset.rmphoto); units = units.map(x => x.id === row.id ? row : x); render(); openDetail(row.id); toast("Photo removed"); }
        catch(err){ toast("Couldn't remove the photo: " + errText(err)); }
        finally { busy = false; }
        return;
      }
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
    async function onDetailChange(e){
      const inp = e.target.closest("[data-addphoto]"); if(!inp) return;
      const files = [...(inp.files || [])]; inp.value = "";
      let u = units.find(x => x.id === inp.dataset.addphoto); if(!u || !files.length || busy) return;
      const room = S.MAX_PHOTOS - (u.photos || []).length, pick = files.slice(0, room);
      const tile = inp.closest(".g-add"); if(tile){ tile.classList.add("busy"); tile.querySelector("small").textContent = "Uploading…"; }
      busy = true; let added = 0;
      try {
        for(const f of pick){ u = await store.addUnitPhoto(army.id, u, f); units = units.map(x => x.id === u.id ? u : x); added++; }
      } catch(err){ toast("Couldn't add the photo: " + errText(err)); }
      finally { busy = false; }
      render(); openDetail(u.id);
      if(added) toast(files.length > room ? `Added ${plural(added, "photo")} (${S.MAX_PHOTOS} is the most per unit)` : `Added ${plural(added, "photo")}`);
    }
    $("detail").addEventListener("change", onDetailChange);
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
    const {parseCode, parseList} = makeListReader(army.faction);
    let parsed = null;
    function renderParsed(){
      const box = $("ld-out");
      if(!parsed){ box.innerHTML = ""; return; }
      const us = parsed.units;
      $("ld-sum").textContent = us.length ? [parsed.detachment, plural(us.length, "unit"), fmt(us.reduce((a, u) => a + (u.include ? u.points : 0), 0)) + "\u00a0pts"].filter(Boolean).join(" · ") : "";
      box.innerHTML = (us.length ? `<div class="ld-table">
          <div class="ld-row ld-head" aria-hidden="true"><span></span><span>Datasheet</span><span>Models</span><span>Points</span><span>Weapons</span></div>
          ${us.map((u, i) => `<label class="ld-row"><span><input type="checkbox" data-inc="${i}" ${u.include ? "checked" : ""} aria-label="Include ${esc(u.name)}"></span><span><strong>${esc(u.name)}</strong><small>${esc(u.sheet.r)}${u.notes.length ? " · " + esc(u.notes.join(", ")) : ""}</small></span><span><input type="number" min="1" max="99" data-cnt="${i}" value="${u.count}" aria-label="Models in ${esc(u.name)}"></span><span>${u.points}</span><span>${esc([...u.melee, ...u.ranged].slice(0, 3).join(", ") || "—")}</span></label>`).join("")}
        </div>` : `<p class="hint">No ${esc(f.name)} datasheets found in that text. Check the list is for this faction.</p>`)
        + (parsed.codeFactionId && parsed.codeFactionId !== army.faction ? `<p class="hint warn">This list is for ${esc(parsed.codeFaction)}, but this ledger is ${esc(f.name)}. Units were matched to ${esc(f.name)} datasheets where possible, and the rest were added as allies.</p>` : "")
        + (parsed.unmatched.length ? `<p class="hint">Not matched to a datasheet: ${esc(parsed.unmatched.slice(0, 12).join(", "))}${parsed.unmatched.length > 12 ? "…" : ""}</p>` : "");
      $("ld-actions").hidden = !us.length;
      $("ld-add").textContent = `Add ${plural(us.filter(u => u.include).length, "unit")}`;
      $("ld-lim-wrap").hidden = !parsed.limit || parsed.limit === scheme.limit;
      $("ld-lim-text").textContent = `Set points limit to ${fmt(parsed.limit)}`;
    }
    if(canWrite){
      $("b-list").addEventListener("click", () => { $("ld-msg").textContent = ""; $("listdlg").showModal(); $("ld-text").focus(); });
      const readList = () => { const v = $("ld-text").value; parsed = parseCode(v) || parseList(v); renderParsed(); };
      $("ld-read").addEventListener("click", readList);
      $("ld-text").addEventListener("paste", () => setTimeout(readList, 0));
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

    if($("b-keepcol")) $("b-keepcol").addEventListener("click", async e => {
      e.target.disabled = true;
      try { army = await store.saveArmy({faction: army.faction, name: army.name, scheme: {...army.scheme, wonly: false}, public: army.public}, army.id); scheme.wonly = false; $("wonly-banner").remove(); toast("Keeping the official colours. Change them any time with Edit colours."); }
      catch(err){ e.target.disabled = false; msg("Couldn't save: " + errText(err), true); }
    });
    // One ledger, with its photos and the army's lists and battle reports from War Ledger.
    $("b-export").addEventListener("click", async () => {
      const war = canWrite ? await warRecords([army.id]) : {lists: [], games: []};
      downloadJSON({app: "livery-ledger", kind: "army", version: 6, exported: new Date().toISOString(),
        army: {id: army.id, faction: army.faction, name: army.name, scheme: army.scheme},
        units: units.map(backupUnit), lists: war.lists, games: war.games}, `livery-${slug(army.name)}-${new Date().toISOString().slice(0, 10)}.json`);
      msg("Backup downloaded.");
    });
    if(canWrite){
      $("b-import").addEventListener("click", () => $("f-import").click());
      $("f-import").addEventListener("change", async e => {
        const file = e.target.files && e.target.files[0]; e.target.value = "";
        if(!file) return;
        try {
          const b = readBackup(JSON.parse(await file.text()));
          if(!b || !b.single || !b.ledgers[0].units.length) throw new Error("empty");
          msg("Importing…");
          const r = await restoreBackup(b, {into: army.id, progress: (i, n) => msg(`Importing ${i} of ${n} units…`)});
          units = await store.listUnits(army.id); newUnit(false);
          msg(`Imported ${plural(r.units, "unit")}${r.lists || r.games ? `, ${[r.lists ? plural(r.lists, "army list") : "", r.games ? plural(r.games, "battle report") : ""].filter(Boolean).join(" and ")}` : ""}.${r.photosMissed ? ` ${plural(r.photosMissed, "photo")} couldn't be brought back.` : ""}`);
        } catch(err){ console.error(err); msg(err instanceof SyntaxError ? "That file isn't a Livery Ledger backup." : err && err.message === "empty" ? "That file isn't a backup of a single ledger. To restore everything, use Restore from a file in Settings." : "Couldn't import that file: " + errText(err), true); }
      });
    }
    if(canWrite){
      // Delete the whole ledger, after a confirmation that says exactly what goes with it.
      const dd = $("deldlg");
      $("b-delarmy").addEventListener("click", () => {
        const n = units.length, photos = units.filter(u => u.image).length;
        const base = `This permanently deletes ${army.name}` +
          (n ? ` and its ${plural(n, "unit")}${photos ? `, including ${plural(photos, "photo")}` : ""}` : "");
        $("dl-text").textContent = base + ". It can't be undone.";
        // The same army is in War Ledger, so its army lists and battle reports go with it.
        Promise.all([store.listLists().catch(() => []), store.listGames().catch(() => [])]).then(([ls, gs]) => {
          const nl = ls.filter(l => l.armyId === army.id).length, ng = gs.filter(g => g.armyId === army.id).length;
          if(dd.open) $("dl-text").textContent = base + `. It's the same army in War Ledger, so it goes from there too${nl || ng ? `, along with its ${[nl ? plural(nl, "army list") : "", ng ? plural(ng, "battle report") : ""].filter(Boolean).join(" and ")}` : ""}. It can't be undone.`;
        });
        $("dl-msg").textContent = ""; $("dl-go").disabled = false;
        dd.showModal(); $("dl-cancel").focus();
      });
      $("dl-cancel").addEventListener("click", () => dd.close());
      dd.addEventListener("click", e => { if(e.target === dd) dd.close(); });
      $("dl-export").addEventListener("click", () => $("b-export").click());
      $("dl-go").addEventListener("click", async () => {
        const b = $("dl-go"); b.disabled = true; b.textContent = "Deleting…";
        try {
          await store.removeArmy(army);
          setDirty(false); view.guard = null; dd.close(); location.hash = "#/livery";
        } catch(err){
          $("dl-msg").textContent = "Couldn't delete: " + errText(err); $("dl-msg").classList.add("err");
          b.disabled = false; b.textContent = "Delete ledger";
        }
      });
    }
    const onBeforeUnload = e => { if(dirty && canWrite){ e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    // Rank strip scrolls sideways on phones: fade the right edge while there's more to see.
    const keyFade = () => { const k = $("key"); if(k) k.classList.toggle("more-right", k.scrollLeft + k.clientWidth < k.scrollWidth - 4); };
    $("key").addEventListener("scroll", keyFade, {passive: true}); window.addEventListener("resize", keyFade); keyFade();
    // "More" menu (backups): closes on a pick, a click elsewhere or Escape.
    const moreOpen = on => { $("more-menu").hidden = !on; $("b-more").setAttribute("aria-expanded", on); };
    $("b-more").addEventListener("click", e => { e.stopPropagation(); moreOpen($("more-menu").hidden); });
    $("more-menu").addEventListener("click", () => moreOpen(false));
    const onDocMore = e => { if(!e.target.closest(".more")) moreOpen(false); };
    const onKeyMore = e => { if(e.key === "Escape" && !$("more-menu").hidden){ moreOpen(false); $("b-more").focus(); } };
    document.addEventListener("click", onDocMore); document.addEventListener("keydown", onKeyMore);
    view.guard = () => okToLeave();
    view.cleanup = () => {
      document.removeEventListener("keydown", onBatchKey); document.body.classList.remove("selecting");
      document.removeEventListener("click", onDocMore); document.removeEventListener("keydown", onKeyMore); window.removeEventListener("resize", keyFade);
      window.removeEventListener("beforeunload", onBeforeUnload); $("detail").removeEventListener("click", onDetailClick); $("detail").removeEventListener("change", onDetailChange); clearPending();
      clearTimeout(toastTimer); $("toast").hidden = true; if(toastDone){ const fn = toastDone; toastDone = null; fn(); }
      view.guard = null;
    };

    /* ============================================================
       Paint recipes and paints you own
       ============================================================ */
    const TECHNIQUES = ["Prime","Basecoat","Layer","Shade / wash","Contrast","Dry brush","Edge highlight","Highlight","Glaze","Technical","Varnish","Other"];
    const AREAS = PROF.areas;
    let owned = new Set(), ownedList = [];
    const isOwned = label => owned.has(PU.norm(label));
    const recipesOf = u => (u.recipes || []).map(id => (scheme.recipes || []).find(r => r.id === id)).filter(Boolean);
    const paintsOf = r => (r.steps || []).map(s => s.p).filter(Boolean);
    const missingFor = u => [...new Set(recipesOf(u).flatMap(paintsOf).filter(p => !isOwned(p)).map(PU.norm))];
    // A paint's short name with its brand and range underneath, for lists.
    const paintLine = label => { const d = PU.describe(label); return `<strong>${esc(d.name)}</strong>${d.meta ? `<small class="pmeta">${esc(d.meta)}</small>` : ""}`; };
    function stepsHtml(r){
      if(!r.steps.length) return `<p class="prose">No steps yet.</p>`;
      return `<ol class="steps">${r.steps.map(st => { const d = PU.describe(st.p);
        return `<li>${PU.swatch(st.p)}<span class="st-x"><span class="st-t">${esc(st.t || "Step")}</span><span class="st-p">${esc(d.name || "—")}${d.meta ? `<small>${esc(d.meta)}</small>` : ""}</span></span>${canWrite && st.p ? (isOwned(st.p) ? `<span class="own ok">Owned</span>` : `<span class="own no">To buy</span>`) : ""}</li>`; }).join("")}</ol>${r.notes ? `<p class="prose r-notes">${esc(r.notes)}</p>` : ""}`;
    }
    function renderRecipePicks(checked){
      const box = $("f-recipes"); if(!box) return;   // the ledger was left while something was loading
      const list = scheme.recipes || [], inLib = libLive().length;
      const on = new Set(checked || [...box.querySelectorAll("input:checked")].map(i => i.value));
      box.innerHTML = list.length ? list.map(r => `<label class="stage"><input type="checkbox" value="${esc(r.id)}" ${on.has(r.id) ? "checked" : ""}><span>${esc(r.name)}${r.area ? `<small>${esc(r.area)}</small>` : ""}</span></label>`).join("")
        : `<p class="hint-sm">${inLib ? `No recipes in this ledger yet. You have ${plural(inLib, "recipe")} in your library.` : "No recipes yet. Write one once, then tick it on every unit that uses it."}</p>`;
      $("f-manage-recipes").textContent = list.length ? "Manage recipes" : inLib ? "Add from your library" : "Create a recipe";
    }

    /* Recipe library: every recipe you save is also kept on your account (or in this browser), so
       any of your ledgers can use it. Each ledger keeps its own copy too, which is what people see
       on a shared ledger. The newest copy of a recipe wins, so an edit in one ledger reaches the
       others the next time they're opened. */
    let library = null, libState = "";   // libState: "", "loading", "setup" (no recipes table) or "error"
    const libLive = () => (library || []).filter(r => !r.deleted);
    const recipeOnly = r => ({id: r.id, name: r.name, area: r.area, notes: r.notes, steps: r.steps, at: r.at || ""});
    const sameRecipe = (a, b) => JSON.stringify([a.name, a.area, a.notes, a.steps]) === JSON.stringify([b.name, b.area, b.notes, b.steps]);
    const refreshRecipes = () => { renderRecipePicks(); if($("paintdlg") && $("paintdlg").open && !editingRecipe) renderPaints(); };
    async function loadLibrary(){
      if(!canWrite || !store.getLibrary) return;
      libState = "loading";
      try { library = await store.getLibrary(); libState = ""; }
      catch(err){ console.warn("Couldn't load the recipe library", err); library = null; libState = err.code === "nolib" ? "setup" : "error"; refreshRecipes(); return; }
      const byId = new Map(library.map(r => [r.id, r]));
      const push = [];
      let changed = false;
      const list = (scheme.recipes || []).map(r => {
        const lib = byId.get(r.id);
        if(!lib){ push.push(r); return r; }           // new to the library
        if(lib.deleted) return r;                     // deleted from the library: this ledger keeps its copy
        if((lib.at || "") > (r.at || "")){ if(!sameRecipe(lib, r)) changed = true; return recipeOnly(lib); }
        if((r.at || "") > (lib.at || "") && !sameRecipe(lib, r)) push.push(r);
        return r;
      });
      try {
        if(push.length) await saveToLibrary(push);
        if(changed) await saveRecipes(list);
      } catch(err){ console.warn("Couldn't sync recipes with the library", err); }
      refreshRecipes();
    }
    async function saveToLibrary(rows){
      if(!library) return;   // library not available: the ledger's own copy is still saved
      await store.putLibrary(rows);
      const ids = new Set(rows.map(r => r.id));
      library = library.filter(r => !ids.has(r.id)).concat(rows.map(r => ({...recipeOnly(r), deleted: r.deleted === true})));
    }
    function librarySection(){
      const head = `<h3 class="em-h">Your recipe library</h3>`;
      if(libState === "setup") return `<section class="lib">${head}<p class="hint">To reuse recipes in your other ledgers, add the recipes table to Supabase: open the SQL editor and run <code>supabase/recipes.sql</code> from this project. Recipes in this ledger work either way.</p></section>`;
      if(libState === "error") return `<section class="lib">${head}<p class="hint">Couldn't load your recipe library. Check your connection and reopen this ledger.</p></section>`;
      if(!library) return `<section class="lib">${head}<p class="hint">Loading your recipe library…</p></section>`;
      const here = new Set((scheme.recipes || []).map(r => r.id));
      const list = libLive().filter(r => !here.has(r.id)).sort((a, b) => a.name.localeCompare(b.name));
      if(!list.length) return `<section class="lib">${head}<p class="hint">${libLive().length ? "Every recipe in your library is already in this ledger." : "Recipes you save are kept here, ready to add to your other ledgers."}</p></section>`;
      return `<section class="lib">
        <div class="lib-head">${head}<button type="button" class="btn-sm" data-act="lib-add-all">Add all (${list.length})</button></div>
        <p class="hint">Recipes from your other ledgers. Add one to use it here. Changes to a recipe carry across to every ledger that has it.</p>
        <div class="recipes">${list.map(r => `<article class="recipe lib-r">
          <header><div><h3>${esc(r.name)}</h3><small>${esc([r.area, plural(r.steps.length, "step")].filter(Boolean).join(" · "))}</small></div>
          <div class="row-actions"><button type="button" class="btn-sm primary" data-act="lib-add" data-id="${esc(r.id)}">Add</button><button type="button" class="btn-sm danger${libDelArmed === r.id ? " armed" : ""}" data-act="lib-del" data-id="${esc(r.id)}">${libDelArmed === r.id ? "Click again to delete" : "Delete"}</button></div></header>
          <p class="lib-steps">${r.steps.filter(st => st.p).map(st => `<span>${PU.swatch(st.p)}${esc(st.p)}</span>`).join(`<i aria-hidden="true">→</i>`) || "No paints yet."}</p>
        </article>`).join("")}</div></section>`;
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
      const add = (p, why) => {
        if(!p || isOwned(p)) return;
        const k = PU.norm(p); if(!need.has(k)) need.set(k, {label: p, recipes: []});
        if(!need.get(k).recipes.includes(why)) need.get(k).recipes.push(why);
      };
      (scheme.recipes || []).filter(r => !onlyUsed || used.has(r.id)).forEach(r => paintsOf(r).forEach(p => add(p, r.name)));
      // Paints picked for colour areas: the army's colours, its ranks and each unit's own choices.
      COLOR_IDS.forEach(k => add((scheme.slotPaints || {})[k], k === "emblem" ? slotLabel(k) : slotLabel(k) + " colour"));
      scheme.tiers.forEach(t => add(t.paint, `${t.name} rank`));
      units.forEach(u => Object.values(u.slotPaints || {}).forEach(p => add(p, u.name)));
      [...XA.details, ...XA.weapons].forEach(a => { const v = (scheme.xareas || {})[a.id]; if(v) add(v.paint, a.label); });
      units.forEach(u => Object.values(u.xareas || {}).forEach(v => add(v.paint, u.name)));
      return [...need.values()].sort((a, b) => a.label.localeCompare(b.label));
    }
    function updateBuyBadge(){
      if(!canWrite) return;
      const n = shoppingList(true).length;
      [$("buy-badge"), $("buy-tab")].forEach(b => { if(!b) return; b.hidden = !n; b.textContent = n; });
    }

    let pdTab = "recipes", editingRecipe = null, buyAll = false, ownedQuery = "", libDelArmed = "";
    let suggesting = null;   // starter recipes waiting to be added: [{recipe, on, have}]
    // Starter recipes from this army's colours (one per colour area that has a paint picked).
    const SUG_AREAS = [["armour", "Armour"], ["secondary", "Secondary"], ["trim", "Trim"], ["cloth", "Robes / cloth"], ["metal", "Weapons / metal"], ["skin", "Skin"]];
    function buildSuggestions(){
      const sp = scheme.slotPaints || {}, existing = scheme.recipes || [], seen = new Set();
      return SUG_AREAS.filter(([k]) => k !== "skin" || PROF.skinAlways || units.some(u => headOf(u) === "bare")).map(([k, area]) => {
        const base = sp[k]; if(!base || seen.has(PU.norm(base))) return null;
        const steps = PU.suggestSteps(base, k); if(!steps) return null;
        seen.add(PU.norm(base));
        const have = existing.some(r => r.area === area || r.steps.some(st => /basecoat/i.test(st.t) && PU.norm(st.p) === PU.norm(base)));
        const label = PROF.labels[k] || area;
        return {on: !have, have, recipe: {id: S.newId(), name: `${label}: ${PU.shortName(base)}`, area: AREAS.includes(area) ? area : label, notes: "Suggested from your colours. Change anything you like.", steps}};
      }).filter(Boolean);
    }
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
      if(pdTab === "recipes" && suggesting){
        const n = suggesting.filter(x => x.on).length;
        body.innerHTML = `
          <div class="pd-head"><p class="hint">Suggested from your army's colours: prime, basecoat, a Citadel shade that suits the colour, then a layer and an edge highlight. Untick any you don't want; you can edit them afterwards.</p></div>
          ${suggesting.length ? `<div class="recipes">${suggesting.map((x, i) => `<article class="recipe sug${x.on ? " on" : ""}">
            <header><label class="check"><input type="checkbox" data-sug="${i}" ${x.on ? "checked" : ""}> <span><strong>${esc(x.recipe.name)}</strong>${x.have ? `<small>You already have a recipe for this</small>` : ""}</span></label></header>
            ${stepsHtml(x.recipe)}</article>`).join("")}</div>`
            : `<div class="empty">Pick paints for your army's colours first (Edit colours), then come back for suggestions.</div>`}
          <div class="row-actions">${suggesting.length ? `<button type="button" class="primary" data-act="sug-add" ${n ? "" : "disabled"}>Add ${plural(n, "recipe")}</button>` : ""}<button type="button" data-act="sug-cancel">${suggesting.length ? "Cancel" : "Back"}</button></div>`;
        return;
      }
      if(pdTab === "recipes"){
        const list = scheme.recipes || [];
        body.innerHTML = `
          <div class="pd-head"><p class="hint">Write a recipe once, then tick it on every unit that uses it. Paints you don't own show as <span class="own no">To buy</span>.</p>
          ${canWrite ? `<span class="row-actions"><button type="button" class="btn-sm" data-act="suggest">Suggest recipes</button><button type="button" class="primary btn-sm" data-act="new-recipe">+ New recipe</button></span>` : ""}</div>
          ${canWrite ? `<h3 class="em-h">In this ledger</h3>` : ""}
          ${list.length ? `<div class="recipes">${list.map(r => {
            const n = units.filter(u => (u.recipes || []).includes(r.id)).length;
            return `<article class="recipe">
              <header><div><h3>${esc(r.name)}</h3><small>${esc([r.area, n ? plural(n, "unit") : "Not used yet"].filter(Boolean).join(" · "))}</small></div>
              ${canWrite ? `<div class="row-actions"><button type="button" class="btn-sm" data-act="edit-recipe" data-id="${esc(r.id)}">Edit</button><button type="button" class="btn-sm" data-act="dup-recipe" data-id="${esc(r.id)}">Copy</button></div>` : ""}</header>
              ${stepsHtml(r)}</article>`; }).join("")}</div>`
            : `<div class="empty">No recipes yet.${canWrite ? (libLive().length ? " Add some from your library below, or write a new one." : " Start with your main armour colour.") : ""}</div>`}
          ${canWrite ? librarySection() : ""}`;
      } else if(pdTab === "owned"){
        const q = PU.norm(ownedQuery);
        const shown = ownedList.filter(p => !q || PU.norm(p).includes(q)).sort((a, b) => a.localeCompare(b));
        const usedHere = ownedList.length ? [] : shoppingList(false);
        body.innerHTML = `
          <p class="hint">Paints you own are saved to your ${store.kind === "supabase" ? "account" : "browser"} and shared by all your ledgers.</p>
          <div class="add-paint"><span class="pwrap-host"><input id="op-add" placeholder="Add a paint, e.g. Abaddon Black" aria-label="Add a paint"></span><button type="button" class="primary" data-act="add-owned">Add</button></div>
          <div class="owned-head"><strong>${plural(ownedList.length, "paint")}</strong>${ownedList.length > 8 ? `<input type="search" id="op-q" class="search" placeholder="Filter" value="${esc(ownedQuery)}">` : ""}</div>
          <div class="owned">${shown.map(p => `<span class="ochip" title="${esc(p)}">${PU.swatch(p)}<span>${esc(PU.describe(p).name)}</span><button type="button" data-act="rm-owned" data-p="${esc(p)}" aria-label="Remove ${esc(p)}">×</button></span>`).join("") || `<p class="hint">${ownedList.length ? "No paints match." : "Nothing here yet. Add the paints on your shelf."}</p>`}</div>
          ${!ownedList.length && usedHere.length ? `<div class="used-here">
            <div class="lib-head"><h3 class="em-h">Used in this ledger</h3><button type="button" class="btn-sm" data-act="got-all">I have all ${usedHere.length}</button></div>
            <p class="hint">Paints from this ledger's colours and recipes. Tick off the ones already on your shelf.</p>
            <ul class="buy">${usedHere.map(it => `<li>${PU.swatch(it.label)}<span class="b-n">${paintLine(it.label)}</span><button type="button" class="btn-sm" data-act="got" data-p="${esc(it.label)}">I have it</button></li>`).join("")}</ul></div>` : ""}`;
        PU.picker($("op-add"), {owned: () => owned, extra: () => [], onPick: () => {}});
        $("op-add").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); addOwned(); } });
        const oq = $("op-q"); if(oq) oq.addEventListener("input", e => { ownedQuery = e.target.value; const pos = e.target.selectionStart; renderPaints(); const n = $("op-q"); if(n){ n.focus(); n.setSelectionRange(pos, pos); } });
      } else {
        const list = shoppingList(!buyAll);
        body.innerHTML = `
          <div class="pd-head"><p class="hint">Paints in your colours and recipes that aren't in <em>My paints</em>.</p>
          <label class="check"><input type="checkbox" id="buy-all" ${buyAll ? "checked" : ""}> Include recipes not used by any unit</label></div>
          ${list.length ? `<ul class="buy">${list.map(it => `<li>${PU.swatch(it.label)}<span class="b-n">${paintLine(it.label)}<small>For ${esc(it.recipes.length > 3 ? it.recipes.slice(0, 3).join(", ") + ` and ${it.recipes.length - 3} more` : it.recipes.join(", "))}</small>${PU.swapsText(it.label) ? `<small class="swaps">${esc(PU.swapsText(it.label))}</small>` : ""}</span><button type="button" class="btn-sm" data-act="got" data-p="${esc(it.label)}">I have it</button></li>`).join("")}</ul>
            <div class="row-actions"><button type="button" class="btn-sm" data-act="copy-buy">Copy list</button><span class="hint" id="buy-msg"></span></div>`
          : `<div class="empty">${(scheme.recipes || []).length || Object.keys(scheme.slotPaints || {}).length || units.some(u => Object.keys(u.slotPaints || {}).length) ? "You have every paint you need." : "Pick paints for your colours, or add some recipes first."}</div>`}`;
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
          <h3 class="em-h">Steps</h3>
          <ol class="r-steps" id="re-steps">${r.steps.map((st, i) => `<li>
            <span class="r-num">${i + 1}</span>
            <select data-st="${i}" aria-label="Technique for step ${i + 1}">${TECHNIQUES.map(t => `<option ${t === st.t ? "selected" : ""}>${t}</option>`).join("")}</select>
            <span class="pwrap-host">${PU.swatch(st.p, "in-input")}<input data-sp="${i}" value="${esc(st.p)}" placeholder="Paint" aria-label="Paint for step ${i + 1}"></span>
            <span class="r-btns"><button type="button" class="btn-sm" data-act="up" data-i="${i}" ${i ? "" : "disabled"} aria-label="Move up">↑</button><button type="button" class="btn-sm" data-act="down" data-i="${i}" ${i < r.steps.length - 1 ? "" : "disabled"} aria-label="Move down">↓</button><button type="button" class="btn-sm" data-act="rm-step" data-i="${i}" aria-label="Remove step">×</button></span>
          </li>`).join("")}</ol>
          <button type="button" class="btn-sm" data-act="add-step">+ Add step</button>
          <label>Notes<textarea id="re-notes" rows="2" maxlength="300" placeholder="e.g. thin the highlight, only on top edges">${esc(r.notes)}</textarea></label>
          <div class="r-bar">
            ${r.isNew ? "" : `<button type="button" class="danger" data-act="del-recipe">${library ? "Remove from this ledger" : "Delete recipe"}</button>`}
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
      const sg = e.target.closest("[data-sug]");
      if(sg){ suggesting[+sg.dataset.sug].on = sg.checked; renderPaints(); return; }
      const tab = e.target.closest("[data-tab]");
      if(tab){ libDelArmed = ""; suggesting = null; syncRecipeDraft(); if(editingRecipe && !confirmDropRecipe()) return; editingRecipe = null; pdTab = tab.dataset.tab; renderPaints(); return; }
      const b = e.target.closest("[data-act]");
      if(libDelArmed && (!b || b.dataset.act !== "lib-del")){ libDelArmed = ""; if(!b){ renderPaints(); return; } }
      if(!b) return;
      const act = b.dataset.act;
      if(editingRecipe) syncRecipeDraft();
      if(act === "suggest"){ await PU.load(); suggesting = buildSuggestions(); renderPaints(); return; }
      if(act === "sug-cancel"){ suggesting = null; renderPaints(); return; }
      if(act === "sug-add"){
        const add = suggesting.filter(x => x.on).map(x => ({...x.recipe, at: new Date().toISOString()}));
        if(!add.length) return;
        b.disabled = true;
        try { await saveRecipes((scheme.recipes || []).concat(add)); }
        catch(err){ b.disabled = false; toast("Couldn't add the recipes: " + errText(err)); return; }
        suggesting = null; renderPaints();
        try { await saveToLibrary(add); } catch(err){ console.warn(err); }
        refreshRecipes();
        toast(`Added ${plural(add.length, "recipe")}`);
        return;
      }
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
        const clean = {id: r.id, name: r.name, area: r.area, notes: r.notes, steps: r.steps, at: new Date().toISOString()};
        if(idx >= 0) list.splice(idx, 0, clean); else list.push(clean);
        b.disabled = true;
        try { await saveRecipes(list); editingRecipe = null; renderPaints(); }
        catch(err){ $("re-msg").textContent = "Couldn't save: " + errText(err); b.disabled = false; return; }
        try { await saveToLibrary([clean]); toast(`Saved recipe ${clean.name}`); }
        catch(err){ toast(`Saved ${clean.name} in this ledger, but not to your recipe library: ${errText(err)}`); }
        refreshRecipes();
      }
      else if(act === "del-recipe"){
        if(!delArmed){ delArmed = true; b.classList.add("armed"); b.textContent = library ? "Click again to remove" : "Click again to delete"; return; }
        const gone = editingRecipe, kept = libLive().some(x => x.id === gone.id);
        try {
          await saveRecipes((scheme.recipes || []).filter(x => x.id !== gone.id)); editingRecipe = null; delArmed = false; renderPaints();
          toast(kept ? `Removed ${gone.name} from this ledger. It's still in your library.` : `Deleted recipe ${gone.name}`, async () => { await saveRecipes((scheme.recipes || []).concat(recipeOnly(gone))); renderPaints(); });
        } catch(err){ $("re-msg").textContent = "Couldn't delete: " + errText(err); }
      }
      else if(act === "lib-add" || act === "lib-add-all"){
        const here = new Set((scheme.recipes || []).map(r => r.id));
        const add = libLive().filter(r => !here.has(r.id) && (act === "lib-add-all" || r.id === b.dataset.id)).sort((x, y) => x.name.localeCompare(y.name));
        if(!add.length) return;
        b.disabled = true;
        try { await saveRecipes((scheme.recipes || []).concat(add.map(recipeOnly))); renderPaints(); toast(add.length === 1 ? `Added ${add[0].name} to this ledger` : `Added ${plural(add.length, "recipe")} to this ledger`); }
        catch(err){ b.disabled = false; toast("Couldn't add: " + errText(err)); }
      }
      else if(act === "lib-del"){
        const r = libLive().find(x => x.id === b.dataset.id); if(!r) return;
        if(libDelArmed !== r.id){ libDelArmed = r.id; renderPaints(); return; }
        libDelArmed = "";
        try {
          await saveToLibrary([{...r, deleted: true, at: new Date().toISOString()}]); renderPaints(); renderRecipePicks();
          toast(`Deleted ${r.name} from your library`, async () => { await saveToLibrary([{...r, deleted: false, at: new Date().toISOString()}]); refreshRecipes(); });
        } catch(err){ toast("Couldn't delete: " + errText(err)); renderPaints(); }
      }
      else if(act === "add-owned") addOwned();
      else if(act === "rm-owned"){ try { await saveOwned(ownedList.filter(p => p !== b.dataset.p)); renderPaints(); } catch(err){ toast("Couldn't save: " + errText(err)); } }
      else if(act === "got"){ try { await saveOwned(ownedList.concat(b.dataset.p)); renderPaints(); } catch(err){ toast("Couldn't save: " + errText(err)); } }
      else if(act === "got-all"){ try { await saveOwned(ownedList.concat(shoppingList(false).map(it => it.label))); renderPaints(); } catch(err){ toast("Couldn't save: " + errText(err)); } }
      else if(act === "copy-buy"){
        const text = shoppingList(!buyAll).map(it => "- " + it.label).join("\n");
        try { await navigator.clipboard.writeText(text); $("buy-msg").textContent = "Copied."; } catch(err){ $("buy-msg").textContent = "Couldn't copy. Select the list and copy it instead."; }
      }
    });
    function confirmDropRecipe(){ return true; }
    $("pd-close").addEventListener("click", () => $("paintdlg").close());
    $("paintdlg").addEventListener("close", () => { editingRecipe = null; suggesting = null; renderRecipePicks(); });
    $("b-paints").addEventListener("click", () => openPaints("recipes"));
    $("f-manage-recipes").addEventListener("click", () => openPaints("recipes"));
    $("f-recipes").addEventListener("change", () => { setDirty(true); preview(); });

    // Viewing someone else's shared ledger while logged in: like it and follow its painter.
    async function viewerSocial(){
      let st = null;
      try { st = await store.communityState([army.id]); } catch(e){}
      const box = $("vo-social"); if(!st || !box) return;
      const draw = () => {
        const liked = st.liked.has(army.id), n = st.likes[army.id] || 0, fol = st.following.has(army.owner);
        box.innerHTML = `<button type="button" class="btn-sm like${liked ? " on" : ""}" data-vlike aria-pressed="${liked}">${HEART(liked)}<span>${liked ? "Liked" : "Like"}${n ? ` · ${n}` : ""}</span></button>
          <button type="button" class="btn-sm follow${fol ? " on" : ""}" data-vfollow aria-pressed="${fol}">${fol ? "Following" : "Follow"}${army.scheme.by ? ` ${esc(army.scheme.by)}` : " painter"}</button>`;
      };
      draw();
      box.addEventListener("click", async e => {
        const b = e.target.closest("button"); if(!b) return;
        b.disabled = true;
        try {
          if(b.hasAttribute("data-vlike")){ const on = !st.liked.has(army.id); await store.setLike(army.id, on); if(on){ st.liked.add(army.id); st.likes[army.id] = (st.likes[army.id] || 0) + 1; } else { st.liked.delete(army.id); st.likes[army.id] = Math.max(0, (st.likes[army.id] || 1) - 1); } }
          else { const on = !st.following.has(army.owner); await store.setFollow(army.owner, on); if(on) st.following.add(army.owner); else st.following.delete(army.owner); }
          draw();
        } catch(err){ b.disabled = false; msg("Couldn't save that: " + errText(err), true); }
      });
    }

    /* ---------- load ---------- */
    if(canWrite){ try { ownedList = await store.getPaints(); owned = new Set(ownedList.map(PU.norm)); } catch(e){} }
    PU.load().then(() => { render(); updateBuyBadge(); });
    writeForm(defaults()); setPhotoUI();
    try { units = await store.listUnits(army.id); }
    catch(err){ console.error(err); $("cards").innerHTML = `<div class="empty">Couldn't load units: ${esc(errText(err))}</div>`; return; }
    newUnit(false);
    loadLibrary();
    if($("vo-social")) viewerSocial();
    // Came from the roster: show that unit, and tidy the address back to the ledger's.
    if(openUnit){
      history.replaceState(null, "", "#/army/" + army.id); lastHash = location.hash;
      if(units.some(u => u.id === openUnit)) openDetail(openUnit);
    }
  }

  /* ============================================================
     Roster: every unit across all your ledgers
     ============================================================ */
  let roster = null, rosterFilter = "all";
  const unitDone = u => { const c = +u.count || 0; return Math.min(c, +u.painted || (u.status === "done" ? c : 0)); };
  function drawRoster(){
    if(!roster) return;
    const {armies, byId, units} = roster;
    const q = $("ro-q").value.trim().toLowerCase(), by = $("ro-g").value;
    const models = units.reduce((n, u) => n + (+u.count || 0), 0), done = units.reduce((n, u) => n + unitDone(u), 0), pts = units.reduce((n, u) => n + (+u.points || 0), 0);
    const list = units.filter(u => {
      if(rosterFilter === "done" && u.status !== "done") return false;
      if(rosterFilter === "progress" && !["progress", "primed", "built"].includes(u.status)) return false;
      if(rosterFilter === "todo" && u.status === "done") return false;
      if(rosterFilter === "fav" && !u.fav) return false;
      const a = byId[u.armyId], f = FBY[a.faction];
      return !q || [u.name, u.datasheet, u.role, u.melee, u.ranged, u.notes, a.name, f && f.name].join(" ").toLowerCase().includes(q);
    });
    $("ro-sum").textContent = units.length ? [plural(units.length, "unit"), plural(models, "model"), num(pts) + "\u00a0pts", (models ? Math.round(done / models * 100) : 0) + "% painted"].join(" · ") + (list.length !== units.length ? ` · showing ${list.length}` : "") : "";
    if(!units.length){
      $("ro-body").innerHTML = `<div class="ro-empty"><strong>No units yet</strong><p>Open a ledger and add your units, or import your army list, and they'll all show up here.</p></div>`;
      return;
    }
    if(!list.length){ $("ro-body").innerHTML = `<p class="hint">No units match. Try a different search or filter.</p>`; return; }
    let groups;
    if(by === "role") groups = ROLE_ORDER.concat([...new Set(list.map(u => u.role || "Other"))].filter(r => !ROLE_ORDER.includes(r))).map(r => ({key: r, title: r, units: list.filter(u => (u.role || "Other") === r)}));
    else if(by === "status") groups = ["progress", "primed", "built", "unbuilt", "done"].map(k => ({key: k, title: STATUS[k], units: list.filter(u => (u.status || "unbuilt") === k)}));
    else groups = armies.map(a => ({key: a.id, army: a, title: a.name, units: list.filter(u => u.armyId === a.id)}));
    const keep = PROF;
    const row = u => {
      const a = byId[u.armyId], c = +u.count || 0, dn = unitDone(u), pct = c ? Math.round(dn / c * 100) : 0, st = u.status || "unbuilt";
      PROF = P.profileFor(a.faction);
      const sub = [u.datasheet && u.datasheet !== u.name ? u.datasheet : "", by === "role" ? "" : u.role, by === "army" ? "" : a.name].filter(Boolean).join(" · ");
      return `<a class="ro-row" href="#/army/${esc(a.id)}/unit/${esc(u.id)}">
        <span class="ro-badge">${unitBadge(u, a.scheme, 44)}</span>
        <span class="ro-name"><strong>${u.fav ? `<span class="star on" title="Starred">${STAR(true)}</span>` : ""}${esc(u.name || u.datasheet || "Unit")}${u.own === "planned" ? " " + PLANNED_TAG : ""}</strong><small>${esc(sub || "Unit")}</small></span>
        <span class="ro-prog"><span class="ro-bar"><i style="width:${pct}%"></i></span><small>${dn}/${c} painted</small></span>
        <span class="ro-pts">${u.points ? num(u.points) + "\u00a0pts" : "—"}</span>
        <span class="ro-st st-${esc(st)}">${esc(STATUS[st] || st)}</span>
      </a>`;
    };
    $("ro-body").innerHTML = groups.filter(g => g.units.length).map(g => {
      const m = g.units.reduce((n, u) => n + (+u.count || 0), 0), dn = g.units.reduce((n, u) => n + unitDone(u), 0);
      let head = "";
      if(g.army){ PROF = P.profileFor(g.army.faction); head = tierBadge(g.army.scheme, g.army.scheme.tiers[0], 34); }
      const f = g.army && FBY[g.army.faction];
      return `<section class="ro-group" aria-label="${esc(g.title)}">
        <div class="ro-gh">${head}<div><h3>${esc(g.title)}</h3><small>${f ? esc(f.name) + " · " : ""}${plural(g.units.length, "unit")} · ${m ? Math.round(dn / m * 100) : 0}% painted</small></div>${g.army ? `<a class="btn btn-sm" href="#/army/${esc(g.army.id)}" aria-label="Open ${esc(g.army.name)}"><span class="lbl-long">Open ledger</span><span class="lbl-short">Open</span></a>` : ""}</div>
        ${g.units.map(row).join("")}
      </section>`;
    }).join("");
    PROF = keep;
  }

  /* ============================================================
     Dialogs, auth, start
     ============================================================ */
  // Dialogs that scroll inside (editor, paints) must never scroll as a whole; if a browser does it anyway, put it back.
  // Only the editor and paints dialogs: others (unit details, sign in, import) scroll normally.
  document.addEventListener("scroll", e => { const d = e.target; if(d && d.tagName === "DIALOG" && d.matches(".editdlg, .paintdlg") && (d.scrollTop || d.scrollLeft)){ d.scrollTop = 0; d.scrollLeft = 0; } }, true);
  document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", e => {
    if(e.target.closest("[data-close]") || e.target === d) d.close();
  }));
  // Account menu: opens on click, closes on a pick, a click elsewhere or Escape; arrow keys move through it.
  const acctOpen = on => {
    const m = $("acct-menu"), btn = $("b-acct"); if(!m) return;
    m.hidden = !on; btn.setAttribute("aria-expanded", on);
    if(on) m.querySelector("a,button:not(:disabled)").focus();
  };
  $("topnav").addEventListener("click", e => {
    const o = e.target.closest("[data-auth-open]");
    if(o){ openAuth(o.dataset.authOpen); return; }
    if(e.target.closest("#b-acct")){ e.stopPropagation(); acctOpen($("acct-menu").hidden); return; }
    if(e.target.closest("[data-logout]")){ acctOpen(false); logOut(); return; }
    if(e.target.closest("[data-install]")){ acctOpen(false); installApp(); return; }
    if(e.target.closest("#acct-menu a")) acctOpen(false);
  });
  $("topnav").addEventListener("keydown", e => {
    const m = $("acct-menu"); if(!m || m.hidden) return;
    const items = [...m.querySelectorAll("a,button:not(:disabled)")], i = items.indexOf(document.activeElement);
    if(e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length].focus(); }
    else if(e.key === "Escape"){ acctOpen(false); $("b-acct").focus(); }
    else if(e.key === "Tab") acctOpen(false);
  });
  document.addEventListener("click", e => { if(!e.target.closest(".acct")) acctOpen(false); });

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

  // Offline support (only on the real site: https, not local test copies).
  if("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(e => console.warn("Service worker not registered", e));
  const onlineState = () => { $("offline").hidden = navigator.onLine !== false; };
  window.addEventListener("online", onlineState); window.addEventListener("offline", onlineState); onlineState();
  ART.injectDefs();
  // A reset or confirm link that has expired comes back as #error=...&error_description=...: note it before anything reads the address.
  const linkErr = (() => {
    const h = location.hash;
    if(!/error_description=/.test(h) || /access_token=/.test(h)) return null;
    const q = new URLSearchParams(h.replace(/^#\/?/, ""));
    history.replaceState(null, "", location.pathname + location.search + "#/");
    return {code: q.get("error_code") || "", text: q.get("error_description") || ""};
  })();
  store = S.create();
  window.addEventListener("hashchange", route);
  if(store.kind === "supabase"){
    let first = true;
    store.client.auth.onAuthStateChange((event, session) => {
      const was = store.session;
      const changed = first || (!!session) !== (!!was) || (session && was && session.user.id !== was.user.id);
      const wasFirst = first;
      if(changed) shameCache = null;   // another person's pile
      store.setSession(session); first = false;
      loadSettings(); setTop();
      if(changed) setTimeout(route, 0);
      // Opened the link in a password reset email: they're signed in, now ask for the new password.
      if(event === "PASSWORD_RECOVERY") setTimeout(() => openAuth("reset"), 60);
      else if(wasFirst && linkErr) setTimeout(() => openAuth(/expired|invalid/i.test(linkErr.code + linkErr.text) ? "forgot" : "in",
        /expired|invalid/i.test(linkErr.code + linkErr.text) ? "That link has expired or was already used. Enter your email and we'll send a new one." : linkErr.text), 60);
    });
  } else {
    loadSettings();
    route();
  }
})();
