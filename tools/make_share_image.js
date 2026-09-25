// Makes img/share.jpg, the picture shown when a link to the site is shared (WhatsApp, Facebook, Discord...).
// It's built from the homepage itself: the two logos and the parade of faction badges.
//
//   cd tests && npm ci && cd ..
//   python3 -m http.server 8765 &
//   NODE_PATH=tests/node_modules node tools/make_share_image.js
const {chromium} = require("@playwright/test");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  // ignoreHTTPSErrors: some networks (proxies) re-sign HTTPS; this only fetches the site's public web font.
  const page = await (await browser.newContext({viewport: {width: 1200, height: 630}, deviceScaleFactor: 1, ignoreHTTPSErrors: true})).newPage();
  await page.goto("http://localhost:8765/#/");
  await page.waitForSelector(".lp-parade");
  await page.evaluate(() => document.fonts.load('800 58px "Space Grotesk"'));
  if(!(await page.evaluate(() => [...document.fonts].some(f => f.family.includes("Space Grotesk") && f.status === "loaded")))) throw new Error("The Space Grotesk font didn't load; check the connection.");
  await page.evaluate(() => {
    const logo = mode => document.querySelector(`[data-lp-mode="${mode}"] svg`).outerHTML;
    const parade = document.querySelector(".lp-parade").cloneNode(true);
    [...parade.children].slice(9).forEach(x => x.remove());   // a tidy three by three
    const card = document.createElement("div");
    card.id = "share-card";
    card.innerHTML = `
      <div class="sc-copy">
        <div class="sc-tool">${logo("livery")}<span>Livery <b style="color:#3ddc84">Ledger</b></span></div>
        <div class="sc-tool">${logo("war")}<span>War <b style="color:#ec5a5f">Ledger</b></span></div>
        <h1>Paint your army.<br>Command it.</h1>
        <p>Free Warhammer 40,000 army tracker<br>liveryledger.co.za</p>
      </div>
      <div class="sc-art"></div>`;
    card.querySelector(".sc-art").appendChild(parade);
    const css = document.createElement("style");
    css.textContent = `
      #share-card{position:fixed;inset:0;z-index:99999;width:1200px;height:630px;display:grid;grid-template-columns:600px 1fr;align-items:center;gap:24px;
        padding:0 56px;box-sizing:border-box;color:#f2f6f3;font-family:"Space Grotesk",system-ui,sans-serif;
        background:radial-gradient(900px 500px at 0% 0%,rgba(61,220,132,.16),transparent 60%),radial-gradient(800px 500px at 100% 100%,rgba(236,90,95,.16),transparent 60%),#06080a}
      #share-card .sc-tool{display:flex;align-items:center;gap:14px;font-size:34px;font-weight:700;letter-spacing:-.01em;margin-bottom:12px}
      #share-card .sc-tool svg{width:56px;height:56px}
      #share-card h1{font-size:54px;line-height:1.05;letter-spacing:-.02em;margin:30px 0 22px;font-weight:800}
      #share-card p{font-size:22px;color:#a7b3ad;margin:0}
      #share-card .sc-art .lp-parade{display:grid;grid-template-columns:repeat(3,auto);justify-content:center;gap:14px;transform:scale(1.2);transform-origin:center;margin:0}`;
    document.body.append(css, card);
  });
  await page.screenshot({path: path.join(__dirname, "..", "img", "share.jpg"), type: "jpeg", quality: 86, clip: {x: 0, y: 0, width: 1200, height: 630}});
  await browser.close();
  console.log("wrote img/share.jpg");
})();
