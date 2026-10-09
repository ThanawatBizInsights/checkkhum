#!/usr/bin/env node
/**
 * Browser checks for the quotation-first journey against a LOCAL Supabase
 * stack (it creates enquiries, so it refuses anything else):
 *   - each product's quote form on a 390px phone, through to the
 *     confirmation screen (reference + LINE link) and the staff CRM;
 *   - marketing choice stored separately with the notice version;
 *   - failures (server error, intake not configured, network down) never
 *     show a success screen;
 *   - optional: an app started WITHOUT the intake settings shows the
 *     "not available" notice instead of a form (UNCONFIGURED_URL).
 *
 *   npx supabase db reset && npm run build && npm start
 *   BASE_URL=http://localhost:3000 node scripts/verify-quote-journey.mjs
 *   # optional second app with ENQUIRY_HASH_SALT unset, e.g. on port 3100:
 *   UNCONFIGURED_URL=http://localhost:3100 node scripts/verify-quote-journey.mjs
 */
import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const B = process.env.BASE_URL ?? "http://localhost:3000";
const UNCONFIGURED = process.env.UNCONFIGURED_URL;
const LINE_URL = "https://lin.ee/sAdMA0r";
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error("Refusing to run against a non-local Supabase");
const sql = (q) => execFileSync("psql", [status.DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};

const browser = await chromium.launch();
let ipSeq = 10;
async function phonePage() {
  // A distinct client IP per page keeps the per-IP rate limit out of the way.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    extraHTTPHeaders: { "x-real-ip": `198.51.100.${ipSeq++}` },
  });
  const p = await ctx.newPage();
  return { ctx, p };
}
const noHorizontalScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const runId = Date.now().toString().slice(-4);
const journeys = [
  {
    plan: "car-1", name: `ทดสอบ ชั้นหนึ่ง ${runId}`, phone: `08100${runId}1`, product: "car_1", marketing: true,
    fill: async (f) => {
      await f.getByLabel("ยี่ห้อรถ").fill("Honda");
      await f.getByLabel("รุ่นรถ").fill("City");
      await f.getByLabel("ปีรถ (พ.ศ.)").selectOption("2022");
      await f.getByLabel("ประกันเดิมหมดเมื่อไร").selectOption("1_3_months");
      await f.getByRole("radio", { name: "ซ่อมศูนย์", exact: true }).check();
      await f.getByRole("radio", { name: "ใช้ส่วนตัว", exact: true }).check();
    },
    expect: `Honda|City|2022|1_3_months|{"usage": "personal", "repair": "dealer"}`,
  },
  {
    plan: "ev", name: `ทดสอบ อีวี ${runId}`, phone: `08100${runId}2`, product: "ev", marketing: false,
    fill: async (f) => {
      await f.getByLabel("ยี่ห้อรถ").fill("BYD");
      await f.getByLabel("รุ่นรถ").fill("Dolphin");
      await f.getByLabel("ปีรถ (พ.ศ.)").selectOption("2024");
      await f.getByLabel("ประกันเดิมหมดเมื่อไร").selectOption("no_current_policy");
      await f.locator("fieldset", { hasText: "เครื่องชาร์จ" }).getByRole("radio", { name: "มี", exact: true }).check();
    },
    expect: `BYD|Dolphin|2024|no_current_policy|{"ev_home_charger": "yes"}`,
  },
  {
    plan: "compulsory", name: `ทดสอบ พรบ ${runId}`, phone: `08100${runId}3`, product: "compulsory", marketing: false,
    fill: async (f) => {
      await f.getByRole("radio", { name: "รถกระบะ", exact: true }).check();
      await f.getByLabel("พ.ร.บ. เดิมหมดเมื่อไร").selectOption("within_1_month");
    },
    expect: `-|-|-|within_1_month|{"vehicle_type": "pickup"}`,
  },
  {
    plan: "travel", name: `ทดสอบ เดินทาง ${runId}`, phone: `08100${runId}4`, product: "travel", marketing: false,
    fill: async (f) => {
      await f.getByLabel("ประเทศปลายทาง").fill("ญี่ปุ่น");
      await f.getByLabel("จำนวนวัน").fill("6");
      await f.getByLabel("จำนวนผู้เดินทาง").fill("2");
    },
    expect: `-|-|-|-|{}`,
  },
];

