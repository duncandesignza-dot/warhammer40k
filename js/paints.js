/* Paint catalogue (loaded on demand) and a paint-name picker with colour swatches. */
(function(){
  "use strict";
  let cat = null, loading = null;
  const norm = s => String(s || "").toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ").trim();
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function build(){
    const d = window.LEDGER_PAINTS; if(!d) return null;
    const count = {};
    d.paints.forEach(([b, n]) => { const k = b + "|" + n.toLowerCase(); count[k] = (count[k] || 0) + 1; });
    const list = d.paints.map(([b, n, set, hex]) => {
      const brand = d.brands[b];
      const label = `${brand} ${n}` + (count[b + "|" + n.toLowerCase()] > 1 && set ? ` (${set})` : "");
      return {brand, name: n, set, hex, label, key: norm(label), nk: norm(n)};
    });
    const byKey = new Map(list.map(p => [p.key, p]));
    return {list, byKey, brands: d.brands};
  }
  function load(){
    if(cat) return Promise.resolve(cat);
    if(loading) return loading;
    loading = new Promise(res => {
      if(window.LEDGER_PAINTS){ cat = build(); return res(cat); }
      const s = document.createElement("script");
      s.src = "js/data/paints.js"; s.async = true;
      s.onload = () => { cat = build(); res(cat); };
      s.onerror = () => { cat = {list: [], byKey: new Map(), brands: []}; res(cat); };
      document.head.appendChild(s);
    });
    return loading;
  }
  const find = label => cat ? cat.byKey.get(norm(label)) || null : null;
  function search(q, extra, limit){
    q = norm(q); limit = limit || 12;
    const words = q.split(" ").filter(Boolean);
    const pool = (cat ? cat.list : []);
    const custom = (extra || []).filter(l => !find(l)).map(l => ({label: l, key: norm(l), nk: norm(l), brand: "", name: l, set: "Your paint", hex: ""}));
    const all = custom.concat(pool);
    if(!words.length) return custom.slice(0, limit);
    const scored = [];
    for(const p of all){
      const hay = p.key + " " + norm(p.set);
      if(!words.every(w => hay.includes(w))) continue;
      const s = (p.nk.startsWith(q) ? 0 : p.key.startsWith(q) ? 1 : p.nk.includes(q) ? 2 : 3) + (p.set === "Your paint" ? -0.5 : 0) + (/discontinued/i.test(p.set) ? 2 : 0) + (/\b(air|spray|primer|thinner|medium)\b/i.test(p.set) ? 1 : 0);
      scored.push([s, p]);
      if(scored.length > 400) break;
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1].label.localeCompare(b[1].label)).slice(0, limit).map(x => x[1]);
  }
  const swatch = (label, cls) => { const p = find(label); return `<span class="pswatch ${cls || ""}" style="${p ? "background:" + p.hex : ""}"></span>`; };

  /* Autocomplete on a text input. opts.extra(): extra names (e.g. paints you own); opts.onPick(label). */
  function picker(input, opts){
    opts = opts || {};
    load();
    const box = document.createElement("div");
    box.className = "psuggest"; box.hidden = true; box.setAttribute("role", "listbox");
    input.setAttribute("autocomplete", "off"); input.setAttribute("role", "combobox"); input.setAttribute("aria-expanded", "false");
    const wrap = input.parentElement; wrap.classList.add("pwrap"); wrap.appendChild(box);
    let items = [], active = -1, picking = false;
    const owned = () => (opts.owned ? opts.owned() : new Set());
    function show(){
      const q = input.value;
      items = search(q, opts.extra ? opts.extra() : [], 10);
      if(!items.length || !q.trim()){ hide(); return; }
      const own = owned();
      box.innerHTML = items.map((p, i) => `<div class="psug${i === active ? " on" : ""}" role="option" data-i="${i}">
        <span class="pswatch" style="${p.hex ? "background:" + p.hex : ""}"></span>
        <span class="pn"><strong>${esc(p.brand ? p.name : p.label)}</strong><small>${esc([p.brand, p.set].filter(Boolean).join(" · "))}</small></span>
        ${own.has(p.key) ? `<span class="pown">Owned</span>` : ""}</div>`).join("");
      box.hidden = false; input.setAttribute("aria-expanded", "true");
      place();
    }
    // Float the list over everything (so dialogs can't clip it), below the input or above if there's no room.
    function place(){
      if(box.hidden) return;
      const r = input.getBoundingClientRect(), vh = window.innerHeight, gap = 6;
      const below = vh - r.bottom - gap - 12, above = r.top - gap - 12;
      const up = below < 260 && above > below;
      const maxH = Math.max(160, Math.min(380, up ? above : below));
      Object.assign(box.style, {left: r.left + "px", width: Math.max(r.width, 280) + "px", maxHeight: maxH + "px",
        top: up ? "" : (r.bottom + gap) + "px", bottom: up ? (vh - r.top + gap) + "px" : ""});
    }
    const onMove = () => { if(!box.hidden) place(); };
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);
    function hide(){ box.hidden = true; active = -1; input.setAttribute("aria-expanded", "false"); }
    function pick(i){ const p = items[i]; if(!p) return; input.value = p.label; hide(); picking = true; input.dispatchEvent(new Event("input", {bubbles: true})); picking = false; if(opts.onPick) opts.onPick(p.label); }
    input.addEventListener("input", () => { if(picking) return; active = -1; load().then(show); });
    input.addEventListener("focus", () => load().then(show));
    input.addEventListener("blur", () => setTimeout(hide, 150));
    input.addEventListener("keydown", e => {
      if(box.hidden) return;
      if(e.key === "ArrowDown"){ e.preventDefault(); active = Math.min(items.length - 1, active + 1); show(); }
      else if(e.key === "ArrowUp"){ e.preventDefault(); active = Math.max(0, active - 1); show(); }
      else if(e.key === "Enter" && active >= 0){ e.preventDefault(); pick(active); }
      else if(e.key === "Escape"){ e.stopPropagation(); e.preventDefault(); hide(); }
    });
    box.addEventListener("mousedown", e => { const o = e.target.closest("[data-i]"); if(o){ e.preventDefault(); pick(+o.dataset.i); } });
    return {hide};
  }

  /* Colour slot: a button showing the chosen paint (or a plain colour). It opens a picker to search
     every paint, choose one of yours or an army colour, or set a custom colour. The hex always follows
     the paint, so badges keep working from colours alone.
     opts: {id: id for a hidden input holding the hex, label, value: {hex, paint}, owned(): Set of
     owned keys, mine(): your paint labels, swatches(): [{hex, paint}], onChange({hex, paint})} */
  let openSlot = null;
  const cname = hex => (window.LEDGER_PRESETS && window.LEDGER_PRESETS.colorName(hex)) || hex;
  const okHex = h => /^#[0-9a-f]{6}$/i.test(h || "");
  function slot(host, opts){
    load();
    let v = {hex: okHex(opts.value && opts.value.hex) ? opts.value.hex : "#1f1f22", paint: (opts.value && opts.value.paint) || ""};
    host.classList.add("cp-host");
    host.innerHTML = `<button type="button" class="cp" aria-haspopup="dialog" aria-expanded="false"><span class="cp-sw"></span><span class="cp-t"><strong></strong><small></small></span></button>${opts.id ? `<input type="hidden" id="${esc(opts.id)}">` : ""}`;
    const btn = host.querySelector(".cp"), hid = host.querySelector("input");
    function show(){
      const p = v.paint ? find(v.paint) : null;
      host.querySelector(".cp-sw").style.background = v.hex;
      host.querySelector("strong").textContent = p ? p.name : v.paint || cname(v.hex);
      host.querySelector("small").textContent = p ? p.brand : v.paint ? "Your paint" : "Custom colour";
      btn.setAttribute("aria-label", `${opts.label || "Colour"}: ${v.paint || cname(v.hex)}. Change`);
      if(hid) hid.value = v.hex;
    }
    function commit(nv, keepOpen){
      v = {hex: okHex(nv.hex) ? nv.hex : v.hex, paint: nv.paint || ""};
      show();
      if(opts.onChange) opts.onChange({...v});
      if(!keepOpen){ close(); btn.focus(); }
    }

    let pop = null, items = [], active = -1, sws = [];
    const own = () => (opts.owned ? opts.owned() : new Set());
    const row = (p, i) => `<div class="psug${i === active ? " on" : ""}" role="option" data-i="${i}">
      <span class="pswatch" style="${p.hex ? "background:" + p.hex : ""}"></span>
      <span class="pn"><strong>${esc(p.custom ? `Use “${p.label}” as the name` : p.brand ? p.name : p.label)}</strong><small>${esc(p.custom ? "Keeps the current colour" : [p.brand, p.set].filter(Boolean).join(" · "))}</small></span>
      ${!p.custom && own().has(p.key) ? `<span class="pown">Owned</span>` : ""}</div>`;
    function list(){
      if(!pop) return;
      const q = pop.querySelector(".cpop-q").value.trim(), box = pop.querySelector(".cpop-list");
      let html = "";
      if(!q){
        const seen = new Set();
        sws = (opts.swatches ? opts.swatches() : []).filter(s => okHex(s.hex) && !seen.has(s.hex + s.paint) && seen.add(s.hex + s.paint));
        if(sws.length) html += `<div class="cpop-h">Army colours</div><div class="cpop-sws">${sws.map((s, i) => `<button type="button" class="sw" data-sw="${i}" style="background:${s.hex}" title="${esc(s.paint || cname(s.hex))}" aria-label="${esc(s.paint || cname(s.hex))}"></button>`).join("")}</div>`;
        items = (opts.mine ? opts.mine() : []).map(l => find(l) || {label: l, name: l, brand: "", set: "Your paint", hex: "", key: norm(l)}).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 80);
        html += items.length ? `<div class="cpop-h">Your paints</div>${items.map(row).join("")}` : `<p class="cpop-empty">Type to search thousands of paints, or pick a custom colour below.</p>`;
      } else {
        items = search(q, opts.mine ? opts.mine() : [], 30);
        if(!items.some(p => p.nk === norm(q) || p.key === norm(q))) items.push({label: q, name: q, custom: true});
        html = items.map(row).join("");
      }
      box.innerHTML = html;
      const on = box.querySelector(".psug.on"); if(on) on.scrollIntoView({block: "nearest"});
    }
    function place(){
      if(!pop) return;
      if(!host.isConnected){ close(); return; }
      const r = btn.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, w = Math.min(360, vw - 24);
      const below = vh - r.bottom - 18, above = r.top - 18, up = below < 300 && above > below;
      Object.assign(pop.style, {width: w + "px", left: Math.max(12, Math.min(r.left, vw - w - 12)) + "px", maxHeight: Math.max(220, Math.min(440, up ? above : below)) + "px",
        top: up ? "" : (r.bottom + 6) + "px", bottom: up ? (vh - r.top + 6) + "px" : ""});
    }
    function pick(i){
      const p = items[i]; if(!p) return;
      commit(p.custom || !p.hex ? {hex: v.hex, paint: p.label} : {hex: p.hex, paint: p.label});
    }
    function onDoc(e){ if(pop && !pop.contains(e.target) && !btn.contains(e.target)) close(); }
    function open(){
      if(openSlot) openSlot();
      pop = document.createElement("div");
      pop.className = "cpop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Choose " + (opts.label || "a colour"));
      pop.innerHTML = `<input type="search" class="cpop-q" placeholder="Search paints, e.g. Abaddon Black" aria-label="Search paints" autocomplete="off">
        <div class="cpop-list" role="listbox"></div>
        <div class="cpop-foot"><label class="btn btn-sm cpop-custom"><span class="cp-sw" style="background:${v.hex}"></span>Custom colour<input type="color" value="${v.hex}"></label>
        ${v.paint ? `<button type="button" class="btn-sm" data-clear>Keep colour, clear paint</button>` : ""}</div>`;
      // Inside an open dialog so it shows above it; otherwise on the page.
      (btn.closest("dialog[open]") || document.body).appendChild(pop);
      const q = pop.querySelector(".cpop-q"), col = pop.querySelector("input[type=color]");
      q.addEventListener("input", () => { active = -1; list(); });
      q.addEventListener("keydown", e => {
        if(e.key === "ArrowDown"){ e.preventDefault(); active = Math.min(items.length - 1, active + 1); list(); }
        else if(e.key === "ArrowUp"){ e.preventDefault(); active = Math.max(0, active - 1); list(); }
        else if(e.key === "Enter"){ e.preventDefault(); pick(active >= 0 ? active : 0); }
      });
      pop.addEventListener("keydown", e => { if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); close(); btn.focus(); } });
      pop.addEventListener("mousedown", e => { const o = e.target.closest("[data-i]"); if(o){ e.preventDefault(); pick(+o.dataset.i); } });
      pop.addEventListener("click", e => {
        const s = e.target.closest("[data-sw]"); if(s){ const w = sws[+s.dataset.sw]; commit({hex: w.hex, paint: w.paint || ""}); return; }
        if(e.target.closest("[data-clear]")) commit({hex: v.hex, paint: ""});
      });
      col.addEventListener("input", () => { pop.querySelector(".cpop-custom .cp-sw").style.background = col.value; commit({hex: col.value, paint: ""}, true); });
      document.addEventListener("mousedown", onDoc, true);
      window.addEventListener("resize", place); document.addEventListener("scroll", place, true);
      openSlot = close;
      btn.setAttribute("aria-expanded", "true");
      list(); place(); q.focus();
      load().then(list);
    }
    function close(){
      if(!pop) return;
      pop.remove(); pop = null; active = -1;
      document.removeEventListener("mousedown", onDoc, true);
      window.removeEventListener("resize", place); document.removeEventListener("scroll", place, true);
      if(openSlot === close) openSlot = null;
      btn.setAttribute("aria-expanded", "false");
    }
    btn.addEventListener("click", () => pop ? close() : open());
    show(); load().then(show);
    return {get: () => ({...v}), set(nv){ v = {hex: okHex(nv.hex) ? nv.hex : v.hex, paint: nv.paint || ""}; show(); }, close};
  }
  // Short name for a paint label ("Citadel Abaddon Black" -> "Abaddon Black"); other text as it is.
  const shortName = label => { const p = label ? find(label) : null; return p ? p.name : label || ""; };

  window.LEDGER_PAINTUI = {load, find, search, swatch, picker, norm, slot, shortName};
})();
