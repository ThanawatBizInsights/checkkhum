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
const LINE_URL = "https://lin.ee/86TezJV";
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