console.log("\n# Quote journeys on a 390px phone");
const refs = [];
for (const j of journeys) {
  const { ctx, p } = await phonePage();
  await p.goto(`${B}/quote?plan=${j.plan}`);
  const form = p.locator("main form").first();
  await form.waitFor();
  ok(await noHorizontalScroll(p), `${j.plan}: no horizontal scroll at 390px`);
  ok((await p.getByText("ข้อมูลสาธิต").count()) === 0, `${j.plan}: no demo label when the database is configured`);

  // Empty submit shows tied, focused errors and sends nothing.
  await sleep(3200); // minimum fill time
  await form.getByRole("button", { name: "ขอใบเสนอราคา" }).click();
  const firstError = await p.evaluate(() => {
    const el = document.activeElement;
    const ids = (el?.closest("fieldset") ?? el)?.getAttribute("aria-describedby") ?? "";
    return ids.split(" ").some((id) => id.endsWith("-error") && document.getElementById(id));
  });
  ok(firstError, `${j.plan}: empty submit focuses the first invalid field with its error`);

  await j.fill(form);
  await form.getByLabel("ชื่อที่ให้เราเรียก").fill(j.name);
  await form.getByLabel("เบอร์โทรศัพท์").fill(j.phone);
  if (j.marketing) await form.getByLabel(/รับข่าวสาร/).check();
  ok(await noHorizontalScroll(p), `${j.plan}: still no horizontal scroll with product fields shown`);
  await form.getByRole("button", { name: "ขอใบเสนอราคา" }).click();

  await p.getByTestId("enquiry-confirmation").waitFor({ timeout: 15000 });
  const ref = (await p.getByTestId("enquiry-reference").innerText()).trim();
  refs.push(ref);
  ok(/^CK-\d{6}-[A-Z0-9]{4}$/.test(ref), `${j.plan}: confirmation shows reference ${ref}`);
  const line = p.locator(`main a[href="${LINE_URL}"]`).first();
  ok((await line.getAttribute("target")) === "_blank" && (await line.getAttribute("rel")) === "noopener noreferrer", `${j.plan}: confirmation links to LINE ${LINE_URL}`);
  ok(!(await line.getAttribute("href")).includes("?"), `${j.plan}: LINE link carries no form details`);
  ok(await noHorizontalScroll(p), `${j.plan}: confirmation fits 390px`);
  if (j.plan === "car-1") await p.screenshot({ path: "/tmp/journey-confirmation-390.png", fullPage: true });

  const row = sql(`select e.product || '|' || coalesce(v.make, '-') || '|' || coalesce(v.model, '-') || '|' || coalesce(v.model_year::text, '-') || '|'
                   || coalesce(e.renewal_timing, '-') || '|' || e.details::text
                   from public.enquiries e left join public.vehicles v on v.id = e.vehicle_id where e.reference = '${ref}'`);
  ok(row === `${j.product}|${j.expect}`, `${j.plan}: saved with its product fields (${row})`);
  const consent = sql(`select string_agg(c.purpose || '=' || c.granted || '@' || c.notice_version, ',' order by c.purpose)
                       from public.consent_records c join public.enquiries e on e.id = c.enquiry_id where e.reference = '${ref}'`);
  ok(consent === `quote_processing=true@draft-2026-10,marketing=${j.marketing}@draft-2026-10`, `${j.plan}: quote processing and marketing choice stored separately (${consent})`);
  await ctx.close();
}
ok(sql(`select travel_destination || '/' || travel_days || '/' || travellers from public.enquiries where reference = '${refs[3]}'`) === "ญี่ปุ่น/6/2",
  "travel: destination, days and travellers saved");

