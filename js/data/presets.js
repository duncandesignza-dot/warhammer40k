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
    "black-templars":   {style:"astartes", armour:"#1f1f22", secondary:"#efeee9", trim:"#efeee9", emblem:"#efeee9", shape:"cross",   lens:"#b3141c", cloth:"#d8cba8", metal:"#a9adb3"},
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
    "orks":             {style:"roundel",  armour:"#5d6166", secondary:"#b3141c", trim:"#e8c33a", emblem:"#1f1f22", shape:"bolt",    lens:"#b3141c", cloth:"#6b4a2e", metal:"#8a8d91"},
    "tau-empire":       {style:"roundel",  armour:"#c98a3b", secondary:"#efeee9", trim:"#1f1f22", emblem:"#efeee9", shape:"ring",    lens:"#3fbf5a", cloth:"#6b4a2e", metal:"#5d6166"},
    "tyranids":         {style:"roundel",  armour:"#5a2a6b", secondary:"#d8cba8", trim:"#b3141c", emblem:"#d8cba8", shape:"drop",    lens:"#e8c33a", cloth:"#d8cba8", metal:"#d8cba8"}
  };

  /* Faction icons from the emblem library (icons/...). Default emblem per faction, and which
     icon groups are suggested first on the colour page. */
  const ICON_DEFAULT = {
    "black-templars":"astartes-chapters/black-templars.svg", "ultramarines":"astartes-legion/ultramarines.svg",
    "blood-angels":"astartes-legion/blood-angels.svg", "dark-angels":"astartes-legion/dark-angels.svg",
    "space-wolves":"astartes-legion/space-wolves.svg", "imperial-fists":"astartes-legion/imperial-fists.svg",
    "iron-hands":"astartes-legion/iron-hands.svg", "raven-guard":"astartes-legion/raven-guard.svg",
    "salamanders":"astartes-legion/salamanders.svg", "white-scars":"astartes-legion/white-scars.svg",
    "deathwatch":"astartes-chapters/deathwatch.svg", "grey-knights":"astartes-chapters/grey-knights.svg",
    "space-marines":"human-imperium/adeptus-astartes.svg", "adeptus-custodes":"human-imperium/adeptus-custodes.svg",
    "adepta-sororitas":"human-imperium/adepta-sororitas.svg", "adeptus-mechanicus":"human-imperium/adeptus-mechanicus.svg",
    "agents-of-the-imperium":"human-imperium/inquisition-01.svg", "astra-militarum":"human-imperium/astra-militarum.svg",
    "imperial-knights":"human-imperium/imperial-knights.svg", "chaos-space-marines":"legions/black-legion.svg",
    "death-guard":"legions/death-guard.svg", "emperors-children":"legions/emperors-children-1.svg",
    "thousand-sons":"legions/thousand-sons.svg", "world-eaters":"legions/world-eaters-1.svg",
    "chaos-daemons":"chaos/chaos-daemons.svg", "chaos-knights":"chaos/questor-traitoris.svg",
    "aeldari":"eldar/asuryani.svg", "drukhari":"durhkari/drukhari-2.svg", "genestealer-cults":"genestealer-cult/genestealer-cults.svg",
    "leagues-of-votann":"xenos/leagues-of-votann.svg", "necrons":"necrons/necrons.svg", "orks":"orks/orks.svg",
    "tau-empire":"tau-empire/tau-sept.svg", "tyranids":"xenos/tyranids.svg"
  };
  const SM = ["human_imperium/astartes_chapters","human_imperium/astartes_legion","human_imperium/astartes_legion/blood_angels","human_imperium/astartes_legion/dark_angels","human_imperium/astartes_legion/imperial_fists","human_imperium/astartes_legion/iron_hands","human_imperium/astartes_legion/space_wolves","human_imperium/adeptus_astartes","human_imperium"];
  const CHAOS = ["chaos/legions","chaos","chaos/gods"];
  const ICON_CATS = {
    "space-marines":SM, "adeptus-custodes":["human_imperium/adeptus_custodes","human_imperium/sisters_of_silence","human_imperium"],
    "adepta-sororitas":["human_imperium/battle_sisters","human_imperium"], "adeptus-mechanicus":["human_imperium/mechanicum","human_imperium"],
    "agents-of-the-imperium":["human_imperium","human_imperium/officio-assassinorum","human_imperium/sisters_of_silence"],
    "astra-militarum":["human_imperium/astra_militarum","human_imperium/solar_auxilla","human_imperium"],
    "imperial-knights":["human_imperium","human_imperium/mechanicum"], "grey-knights":SM, "deathwatch":SM,
    "chaos-space-marines":CHAOS, "death-guard":CHAOS, "emperors-children":CHAOS, "thousand-sons":CHAOS, "world-eaters":CHAOS,
    "chaos-daemons":["chaos/gods","chaos"], "chaos-knights":["chaos","chaos/gods"],
    "aeldari":["xenos/eldar","xenos/harlequins"], "drukhari":["xenos/durhkari","xenos/harlequins"], "genestealer-cults":["xenos/genestealer_cult","xenos"],
    "leagues-of-votann":["xenos"], "necrons":["xenos/necrons"], "orks":["xenos/orks"], "tau-empire":["xenos/tau_empire"], "tyranids":["xenos"]
  };
  const ICONS = (window.LEDGER_EMBLEMS && window.LEDGER_EMBLEMS.icons) || [];
  const ICON_BY_ID = Object.fromEntries(ICONS.map(i => [i.id, i]));
  function defaultIcon(fid){ const p = ICON_DEFAULT[fid]; const i = p && ICONS.find(x => x.f.endsWith("/" + p) || x.f.endsWith(p)); return i ? "icon:" + i.id : ""; }
  function iconCats(fid, parent){ return ICON_CATS[fid] || ICON_CATS[parent] || SM; }
  function emblemName(shape){
    if(String(shape).startsWith("icon:")){ const i = ICON_BY_ID[shape.slice(5)]; return i ? i.n : "Icon"; }
    const s = SHAPES.find(x => x[0] === shape); return s ? s[1] : "Emblem";
  }

  /* Paint areas per faction. Every army stores the same colour slots (helmet, lens, armour, secondary,
     trim, emblem, cloth, metal, skin); a profile says what each slot means for that faction's models,
     e.g. "armour" is Carapace for Tyranids and Necrodermis for Necrons. "helmet" is the slot that
     follows the unit's rank. Units pick a head type: helmet, bare (a face in the skin colour) or none;
     bare is only offered when the profile allows it. */
  const SKIN = "#c79a7e";
  const BASE = {
    head: "helmet",
    labels: {helmet:"Helmet", lens:"Lenses / eyes", armour:"Armour", secondary:"Secondary", trim:"Trim", emblem:"Emblem",
             cloth:"Robes / cloth", metal:"Weapons / metal", skin:"Skin", lpauldron:"Left pauldron", rpauldron:"Right pauldron"},
    legends: {head:"Helmet", body:"Armour & pauldrons", details:"Cloth & details"},
    detail: ["Helmet detail", "e.g. laurel wreath, centre stripe"],
    detailOpts: ["Laurel wreath","Centre stripe","Crest","Battle damage","Squad markings"],
    bare: true,
    defaultHead: "helmet",
    // Roles that start with no head to paint.
    noHeadRoles: ["Vehicle","Monster","Dedicated Transport","Fortification"],
    extras: ["Purity seals, freehand & extras", "e.g. red wax seals, freehand on kneepad"],
    hide: [],
    more: ["Weapons","Leather"],
    tiers: [["Line","Standard troops"],["Veteran","Veterans and elites"],["Leader","Sergeants and characters"],["Hero","Your warlord and heroes"]]
  };
  const KINDS = {
    // Space Marines can paint each shoulder pad its own colour (e.g. Deathwatch's silver left pauldron).
    astartes: {pauldrons: true},
    chaos: {
      labels: {emblem:"Icon / mark"},
      detailOpts: ["Horns","Crest","Face stripes","Battle damage","Warband markings"],
      extras: ["Trophies, spikes & extras", "e.g. brass spikes, skulls, freehand runes"],
      more: ["Weapons","Leather","Spikes & trophies"],
      tiers: [["Legionaries","Standard troops"],["Chosen","Veterans and elites"],["Champion","Aspiring Champions and characters"],["Lord","Your warlord and heroes"]]
    },
    custodes: {
      labels: {cloth:"Cloaks / plumes"},
      detailOpts: ["Plume","Laurel wreath","Battle damage"],
      extras: ["Scrolls, freehand & extras", "e.g. red oath scrolls, laurel freehand"],
      tiers: [["Custodian Guard","Line troops"],["Allarus","Terminators and elites"],["Shield-Captain","Characters"],["Hero","Your warlord and heroes"]]
    },
    sororitas: {
      labels: {armour:"Armour", secondary:"Armour detail", emblem:"Fleur / emblem", cloth:"Robes"},
      legends: {head:"Head", body:"Armour", details:"Robes & details"},
      detail: ["Helmet detail", "e.g. fleur on the brow, red stripe"],
      detailOpts: ["Fleur","Stripe","Veil","Halo"],
      defaultHead: "bare",
      extras: ["Purity seals, scrolls & extras", "e.g. red wax seals, scripture scrolls"],
      tiers: [["Battle Sisters","Line troops"],["Celestians","Veterans and elites"],["Sister Superior","Squad leaders and characters"],["Canoness","Your warlord and heroes"]]
    },
    mechanicus: {
      head: "hood",
      labels: {helmet:"Hood / mask", lens:"Optics", armour:"Robes", secondary:"Armour plates", trim:"Trim / edging", emblem:"Cog / emblem",
               cloth:"Undersuit / cabling", metal:"Bionics / metal"},
      legends: {head:"Head", body:"Robes & plates", details:"Bionics & details"},
      detail: ["Head detail", "e.g. glowing optics, rebreather"],
      detailOpts: ["Rebreather","Mechadendrites","Hazard stripes","Hood lining"],
      extras: ["Hazard stripes, markings & extras", "e.g. yellow-black hazard stripes, binary script"],
      more: ["Weapons","Cables","Hazard stripes"],
      tiers: [["Skitarii","Line troops"],["Elites","Ruststalkers, Infiltrators and Kataphrons"],["Alpha","Squad leaders"],["Tech-Priest","Characters"]]
    },
    guard: {
      labels: {lens:"Lenses / goggles", armour:"Armour / hulls", secondary:"Fatigues", trim:"Webbing / straps", emblem:"Insignia", cloth:"Greatcoat / cloth"},
      legends: {head:"Helmet", body:"Armour & uniform", details:"Kit & details"},
      detail: ["Helmet detail", "e.g. rank stripes, camo net"],
      detailOpts: ["Rank stripes","Camo net","Squad number","Goggles","Beret"],
      extras: ["Kit, markings & extras", "e.g. regiment number, bedroll, pouches"],
      more: ["Weapons","Leather","Camo","Tank tracks"],
      tiers: [["Troopers","Infantry squads"],["Veterans","Kasrkin, Tempestus and elites"],["Sergeant","Sergeants and officers"],["Commander","Your warlord and heroes"]]
    },
    knights: {
      head: "helm",
      labels: {helmet:"Helm", lens:"Eye lenses", armour:"Carapace", secondary:"Heraldry colour", emblem:"House emblem",
               cloth:"Banners / tabards", metal:"Chassis / weapons", skin:"Skin (pilots)"},
      legends: {head:"Helm", body:"Carapace & heraldry", details:"Chassis & details"},
      detail: ["Helm detail", "e.g. crest, face-plate stripe"],
      detailOpts: ["Crest","Face-plate stripe","Laurels","Battle damage"],
      bare: false,
      noHeadRoles: ["Fortification"],
      extras: ["Heraldry, kill markings & extras", "e.g. checks, kill banners, freehand"],
      more: ["Weapons","Pistons & cables","Heraldry"],
      tiers: [["Armigers","Armiger-class Knights"],["Questoris","Questoris-class Knights"],["Dominus","Dominus-class Knights"],["Hero","Your warlord and characters"]]
    },
    agents: {
      labels: {secondary:"Coat / uniform"},
      tiers: [["Troops","Retinues and troops"],["Specialists","Assassins and elites"],["Leader","Characters"],["Inquisitor","Your warlord"]]
    },
    aeldari: {
      labels: {lens:"Lenses & gems", emblem:"Rune", cloth:"Cloth / cloaks", metal:"Weapons"},
      legends: {head:"Helmet", body:"Armour & markings", details:"Cloth & details"},
      detail: ["Helmet detail", "e.g. crest, rune on the brow"],
      detailOpts: ["Crest","Plume","Rune","Hair"],
      extras: ["Gems, runes & freehand", "e.g. red spirit stones, craftworld rune"],
      more: ["Weapons","Gems","Wraithbone"],
      tiers: [["Guardians","Guardians and line troops"],["Aspect Warriors","Aspect Warriors and elites"],["Exarch","Exarchs and leaders"],["Seer","Farseers, Autarchs and heroes"]]
    },
    drukhari: {
      labels: {helmet:"Helmet / hair", trim:"Trim / blades", cloth:"Cloth / cloaks"},
      detailOpts: ["Crest","Hair plume","Glyph","Spikes"],
      extras: ["Trophies, glyphs & extras", "e.g. severed hands, kabal glyphs"],
      more: ["Weapons","Leather","Blades & spikes"],
      tiers: [["Kabalites","Kabalite Warriors and Wyches"],["Elites","Incubi, Mandrakes and Trueborn"],["Sybarite","Squad leaders"],["Archon","Archons, Succubi and Haemonculi"]]
    },
    gsc: {
      skinAlways: true,
      labels: {helmet:"Helmet / cap", lens:"Eyes / lamps", armour:"Overalls / uniform", trim:"Webbing / straps", emblem:"Cult icon", cloth:"Rags / cloth", metal:"Weapons / tools"},
      legends: {head:"Head", body:"Overalls & uniform", details:"Skin & details"},
      detail: ["Helmet detail", "e.g. mining lamp, hazard stripe"],
      detailOpts: ["Mining lamp","Goggles","Hazard stripe","Cult icon"],
      extras: ["Cult markings & extras", "e.g. cult icon freehand, hazard stripes"],
      more: ["Weapons","Leather","Hazard stripes"],
      tiers: [["Neophytes","Neophyte Hybrids"],["Acolytes","Acolytes and Aberrants"],["Leader","Leaders and characters"],["Patriarch","The Patriarch and Magus"]]
    },
    votann: {
      labels: {lens:"Visor", emblem:"League emblem", cloth:"Undersuit / cloth"},
      detail: ["Beard & helmet detail", "e.g. ginger beard, helmet stripe"],
      detailOpts: ["Beard","Helmet stripe","Crest","Rank markings"],
      extras: ["Markings & extras", "e.g. hazard stripes, rank markings, Ironkin glow"],
      more: ["Weapons","Beards","Leather"],
      tiers: [["Hearthkyn","Hearthkyn Warriors"],["Hearthguard","Hearthguard and Einhyr"],["Theyn","Theyns and squad leaders"],["Kâhl","Kâhls and heroes"]]
    },
    necrons: {
      head: "head",
      labels: {helmet:"Head", lens:"Gauss glow / eyes", armour:"Necrodermis", secondary:"Carapace / panels", emblem:"Dynasty glyph",
               cloth:"Cloth / cables", metal:"Weapons"},
      legends: {head:"Head", body:"Necrodermis & carapace", details:"Cloth & details"},
      detail: ["Head detail", "e.g. gold crest, headdress stripes"],
      detailOpts: ["Headdress","Crest","Stripes","Crown"],
      bare: false,
      extras: ["Glyphs, glow & extras", "e.g. green gauss glow on guns, verdigris"],
      hide: ["skin"],
      more: ["Weapons","Gauss glow","Verdigris"],
      // Nobles wear the dynasty's gold on their heads (see TIER_SRC).
      tiers: [["Warriors","Necron Warriors and line troops"],["Immortals","Immortals, Lychguard and elites"],["Lord","Lords and Crypteks"],["Overlord","Overlords and heroes"]]
    },
    orks: {
      skinAlways: true,
      defaultHead: "bare",
      labels: {lens:"Eyes", armour:"Armour plates", secondary:"Clan colour", emblem:"Glyph", cloth:"Clothes / trousers"},
      legends: {head:"Head", body:"Armour & clan colours", details:"Skin & details"},
      detail: ["Helmet detail", "e.g. horns, glyph on helmet"],
      detailOpts: ["Horns","Glyph","Checks","Flames","Scars"],
      extras: ["Glyphs, checks & extras", "e.g. black-white checks, teef, rust"],
      more: ["Weapons","Leather","Teef & claws","Rust"],
      tiers: [["Boyz","Boyz and gretchin"],["Nobz","Nobz and Meganobz"],["Boss","Bosses and characters"],["Warboss","Your Warboss and heroes"]]
    },
    tau: {
      labels: {lens:"Lenses", secondary:"Sept markings", emblem:"Sept symbol", cloth:"Undersuit / cloth", metal:"Weapons"},
      legends: {head:"Helmet", body:"Armour & sept markings", details:"Undersuit & details"},
      detail: ["Helmet detail", "e.g. rank stripes, sensor spines"],
      detailOpts: ["Rank stripes","Sensor spines","Markings"],
      extras: ["Markings, stripes & extras", "e.g. hunter cadre stripes, kill markings"],
      more: ["Weapons","Undersuit","Kroot skin"],
      tiers: [["Shas'la","Fire Warriors and line troops"],["Shas'ui","Team leaders, Stealth and Crisis teams"],["Shas'vre","Veterans, Bodyguards and Broadsides"],["Shas'o","Commanders and heroes"]]
    },
    tyranids: {
      skinAlways: true,
      head: "head",
      labels: {helmet:"Head / crest", lens:"Eyes", armour:"Carapace", secondary:"Carapace pattern", trim:"Carapace edges", emblem:"Markings",
               cloth:"Tongues / membranes", metal:"Claws & talons"},
      legends: {head:"Head", body:"Carapace", details:"Skin & details"},
      detail: ["Head detail", "e.g. striped crest, dark eye sockets"],
      detailOpts: ["Stripes","Spots","Crest"],
      bare: false,
      noHeadRoles: ["Fortification"],
      extras: ["Details & extras", "e.g. purple tongues, glowing bio-weapons"],
      more: ["Bio-weapons","Sinew","Toxin sacs"],
      tiers: [["Swarm","Gaunts, Gargoyles and swarms"],["Warrior","Warriors and mid-sized bugs"],["Synapse","Synapse creatures and characters"],["Monster","Hive Tyrants and monsters"]]
    },
    daemons: {
      head: "head",
      labels: {helmet:"Head / horns", lens:"Eyes", armour:"Skin / hide", secondary:"Second tone", trim:"Horns & claws", emblem:"Mark of Chaos",
               cloth:"Tongues / cloth", metal:"Weapons / brass"},
      legends: {head:"Head", body:"Hide & horns", details:"Weapons & details"},
      detail: ["Head detail", "e.g. horn tips, eye glow"],
      detailOpts: ["Horn tips","Flames","Crest"],
      bare: false,
      noHeadRoles: ["Fortification"],
      extras: ["Details & extras", "e.g. brass armour, pustules, warpfire"],
      hide: ["skin"],
      more: ["Weapons","Warpfire","Brass"],
      tiers: [["Lesser daemons","Bloodletters, Plaguebearers and troops"],["Elites","Beasts, cavalry and elites"],["Herald","Heralds and characters"],["Greater daemon","Greater daemons and heroes"]]
    }
  };
  const KIND_OF = {
    "chaos-space-marines":"chaos", "death-guard":"chaos", "emperors-children":"chaos", "thousand-sons":"chaos", "world-eaters":"chaos",
    "adeptus-custodes":"custodes", "adepta-sororitas":"sororitas", "adeptus-mechanicus":"mechanicus", "astra-militarum":"guard",
    "imperial-knights":"knights", "chaos-knights":"knights", "agents-of-the-imperium":"agents",
    "aeldari":"aeldari", "drukhari":"drukhari", "genestealer-cults":"gsc", "leagues-of-votann":"votann", "necrons":"necrons",
    "orks":"orks", "tau-empire":"tau", "tyranids":"tyranids", "chaos-daemons":"daemons"
  };
  // Small per-faction tweaks on top of the kind.
  const FACTION_OVER = {
    "death-guard": {labels: {skin:"Skin / rot", metal:"Weapons / rust"}, extras: ["Rust, pus & extras", "e.g. rust streaks, pustules, flies"],
                    tiers: [["Plague Marines","Standard troops"],["Deathshroud","Terminators and elites"],["Champion","Plague Champions and characters"],["Lord","Your warlord and heroes"]]},
    "world-eaters": {tiers: [["Berzerkers","Standard troops"],["Eightbound","Eightbound and elites"],["Champion","Berzerker Champions and characters"],["Lord","Your warlord and heroes"]]},
    "thousand-sons": {tiers: [["Rubricae","Rubric Marines"],["Scarab Occult","Terminators and elites"],["Aspiring Sorcerer","Squad leaders"],["Sorcerer","Sorcerers and heroes"]]},
    "chaos-knights": {labels: {emblem:"Icon / mark", cloth:"Banners / trophies"}, extras: ["Spikes, trophies & extras", "e.g. brass spikes, skull trophies"],
                      tiers: [["War Dogs","War Dog Knights"],["Knights","Despoilers, Rampagers and others"],["Tyrants","Abominants and Tyrants"],["Hero","Your warlord"]]},
    "black-templars": {tiers: [["Initiates","Initiates and Neophytes"],["Sword Brethren","Veterans and Terminators"],["Castellan","Castellans, Chaplains and the Emperor's Champion"],["Marshal","Marshals and your warlord"]]},
    "grey-knights": {tiers: [["Strike","Strike Squads"],["Terminator","Terminators and Paladins"],["Justicar","Justicars and characters"],["Grand Master","Your warlord and heroes"]]}
  };

  function shade(h, k){ const c = [1,3,5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k))); return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); }
  const merge = (a, b) => ({...a, ...b, labels: {...a.labels, ...(b.labels || {})}, legends: {...a.legends, ...(b.legends || {})}});

  const profiles = {};
  function profileFor(factionId){
    if(profiles[factionId]) return profiles[factionId];
    const pr = merge(merge(BASE, KINDS[KIND_OF[factionId] || "astartes"] || {}), FACTION_OVER[factionId] || {});
    const L = pr.labels;
    pr.kind = KIND_OF[factionId] || "astartes";
    pr.keys = ["armour", ...(pr.pauldrons ? ["lpauldron","rpauldron"] : []), "secondary","trim","emblem","lens","cloth","metal","skin"].filter(k => !pr.hide.includes(k));
    pr.areas = [...new Set([L.armour, L.secondary, L.trim, L.helmet, L.lens, L.cloth, L.metal, pr.hide.includes("skin") ? "" : L.skin, L.emblem, ...pr.more, "Base", "Other"].filter(Boolean))];
    return (profiles[factionId] = pr);
  }

  /* ---------- Starting paints ----------
     Every faction and known scheme starts from Citadel paints (the ones Games Workshop's painting
     guides use for that army), so colours arrive as real paints you can buy, not plain colours.
     F(armour, secondary, trim, emblem, lens, cloth, metal, skin) takes Citadel paint names; "" keeps
     the plain colour. CIT maps each name to its catalogue label and colour in js/data/paints.js and
     is filled in by tools/build_citadel_refs.py. */
  const CIT = {"Abaddon Black":["Citadel Abaddon Black (Base)","#000000"],"Auric Armour Gold":["Citadel Auric Armour Gold","#ffc451"],"Averland Sunset":["Citadel Averland Sunset (Base)","#fbb81c"],"Balthasar Gold":["Citadel Balthasar Gold (Base)","#a77353"],"Bugman Glow":["Citadel Bugman Glow","#804c43"],"Cadian Fleshtone":["Citadel Cadian Fleshtone","#c47652"],"Caliban Green":["Citadel Caliban Green (Base)","#003d15"],"Castellan Green":["Citadel Castellan Green (Base)","#264715"],"Corax White":["Citadel Corax White (Base)","#ffffff"],"Death Guard Green":["Citadel Death Guard Green (Base)","#6d774d"],"Deathworld Forest":["Citadel Deathworld Forest (Base)","#556229"],"Emperor Children":["Citadel Emperor Children","#b74073"],"Eshin Grey":["Citadel Eshin Grey","#484b4e"],"Evil Sunz Scarlet":["Citadel Evil Sunz Scarlet (Layer)","#c01411"],"Incubi Darkness":["Citadel Incubi Darkness","#082e32"],"Jokaero Orange":["Citadel Jokaero Orange","#ed3814"],"Kantor Blue":["Citadel Kantor Blue (Base)","#02134e"],"Khorne Red":["Citadel Khorne Red (Base)","#650001"],"Leadbelcher":["Citadel Leadbelcher (Base)","#969696"],"Macragge Blue":["Citadel Macragge Blue (Base)","#0f3d7c"],"Mechanicus Standard Grey":["Citadel Mechanicus Standard Grey (Base)","#39484a"],"Mephiston Red":["Citadel Mephiston Red (Base)","#960c09"],"Moot Green":["Citadel Moot Green (Layer)","#3daf44"],"Mournfang Brown":["Citadel Mournfang Brown (Base)","#490f06"],"Naggaroth Night":["Citadel Naggaroth Night","#3b2b50"],"Nurgling Green":["Citadel Nurgling Green (Layer)","#7e975e"],"Pallid Wych Flesh":["Citadel Pallid Wych Flesh","#caccbb"],"Pink Horror":["Citadel Pink Horror","#8e2757"],"Rakarth Flesh":["Citadel Rakarth Flesh","#9c998d"],"Retributor Armour":["Citadel Retributor Armour (Base)","#edc169"],"Rhinox Hide":["Citadel Rhinox Hide","#462f30"],"Russ Grey":["Citadel Russ Grey (Layer)","#507085"],"Skrag Brown":["Citadel Skrag Brown","#8b4806"],"Slaanesh Grey":["Citadel Slaanesh Grey (Layer)","#8b8893"],"Sons of Horus Green":["Citadel Sons of Horus Green (Layer)","#00545e"],"Sotek Green":["Citadel Sotek Green","#0b6371"],"Steel Legion Drab":["Citadel Steel Legion Drab (Base)","#584e2d"],"Stormhost Silver":["Citadel Stormhost Silver","#dadddf"],"Tau Light Ochre":["Citadel Tau Light Ochre (Layer)","#bc6b10"],"Teclis Blue":["Citadel Teclis Blue","#3877bf"],"Temple Guard Blue":["Citadel Temple Guard Blue (Layer)","#239489"],"Tesseract Glow":["Citadel Tesseract Glow","#65ab46"],"The Fang":["Citadel The Fang (Base)","#405b71"],"Thousand Sons Blue":["Citadel Thousand Sons Blue","#00506f"],"Troll Slayer Orange":["Citadel Troll Slayer Orange (Layer)","#f16c23"],"Waaagh! Flesh":["Citadel Waaagh! Flesh","#0b3b36"],"Warboss Green":["Citadel Warboss Green (Layer)","#317e57"],"Warplock Bronze":["Citadel Warplock Bronze","#b36e4f"],"Warpstone Glow":["Citadel Warpstone Glow","#0f702a"],"Wraithbone":["Citadel Wraithbone (Base)","#dbd1b2"],"Xereus Purple":["Citadel Xereus Purple","#47125a"],"Zandri Dust":["Citadel Zandri Dust (Base)","#988e56"]};
  const SLOTS = ["armour","secondary","trim","emblem","lens","cloth","metal","skin"];
  const F = (...names) => Object.fromEntries(SLOTS.map((k, i) => [k, names[i] || ""]).filter(([, v]) => v));
  const citHex = n => CIT[n] ? CIT[n][1] : "";
  const citLabel = n => CIT[n] ? CIT[n][0] : "";

  const FP = {
    "space-marines":     F("Mechanicus Standard Grey","Corax White","Retributor Armour","Corax White","Moot Green","Rakarth Flesh","Leadbelcher","Cadian Fleshtone"),
    "ultramarines":      F("Macragge Blue","Corax White","Retributor Armour","Corax White","Mephiston Red","Rakarth Flesh","Leadbelcher","Cadian Fleshtone"),
    "black-templars":    F("Abaddon Black","Corax White","Corax White","Corax White","Mephiston Red","Rakarth Flesh","Leadbelcher","Cadian Fleshtone"),
    "blood-angels":      F("Mephiston Red","Abaddon Black","Retributor Armour","Abaddon Black","Moot Green","Abaddon Black","Retributor Armour","Cadian Fleshtone"),
    "dark-angels":       F("Caliban Green","Wraithbone","Wraithbone","Corax White","Mephiston Red","Zandri Dust","Leadbelcher","Cadian Fleshtone"),
    "space-wolves":      F("The Fang","Averland Sunset","Retributor Armour","Abaddon Black","Averland Sunset","Mournfang Brown","Leadbelcher","Cadian Fleshtone"),
    "imperial-fists":    F("Averland Sunset","Abaddon Black","Abaddon Black","Mephiston Red","Moot Green","Rakarth Flesh","Leadbelcher","Cadian Fleshtone"),
    "iron-hands":        F("Abaddon Black","Leadbelcher","Corax White","Corax White","Moot Green","Eshin Grey","Leadbelcher","Cadian Fleshtone"),
    "raven-guard":       F("Abaddon Black","Corax White","Corax White","Corax White","Mephiston Red","Abaddon Black","Leadbelcher","Cadian Fleshtone"),
    // Salamanders: Warpstone Glow armour, flame emblems in orange, and jet-black skin.
    "salamanders":       F("Warpstone Glow","Abaddon Black","Retributor Armour","Troll Slayer Orange","Mephiston Red","Abaddon Black","Retributor Armour","Abaddon Black"),
    "white-scars":       F("Corax White","Mephiston Red","Mephiston Red","Mephiston Red","Mephiston Red","Mephiston Red","Leadbelcher","Cadian Fleshtone"),
    "deathwatch":        F("Abaddon Black","Leadbelcher","Leadbelcher","Corax White","Moot Green","Abaddon Black","Leadbelcher","Cadian Fleshtone"),
    "grey-knights":      F("Leadbelcher","Mephiston Red","Retributor Armour","Mephiston Red","Teclis Blue","Mephiston Red","Leadbelcher","Cadian Fleshtone"),
    "adeptus-custodes":  F("Retributor Armour","Khorne Red","Balthasar Gold","Abaddon Black","Moot Green","Khorne Red","Retributor Armour","Cadian Fleshtone"),
    // Order of Our Martyred Lady: black armour, red robes.
    "adepta-sororitas":  F("Abaddon Black","Mephiston Red","Corax White","Corax White","Moot Green","Mephiston Red","Leadbelcher","Cadian Fleshtone"),
    // Forge World Mars: red robes over silver plates.
    "adeptus-mechanicus":F("Mephiston Red","Leadbelcher","Balthasar Gold","Corax White","Moot Green","Khorne Red","Leadbelcher","Cadian Fleshtone"),
    "agents-of-the-imperium":F("Eshin Grey","Mephiston Red","Retributor Armour","Retributor Armour","Moot Green","Abaddon Black","Leadbelcher","Cadian Fleshtone"),
    // Cadian: Castellan Green flak armour over Zandri Dust fatigues.
    "astra-militarum":   F("Castellan Green","Zandri Dust","Rhinox Hide","Corax White","Abaddon Black","Zandri Dust","Leadbelcher","Cadian Fleshtone"),
    "imperial-knights":  F("Macragge Blue","Corax White","Retributor Armour","Corax White","Moot Green","Mephiston Red","Leadbelcher","Cadian Fleshtone"),
    // Black Legion
    "chaos-space-marines":F("Abaddon Black","Balthasar Gold","Balthasar Gold","Mephiston Red","Mephiston Red","Khorne Red","Leadbelcher","Cadian Fleshtone"),
    "death-guard":       F("Death Guard Green","Balthasar Gold","Balthasar Gold","Abaddon Black","Moot Green","Rakarth Flesh","Warplock Bronze","Nurgling Green"),
    "emperors-children": F("Emperor Children","Abaddon Black","Retributor Armour","Retributor Armour","Teclis Blue","Corax White","Retributor Armour","Cadian Fleshtone"),
    "thousand-sons":     F("Thousand Sons Blue","Retributor Armour","Retributor Armour","Retributor Armour","Sotek Green","Corax White","Retributor Armour","Cadian Fleshtone"),
    "world-eaters":      F("Khorne Red","Balthasar Gold","Balthasar Gold","Balthasar Gold","Moot Green","Abaddon Black","Warplock Bronze","Cadian Fleshtone"),
    "chaos-daemons":     F("Khorne Red","Abaddon Black","Balthasar Gold","Balthasar Gold","Averland Sunset","Abaddon Black","Warplock Bronze"),
    "chaos-knights":     F("Abaddon Black","Khorne Red","Balthasar Gold","Balthasar Gold","Mephiston Red","Khorne Red","Leadbelcher","Cadian Fleshtone"),
    // Ulthwé
    "aeldari":           F("Abaddon Black","Wraithbone","Wraithbone","Mephiston Red","Moot Green","Wraithbone","Leadbelcher","Cadian Fleshtone"),
    // Kabal of the Black Heart
    "drukhari":          F("Incubi Darkness","Leadbelcher","Leadbelcher","Corax White","Moot Green","Naggaroth Night","Leadbelcher","Pallid Wych Flesh"),
    // Cult of the Four-Armed Emperor: grey and purple
    "genestealer-cults": F("Mechanicus Standard Grey","Xereus Purple","Balthasar Gold","Balthasar Gold","Averland Sunset","Zandri Dust","Leadbelcher","Slaanesh Grey"),
    // Greater Thurian League: turquoise armour
    "leagues-of-votann": F("Sons of Horus Green","Jokaero Orange","Retributor Armour","Corax White","Teclis Blue","Mournfang Brown","Warplock Bronze","Cadian Fleshtone"),
    // Sautekh
    "necrons":           F("Leadbelcher","Abaddon Black","Retributor Armour","Tesseract Glow","Tesseract Glow","Abaddon Black","Leadbelcher"),
    "orks":              F("Leadbelcher","Mephiston Red","Averland Sunset","Abaddon Black","Mephiston Red","Mournfang Brown","Leadbelcher","Waaagh! Flesh"),
    // T'au Sept
    "tau-empire":        F("Tau Light Ochre","Corax White","Abaddon Black","Corax White","Moot Green","Mechanicus Standard Grey","Abaddon Black","Russ Grey"),
    // Leviathan: Naggaroth Night carapace, bone-white flesh
    "tyranids":          F("Naggaroth Night","Xereus Purple","Slaanesh Grey","Wraithbone","Averland Sunset","Mephiston Red","Wraithbone","Wraithbone")
  };
  // Rank colours: slot keys, or a paint name after @.
  const TIER_SRC = {
    // Black Templars: black for Initiates, white helmets for Sword Brethren, gold for Marshals.
    "black-templars": ["@Abaddon Black","@Corax White","@Mephiston Red","@Retributor Armour"],
    "necrons": ["armour","secondary","trim","@Auric Armour Gold"]
  };
  const DEFAULT_SRC = ["armour","secondary","@Mephiston Red","trim"];
  // When a rank would repeat an earlier rank's paint, it takes the first of these that's still free,
  // so every rank colour tells the ranks apart.
  const TIER_FALLBACK = ["trim","@Retributor Armour","emblem","@Corax White","@Abaddon Black","@Mephiston Red","@Averland Sunset","@Macragge Blue","cloth","@Leadbelcher"];

  // Rank colours (and their paints) from a set of army colours.
  function tiersFor(factionId, c, paints){
    const pr = profileFor(factionId), base = P[factionId] || {};
    const src = TIER_SRC[factionId] || DEFAULT_SRC, names = base.tiers ? base.tiers.map(t => [t.name, t.note]) : pr.tiers;
    const pick = s => s[0] === "@" ? {color: citHex(s.slice(1)) || c.armour, paint: citLabel(s.slice(1))} : {color: c[s] || c.armour, paint: (paints || {})[s] || ""};
    const used = new Set(), key = x => (x.paint || x.color).toLowerCase();
    return names.map(([name, note], i) => {
      let x = pick(src[i] || "armour");
      if(used.has(key(x))) x = TIER_FALLBACK.map(pick).find(y => !used.has(key(y))) || x;
      used.add(key(x));
      return {...T(name, x.color, note), paint: x.paint};
    });
  }
  // Colours plus their paint labels from an F(...) set, over plain fallback colours.
  // Pauldron colours start as the armour unless a faction sets its own (Deathwatch: silver left pauldron).
  const PAULDRONS = {"deathwatch": {lpauldron: "@Leadbelcher"}};
  function withPauldrons(factionId, r, fp){
    if(!profileFor(factionId).pauldrons) return r;
    ["lpauldron","rpauldron"].forEach(k => {
      const n = (fp && fp[k]) || ((PAULDRONS[factionId] || {})[k] || "").replace(/^@/, "");
      if(n && CIT[n]){ r.colors[k] = CIT[n][1]; r.slotPaints[k] = CIT[n][0]; }
      else { r.colors[k] = r.colors.armour; if(r.slotPaints.armour) r.slotPaints[k] = r.slotPaints.armour; else delete r.slotPaints[k]; }
    });
    return r;
  }
  function resolve(fp, fallback){
    const colors = {...fallback}, slotPaints = {};
    Object.entries(fp || {}).forEach(([k, n]) => { if(CIT[n]){ colors[k] = CIT[n][1]; slotPaints[k] = CIT[n][0]; } });
    return {colors, slotPaints};
  }

  function presetFor(factionId){
    const base = P[factionId] || P["space-marines"];
    const plain = {armour:base.armour, secondary:base.secondary, trim:base.trim, emblem:base.emblem, lens:base.lens, cloth:base.cloth, metal:base.metal, skin:base.skin || SKIN_OF[factionId] || SKIN};
    const {colors, slotPaints} = withPauldrons(factionId, resolve(FP[factionId], plain), FP[factionId]);
    return {style: base.style, colors, slotPaints, shape: defaultIcon(factionId) || base.shape, tiers: tiersFor(factionId, colors, slotPaints)};
  }
  const SKIN_OF = {"orks":"#4f7a2a", "tau-empire":"#6b7f93", "genestealer-cults":"#a58ab0", "drukhari":"#e6dccf", "death-guard":"#a9a57a", "tyranids":"#d8cba8", "necrons":"#a9adb3", "chaos-daemons":"#9e1b1b"};

  /* Known schemes to start from. The icon (an id, or an icons/ path ending) becomes the army emblem.
     Every faction also gets its own starting paints as "Official colours", so an existing ledger can
     switch to them in one click. */
  const K = (name, icon, fp) => ({name, icon, fp});
  const SM_CHAPTERS = [
    K("Ultramarines", "astartes-legion/ultramarines.svg", FP["ultramarines"]),
    K("Imperial Fists", "astartes-legion/imperial-fists.svg", FP["imperial-fists"]),
    K("Iron Hands", "astartes-legion/iron-hands.svg", FP["iron-hands"]),
    K("Raven Guard", "astartes-legion/raven-guard.svg", FP["raven-guard"]),
    K("Salamanders", "astartes-legion/salamanders.svg", FP["salamanders"]),
    K("White Scars", "astartes-legion/white-scars.svg", FP["white-scars"]),
    K("Crimson Fists", "human-imperium-astartes-chapters-crimson-fists", F("Kantor Blue","Mephiston Red","Retributor Armour","Mephiston Red","Mephiston Red","Rakarth Flesh","Leadbelcher","Cadian Fleshtone")),
    K("Blood Ravens", "human-imperium-astartes-chapters-blood-ravens", F("Khorne Red","Wraithbone","Retributor Armour","Wraithbone","Moot Green","Wraithbone","Leadbelcher","Cadian Fleshtone")),
    K("Minotaurs", "", F("Balthasar Gold","Abaddon Black","Retributor Armour","Abaddon Black","Mephiston Red","Abaddon Black","Leadbelcher","Cadian Fleshtone")),
    K("Howling Griffons", "", F("Mephiston Red","Averland Sunset","Retributor Armour","Abaddon Black","Moot Green","Rakarth Flesh","Leadbelcher","Cadian Fleshtone"))
  ];
  const SCHEMES = {
    "space-marines": SM_CHAPTERS,
    "blood-angels": [
      K("Flesh Tearers", "human-imperium-astartes-chapters-flesh-tearers", F("Khorne Red","Abaddon Black","Abaddon Black","Corax White","Moot Green","Abaddon Black","Leadbelcher","Cadian Fleshtone")),
      K("Lamenters", "human-imperium-astartes-chapters-lamenters", F("Averland Sunset","Abaddon Black","Abaddon Black","Abaddon Black","Mephiston Red","Abaddon Black","Leadbelcher","Cadian Fleshtone")),
      K("Death Company", "human-imperium-astartes-legion-blood-angels-blood-angels-death-company", F("Abaddon Black","Mephiston Red","Retributor Armour","Mephiston Red","Mephiston Red","Abaddon Black","Leadbelcher","Cadian Fleshtone"))
    ],
    "dark-angels": [
      K("Deathwing", "human-imperium-astartes-legion-dark-angels-dark-angels-deathwing", F("Wraithbone","Mephiston Red","Wraithbone","Mephiston Red","Mephiston Red","Zandri Dust","Leadbelcher","Cadian Fleshtone")),
      K("Ravenwing", "human-imperium-astartes-legion-dark-angels-dark-angels-ravenwing", F("Abaddon Black","Wraithbone","Leadbelcher","Corax White","Mephiston Red","Zandri Dust","Leadbelcher","Cadian Fleshtone"))
    ],
    "imperial-fists": [
      K("Crimson Fists", "human-imperium-astartes-chapters-crimson-fists", F("Kantor Blue","Mephiston Red","Retributor Armour","Mephiston Red","Mephiston Red","Rakarth Flesh","Leadbelcher","Cadian Fleshtone"))
    ],
    "necrons": [
      K("Sautekh", "xenos-necrons-sautekh", FP["necrons"]),
      K("Szarekhan", "xenos-necrons-szarekhan", F("Stormhost Silver","Eshin Grey","Leadbelcher","Teclis Blue","Teclis Blue","Abaddon Black","Leadbelcher")),
      K("Nihilakh", "xenos-necrons-nihilakh", F("Retributor Armour","Sotek Green","Retributor Armour","Temple Guard Blue","Temple Guard Blue","Abaddon Black","Leadbelcher")),
      K("Novokh", "xenos-necrons-novokh", F("Leadbelcher","Khorne Red","Balthasar Gold","Tesseract Glow","Tesseract Glow","Abaddon Black","Leadbelcher")),
      K("Mephrit", "xenos-necrons-mephrit", F("Leadbelcher","Eshin Grey","Retributor Armour","Troll Slayer Orange","Troll Slayer Orange","Abaddon Black","Leadbelcher")),
      K("Nephrekh", "xenos-necrons-nephrekh", F("Retributor Armour","Abaddon Black","Balthasar Gold","Averland Sunset","Averland Sunset","Abaddon Black","Retributor Armour"))
    ],
    "tyranids": [
      K("Leviathan", "", FP["tyranids"]),
      K("Behemoth", "", F("Kantor Blue","Macragge Blue","Teclis Blue","Mephiston Red","Averland Sunset","Mephiston Red","Wraithbone","Mephiston Red")),
      K("Kraken", "", F("Troll Slayer Orange","Khorne Red","Jokaero Orange","Abaddon Black","Averland Sunset","Naggaroth Night","Abaddon Black","Wraithbone"))
    ],
    "orks": [
      K("Goffs", "xenos-orks-goffs-clan", F("Abaddon Black","Abaddon Black","Corax White","Mephiston Red","Mephiston Red","Abaddon Black","Leadbelcher","Warboss Green")),
      K("Evil Sunz", "xenos-orks-evil-sunz-clan", F("Mephiston Red","Mephiston Red","Averland Sunset","Abaddon Black","Mephiston Red","Mournfang Brown","Leadbelcher","Waaagh! Flesh")),
      K("Bad Moons", "xenos-orks-bad-moons-clan", F("Averland Sunset","Abaddon Black","Retributor Armour","Abaddon Black","Mephiston Red","Mournfang Brown","Retributor Armour","Waaagh! Flesh")),
      K("Blood Axes", "xenos-orks-blood-axes-clan", F("Castellan Green","Steel Legion Drab","Rhinox Hide","Mephiston Red","Mephiston Red","Steel Legion Drab","Leadbelcher","Waaagh! Flesh")),
      K("Deathskulls", "xenos-orks-deathskulls-clan", F("Macragge Blue","Corax White","Wraithbone","Corax White","Mephiston Red","Mournfang Brown","Leadbelcher","Waaagh! Flesh")),
      K("Snakebites", "xenos-orks-snakebites-clan", F("Mournfang Brown","Mephiston Red","Wraithbone","Abaddon Black","Mephiston Red","Skrag Brown","Warplock Bronze","Castellan Green"))
    ],
    "tau-empire": [
      K("T'au Sept", "xenos-tau-empire-tau-sept", FP["tau-empire"]),
      K("Vior'la Sept", "xenos-tau-empire-viorla-sept", F("Corax White","Mephiston Red","Abaddon Black","Mephiston Red","Moot Green","Mechanicus Standard Grey","Abaddon Black","Russ Grey")),
      K("Farsight Enclaves", "xenos-tau-empire-farsight-enclave", F("Mephiston Red","Corax White","Abaddon Black","Corax White","Moot Green","Mechanicus Standard Grey","Abaddon Black","Russ Grey"))
    ],
    "aeldari": [
      K("Ulthwé", "xenos-eldar-craftworld-ulthwe", FP["aeldari"]),
      K("Biel-Tan", "xenos-eldar-craftworld-biel-tan", F("Warpstone Glow","Corax White","Corax White","Corax White","Mephiston Red","Corax White","Leadbelcher","Cadian Fleshtone")),
      K("Iyanden", "xenos-eldar-craftworld-iyanden", F("Averland Sunset","Macragge Blue","Macragge Blue","Macragge Blue","Mephiston Red","Macragge Blue","Leadbelcher","Cadian Fleshtone")),
      K("Saim-Hann", "xenos-eldar-craftworld-saim-hann", F("Mephiston Red","Corax White","Abaddon Black","Corax White","Moot Green","Corax White","Leadbelcher","Cadian Fleshtone")),
      K("Alaitoc", "xenos-eldar-craftworld-alaitoc", F("Macragge Blue","Averland Sunset","Averland Sunset","Averland Sunset","Mephiston Red","Averland Sunset","Leadbelcher","Cadian Fleshtone"))
    ],
    "astra-militarum": [
      K("Cadian", "human-imperium-astra-militarum-cadian-shock-troops-2", FP["astra-militarum"]),
      K("Catachan", "human-imperium-astra-militarum-catachan-jungle-fighters", F("Castellan Green","Deathworld Forest","Rhinox Hide","Mephiston Red","Abaddon Black","Mephiston Red","Leadbelcher","Bugman Glow")),
      K("Mordian Iron Guard", "human-imperium-astra-militarum-mordian-iron-guard", F("Kantor Blue","Kantor Blue","Retributor Armour","Mephiston Red","Abaddon Black","Mephiston Red","Leadbelcher","Cadian Fleshtone")),
      K("Death Korps of Krieg", "human-imperium-astra-militarum-death-korps-of-krieg", F("Mechanicus Standard Grey","Eshin Grey","Rhinox Hide","Corax White","Moot Green","Eshin Grey","Leadbelcher","Cadian Fleshtone")),
      K("Tallarn", "human-imperium-astra-militarum-tallarn-desert-raiders", F("Zandri Dust","Wraithbone","Rhinox Hide","Mephiston Red","Abaddon Black","Wraithbone","Leadbelcher","Bugman Glow")),
      K("Vostroyan", "human-imperium-astra-militarum-vostroyan-firstborn", F("Khorne Red","Abaddon Black","Retributor Armour","Retributor Armour","Abaddon Black","Mournfang Brown","Retributor Armour","Cadian Fleshtone"))
    ],
    "adepta-sororitas": [
      K("Our Martyred Lady", "human-imperium-battle-sisters-order-of-our-martyred-lady", FP["adepta-sororitas"]),
      K("Bloody Rose", "human-imperium-battle-sisters-order-of-the-bloody-rose", F("Mephiston Red","Mephiston Red","Leadbelcher","Corax White","Moot Green","Abaddon Black","Leadbelcher","Cadian Fleshtone"))
    ],
    "chaos-space-marines": [
      K("Black Legion", "chaos-legions-black-legion", FP["chaos-space-marines"]),
      K("Night Lords", "chaos-legions-night-lords", F("Kantor Blue","Corax White","Balthasar Gold","Corax White","Mephiston Red","Abaddon Black","Leadbelcher","Cadian Fleshtone")),
      K("Iron Warriors", "chaos-legions-iron-warriors", F("Leadbelcher","Averland Sunset","Balthasar Gold","Abaddon Black","Mephiston Red","Eshin Grey","Leadbelcher","Cadian Fleshtone")),
      K("Word Bearers", "chaos-legions-word-bearers", F("Khorne Red","Abaddon Black","Retributor Armour","Retributor Armour","Moot Green","Abaddon Black","Leadbelcher","Cadian Fleshtone")),
      K("Alpha Legion", "chaos-legions-alpha-legion-1", F("Incubi Darkness","Leadbelcher","Leadbelcher","Leadbelcher","Moot Green","Abaddon Black","Leadbelcher","Cadian Fleshtone"))
    ],
    "chaos-daemons": [
      K("Khorne", "chaos-gods-khorne", F("Evil Sunz Scarlet","Khorne Red","Abaddon Black","Balthasar Gold","Averland Sunset","Abaddon Black","Balthasar Gold")),
      K("Nurgle", "chaos-gods-nurgle", F("Death Guard Green","Rhinox Hide","Wraithbone","Abaddon Black","Averland Sunset","Pink Horror","Warplock Bronze")),
      K("Tzeentch", "chaos-gods-tzeentch", F("Pink Horror","Macragge Blue","Averland Sunset","Averland Sunset","Corax White","Macragge Blue","Retributor Armour")),
      K("Slaanesh", "chaos-gods-slaanesh", F("Slaanesh Grey","Emperor Children","Abaddon Black","Emperor Children","Corax White","Emperor Children","Retributor Armour"))
    ],
    "leagues-of-votann": [
      K("Greater Thurian League", "", FP["leagues-of-votann"]),
      K("Trans-Hyperian Alliance", "", F("Jokaero Orange","Abaddon Black","Retributor Armour","Corax White","Teclis Blue","Mournfang Brown","Warplock Bronze","Cadian Fleshtone"))
    ]
  };
  const iconRef = ref => { if(!ref) return ""; const i = ICON_BY_ID[ref] || ICONS.find(x => x.f.endsWith("/" + ref)); return i ? "icon:" + i.id : ""; };
  function schemesFor(factionId){
    const own = FP[factionId];
    const list = (SCHEMES[factionId] || []).slice();
    if(own && !list.some(k => JSON.stringify(k.fp) === JSON.stringify(own))) list.unshift(K("Official colours", "", own));
    const base = presetFor(factionId);
    return list.map(k => { const r = withPauldrons(factionId, resolve(k.fp, base.colors), k.fp); return {name: k.name, shape: k.fp === own ? base.shape : iconRef(k.icon), colors: r.colors, paints: r.slotPaints}; });
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

  window.LEDGER_PRESETS = {NAMED, SHAPES, presetFor, colorName, ICONS, ICON_BY_ID, iconCats, emblemName, defaultIcon, profileFor, tiersFor, schemesFor, SKIN};
})();
