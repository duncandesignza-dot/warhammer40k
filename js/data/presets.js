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
     follows the unit's rank. */
  const SKIN = "#c79a7e";
  const BASE = {
    head: "helmet",
    labels: {helmet:"Helmet", lens:"Lenses / eyes", armour:"Armour", secondary:"Secondary", trim:"Trim", emblem:"Emblem",
             cloth:"Robes / cloth", metal:"Weapons / metal", skin:"Skin"},
    legends: {head:"Helmet", body:"Armour & pauldrons", details:"Cloth & details"},
    detail: ["Helmet detail", "e.g. laurel wreath, centre stripe"],
    detailOpts: ["Laurel wreath","Centre stripe","Crest","Battle damage","Squad markings"],
    bare: "Bare head (no helmet)",
    extras: ["Purity seals, freehand & extras", "e.g. red wax seals, freehand on kneepad"],
    hide: [],
    more: ["Weapons","Leather"],
    tiers: [["Line","Standard troops"],["Veteran","Veterans and elites"],["Leader","Sergeants and characters"],["Hero","Your warlord and heroes"]]
  };
  const KINDS = {
    astartes: {},
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
      head: "head",
      labels: {helmet:"Hair / helm", armour:"Armour", secondary:"Armour detail", emblem:"Fleur / emblem", cloth:"Robes"},
      legends: {head:"Head", body:"Armour", details:"Robes & details"},
      detail: ["Head detail", "e.g. white bob, veil, halo"],
      detailOpts: ["Veil","Halo","Helmet","Hood"],
      bare: "",
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
      bare: "Bare head (no hood)",
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
      bare: "",
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
      skinOnCard: true,
      head: "head",
      labels: {helmet:"Head / headgear", lens:"Eyes / lamps", armour:"Overalls / uniform", trim:"Webbing / straps", emblem:"Cult icon", cloth:"Rags / cloth", metal:"Weapons / tools"},
      legends: {head:"Head", body:"Overalls & uniform", details:"Skin & details"},
      detail: ["Head detail", "e.g. mining helmet, cranial ridge"],
      detailOpts: ["Mining helmet","Goggles","Cranial ridge","Cap"],
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
      bare: "",
      extras: ["Glyphs, glow & extras", "e.g. green gauss glow on guns, verdigris"],
      hide: ["skin"],
      more: ["Weapons","Gauss glow","Verdigris"],
      tiers: [["Warriors","Necron Warriors and line troops"],["Immortals","Immortals, Lychguard and elites"],["Lord","Lords and Crypteks"],["Overlord","Overlords and heroes"]],
      // Nobles wear the dynasty's trim metal on their heads.
      tierColors: c => [c.armour, c.secondary, c.trim, shade(c.trim, .2)]
    },
    orks: {
      skinOnCard: true,
      head: "head",
      labels: {helmet:"Head / helmet", lens:"Eyes", armour:"Armour plates", secondary:"Clan colour", emblem:"Glyph", cloth:"Clothes / trousers"},
      legends: {head:"Head", body:"Armour & clan colours", details:"Skin & details"},
      detail: ["Head detail", "e.g. horns, glyph on helmet"],
      detailOpts: ["Horns","Glyph","Checks","Flames","Scars"],
      extras: ["Glyphs, checks & extras", "e.g. black-white checks, teef, rust"],
      more: ["Weapons","Leather","Teef & claws","Rust"],
      tiers: [["Boyz","Boyz and gretchin"],["Nobz","Nobz and Meganobz"],["Boss","Bosses and characters"],["Warboss","Your Warboss and heroes"]],
      // Bigger orks are darker green.
      tierColors: c => [c.skin, shade(c.skin, .15), shade(c.skin, .3), shade(c.skin, .45)]
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
      skinOnCard: true,
      head: "head",
      labels: {helmet:"Head / crest", lens:"Eyes", armour:"Carapace", secondary:"Carapace pattern", trim:"Carapace edges", emblem:"Markings",
               cloth:"Tongues / membranes", metal:"Claws & talons"},
      legends: {head:"Head", body:"Carapace", details:"Skin & details"},
      detail: ["Head detail", "e.g. striped crest, dark eye sockets"],
      detailOpts: ["Stripes","Spots","Crest"],
      bare: "",
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
      bare: "",
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
    "grey-knights": {tiers: [["Strike","Strike Squads"],["Terminator","Terminators and Paladins"],["Justicar","Justicars and characters"],["Grand Master","Your warlord and heroes"]]}
  };

  function shade(h, k){ const c = [1,3,5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - k))); return "#" + c.map(v => v.toString(16).padStart(2, "0")).join(""); }
  const merge = (a, b) => ({...a, ...b, labels: {...a.labels, ...(b.labels || {})}, legends: {...a.legends, ...(b.legends || {})}});

  const profiles = {};
  function profileFor(factionId){
    if(profiles[factionId]) return profiles[factionId];
    const pr = merge(merge(BASE, KINDS[KIND_OF[factionId]] || {}), FACTION_OVER[factionId] || {});
    const L = pr.labels;
    pr.kind = KIND_OF[factionId] || "astartes";
    pr.keys = ["armour","secondary","trim","emblem","lens","cloth","metal","skin"].filter(k => !pr.hide.includes(k));
    pr.areas = [...new Set([L.armour, L.secondary, L.trim, L.helmet, L.lens, L.cloth, L.metal, pr.hide.includes("skin") ? "" : L.skin, L.emblem, ...pr.more, "Base", "Other"].filter(Boolean))];
    return (profiles[factionId] = pr);
  }

  function tiersFor(factionId, c){
    const pr = profileFor(factionId);
    const cols = pr.tierColors ? pr.tierColors(c) : [c.armour, c.secondary, "#b3141c", c.trim];
    return pr.tiers.map(([name, note], i) => T(name, cols[i] || c.armour, note));
  }

  function presetFor(factionId){
    const base = P[factionId] || P["space-marines"];
    const colors = {armour:base.armour, secondary:base.secondary, trim:base.trim, emblem:base.emblem, lens:base.lens, cloth:base.cloth, metal:base.metal, skin:base.skin || SKIN_OF[factionId] || SKIN};
    return {
      style: base.style,
      colors,
      shape: defaultIcon(factionId) || base.shape,
      tiers: (base.tiers || tiersFor(factionId, colors)).map(t => ({...t}))
    };
  }
  const SKIN_OF = {"orks":"#4f7a2a", "tau-empire":"#6b7f93", "genestealer-cults":"#a58ab0", "drukhari":"#e6dccf", "death-guard":"#a9a57a", "tyranids":"#d8cba8", "necrons":"#a9adb3", "chaos-daemons":"#9e1b1b"};

  /* Known schemes to start from (chapters have their own factions; these cover everyone else).
     Colours are a starting point. The icon, when there is one, becomes the army emblem. */
  const K = (name, icon, armour, secondary, trim, emblem, lens, cloth, metal, skin) => ({name, icon, colors: {armour, secondary, trim, emblem, lens, cloth, metal, ...(skin ? {skin} : {})}});
  const SCHEMES = {
    "necrons": [
      K("Sautekh", "xenos-necrons-sautekh", "#a9adb3","#1f1f22","#c9a13b","#3fbf5a","#3fbf5a","#1f1f22","#a9adb3"),
      K("Szarekhan", "xenos-necrons-szarekhan", "#c9ccd1","#3a3a3e","#a9adb3","#3b8fe0","#3b8fe0","#1f1f22","#a9adb3"),
      K("Nihilakh", "xenos-necrons-nihilakh", "#c9a13b","#1f7a78","#c9a13b","#2fb3b0","#2fb3b0","#1f1f22","#a9adb3"),
      K("Novokh", "xenos-necrons-novokh", "#a9adb3","#7a0d12","#b08d3c","#3fbf5a","#3fbf5a","#1f1f22","#a9adb3"),
      K("Mephrit", "xenos-necrons-mephrit", "#9a9da2","#3a3a3e","#c9a13b","#d9702a","#d9702a","#1f1f22","#a9adb3"),
      K("Nephrekh", "xenos-necrons-nephrekh", "#c9a13b","#1f1f22","#b08d3c","#e8c33a","#e8c33a","#1f1f22","#c9a13b")
    ],
    "tyranids": [
      K("Leviathan", "", "#5a2a6b","#7b5ab8","#a58ab0","#d8cba8","#e8c33a","#b3141c","#d8cba8","#d8cba8"),
      K("Behemoth", "", "#1c2c55","#1f4aa8","#3b8fe0","#b3141c","#e8c33a","#b3141c","#d8cba8","#b3141c"),
      K("Kraken", "", "#c24a1f","#7a0d12","#d9702a","#1f1f22","#e8c33a","#5a2a6b","#1f1f22","#d8cba8")
    ],
    "orks": [
      K("Goffs", "xenos-orks-goffs-clan", "#1f1f22","#1f1f22","#efeee9","#b3141c","#b3141c","#1f1f22","#5d6166","#3f6b2a"),
      K("Evil Sunz", "xenos-orks-evil-sunz-clan", "#b3141c","#b3141c","#e8c33a","#1f1f22","#b3141c","#6b4a2e","#5d6166","#4f7a2a"),
      K("Bad Moons", "xenos-orks-bad-moons-clan", "#e8c33a","#1f1f22","#c9a13b","#1f1f22","#b3141c","#6b4a2e","#c9a13b","#4f7a2a"),
      K("Blood Axes", "xenos-orks-blood-axes-clan", "#5a6b3a","#8f8a5a","#6b4a2e","#b3141c","#b3141c","#8f8a5a","#5d6166","#4f7a2a"),
      K("Deathskulls", "xenos-orks-deathskulls-clan", "#1f4aa8","#efeee9","#d8cba8","#efeee9","#b3141c","#6b4a2e","#a9adb3","#4f7a2a"),
      K("Snakebites", "xenos-orks-snakebites-clan", "#6b4a2e","#b3141c","#d8cba8","#1f1f22","#b3141c","#8a5a34","#9a6b3a","#5a6b3a")
    ],
    "tau-empire": [
      K("T'au Sept", "xenos-tau-empire-tau-sept", "#c98a3b","#efeee9","#1f1f22","#efeee9","#3fbf5a","#3a3a3e","#3a3a3e"),
      K("Vior'la Sept", "xenos-tau-empire-viorla-sept", "#efeee9","#b3141c","#1f1f22","#b3141c","#3fbf5a","#3a3a3e","#3a3a3e"),
      K("Farsight Enclaves", "xenos-tau-empire-farsight-enclave", "#b3141c","#efeee9","#1f1f22","#efeee9","#3fbf5a","#3a3a3e","#3a3a3e")
    ],
    "aeldari": [
      K("Ulthwé", "xenos-eldar-craftworld-ulthwe", "#1f1f22","#d8cba8","#d8cba8","#d8cba8","#b3141c","#d8cba8","#a9adb3"),
      K("Biel-Tan", "xenos-eldar-craftworld-biel-tan", "#1f6b3a","#efeee9","#efeee9","#efeee9","#b3141c","#efeee9","#a9adb3"),
      K("Iyanden", "xenos-eldar-craftworld-iyanden", "#e8c33a","#1f4aa8","#1f4aa8","#1f4aa8","#b3141c","#1f4aa8","#a9adb3"),
      K("Saim-Hann", "xenos-eldar-craftworld-saim-hann", "#b3141c","#efeee9","#1f1f22","#efeee9","#3fbf5a","#efeee9","#a9adb3"),
      K("Alaitoc", "xenos-eldar-craftworld-alaitoc", "#1f4aa8","#e8c33a","#e8c33a","#e8c33a","#b3141c","#e8c33a","#a9adb3")
    ],
    "astra-militarum": [
      K("Cadian", "human-imperium-astra-militarum-cadian-shock-troops-2", "#3f5a2e","#c9b27c","#6b4a2e","#efeee9","#1f1f22","#c9b27c","#5d6166"),
      K("Catachan", "human-imperium-astra-militarum-catachan-jungle-fighters", "#4a5a32","#3f5a2e","#6b4a2e","#b3141c","#1f1f22","#b3141c","#5d6166","#b07a58"),
      K("Mordian Iron Guard", "human-imperium-astra-militarum-mordian-iron-guard", "#1c2c55","#1c2c55","#c9a13b","#b3141c","#1f1f22","#b3141c","#a9adb3"),
      K("Death Korps of Krieg", "human-imperium-astra-militarum-death-korps-of-krieg", "#5d6166","#5a5a48","#6b4a2e","#efeee9","#3fbf5a","#5a5a48","#5d6166"),
      K("Tallarn", "human-imperium-astra-militarum-tallarn-desert-raiders", "#c9b27c","#d8cba8","#6b4a2e","#b3141c","#1f1f22","#d8cba8","#5d6166","#9a6b4a"),
      K("Vostroyan", "human-imperium-astra-militarum-vostroyan-firstborn", "#7a0d12","#1f1f22","#c9a13b","#c9a13b","#1f1f22","#6b4a2e","#c9a13b")
    ],
    "adepta-sororitas": [
      K("Our Martyred Lady", "human-imperium-battle-sisters-order-of-our-martyred-lady", "#1f1f22","#1f1f22","#a9adb3","#efeee9","#3fbf5a","#b3141c","#a9adb3"),
      K("Bloody Rose", "human-imperium-battle-sisters-order-of-the-bloody-rose", "#9e1b1b","#9e1b1b","#a9adb3","#efeee9","#3fbf5a","#1f1f22","#a9adb3")
    ],
    "chaos-space-marines": [
      K("Black Legion", "chaos-legions-black-legion", "#1f1f22","#b08d3c","#b08d3c","#b3141c","#b3141c","#7a0d12","#5d6166"),
      K("Night Lords", "chaos-legions-night-lords", "#1c2c55","#efeee9","#b08d3c","#efeee9","#b3141c","#1f1f22","#5d6166"),
      K("Iron Warriors", "chaos-legions-iron-warriors", "#6f7378","#e8c33a","#b08d3c","#1f1f22","#b3141c","#3a3a3e","#5d6166"),
      K("Word Bearers", "chaos-legions-word-bearers", "#7a0d12","#1f1f22","#c9a13b","#c9a13b","#3fbf5a","#1f1f22","#5d6166"),
      K("Alpha Legion", "chaos-legions-alpha-legion-1", "#1f7a78","#a9adb3","#a9adb3","#a9adb3","#3fbf5a","#1f1f22","#5d6166")
    ],
    "chaos-daemons": [
      K("Khorne", "chaos-gods-khorne", "#9e1b1b","#7a0d12","#1f1f22","#b08d3c","#e8c33a","#1f1f22","#b08d3c"),
      K("Nurgle", "chaos-gods-nurgle", "#8a8f5a","#6b4a2e","#d8cba8","#1f1f22","#e8c33a","#d97aa6","#6b4a2e"),
      K("Tzeentch", "chaos-gods-tzeentch", "#d97aa6","#1f4aa8","#e8c33a","#e8c33a","#efeee9","#1f4aa8","#c9a13b"),
      K("Slaanesh", "chaos-gods-slaanesh", "#c8b8d8","#b8428e","#1f1f22","#b8428e","#efeee9","#b8428e","#c9a13b")
    ]
  };
  const schemesFor = factionId => (SCHEMES[factionId] || []).map(s => ({...s, shape: s.icon && ICON_BY_ID[s.icon] ? "icon:" + s.icon : ""}));

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