console.log("\n# Vehicle year: Buddhist Era shown, Gregorian submitted");
{
  const { ctx, p } = await phonePage();
  await p.goto(`${B}/quote?plan=car-1`);
  const form = p.locator("main form").first();
  const year = form.getByLabel("ปีรถ (พ.ศ.)");
  const labelText = (await p.locator('label[for$="carYear"]').first().innerText()).trim();
  ok(labelText === "ปีรถ (พ.ศ.)", `year label reads exactly "ปีรถ (พ.ศ.)" (${labelText})`);
  const opts = await year.locator("option").evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
  const next = new Date().getFullYear() + 1;
  ok(opts[0][0] === "" && opts[0][1] === "เลือกปีรถ", `empty option is "เลือกปีรถ"`);
  ok(opts.length === 32 && opts[1][0] === String(next) && opts[1][1] === `${next + 543} (${next})` && opts[31][0] === String(next - 30),
    `31 years, newest first, same range as before (${opts[1][1]} … ${opts[31][1]})`);
  ok(opts.slice(1).every(([v, t]) => t === `${Number(v) + 543} (${v})`), "every option is \"พ.ศ. (ค.ศ.)\" with value = ค.ศ.");

  await year.selectOption({ label: "2569 (2026)" });
  ok((await year.inputValue()) === "2026", `choosing "2569 (2026)" sets the value 2026`);
  await form.getByLabel("ยี่ห้อรถ").fill("Toyota");
  await form.getByLabel("รุ่นรถ").fill("Yaris Ativ");
  await form.getByLabel("ชื่อที่ให้เราเรียก").fill(`ทดสอบ ปีรถ ${runId}`);
  await form.getByLabel("เบอร์โทรศัพท์").fill(`08100${runId}5`);
  let sentYear;
  p.on("request", (r) => {
    if (r.url().endsWith("/api/enquiries") && r.method() === "POST") sentYear = JSON.parse(r.postData() ?? "{}").carYear;
  });
  await sleep(3200);
  await form.getByRole("button", { name: "ขอใบเสนอราคา" }).click();
  await p.getByTestId("enquiry-reference").waitFor({ timeout: 15000 });
  const ref = (await p.getByTestId("enquiry-reference").innerText()).trim();
  ok(sentYear === "2026", `request body carries carYear "2026" (${sentYear})`);
  ok(sql(`select v.model_year from public.enquiries e join public.vehicles v on v.id = e.vehicle_id where e.reference = '${ref}'`) === "2026",
    "database stores model_year 2026 (Gregorian, unchanged)");
  ok((await p.locator("main pre").first().innerText()).includes("ปีรถ: 2569 (2026)"), "confirmation summary shows ปีรถ: 2569 (2026)");

  // A year set by value (as when editing a kept answer) shows its matching label.
  await p.goto(`${B}/quote?plan=car-1`);
  await p.locator("main form").first().getByLabel("ปีรถ (พ.ศ.)").selectOption("2021");
  ok((await p.locator('select[id$="carYear"] option:checked').first().innerText()) === "2564 (2021)", "value 2021 selects the option 2564 (2021)");

  await p.goto(`${B}/quote?plan=compulsory`);
  const cLabel = (await p.locator('label[for$="carYear"]').first().innerText()).trim();
  ok(cLabel.startsWith("ปีรถ (พ.ศ.)") && cLabel.includes("ไม่บังคับ"), `พ.ร.บ.: same label, marked optional (${cLabel.replace(/\s+/g, " ")})`);
  await ctx.close();
}

