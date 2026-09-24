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
    }
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

  window.LEDGER_PAINTUI = {load, find, search, swatch, picker, norm};
})();
