/* Starting colour schemes per faction. These are only a starting point:
   every colour can be changed on the setup page. */
(function(){
  "use strict";

  // Named colours used for swatches and for describing a picked colour in words.
  const NAMED = [
    ["Black","#1f1f22"],["Charcoal","#3a3a3e"],["Gunmetal","#5d6166"],["Grey","#8a8d91"],["Silver","#a9adb3"],["White","#efeee9"],
    ["Bone","#d8cba8"],["Sand","#c9b27c"],["Khaki","#8f8a5a"],["Brown","#6b4a2e"],["Leather","#8a5a34"],["Bronze","#9a6b3a"],
    ["Brass","#b08d3c"],["Gold","#c9a13b"],["Yellow","#e8c33a"],["Orange","#d9702a"],["Red","#b3141c"],["Crimson","#7a0d12"],
    ["Pink","#d97aa6"],["Magenta","#b8428e"],["Purple","#5a2a6b"],["Violet","#7b5ab8"],["Navy","#1c2c55"],["Blue","#1f4aa8"],
    ["Sky blue","#3b8fe0"],["Teal","#1f7a78"],["Turquoise","#2fb3b0"],["Green","#1f6b3a"],["Dark green","#1e3b2a"],["Olive","#5a6b3a"],
    ["Bright green","#3fbf5a"],["Sickly green","#8a8f5a"],["Flesh","#c79a7e"]
  ];

  // Emblem shapes (drawn in a 1000 x 1000 box). "cross" uses the uploaded Templar cross artwork.
  const SHAPES = [
    ["cross","Cross"],["star","Star"],["chevron","Chevron"],["bolt","Lightning"],["drop","Drop"],
    ["crescent","Crescent"],["diamond","Diamond"],["arrow","Arrow"],["ring","Ring"],["none","None"]
  ];

  const T = (name, color, note) => ({name, color, note: note || ""});

  // style: "astartes" shows the power-armour helmet badge, "roundel" shows a colour roundel.
  const P = {
    "black-templars":   {style:"astartes", armour:"#1f1f22", secondary:"#efeee9", trim:"#efeee9", emblem:"#efeee9", shape:"cross",   lens:"#b3141c", cloth:"#d8cba8", metal:"#a9adb3",
                          tiers:[T("Black helmet","#1f1f22","Neophytes and Initiates"),T("White helmet","#efeee9","Sword Brethren"),T("Red helmet","#b3141c","Emperor's Champion and Marshal"),T("Bone helmet","#d8cba8","Chaplains")]},
    "space-marines":    {style:"astartes", armour:"#5d6166", secondary:"#efeee9", trim:"#c9a13b", emblem:"#efeee9", shape:"diamond", lens:"#3fbf5a", cloth:"#d8cba8", metal:"#a9adb3"},
    "ultramarines":     {style:"astartes", armour:"#1f4aa8", secondary:"#efeee9", trim:"#c9a13b", emblem:"#efeee9", shape:"arrow",   lens:"#b3141c", cloth:"#d8cba8", metal:"#a9adb3"},
    "blood-angels":     {style:"astartes", armour:"#9e1b1b", secondary:"#1f1f22", trim:"#c9a13b", emblem:"#1f1f22", shape:"drop",    lens:"#3fbf5a", cloth:"#1f1f22", metal:"#c9a13b"},
    "dark-angels":      {style:"astartes", armour:"#1e3b2a", secondary:"#d8cba8", trim:"#d8cba8", emblem:"#efeee9", shape:"star",    lens:"#b3141c", cloth:"#d8cba8", metal:"#a9adb3"},
    "space-wolves":     {style:"astartes", armour:"#6b7f93", secondary:"#e8c33a", trim:"#c9a13b", emblem:"#1f1f22", shape:"crescent",lens:"#e8c33a", cloth:"#6b4a2e", metal:"#a9adb3"},
    "imperial-fists":   {style:"astartes", armour:"#e8c33a", secondary:"#1f1f22", trim:"#1f1f22", emblem:"#b3141c", shape:"star",    lens:"#3fbf5a", cloth:"#d8cba8", metal:"#a9adb3"},
    "iron-hands":       {style:"astartes", armour:"#1f1f22", secondary:"#a9adb3", trim:"#efeee9", emblem:"#efeee9", shape:"ring",    lens:"#3fbf5a", cloth:"#3a3a3e", metal:"#a9adb3"},
    "raven-guard":      {style:"astartes", armour:"#1f1f22", secondary:"#efeee9", trim:"#efeee9", emblem:"#efeee9", shape:"chevron", lens:"#b3141c", cloth:"#1f1f22", metal:"#a9adb3"},
    "salamanders":      {style:"astartes", armour:"#1f6b3a", secondary:"#1f1f22", trim:"#c9a13b", emblem:"#d9702a", shape:"drop",    lens:"#b3141c", cloth:"#1f1f22", metal:"#c9a13b"},
    "white-scars":      {style:"astartes", armour:"#efeee9", secondary:"#b3141c", trim:"#b3141c", emblem:"#b3141c", shape:"bolt",    lens:"#b3141c", cloth:"#b3141c", metal:"#a9adb3"},
    "deathwatch":       {style:"astartes", armour:"#1f1f22", secondary:"#a9adb3", trim:"#a9adb3", emblem:"#efeee9", shape:"diamond", lens:"#3fbf5a", cloth:"#1f1f22", metal:"#a9adb3"},
    "grey-knights":     {style:"astartes", armour:"#a9adb3", secondary:"#b3141c", trim:"#c9a13b", emblem:"#b3141c", shape:"star",    lens:"#3b8fe0", cloth:"#b3141c", metal:"#a9adb3"},
    "adeptus-custodes": {style:"roundel",  armour:"#c9a13b", secondary:"#7a0d12", trim:"#b08d3c", emblem:"#1f1f22", shape:"star",    lens:"#3fbf5a", cloth:"#7a0d12", metal:"#c9a13b"},
    "adepta-sororitas": {style:"roundel",  armour:"#1f1f22", secondary:"#b3141c", trim:"#efeee9", emblem:"#efeee9", shape:"cross",   lens:"#3fbf5a", cloth:"#b3141c", metal:"#a9adb3"},
    "adeptus-mechanicus":{style:"roundel", armour:"#9e1b1b", secondary:"#a9adb3", trim:"#b08d3c", emblem:"#efeee9", shape:"ring",    lens:"#3fbf5a", cloth:"#9e1b1b", metal:"#a9adb3"},
    "agents-of-the-imperium":{style:"roundel",armour:"#3a3a3e",secondary:"#b3141c",trim:"#c9a13b",emblem:"#c9a13b", shape:"diamond", lens:"#3fbf5a", cloth:"#1f1f22", metal:"#a9adb3"},
    "astra-militarum":  {style:"roundel",  armour:"#5a6b3a", secondary:"#c9b27c", trim:"#6b4a2e", emblem:"#efeee9", shape:"chevron", lens:"#1f1f22", cloth:"#c9b27c", metal:"#5d6166"},
    "imperial-knights": {style:"roundel",  armour:"#1f4aa8", secondary:"#efeee9", trim:"#c9a13b", emblem:"#efeee9", shape:"cross",   lens:"#3fbf5a", cloth:"#b3141c", metal:"#a9adb3"},
    "chaos-space-marines":{style:"astartes",armour:"#1f1f22",secondary:"#b08d3c", trim:"#b08d3c", emblem:"#b3141c", shape:"star",    lens:"#b3141c", cloth:"#7a0d12", metal:"#5d6166"},
    "death-guard":      {style:"astartes", armour:"#8a8f5a", secondary:"#9a6b3a", trim:"#9a6b3a", emblem:"#1f1f22", shape:"ring",    lens:"#3fbf5a", cloth:"#d8cba8", metal:"#6b4a2e"},
    "emperors-children":{style:"astartes", armour:"#b8428e", secondary:"#1f1f22", trim:"#c9a13b", emblem:"#c9a13b", shape:"star",    lens:"#3b8fe0", cloth:"#efeee9", metal:"#c9a13b"},
    "thousand-sons":    {style:"astartes", armour:"#1f4aa8", secondary:"#c9a13b", trim:"#c9a13b", emblem:"#c9a13b", shape:"star",    lens:"#2fb3b0", cloth:"#efeee9", metal:"#c9a13b"},
    "world-eaters":     {style:"astartes", armour:"#9e1b1b", secondary:"#b08d3c", trim:"#b08d3c", emblem:"#b08d3c", shape:"diamond", lens:"#3fbf5a", cloth:"#1f1f22", metal:"#9a6b3a"},
    "chaos-daemons":    {style:"roundel",  armour:"#7a0d12", secondary:"#1f1f22", trim:"#b08d3c", emblem:"#b08d3c", shape:"star",    lens:"#e8c33a", cloth:"#1f1f22", metal:"#9a6b3a"},
    "chaos-knights":    {style:"roundel",  armour:"#1f1f22", secondary:"#7a0d12", trim:"#b08d3c", emblem:"#b08d3c", shape:"star",    lens:"#b3141c", cloth:"#7a0d12", metal:"#5d6166"},
    "aeldari":          {style:"roundel",  armour:"#1f1f22", secondary:"#d8cba8", trim:"#d8cba8", emblem:"#b3141c", shape:"drop",    lens:"#3fbf5a", cloth:"#d8cba8", metal:"#a9adb3"},
    "drukhari":         {style:"roundel",  armour:"#1e3b2a", secondary:"#a9adb3", trim:"#a9adb3", emblem:"#efeee9", shape:"crescent",lens:"#3fbf5a", cloth:"#5a2a6b", metal:"#a9adb3"},
    "genestealer-cults":{style:"roundel",  armour:"#5a2a6b", secondary:"#c9b27c", trim:"#b08d3c", emblem:"#b08d3c", shape:"star",    lens:"#e8c33a", cloth:"#c9b27c", metal:"#5d6166"},
    "leagues-of-votann":{style:"roundel",  armour:"#8a8d91", secondary:"#d9702a", trim:"#c9a13b", emblem:"#efeee9", shape:"diamond", lens:"#3b8fe0", cloth:"#6b4a2e", metal:"#9a6b3a"},
    "necrons":          {style:"roundel",  armour:"#a9adb3", secondary:"#1f1f22", trim:"#c9a13b", emblem:"#3fbf5a", shape:"ring",    lens:"#3fbf5a", cloth:"#1f1f22", metal:"#a9adb3"},
    "orks":             {style:"roundel",  armour:"#4f7a2a", secondary:"#b3141c", trim:"#e8c33a", emblem:"#1f1f22", shape:"bolt",    lens:"#b3141c", cloth:"#6b4a2e", metal:"#5d6166"},
    "tau-empire":       {style:"roundel",  armour:"#c98a3b", secondary:"#efeee9", trim:"#1f1f22", emblem:"#efeee9", shape:"ring",    lens:"#3fbf5a", cloth:"#6b4a2e", metal:"#5d6166"},
    "tyranids":         {style:"roundel",  armour:"#5a2a6b", secondary:"#d8cba8", trim:"#b3141c", emblem:"#d8cba8", shape:"drop",    lens:"#e8c33a", cloth:"#d8cba8", metal:"#d8cba8"}
  };

  const DEFAULT_TIERS = (p) => [
    T("Line", p.armour, "Standard troops"),
    T("Veteran", p.secondary, "Veterans and elites"),
    T("Leader", "#b3141c", "Sergeants and characters"),
    T("Hero", p.trim, "Your warlord and heroes")
  ];

  function presetFor(factionId){
    const base = P[factionId] || P["space-marines"];
    return {
      style: base.style,
      colors: {armour:base.armour, secondary:base.secondary, trim:base.trim, emblem:base.emblem, lens:base.lens, cloth:base.cloth, metal:base.metal},
      shape: base.shape,
      tiers: (base.tiers || DEFAULT_TIERS(base)).map(t => ({...t}))
    };
  }

  function colorName(hex){
    const h = String(hex||"").replace("#","");
    if(!/^[0-9a-f]{6}$/i.test(h)) return "";
    const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16);
    let best="", d=1e9;
    for(const [n,c] of NAMED){
      const R=parseInt(c.slice(1,3),16), G=parseInt(c.slice(3,5),16), B=parseInt(c.slice(5,7),16);
      const rm=(r+R)/2, dd=(2+rm/256)*(r-R)**2 + 4*(g-G)**2 + (2+(255-rm)/256)*(b-B)**2;
      if(dd<d){d=dd;best=n}
    }
    return best;
  }

  window.LEDGER_PRESETS = {NAMED, SHAPES, presetFor, colorName};
})();