console.log("\n# Form layout at phone, tablet and desktop widths");
// Paired fields share a row only when the form itself is at least 32rem wide inside.
for (const [w, expected, paired] of [[390, 358, false], [768, 704, true], [1024, 520, false], [1280, 600, true], [1366, 600, true]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const p = await ctx.newPage();
  for (const path of ["/", "/quote?plan=car-1", "/car-insurance"]) {
    await p.goto(`${B}${path}`);
    const formBox = await p.locator("[data-quote-form]").first().boundingBox();
    const scroll = await p.evaluate(() => document.documentElement.scrollWidth);
    const top = async (sel) => (await p.locator(sel).first().boundingBox()).y;
    const [brand, model, year, renewal] = await Promise.all(['input[id$="carBrand"]', 'input[id$="carModel"]', 'select[id$="carYear"]', 'select[id$="renewalTiming"]'].map(top));
    const yearBox = await p.locator('select[id$="carYear"]').first().boundingBox();
    const twoCol = brand === model && year === renewal;
    const stacked = model > brand && renewal > year;
    const tiles = await p.locator("[data-quote-form] fieldset").first().locator("label").evaluateAll((ls) => ls.map((l) => l.getBoundingClientRect()));
    const tileWidths = tiles.map((t) => Math.round(t.width));
    const tileHeights = tiles.map((t) => Math.round(t.height));
    ok(Math.round(formBox.width) === expected && scroll <= w, `${w}px ${path}: form ${Math.round(formBox.width)}px (expected ${expected}), no horizontal scroll`);
    ok(paired ? twoCol : stacked, `${w}px ${path}: ${paired ? "paired fields share a row and line up" : "fields stack one per row"}`);
    ok(yearBox.width >= 200, `${w}px ${path}: year dropdown ${Math.round(yearBox.width)}px wide, room for "2569 (2026)"`);
    ok(Math.max(...tileWidths) - Math.min(...tileWidths) <= 1 && Math.max(...tileHeights) === Math.min(...tileHeights),
      `${w}px ${path}: plan tiles equal width (${tileWidths[0]}px), every label on one line`);
  }
  await ctx.close();
}

console.log("\n# Product photos: heroes, homepage cards, loading and cropping");
for (const [w, h] of [[390, 844], [768, 1024], [1366, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  for (const [path, file] of [["/car-insurance", "car-insurance-silver-sedan"], ["/ev-insurance", "ev-insurance-white-crossover-charging"], ["/travel-insurance", "travel-insurance-couple-airport"]]) {
    const res = await p.goto(`${B}${path}`, { waitUntil: "networkidle" });
    const html = await res.text();
    const hero = p.locator(`main img[src*="${file}"]`).first();
    const info = await hero.evaluate((img) => {
      const box = img.parentElement.getBoundingClientRect();
      return { alt: img.alt, loaded: img.complete && img.naturalWidth > 0, fit: getComputedStyle(img).objectFit, ratio: box.width / box.height, top: box.top, w: box.width };
    });
    const form = await p.locator("[data-quote-form]").first().boundingBox();
    const scroll = await p.evaluate(() => document.documentElement.scrollWidth);
    ok(/[\u0E00-\u0E7F]/.test(info.alt) && info.loaded && info.fit === "cover", `${w}px ${path}: hero photo loaded, Thai alt text, cover fit (${info.alt.slice(0, 24)}…)`);
    ok(html.includes(`rel="preload"`) && html.includes(file), `${w}px ${path}: hero photo is preloaded`);
    ok(Math.abs(info.ratio - (w >= 1024 ? 1.6 : w >= 640 ? 2 : 1.6)) < 0.02, `${w}px ${path}: crop ratio ${info.ratio.toFixed(2)} (reserved box, no layout shift)`);
    ok(w >= 1024 ? form.x > info.w && form.width >= 600 : info.top < form.y, `${w}px ${path}: ${w >= 1024 ? "photo beside a 600px form" : "photo, heading and button come before the form"}`);
    ok(scroll <= w, `${w}px ${path}: no horizontal scroll`);
    if (w < 1024) {
      const jump = p.locator('main a[href="#quote"]').first();
      ok(await jump.isVisible(), `${w}px ${path}: "ขอใบเสนอราคา" button jumps to the form`);
    }
  }
  await p.goto(`${B}/compulsory-insurance`, { waitUntil: "networkidle" });
  ok((await p.locator('main img[src*="insurance-"]').count()) === 0, `${w}px พ.ร.บ.: no substitute photo (icon kept)`);

  await p.goto(`${B}/`, { waitUntil: "networkidle" });
  const cards = p.locator("#products-title").locator("xpath=..").locator("li");
  const cardImgs = await cards.locator("img").evaluateAll((imgs) => imgs.map((i) => ({ src: i.getAttribute("src") ?? "", loading: i.getAttribute("loading"), alt: i.alt })));
  ok(cardImgs.length === 3 && cardImgs.every((i) => i.loading === "lazy" && i.alt.length > 10), `${w}px homepage: 3 product-card photos, lazy-loaded with alt text`);
  ok((await cards.nth(2).locator("svg").count()) === 1, `${w}px homepage: พ.ร.บ. card shows its icon panel`);
  const heroPhotoVisible = await p.locator('main section').first().locator(`img[src*="car-insurance-silver-sedan"]`).isVisible();
  ok(heroPhotoVisible === (w >= 1024), `${w}px homepage: hero photo ${w >= 1024 ? "shown beside the form" : "hidden so the form comes first"}`);
  ok((await p.locator('img[src*="hero-car"]').count()) === 0, `${w}px homepage: old poster image removed`);
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= w, `${w}px homepage: no horizontal scroll`);
  await ctx.close();
}

console.log("\n# LINE: header button, QR, contact page, footer, floating widget");
{
  const ADD_IMG = "https://scdn.line-apps.com/n/line_add_friends/btn/th.png";
  const QR_IMG = "https://qr-official.line.me/gs/M_103yhsnv_GW.png?oat_content=qr";
  const isLineLink = async (a) => (await a.getAttribute("href")) === LINE_URL && (await a.getAttribute("target")) === "_blank" && (await a.getAttribute("rel")) === "noopener noreferrer";

  // Pages: every LINE link points at the new OA link, the old one is gone, no raw URL shown.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  for (const path of ["/", "/car-insurance", "/quote", "/contact", "/privacy"]) {
    const res = await p.goto(`${B}${path}`, { waitUntil: "networkidle" });
    const html = await res.text();
    const hrefs = await p.locator("[data-line-link]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    ok(!html.includes("86TezJV") && hrefs.length > 0 && hrefs.every((h) => h === LINE_URL), `${path}: ${hrefs.length} LINE links, all ${LINE_URL}; old link gone`);
    const text = await p.locator("body").innerText();
    ok(!/lin\.ee|line\.me|M_103yhsnv|sAdMA0r/.test(text), `${path}: no raw LINE URL or account ID shown as text`);
    const footerBtn = p.locator("footer [data-line-link] img");
    ok((await footerBtn.getAttribute("src")) === ADD_IMG && (await isLineLink(p.locator("footer [data-line-link]").first())), `${path}: footer has the official add-friend button`);
  }

  // Desktop header: official button beside "ขอใบเสนอราคา".
  await p.goto(`${B}/`, { waitUntil: "networkidle" });
  const headerLink = p.locator("header [data-line-link]").first();
  const img = headerLink.locator("img");
  const [imgBox, quoteBox] = [await img.boundingBox(), await p.locator("header").getByRole("link", { name: "ขอใบเสนอราคา" }).boundingBox()];
  ok((await img.getAttribute("src")) === ADD_IMG && (await img.getAttribute("alt")) === "เพิ่มเพื่อน LINE เช็กคุ้ม" && Math.round(imgBox.height) === 36,
    `1440px header: official button, alt "เพิ่มเพื่อน LINE เช็กคุ้ม", 36px tall`);
  ok((await isLineLink(headerLink)) && imgBox.x + imgBox.width <= quoteBox.x && Math.abs(imgBox.y + imgBox.height / 2 - (quoteBox.y + quoteBox.height / 2)) < 4,
    "1440px header: button opens LINE in a new tab, sits just left of ขอใบเสนอราคา, vertically centred");
  await headerLink.focus();
  ok(await headerLink.evaluate((a) => getComputedStyle(a).outlineStyle !== "none" || getComputedStyle(a).boxShadow !== "none"), "header LINE button shows a visible focus outline");

  // Contact page: office, Maps link, QR.
  await p.goto(`${B}/contact`, { waitUntil: "networkidle" });
  const address = (await p.locator("address").innerText()).replace(/\s+/g, " ");
  ok(address.includes("บริษัท แสงพันล้าน จำกัด") && address.includes("89/9-10 หมู่ 3 ต.บางม่วง อ.บางใหญ่") && address.includes("จ.นนทบุรี 11140"), "contact: office name and address as text");
  const maps = p.getByRole("link", { name: /เปิดใน Google Maps/ });
  const mapsHref = await maps.getAttribute("href");
  ok(mapsHref.startsWith("https://www.google.com/maps/search/?api=1&query=") && decodeURIComponent(mapsHref).includes("89/9-10 หมู่ 3 ต.บางม่วง อ.บางใหญ่ จ.นนทบุรี 11140") && (await maps.getAttribute("target")) === "_blank",
    "contact: เปิดใน Google Maps runs an address search in a new tab (no unconfirmed pin)");
  ok((await p.locator("main iframe").count()) === 0, "contact: no embedded map until the pin is confirmed");
  const qr = p.locator(`main img[src="${QR_IMG}"]`);
  const qrBox = await qr.boundingBox();
  ok(Math.round(qrBox.width) === 180 && Math.round(qrBox.height) === 180 && (await p.locator("main figure", { has: p.locator(`img[src="${QR_IMG}"]`) }).first().innerText()).includes("สแกนเพื่อเพิ่มเพื่อน LINE"),
    "contact: QR 180×180, square, captioned สแกนเพื่อเพิ่มเพื่อน LINE");
  const quiet = await qr.evaluate((i) => { const pad = getComputedStyle(i.parentElement); return parseFloat(pad.paddingLeft) >= 12 && pad.backgroundColor === "rgb(255, 255, 255)"; });
  ok(quiet, "contact: QR on white with a clear margin");
  ok(await isLineLink(p.locator("main [data-line-link] img").first().locator("xpath=..")), "contact: official add-friend button");

  // Quote form: LINE as an alternative.
  await p.goto(`${B}/quote`, { waitUntil: "networkidle" });
  const alt = p.locator("[data-quote-form]").getByRole("link", { name: /คุยกับเราผ่าน LINE/ });
  ok(await isLineLink(alt), "quote form: คุยกับเราผ่าน LINE alternative");
  await ctx.close();

  // Staff pages stay free of the marketing widget and header button.
  const s = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sp = await s.newPage();
  await sp.goto(`${B}/staff/login`, { waitUntil: "networkidle" });
  await sp.waitForTimeout(400);
  ok((await sp.locator("[data-line-widget]").count()) === 0 && (await sp.locator("header [data-line-link]").count()) === 0, "staff login: no LINE widget or header button");
  await s.close();

  // Floating widget at each width.
  for (const [w, h] of [[375, 667], [390, 844], [768, 1024], [1440, 900]]) {
    const c = await browser.newContext({ viewport: { width: w, height: h } });
    const q = await c.newPage();
    await q.goto(`${B}/privacy`, { waitUntil: "networkidle" }); // a page without forms
    const widget = q.locator("[data-line-widget]");
    await widget.waitFor({ state: "attached", timeout: 5000 });
    await q.waitForTimeout(350);
    const box = await widget.boundingBox();
    const wText = await widget.innerText();
    ok(wText.includes("แอดไลน์เพื่อเช็กเบี้ย") && wText.includes("ส่งคำขอเช็กเบี้ยประกันรถฟรีได้ 24 ชม.") && !/lin\.ee|http|@/.test(wText), `${w}px widget: Thai heading and text only, no URL or ID`);
    ok(await isLineLink(widget.locator("[data-line-link]")), `${w}px widget: opens the LINE OA in a new tab`);
    if (w >= 768) {
      ok(Math.round(w - (box.x + box.width)) === 24 && Math.round(h - (box.y + box.height)) === 24 && box.width <= 340, `${w}px widget: bottom-right card, ${Math.round(box.width)}px wide`);
      ok(wText.includes("เพิ่มเพื่อน LINE"), `${w}px widget: "เพิ่มเพื่อน LINE" button`);
    } else {
      const bar = await q.getByRole("link", { name: "ขอใบเสนอราคา" }).last().boundingBox();
      ok(box.x >= 16 && box.x + box.width <= w - 16 && box.y + box.height <= bar.y - 4 && box.height <= 110, `${w}px widget: compact (${Math.round(box.height)}px), above the quote bar, within the margins`);
    }
    ok((await q.evaluate(() => document.documentElement.scrollWidth)) <= w, `${w}px widget page: no horizontal scroll`);

    // Steps aside while a field has focus (on-screen keyboard), and for the footer.
    await q.evaluate(() => {
      const f = Object.assign(document.createElement("input"), { id: "probe-field" });
      f.style.cssText = "position:fixed;top:0;left:0;width:10px";
      document.body.append(f);
      f.focus();
    });
    await q.waitForTimeout(300);
    ok(await widget.evaluate((el) => el.inert && getComputedStyle(el).opacity === "0"), `${w}px widget: hidden while a field has focus (keyboard)`);
    await q.evaluate(() => document.getElementById("probe-field").remove());
    await q.waitForTimeout(300);
    await q.locator("footer").scrollIntoViewIfNeeded();
    await q.waitForTimeout(400);
    ok(await widget.evaluate((el) => el.inert), `${w}px widget: steps aside at the footer`);
    await q.evaluate(() => window.scrollTo(0, 0));
    await q.waitForTimeout(400);

    // Keyboard: the close button is reachable and labelled; dismissal lasts for the session.
    const close = widget.getByRole("button", { name: "ปิดกล่องเพิ่มเพื่อน LINE" });
    await close.focus();
    await q.keyboard.press("Enter");
    await q.waitForTimeout(200);
    ok((await widget.count()) === 0, `${w}px widget: closes with the keyboard`);
    await q.goto(`${B}/`, { waitUntil: "networkidle" });
    await q.waitForTimeout(300);
    ok((await q.locator("[data-line-widget]").count()) === 0, `${w}px widget: stays closed on the next page this session`);
    if (w === 390) {
      const fresh = await c.newPage(); // new tab = new session storage
      await fresh.goto(`${B}/privacy`, { waitUntil: "networkidle" });
      await fresh.locator("[data-line-widget]").waitFor({ state: "attached", timeout: 5000 });
      ok(true, "widget: a new session shows it again");
    }
    await c.close();
  }

  // Never over the quote form: hidden while it is on screen.
  for (const w of [390, 1440]) {
    const c = await browser.newContext({ viewport: { width: w, height: 900 } });
    const q = await c.newPage();
    await q.goto(`${B}/quote`, { waitUntil: "networkidle" });
    await q.waitForTimeout(400);
    ok(await q.locator("[data-line-widget]").evaluate((el) => el.inert && getComputedStyle(el).pointerEvents === "none"), `${w}px /quote: widget out of the way while the form is on screen`);
    await q.goto(`${B}/contact`, { waitUntil: "networkidle" });
    await q.locator("[data-contact-form]").scrollIntoViewIfNeeded();
    await q.waitForTimeout(400);
    ok(await q.locator("[data-line-widget]").evaluate((el) => el.inert), `${w}px /contact: widget out of the way while the callback form is on screen`);
    await c.close();
  }

  // Phones: no header overflow; the LINE button is in the menu instead.
  for (const w of [375, 390]) {
    const c = await browser.newContext({ viewport: { width: w, height: 800 } });
    const q = await c.newPage();
    await q.goto(`${B}/`, { waitUntil: "networkidle" });
    ok(!(await q.locator("header [data-line-link]").first().isVisible()) && (await q.evaluate(() => document.documentElement.scrollWidth)) <= w, `${w}px header: no LINE button squeezed in, no overflow`);
    await q.getByRole("button", { name: "เมนู" }).click();
    ok(await q.getByRole("navigation", { name: "เมนูหลัก" }).locator("[data-line-link]").isVisible(), `${w}px menu: official LINE button inside the menu`);
    await c.close();
  }
}

console.log("\n# Staff see the enquiries; the public can't");
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  for (const path of ["/staff", "/staff/enquiries", `/staff/enquiries?q=${refs[0]}`]) {
    await p.goto(`${B}${path}`);
    ok(p.url().startsWith(`${B}/staff/login`), `signed out: ${path.split("?")[0]} redirects to /staff/login`);
  }
  await p.goto(`${B}/staff/login`);
  await p.fill("#email", "agent@checkkhum.example");
  await p.fill("#password", "checkkhum-local-only");
  await p.click("button[type=submit]");
  await p.waitForURL(`${B}/staff`);
  await p.goto(`${B}/staff/enquiries?status=new`);
  for (const j of journeys) ok((await p.getByRole("link", { name: j.name }).count()) === 1, `CRM new list shows ${j.plan} enquiry`);
  await p.getByRole("link", { name: journeys[0].name }).click();
  await p.waitForURL(/\/staff\/enquiries\/[0-9a-f-]{36}$/);
  const detail = await p.locator("main").innerText();
  ok(detail.includes("Honda City ปี 2022") && detail.includes("ซ่อมศูนย์") && detail.includes("1–3 เดือน"), "CRM detail shows car, repair choice and renewal timing");
  await ctx.close();
}

console.log("\n# Failures never show success");
for (const [label, route] of [
  ["server error (500)", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "server_error", message: "ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง" }) })],
  ["not configured (503)", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "not_configured", message: "ตอนนี้ระบบรับคำขอออนไลน์ยังไม่พร้อม คำขอนี้ยังไม่ถูกบันทึก ติดต่อเราทาง LINE ได้เลย" }) })],
  ["demo answer from a misconfigured server", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, mode: "demo" }) })],
  ["network down", (r) => r.abort("internetdisconnected")],
]) {
  const { ctx, p } = await phonePage();
  await p.route("**/api/enquiries", route);
  await p.goto(`${B}/quote?plan=car-1`);
  const form = p.locator("main form").first();
  await form.getByLabel("ยี่ห้อรถ").fill("Mazda");
  await form.getByLabel("รุ่นรถ").fill("CX-3");
  await form.getByLabel("ปีรถ (พ.ศ.)").selectOption("2019");
  await form.getByLabel("ชื่อที่ให้เราเรียก").fill("ทดสอบ ล้มเหลว");
  await form.getByLabel("เบอร์โทรศัพท์").fill("0810000999");
  await sleep(3200);
  await form.getByRole("button", { name: "ขอใบเสนอราคา" }).click();
  await p.locator('main [role="alert"]').first().waitFor({ timeout: 10000 }).catch(() => {});
  await sleep(500);
  ok((await p.getByTestId("enquiry-confirmation").count()) === 0 && (await p.getByTestId("enquiry-reference").count()) === 0,
    `${label}: no confirmation or reference shown`);
  ok((await p.locator('main [role="alert"]').count()) > 0, `${label}: an error message is shown`);
  ok((await form.getByLabel("ยี่ห้อรถ").inputValue()) === "Mazda", `${label}: the visitor's answers are kept`);
  if (label.startsWith("server")) await p.screenshot({ path: "/tmp/journey-error-390.png" });
  await ctx.close();
}
ok(sql("select count(*) from public.enquiries where contact_phone = '0810000999'") === "0", "nothing saved by the failed attempts");

