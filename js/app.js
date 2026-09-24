/* Livery Ledger app: routing, faction picker, colour setup and the ledger itself. */
(function(){
  "use strict";
  const DATA = window.LEDGER_FACTIONS || {factions: []};
  const P = window.LEDGER_PRESETS, ART = window.LEDGER_ART, S = window.LEDGER_STORE, PU = window.LEDGER_PAINTUI;
  const STATUS = S.STATUS;
  const FACTIONS = DATA.factions;
  const FBY = Object.fromEntries(FACTIONS.map(f => [f.id, f]));
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
  function combo(input, getList){
    const box = document.createElement("div");
    box.className = "psuggest"; box.hidden = true; box.setAttribute("role", "listbox");
    input.classList.add("combo");
    input.setAttribute("autocomplete", "off"); input.setAttribute("role", "combobox"); input.setAttribute("aria-expanded", "false");
    // Outside the label, so a click on an option doesn't also land on the input and reopen the list.
    (input.closest("label") || input).after(box);
    let items = [], active = -1;
    function show(){
      const all = getList() || [], q = input.value.trim().toLowerCase();
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
    function pick(i){ if(items[i] == null) return; input.value = items[i]; hide(); input.dispatchEvent(new Event("input", {bubbles: true})); }
    const onMove = () => { if(!box.isConnected){ window.removeEventListener("resize", onMove); document.removeEventListener("scroll", onMove, true); return; } place(); };
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    input.addEventListener("focus", show);
    input.addEventListener("click", () => { if(box.hidden) show(); });
    input.addEventListener("input", e => { active = -1; if(e.isTrusted) show(); });
    input.addEventListener("blur", () => setTimeout(hide, 150));
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
    const nav = $("topnav"), a = store.kind === "supabase" ? acct() : null;
    if(store.kind !== "supabase"){ nav.innerHTML = ""; return; }
    if(!a){
      nav.innerHTML = `<button type="button" class="btn-sm ghost" data-auth-open="in">Log in</button><button type="button" class="btn-sm primary" data-auth-open="up">Sign up</button>`;
      return;
    }
    nav.innerHTML = `<div class="acct">
      <button type="button" class="acct-btn" id="b-acct" aria-haspopup="menu" aria-expanded="false" aria-controls="acct-menu" aria-label="Account menu for ${esc(a.name)}">${avatarHtml(a)}<span class="acct-name">${esc(a.name)}</span>${CARET}</button>
      <div class="acct-menu" id="acct-menu" role="menu" hidden>
        <div class="acct-head">${avatarHtml(a, "lg")}<span><strong>${esc(a.name)}</strong><small>${esc(a.email)}</small></span></div>
        <a role="menuitem" href="#/">Home</a>
        <a role="menuitem" href="#/profile">My profile and ledgers</a>
        <button type="button" role="menuitem" data-roster>Your roster</button>
        <a role="menuitem" href="#/shared">Shared armies</a>
        <button type="button" role="menuitem" disabled aria-disabled="true">Settings <span class="soon">Soon</span></button>
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
    in: {h: "Welcome back", p: "Log in to see your ledgers.", go: "Log in", busy: "Logging in…"},
    up: {h: "Create your free account", p: "Plan and track every army you paint.", go: "Create account", busy: "Creating your account…"},
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
      q(".auth-h").textContent = t.h; q(".auth-p").textContent = t.p;
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
    if(!dlgAuth) dlgAuth = authForm($("auth-host"), "in", {onDone: () => { if(view.name === "landing" && !/^#\/(shared|profile)\b/.test(location.hash)) location.hash = "#/profile"; setTimeout(() => { if(d.open) d.close(); }, 700); }});
    dlgAuth.set(typeof mode === "string" ? mode : "in", note);
    if(!d.open) d.showModal();
    dlgAuth.focus();
  }
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
    setTop();
    try {
      if(parts[0] === "new" && FBY[parts[1]]) await viewSetup({factionId: parts[1]});
      else if(parts[0] === "army" && parts[1] && parts[2] === "colours") await viewSetup({armyId: parts[1]});
      else if(parts[0] === "army" && parts[1] && parts[2] === "guide") await viewGuide(parts[1]);
      else if(parts[0] === "army" && parts[1] && parts[2] === "unit" && parts[3]) await viewLedger(parts[1], parts[3]);
      else if(parts[0] === "army" && parts[1]) await viewLedger(parts[1]);
      // The list of shared armies is for logged-in painters; a shared ledger itself still opens from its link.
      else if(parts[0] === "shared"){
        if(store.kind === "supabase" && !store.session){ await viewLanding(); setTimeout(() => openAuth("in", "Log in to browse shared armies."), 0); }
        else await viewShared();
      }
      else if(parts[0] === "profile"){
        // Your profile and ledgers; logged out, the homepage with the log in form open.
        if(store.kind === "supabase" && !store.session){ await viewLanding(); setTimeout(() => openAuth("in", "Log in to see your profile and ledgers."), 0); }
        else await viewHome();
      }
      // "#/" (and the old "#/welcome"): the homepage.
      else await viewLanding();
    } catch(err){
      console.error(err);
      app.innerHTML = `<div class="banner"><span class="dot warn"></span>Couldn't load this page: ${esc(errText(err))}</div><p><a class="btn" href="#/profile">Back to your ledgers</a></p>`;
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
    const me = acct();
    const tot = armies.reduce((t, x) => { const s = sum[x.id] || {}; t.units += s.units || 0; t.models += s.models || 0; t.done += s.done || 0; return t; }, {units: 0, models: 0, done: 0});
    const since = me ? monthYear(me.since) : "";
    app.innerHTML = `
      <section class="profile-head">
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
          <p class="eyebrow">${me ? "Your profile" : "Livery Ledger"}</p>
          ${me ? `<div class="ph-name" id="ph-name"><h1 id="ph-h">${esc(me.name)}</h1><button type="button" class="icon-btn edit-name" id="b-name" aria-label="Change your display name" title="Change your display name"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></svg></button></div>
          <form class="name-edit" id="name-form" hidden>
            <input id="name-in" maxlength="40" autocomplete="nickname" aria-label="Display name" placeholder="${esc(me.email.split("@")[0])}">
            <button type="submit" class="primary btn-sm">Save</button>
            <button type="button" class="btn-sm" id="name-cancel">Cancel</button>
          </form>` : `<h1>Your ledgers</h1>`}
          ${me ? `<p class="sub">${esc(me.email)}${since ? ` · Painting with us since ${esc(since)}` : ""}</p>` : `<p class="sub">Plan how you'll paint your army. Pick your faction, choose your colours, then track every unit with photos, weapons and paint recipes.</p>`}
          ${me ? `<p class="msg" id="ph-msg" role="status" aria-live="polite"></p>` : `<div class="ph-note">${noteHtml()}</div>`}
          ${armies.length ? `<div class="ph-actions"><button type="button" class="btn-sm" data-roster><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6h.01"/><path d="M4 12h.01"/><path d="M4 18h.01"/></svg>Your roster<span class="count">${num(tot.units)}</span></button></div>` : ""}
        </div>
        <div class="stats" aria-label="Your painting so far">
          <div class="stat"><b>${armies.length}</b><span>${armies.length === 1 ? "Ledger" : "Ledgers"}</span></div>
          <div class="stat"><b>${num(tot.units)}</b><span>Units</span></div>
          <div class="stat"><b>${num(tot.done)}/${num(tot.models)}</b><span>Models painted</span></div>
          <div class="stat"><b>${tot.models ? Math.round(tot.done / tot.models * 100) : 0}%</b><span>Complete</span></div>
        </div>
      </section>
      ${signedOut ? `<div class="banner"><span class="dot"></span>Log in to create a ledger and see the ones you've made. <button type="button" class="btn-sm" data-signin>Log in</button></div>` : ""}
      ${!armies.length && !signedOut ? `<div class="first-run panel"><span class="fr-num" aria-hidden="true">1</span><div><strong>Start your first ledger</strong><p>Pick your faction below. You'll choose your colours next, then add your units.</p></div></div>` : ""}
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
      <p class="source">Unit and weapon names come from the community BattleScribe data for Warhammer 40,000 11th edition (${esc(DATA.source || "BSData")}${DATA.commit ? ", " + esc(DATA.commit) : ""}). Emblem icons from <a href="https://github.com/Certseeds/wh40k-icon" target="_blank" rel="noopener">wh40k-icon</a> by shitake, farvig, 夜行漫记 and Certseeds (<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener">CC BY-NC-SA 4.0</a>), recoloured for this site. Paint names and colours from <a href="https://github.com/Arcturus5404/miniature-paints" target="_blank" rel="noopener">miniature-paints</a> by Rick Fleuren (MIT). Starting colours are suggestions you can change.</p>
    `;
    const fq = $("fq");
    fq.addEventListener("input", () => {
      const q = fq.value.trim().toLowerCase();
      app.querySelectorAll(".fcard").forEach(c => c.hidden = q && !c.dataset.fname.includes(q));
      app.querySelectorAll("[data-group]").forEach(g => g.hidden = !g.querySelector(".fcard:not([hidden])"));
    });
    app.querySelectorAll("[data-signin]").forEach(b => b.addEventListener("click", openAuth));
    if(me && store.updateProfile) profileEdits();
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
  /* ============================================================
     Homepage: what Livery Ledger does, with log in / sign up in the hero
     ============================================================ */
  // A feature's picture: img/shots/<name>.webp when it's been added, otherwise a drawing made from the app's own parts.
  const shot = (name, alt, art) => `<figure class="shot" data-shot="${name}"><div class="shot-art" aria-hidden="true">${art}</div><img src="img/shots/${name}.webp" alt="${esc(alt)}" loading="lazy" decoding="async"></figure>`;
  const paintName = l => String(l || "").replace(/^Citadel\s+/, "").replace(/\s*\([^)]*\)\s*$/, "");
  async function viewLanding(){
    view.name = "landing";
    document.title = "Livery Ledger · Plan and track your Warhammer 40,000 painting";
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
      phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>'
    };
    const icon = k => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
    const tick = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
    const cta = me ? `<a class="btn primary lg" href="#/profile">Go to your ledgers</a>` : online ? `<button type="button" class="primary lg" data-cta="up">Create your free account</button>` : `<a class="btn primary lg" href="#/profile">Start a ledger</a>`;

    app.innerHTML = `
      <section class="lp-hero">
        <div class="lp-copy">
          <p class="eyebrow">For Warhammer 40,000 painters</p>
          <h1>Plan every army you paint. <span class="grad">Track every brushstroke.</span></h1>
          <p class="lead">Livery Ledger keeps your colour scheme, paint recipes and painting progress for every unit in one place. It covers all ${FACTIONS.length} factions and chapters, with official Citadel colours ready to go.</p>
          <ul class="lp-ticks">
            <li>${tick}Free to use</li><li>${tick}Import your army list</li><li>${tick}Works on your phone</li>
          </ul>
          <div class="lp-parade" aria-hidden="true">${show.map(id => `<span title="${esc(FBY[id].name)}">${factionBadge(id, 46)}</span>`).join("")}</div>
        </div>
        <div class="lp-side">
          ${me ? `<div class="panel lp-card lp-welcome">
              ${avatarHtml(me, "xl")}
              <h2>Welcome back, ${esc(me.name)}</h2>
              <p class="sub">Your ledgers are waiting.</p>
              <a class="btn primary" href="#/profile">Go to your ledgers</a>
            </div>`
          : online ? `<div class="panel lp-card auth" id="lp-auth"></div>`
          : `<div class="panel lp-card lp-welcome">
              <h2>Start painting smarter</h2>
              <p class="sub">This copy saves everything in your browser, with no account needed.</p>
              <a class="btn primary" href="#/profile">Open your ledgers</a>
            </div>`}
        </div>
      </section>

      <section class="lp-numbers" aria-label="Livery Ledger in numbers">
        <div><b>${FACTIONS.length}</b><span>Factions and chapters</span></div>
        <div><b>${num(nSheets)}</b><span>Datasheets, 11th edition</span></div>
        <div><b>${num(nSchemes)}</b><span>Official and known colour schemes</span></div>
        <div><b>3,700+</b><span>Paints from 11 brands</span></div>
      </section>

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
            <div class="ill-rows">${[["Captain", "1", "80"], ["Intercessor Squad", "10", "160"], ["Redemptor Dreadnought", "1", "210"]].map(([n, m, pt]) => `<div class="ill-row"><span class="ck">${tick}</span><span>${n}</span><em>${m} · ${pt} pts</em></div>`).join("")}</div>
          </div>`)}
        </article>
      </section>

      <section class="lp-grid" aria-labelledby="lp-more-h">
        <h2 id="lp-more-h" class="lp-grid-h">And the little things that help</h2>
        <div class="lp-cards">
          ${[["share", "Share your army", "Send a read-only link so friends can see your colours and progress."],
             ["photo", "A photo for every unit", "Keep a picture of each unit as it comes together."],
             ["points", "Points at a glance", "See your army's total against the limit you're building to."],
             ["cart", "Shopping list", "Every paint your recipes need that you don't own yet, ready to copy."],
             ["backup", "Backups", "Download a ledger any time, and bring it back whenever you like."],
             ["phone", "At the painting desk", "Made for your phone, so it's there beside the brushes."]]
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

      <section class="lp-cta panel">
        <div><h2>Your army deserves a plan</h2><p class="sub">Free, and ready in under a minute.</p></div>
        <div class="lp-cta-btns">${me ? `<a class="btn lg" href="#/shared">Browse shared armies</a>` : ""}${cta}</div>
      </section>
    `;
    app.querySelectorAll(".shot img").forEach(img => {
      const ok = () => img.closest(".shot").classList.add("has-img");
      if(img.complete && img.naturalWidth) ok(); else img.addEventListener("load", ok);
      img.addEventListener("error", () => img.remove());
    });
    let heroAuth = null;
    if($("lp-auth")) heroAuth = authForm($("lp-auth"), "up", {onDone: () => { location.hash = "#/profile"; }});
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
    if(!army){ location.hash = "#/profile"; return; }
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
          <table class="g-table g-units">
            <thead><tr><th>Unit</th><th>Models</th><th>Rank</th><th>Progress</th><th>Painted differently</th></tr></thead>
            <tbody>${sorted.map(u => {
              const rs = (u.recipes || []).map(id => recipes.find(r => r.id === id)).filter(Boolean).map(r => r.name);
              const own = ownColours(u);
              return `<tr><td><strong>${esc(u.name)}</strong>${u.datasheet && u.datasheet !== u.name ? `<small>${esc(u.datasheet)}</small>` : ""}${rs.length ? `<small>Recipes: ${esc(rs.join(", "))}</small>` : ""}</td>
                <td>${u.count}</td><td>${esc(tierOf(u).name || "")}</td>
                <td>${u.painted}/${u.count}${u.status === "done" ? " ✓" : ""}</td>
                <td>${own.length ? own.join("<br>") : "—"}</td></tr>`;
            }).join("")}</tbody>
          </table>
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
        ${mine ? `<label class="check sh-mine"><input type="checkbox" id="sh-mine"> Only mine</label>` : ""}
        <span class="sh-count" id="sh-count" aria-live="polite"></span>
      </div>
      <div id="sh-list"><p class="loading">Loading shared armies…</p></div>`;
    if(!store.canShare){ $("sh-list").innerHTML = `<div class="ro-empty"><strong>Sharing needs the online database</strong><p>This copy saves ledgers in your browser only, so there's nothing shared to show.</p></div>`; return; }
    let data;
    try { data = await store.listShared(); }
    catch(err){ console.error(err); if($("sh-list")) $("sh-list").innerHTML = `<div class="banner"><span class="dot warn"></span>Couldn't load shared armies: ${esc(errText(err))}</div>`; return; }
    if(!$("sh-list")) return;   // left the page while loading
    const {armies, sum} = data;
    const present = [...new Set(armies.map(a => a.faction))].filter(id => FBY[id]).sort((a, b) => FBY[a].name.localeCompare(FBY[b].name));
    $("sh-f").insertAdjacentHTML("beforeend", present.map(id => `<option value="${esc(id)}">${esc(FBY[id].name)}</option>`).join(""));
    const keep = PROF;
    function draw(){
      const q = $("sh-q").value.trim().toLowerCase(), fid = $("sh-f").value, onlyMine = $("sh-mine") && $("sh-mine").checked;
      const list = armies.filter(a => (!fid || a.faction === fid) && (!onlyMine || a.owner === mine)
        && (!q || [a.name, (FBY[a.faction] || {}).name, a.scheme.by].join(" ").toLowerCase().includes(q)));
      $("sh-count").textContent = armies.length ? (list.length === armies.length ? `${armies.length} ${armies.length === 1 ? "army" : "armies"}` : `${list.length} of ${armies.length}`) : "";
      if(!armies.length){ $("sh-list").innerHTML = `<div class="ro-empty"><strong>No shared armies yet</strong><p>Be the first: open one of your ledgers and press Share.</p></div>`; return; }
      if(!list.length){ $("sh-list").innerHTML = `<p class="hint">No shared armies match. Try a different search or faction.</p>`; return; }
      $("sh-list").innerHTML = `<div class="ledgers">${list.map(a => {
        const s = sum[a.id] || {units: 0, models: 0, done: 0}, f = FBY[a.faction];
        const pct = s.models ? Math.round(s.done / s.models * 100) : 0;
        PROF = P.profileFor(a.faction);
        const by = a.owner === mine ? "you" : a.scheme.by;
        return `<a class="lcard" href="#/army/${esc(a.id)}">
          <div class="card-top">${tierBadge(a.scheme, a.scheme.tiers[0], 56)}<div><h3>${esc(a.name)}</h3><div class="meta">${esc(f ? f.name : a.faction)}${by ? ` · by ${esc(by)}` : ""}</div></div>${a.owner === mine ? `<span class="tag">Yours</span>` : ""}</div>
          <div class="prog" aria-hidden="true"><i style="width:${pct}%"></i></div>
          <div class="foot"><span>${plural(s.units, "unit")} · ${plural(s.models, "model")}</span><span>${pct}% painted</span></div>
        </a>`;
      }).join("")}</div>`;
      PROF = keep;
    }
    $("sh-q").addEventListener("input", draw);
    $("sh-f").addEventListener("change", draw);
    if($("sh-mine")) $("sh-mine").addEventListener("change", draw);
    draw();
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
    if(armyId){ army = await store.getArmy(armyId); if(!army){ location.hash = "#/profile"; return; } factionId = army.faction; }
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
      <div class="crumbs"><a href="#/profile">My ledgers</a> / ${editing ? `<a href="#/army/${esc(army.id)}">${esc(army.name)}</a> / Colours` : esc(f.name)}</div>
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
            <p class="hint">Sets every colour to the Citadel paints for a well-known ${esc(f.name)} scheme, and the emblem to match. You can change anything afterwards.</p>
            <div class="schemes" id="s-schemes">${known.map((k, i) => `<button type="button" class="scheme" data-scheme="${i}">${ART.pauldron(k.colors.armour, k.colors.trim, k.colors.emblem, k.shape || draft.scheme.shape, 40)}<span>${esc(k.name)}</span></button>`).join("")}</div>
          </div>` : ""}
          <div class="panel">
            <h3>Colours</h3>
            <p class="hint">Pick the paint you use for each area. The picker also has plain colours and a custom colour.</p>
            <div class="cgrid">${colorKeys().map(([k, label]) => `
              <div class="cfield${BASE_OF[k] ? " pd-when" : ""}"${BASE_OF[k] && !draft.scheme.splitPauldrons ? " hidden" : ""}>
                <span class="cf-l">${label}</span>
                <span id="s-${k}"></span>
              </div>`).join("")}</div>
            ${PROF.pauldrons ? `<label class="check split-check"><input type="checkbox" id="s-split" ${draft.scheme.splitPauldrons ? "checked" : ""}> Paint each pauldron differently <small>Gives the left and right pauldron their own colour, secondary and emblem colour. New units start with this setting.</small></label>` : ""}
            <div class="xa-wrap"><h4 class="em-h">Extra paint areas</h4>
              <p class="hint">Add the areas your models have, like leather or power weapons. They become the starting paints for new units.</p>
              <h5 class="pd-h">${esc(PROF.legends.details)}</h5><div class="xa" id="s-xa-d"></div>
              <h5 class="pd-h">Weapons</h5><div class="xa" id="s-xa-w"></div></div>
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
            <h3>Ranks</h3>
            <p class="hint">Ranks group your units, such as ${esc(draft.scheme.tiers.slice(0, 3).map(t => t.name).join(", ").replace(/, ([^,]*)$/, " and $1"))}, so you can paint some a little differently from the rest of the army. Each rank has a colour for the ${esc(PROF.head)}; a unit starts with its rank's colour, and you can still change it per unit.</p>
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
              <a class="btn" href="${editing ? "#/army/" + esc(army.id) : "#/profile"}">Cancel</a>
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
        const saved = await store.saveArmy({faction: f.id, name, scheme: sch, public: editing ? army.public : false}, editing ? army.id : null);
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
        try { await store.removeArmy(army); setupDirty = false; location.hash = "#/profile"; }
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
      app.innerHTML = `<div class="banner"><span class="dot warn"></span>${store.kind === "supabase" && !store.session ? "Sign in to open this ledger." : "This ledger doesn't exist any more."}</div><p class="row-actions"><a class="btn" href="#/profile">Back to your ledgers</a>${store.kind === "supabase" && !store.session ? `<button type="button" class="primary" data-signin>Sign in</button>` : ""}</p>`;
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
    const singleRole = r => ["Epic Hero","Character","Vehicle","Monster","Dedicated Transport","Fortification"].includes(r);

    // A paint picker per colour area (the hidden input #f-<id> holds the colour).
    const colorField = (id, label) => `<label>${label}<span data-slot="${id}"></span></label>`;
    const PREF_KEY = "ll-list-prefs";
    let prefs = {group: "role", sort: "rank"};
    try { prefs = {...prefs, ...JSON.parse(localStorage.getItem(PREF_KEY) || "{}")}; } catch(e){}

    app.innerHTML = `
      <div class="crumbs">${canWrite ? `<a href="#/profile">My ledgers</a>` : store.session ? `<a href="#/shared">Shared armies</a>` : `<a href="#/">Livery Ledger</a>`} / ${esc(f.name)}${!canWrite && army.scheme.by ? ` · shared by ${esc(army.scheme.by)}` : ""}</div>
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

      ${!canWrite ? `<div class="banner viewonly"><span class="dot on"></span><span>You're viewing a shared ledger. You can look but not change anything.</span>${store.kind === "supabase" && !store.session ? `<button type="button" class="btn-sm" data-signin>Sign in</button>` : ""}</div>` : ""}
      <section class="key" id="key" aria-label="Rank colours">${scheme.tiers.map(t => `<div>${tierBadge(scheme, t, 44)}<span><strong>${esc(t.name)}</strong><small>${esc(t.note || cname(t.color) + " " + PROF.head)}</small></span></div>`).join("")}</section>

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
          <div class="pd-tabs"><div class="seg" role="tablist" id="pd-tabs">
            <button type="button" role="tab" data-tab="recipes" aria-pressed="true">Recipes</button>
            ${canWrite ? `<button type="button" role="tab" data-tab="owned" aria-pressed="false">My paints</button>
            <button type="button" role="tab" data-tab="buy" aria-pressed="false">To buy <span class="buy-badge" id="buy-tab" hidden></span></button>` : ""}
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
      h.innerHTML = cur === auto ? `Datasheet cost for ${plural(count, "model")}${br ? ` <span>(${esc(sh.p)} base · ${esc(br)})</span>` : ""}`
        : `Datasheet cost is ${auto} pts. <button type="button" class="linkbtn" id="pts-reset">Use ${auto}</button>`;
    }
    function preview(){
      const u = readForm();
      $("pv-svg").innerHTML = unitBadge(u, scheme, 120);
      $("pv-name").textContent = u.name || u.datasheet || "Unnamed unit";
      const tier = scheme.tiers[u.tier];
      $("pv-meta").textContent = [u.datasheet || "Unit", tier && tier.name, plural(u.count, "model"), u.points ? u.points + " pts" : ""].filter(Boolean).join(" · ");
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
    function cardHtml(u){
      u = withColours(u);
      const img = safeImg(u.image), tier = scheme.tiers[u.tier] || {};
      const nx = canWrite ? nextStep(u) : null;
      const segs = STAGE_KEYS.map(k => `<i class="${(u.stages || []).includes(k) ? "on" : ""}"></i>`).join("");
      const pk = selecting && picked.has(u.id);
      return `<div class="card${u.id === selId && !selecting ? " sel" : ""}${pk ? " picked" : ""}" tabindex="0" role="button" data-id="${esc(u.id)}" ${selecting ? `aria-pressed="${pk}" aria-label="Select ${esc(u.name)}"` : `aria-label="View ${esc(u.name)}"`}>
        ${selecting ? `<span class="pick" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg></span>` : ""}
        ${img ? `<div class="photo"><img src="${esc(img)}" alt="" loading="lazy" decoding="async"></div>` : ""}
        <div class="body">
          <div class="card-top">${unitBadge(u, scheme, 60)}<div><h3>${esc(u.name)}</h3><div class="type">${esc([u.datasheet && u.datasheet !== u.name ? u.datasheet : "", u.role].filter(Boolean).join(" · ") || "Unit")}</div></div>${u.points ? `<span class="pts">${fmt(u.points)}<small>pts</small></span>` : ""}${starBtn(u)}</div>
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
        return `<details class="dsec" data-k="${esc(key)}"${open ? " open" : ""}><summary><h4>${title}</h4></summary>${body}</details>`;
      };
      const sec = (title, rows, key) => { const r = rows.filter(x => x[1]); return r.length ? box(key || title, title, `<dl>${r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`) : ""; };
      $("detail-body").innerHTML = `<div class="detail">
        <div class="media">${img ? `<img src="${esc(img)}" alt="Photo of ${esc(u.name)}">` : unitBadge(u, scheme, 180)}</div>
        <div class="info">
          <div><h2 id="dt-name">${esc(u.name)}</h2>
            <div class="meta">${esc(u.datasheet || "Unit")}${u.role ? " · " + esc(u.role) : ""} · ${plural(u.count, "model")}${u.points ? " · " + fmt(u.points) + " pts" : ""}</div></div>
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
      if(sh && !selId) $("f-count").value = singleRole(sh.r) ? 1 : (sh.pb && sh.pb[0] ? (sh.pb[0][0] === sh.pb[0][1] ? sh.pb[0][0] : Math.max(1, sh.pb[0][0] - 1)) : 5);
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
      if(c){ c.classList.toggle("picked", picked.has(id)); c.setAttribute("aria-pressed", picked.has(id)); }
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
    function guessCount(sh, pts){
      if(singleRole(sh.r)) return 1;
      const br = sh.pb || [];
      const hit = br.filter(b => b[2] === pts).pop();
      if(hit) return hit[1] || Math.max(hit[0], (hit[0] - 1) * 2);
      return br.length ? (br[0][0] === br[0][1] ? br[0][0] : Math.max(1, br[0][0] - 1)) : 1;
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
    let parsed = null;
    function renderParsed(){
      const box = $("ld-out");
      if(!parsed){ box.innerHTML = ""; return; }
      const us = parsed.units;
      $("ld-sum").textContent = us.length ? [parsed.detachment, plural(us.length, "unit"), fmt(us.reduce((a, u) => a + (u.include ? u.points : 0), 0)) + " pts"].filter(Boolean).join(" · ") : "";
      box.innerHTML = (us.length ? `<div class="ld-table" role="table">
          <div class="ld-row ld-head" role="row"><span></span><span>Datasheet</span><span>Models</span><span>Points</span><span>Weapons</span></div>
          ${us.map((u, i) => `<label class="ld-row" role="row"><span><input type="checkbox" data-inc="${i}" ${u.include ? "checked" : ""}></span><span><strong>${esc(u.name)}</strong><small>${esc(u.sheet.r)}${u.notes.length ? " · " + esc(u.notes.join(", ")) : ""}</small></span><span><input type="number" min="1" max="99" data-cnt="${i}" value="${u.count}"></span><span>${u.points}</span><span>${esc([...u.melee, ...u.ranged].slice(0, 3).join(", ") || "—")}</span></label>`).join("")}
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
    if(canWrite){
      // Delete the whole ledger, after a confirmation that says exactly what goes with it.
      const dd = $("deldlg");
      $("b-delarmy").addEventListener("click", () => {
        const n = units.length, photos = units.filter(u => u.image).length;
        $("dl-text").textContent = `This permanently deletes ${army.name}` +
          (n ? ` and its ${plural(n, "unit")}${photos ? `, including ${plural(photos, "photo")}` : ""}` : "") +
          ". It can't be undone.";
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
          setDirty(false); view.guard = null; dd.close(); location.hash = "#/profile";
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
      window.removeEventListener("beforeunload", onBeforeUnload); $("detail").removeEventListener("click", onDetailClick); clearPending();
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
      const head = `<h4 class="em-h">Your recipe library</h4>`;
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
          ${canWrite ? `<h4 class="em-h">In this ledger</h4>` : ""}
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
            <div class="lib-head"><h4 class="em-h">Used in this ledger</h4><button type="button" class="btn-sm" data-act="got-all">I have all ${usedHere.length}</button></div>
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
      const tab = e.target.closest("[data-tab]");
      if(tab){ libDelArmed = ""; syncRecipeDraft(); if(editingRecipe && !confirmDropRecipe()) return; editingRecipe = null; pdTab = tab.dataset.tab; renderPaints(); return; }
      const b = e.target.closest("[data-act]");
      if(libDelArmed && (!b || b.dataset.act !== "lib-del")){ libDelArmed = ""; if(!b){ renderPaints(); return; } }
      if(!b) return;
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
    loadLibrary();
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
  async function openRoster(){
    const d = $("rosterdlg");
    try { $("ro-g").value = localStorage.getItem("ll-roster-group") || "army"; } catch(e){}
    if(!$("ro-g").value) $("ro-g").value = "army";
    $("ro-body").innerHTML = `<p class="hint">Loading your units…</p>`; $("ro-sum").textContent = "";
    if(!d.open) d.showModal();
    try {
      const [armies, units] = await Promise.all([store.listArmies(), store.listAllUnits()]);
      const byId = Object.fromEntries(armies.map(a => [a.id, a]));
      roster = {armies, byId, units: units.filter(u => byId[u.armyId])};
      drawRoster();
    } catch(err){ console.error(err); $("ro-body").innerHTML = `<p class="hint">Couldn't load your roster: ${esc(errText(err))}</p>`; }
  }
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
    $("ro-sum").textContent = units.length ? [plural(units.length, "unit"), plural(models, "model"), num(pts) + " pts", (models ? Math.round(done / models * 100) : 0) + "% painted"].join(" · ") + (list.length !== units.length ? ` · showing ${list.length}` : "") : "";
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
        <span class="ro-name"><strong>${u.fav ? `<span class="star on" title="Starred">${STAR(true)}</span>` : ""}${esc(u.name || u.datasheet || "Unit")}</strong><small>${esc(sub || "Unit")}</small></span>
        <span class="ro-prog"><span class="ro-bar"><i style="width:${pct}%"></i></span><small>${dn}/${c} painted</small></span>
        <span class="ro-pts">${u.points ? num(u.points) + " pts" : "—"}</span>
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
  $("ro-q").addEventListener("input", drawRoster);
  $("ro-g").addEventListener("change", () => { try { localStorage.setItem("ll-roster-group", $("ro-g").value); } catch(e){} drawRoster(); });
  $("ro-f").addEventListener("click", e => {
    const b = e.target.closest("[data-rf]"); if(!b) return;
    rosterFilter = b.dataset.rf;
    $("ro-f").querySelectorAll("[data-rf]").forEach(x => x.setAttribute("aria-pressed", x === b));
    drawRoster();
  });
  // Opening a unit or ledger from the roster closes it on the way.
  $("ro-body").addEventListener("click", e => { if(e.target.closest("a[href]")) $("rosterdlg").close(); });
  document.addEventListener("click", e => { if(e.target.closest("[data-roster]")){ acctOpen(false); openRoster(); } });

  /* ============================================================
     Dialogs, auth, start
     ============================================================ */
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
      store.setSession(session); first = false;
      setTop();
      if(changed) setTimeout(route, 0);
      // Opened the link in a password reset email: they're signed in, now ask for the new password.
      if(event === "PASSWORD_RECOVERY") setTimeout(() => openAuth("reset"), 60);
      else if(wasFirst && linkErr) setTimeout(() => openAuth(/expired|invalid/i.test(linkErr.code + linkErr.text) ? "forgot" : "in",
        /expired|invalid/i.test(linkErr.code + linkErr.text) ? "That link has expired or was already used. Enter your email and we'll send a new one." : linkErr.text), 60);
    });
  } else {
    route();
  }
})();