if (UNCONFIGURED) {
  console.log("\n# App started without the intake settings");
  const { ctx, p } = await phonePage();
  await p.goto(`${UNCONFIGURED}/quote?plan=car-1`);
  ok((await p.getByText("ตอนนี้ส่งคำขอทางเว็บไซต์ไม่ได้ชั่วคราว").count()) > 0, "quote page says online requests are unavailable");
  ok((await p.locator("main form").count()) === 0, "no quote form to fill in");
  ok((await p.locator(`main a[href="${LINE_URL}"]`).count()) > 0, "LINE link offered instead");
  ok((await p.getByText("ข้อมูลสาธิต").count()) === 0, "no demo label in production mode");
  await p.screenshot({ path: "/tmp/journey-unavailable-390.png" });
  // /contact is prerendered, so here it still carries this build's form (on a
  // real deployment build and runtime settings match). Submitting must fail visibly.
  await p.goto(`${UNCONFIGURED}/contact`);
  const contact = p.locator("main form").first();
  if (await contact.count()) {
    await contact.getByLabel("ชื่อที่ให้เราเรียก").fill("ทดสอบ ติดต่อ");
    await contact.getByLabel("เบอร์โทรศัพท์").fill("0810000997");
    await contact.getByLabel("เรื่องที่ต้องการสอบถาม").fill("สอบถามเรื่องต่ออายุ");
    await sleep(3200);
    await contact.locator("button[type=submit]").click();
    await p.locator('main [role="alert"]').first().waitFor({ timeout: 10000 });
    ok((await p.getByTestId("enquiry-confirmation").count()) === 0 && (await p.locator('main [role="alert"]').first().innerText()).includes("ยังไม่ถูกบันทึก"),
      "contact form: says the message was not saved, no confirmation");
  } else {
    ok((await p.getByText("ตอนนี้ส่งคำขอทางเว็บไซต์ไม่ได้ชั่วคราว").count()) > 0, "contact page: unavailable notice, no form");
  }
  const r = await fetch(`${UNCONFIGURED}/api/enquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: UNCONFIGURED },
    body: JSON.stringify({ type: "quote", planId: "car-1", carBrand: "Mazda", carModel: "2", carYear: "2020", name: "ทดสอบ", phone: "0810000998",
      preferredChannel: "phone", marketingConsent: false, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 10000, website: "" }),
  });
  const body = await r.json();
  ok(r.status === 503 && body.error === "not_configured" && !("mode" in body), "API answers 503 not_configured, never a demo success");
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll quote journey checks passed");
process.exit(failures ? 1 : 0);
