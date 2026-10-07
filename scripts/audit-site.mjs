#!/usr/bin/env node
/**
 * Launch audit for the website and CRM against a LOCAL stack.
 *
 *  - Mobile layouts (360 and 390 px) for every public and CRM page:
 *    no horizontal scroll, tap targets, Thai fonts loaded, text size.
 *  - Navigation: every internal link on every page resolves.
 *  - Anonymous visitors cannot read customer data (REST, RPC, GraphQL,
 *    API route, CRM pages, CRM server actions).
 *  - Secrets are absent from the browser bundle and rendered HTML.
 *  - Session cookie flags and security headers.
 *
 *   npx supabase db reset && npm run build && npm start
 *   PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 node scripts/audit-site.mjs
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const B = process.env.BASE_URL ?? "http://localhost:3000";
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error("Refusing to run against a non-local Supabase");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

let failures = 0;
const warnings = [];
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};
const warn = (msg) => {
  console.log(`WARN ${msg}`);
  warnings.push(msg);
};

const PUBLIC = ["/", "/car-insurance", "/ev-insurance", "/compulsory-insurance", "/travel-insurance", "/quote", "/contact", "/privacy", "/staff/login", "/customer/login", "/customer/register", "/customer/verify-email", "/customer/forgot-password"];
const CRM = [
  "/staff", "/staff/enquiries", "/staff/enquiries/55555555-5555-4555-8555-555555555502", "/staff/customers",
  "/staff/customers/33333333-3333-4333-8333-333333333301", "/staff/policies?within=30", "/staff/policies?within=90",
  "/staff/policies/77777777-7777-4777-8777-777777777701", "/staff/tasks?view=all", "/staff/reports", "/staff/admin", "/staff/account",
];

const browser = await chromium.launch();

async function adminContext(viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await p.goto(`${B}/staff/login`);
  await p.fill("#email", "admin@checkkhum.example");
  await p.fill("#password", "checkkhum-local-only");
  await p.click("button[type=submit]");
  await p.waitForURL(`${B}/staff`);
  return { ctx, p };
}

// ===== 1. Mobile layouts, Thai text, tap targets =================================
for (const width of [360, 390]) {
  const anon = await browser.newContext({ viewport: { width, height: 800 } });
  const admin = await adminContext({ width, height: 800 });
  for (const [ctx, pages, label] of [[anon, PUBLIC, "public"], [admin.ctx, CRM, "crm"]]) {
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => m.type() === "error" && !m.location().url.includes("scdn.line-apps.com") && errors.push(m.text()));
    for (const path of pages) {
      const res = await p.goto(B + path);
      await p.waitForLoadState("networkidle");
      const r = await p.evaluate(() => {
        const visible = (el) => {
          const s = getComputedStyle(el);
          const b = el.getBoundingClientRect();
          return s.visibility !== "hidden" && s.display !== "none" && b.width > 0 && b.height > 0 && !el.closest("[aria-hidden=true]") && !el.closest(".sr-only");
        };
        // Text nodes rendered smaller than 15px (CLAUDE.md: Thai text never below 15px).
        const small = new Set();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const t = walker.currentNode.textContent.trim();
          const el = walker.currentNode.parentElement;
          if (!t || !el || !visible(el) || el.closest("script,style,svg,option")) continue;
          if (parseFloat(getComputedStyle(el).fontSize) < 15) small.add(`${parseFloat(getComputedStyle(el).fontSize)}px "${t.slice(0, 30)}"`);
        }
        // Controls smaller than 44px tall (inline text links inside sentences are exempt).
        const tiny = [];
        for (const el of document.querySelectorAll("button, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), nav a, a[class*='rounded-full']")) {
          if (!visible(el) || el.closest("#__next-route-announcer__")) continue;
          const h = el.getBoundingClientRect().height;
          if (h < 44) tiny.push(`${Math.round(h)}px ${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.name || "").trim().slice(0, 25)}"`);
        }
        const body = getComputedStyle(document.body);
        return {
          scrollWidth: document.documentElement.scrollWidth,
          lang: document.documentElement.lang,
          fonts: document.fonts.check('600 20px "Prompt"', "ประกัน") && document.fonts.check('400 16px "IBM Plex Sans Thai Looped"', "ประกัน"),
          lineHeight: parseFloat(body.lineHeight) / parseFloat(body.fontSize),
          mojibake: /Ã|à¸|�/.test(document.body.innerText),
          small: [...small],
          tiny,
          h1: document.querySelectorAll("h1").length,
        };
      });
      const where = `${width}px ${path}`;
      ok(res.status() === 200, `${where}: loads (${res.status()})`);
      ok(r.scrollWidth <= width, `${where}: no horizontal scroll (${r.scrollWidth})`);
      ok(r.lang === "th" && r.fonts && !r.mojibake, `${where}: lang=th, Thai fonts loaded, no garbled text`);
      ok(r.lineHeight >= 1.7, `${where}: body line-height ${r.lineHeight.toFixed(2)}`);
      ok(r.h1 === 1, `${where}: exactly one h1 (${r.h1})`);
      ok(r.small.length === 0, `${where}: no text below 15px${r.small.length ? ` (${r.small.slice(0, 4).join("; ")})` : ""}`);
      if (r.tiny.length) warn(`${where}: ${r.tiny.length} control(s) under 44px tall: ${r.tiny.slice(0, 4).join("; ")}`);
      if (width === 390) await p.screenshot({ path: `${process.env.SHOTS ?? "/tmp"}/audit-${label}-${path.replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.png`, fullPage: true });
    }
    ok(errors.length === 0, `${width}px ${label}: no page/console errors ${errors.length ? JSON.stringify(errors.slice(0, 3)) : ""}`);
    await p.close();
  }
  await anon.close();
  await admin.ctx.close();
}

// ===== 2. Navigation: every internal link resolves =================================
{
  const admin = await adminContext({ width: 1366, height: 900 });
  const anon = await browser.newContext();
  const seen = new Map();
  for (const [ctx, pages] of [[anon, PUBLIC], [admin.ctx, CRM]]) {
    const p = await ctx.newPage();
    for (const path of pages) {
      await p.goto(B + path);
      const links = await p.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      for (const href of links) if (href.startsWith("/") && !href.startsWith("//") && !seen.has(href.split("#")[0])) seen.set(href.split("#")[0], ctx);
    }
  }
  const broken = [];
  for (const [href, ctx] of seen) {
    const res = await ctx.request.get(B + href, { maxRedirects: 5 });
    if (res.status() >= 400) broken.push(`${href} → ${res.status()}`);
  }
  ok(broken.length === 0, `all ${seen.size} internal links resolve${broken.length ? `: ${broken.join(", ")}` : ""}`);

  // Session cookie flags
  const cookies = (await admin.ctx.cookies()).filter((c) => c.name.startsWith("sb-"));
  ok(cookies.length > 0 && cookies.every((c) => c.httpOnly), `staff session cookie is httpOnly (${cookies.map((c) => `${c.name}:${c.httpOnly}`).join(", ")})`);
  ok(cookies.every((c) => c.sameSite === "Lax" || c.sameSite === "Strict"), "staff session cookie is SameSite=Lax/Strict");

  // ===== 3. Secrets: rendered HTML of every page (including signed-in CRM) ===========
  const secretValues = {
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
    ENQUIRY_HASH_SALT: env.ENQUIRY_HASH_SALT,
    JWT_SECRET: status.JWT_SECRET,
    DB_URL: status.DB_URL,
  };
  const leaks = [];
  for (const [ctx, pages] of [[anon, PUBLIC], [admin.ctx, CRM]]) {
    for (const path of pages) {
      const html = await (await ctx.request.get(B + path)).text();
      for (const [name, value] of Object.entries(secretValues)) if (value && html.includes(value)) leaks.push(`${name} in ${path}`);
      if (/sb_secret_|service_role/.test(html)) leaks.push(`secret-looking string in ${path}`);
      if (/"access_token"|"refresh_token"/.test(html)) leaks.push(`auth token in ${path}`);
    }
  }
  ok(leaks.length === 0, `no secrets or tokens in rendered HTML of ${PUBLIC.length + CRM.length} pages${leaks.length ? `: ${leaks.join(", ")}` : ""}`);

  // Browser bundle
  const files = [];
  const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
  walk(".next/static");
  const bundleLeaks = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const [name, value] of Object.entries(secretValues)) if (value && text.includes(value)) bundleLeaks.push(`${name} value in ${f}`);
    for (const name of ["SUPABASE_SECRET_KEY", "ENQUIRY_HASH_SALT", "TURNSTILE_SECRET_KEY", "SUPABASE_PUBLISHABLE_KEY", "sb_secret_", "service_role"]) {
      if (text.includes(name)) bundleLeaks.push(`"${name}" in ${f}`);
    }
  }
  ok(bundleLeaks.length === 0, `no secrets in ${files.length} browser bundle files${bundleLeaks.length ? `: ${bundleLeaks.slice(0, 5).join(", ")}` : ""}`);

  // Security headers
  const res = await anon.request.get(`${B}/`);
  const h = res.headers();
  ok(!h["x-powered-by"], "no X-Powered-By header");
  ok(h["x-content-type-options"] === "nosniff", `X-Content-Type-Options: ${h["x-content-type-options"]}`);
  ok(/frame-ancestors 'none'/.test(h["content-security-policy"] ?? "") || h["x-frame-options"] === "DENY", "pages cannot be framed (clickjacking)");
  ok(!!h["referrer-policy"], `Referrer-Policy: ${h["referrer-policy"]}`);

  await anon.close();
  await admin.ctx.close();
}

// ===== 4. Anonymous visitors cannot retrieve customer information =================
{
  const anonHeaders = { apikey: status.PUBLISHABLE_KEY, "content-type": "application/json" };
  const tables = [
    "customers", "vehicles", "enquiries", "quotations", "policies", "follow_up_activities", "follow_up_tasks", "renewal_tasks",
    "consent_records", "staff_users", "insurers", "audit_logs", "enquiry_status_history", "staff_reminders", "renewal_job_runs",
    "customer_invitations", "customer_accounts", "policy_documents", "customer_profiles",
  ];
  const readable = [];
  for (const t of tables) {
    const r = await fetch(`${status.API_URL}/rest/v1/${t}?select=*&limit=1`, { headers: anonHeaders });
    const body = await r.json().catch(() => null);
    if (r.ok || (Array.isArray(body) && body.length)) readable.push(`${t} (${r.status})`);
  }
  ok(readable.length === 0, `anon REST: all ${tables.length} tables refused${readable.length ? `; readable: ${readable.join(", ")}` : ""}`);

  const rpcs = {
    submit_enquiry: { p: {} },
    consume_rate_limit: { p_bucket_key: "x", p_limit: 1, p_window_seconds: 60 },
    search_customers: { p_query: "สมมติ" },
    crm_conversion_report: { p_from: "2020-01-01", p_to: "2030-01-01" },
    run_renewal_job: {},
    accept_customer_invitation: {},
    portal_session: {},
    record_enquiry_submitter: { p_reference: "CK-261001-DEM1", p_user: "11111111-1111-4111-8111-111111111201" },
    portal_overview: {},
    portal_request_renewal: { p_policy_id: "77777777-7777-4777-8777-777777777701" },
    convert_quotation_to_policy: { p_quotation_id: "66666666-6666-4666-8666-666666666603", p_policy_number: "X", p_start_date: "2026-01-01", p_end_date: "2027-01-01" },
  };
  const callable = [];
  for (const [fn, body] of Object.entries(rpcs)) {
    const r = await fetch(`${status.API_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: anonHeaders, body: JSON.stringify(body) });
    if (r.ok) callable.push(fn);
  }
  ok(callable.length === 0, `anon RPC: all ${Object.keys(rpcs).length} functions refused${callable.length ? `; callable: ${callable.join(", ")}` : ""}`);

  const gql = await fetch(`${status.API_URL}/graphql/v1`, {
    method: "POST",
    headers: anonHeaders,
    body: JSON.stringify({ query: "{ __schema { queryType { fields { name } } } customersCollection { edges { node { full_name phone } } } }" }),
  });
  const gqlText = await gql.text();
  ok(!/สมมติ|0800000101|"full_name":"/.test(gqlText), `anon GraphQL returns no customer data (${gql.status})`);
  ok(!/customersCollection|enquiriesCollection/.test(gqlText.replace(/Unknown field "customersCollection"[^"]*"/g, "")), "anon GraphQL schema exposes no customer tables");

  // Website API route: only POST, never returns customer data
  const get = await fetch(`${B}/api/enquiries`);
  ok(get.status === 405, `GET /api/enquiries not allowed (${get.status})`);

  // CRM server actions replayed without a session
  const ctx = await browser.newContext();
  const admin = await adminContext({ width: 1366, height: 900 });
  await ctx.addCookies(await admin.ctx.cookies());
  const p = await ctx.newPage();
  await p.goto(`${B}/staff/enquiries/55555555-5555-4555-8555-555555555503`);
  await ctx.clearCookies();
  await p.locator('button:has-text("บันทึกว่าติดต่อแล้ว")').click();
  // Refused either by the proxy (redirect to login) or by the action's own check (message).
  await Promise.race([
    p.waitForURL(/\/staff\/login/, { timeout: 15000 }),
    p.locator('[role="alert"]:not(#__next-route-announcer__)').last().waitFor({ timeout: 15000 }),
  ]).catch(() => {});
  const refused = p.url().includes("/staff/login") || (await p.locator('[role="alert"]:not(#__next-route-announcer__)').last().innerText().catch(() => "")).includes("เข้าสู่ระบบ");
  ok(refused, `signed-out replay of a CRM action is refused (${p.url().includes("/staff/login") ? "redirected to login" : "action refused"})`);
  const st = execSync(`psql "${status.DB_URL}" -At -c "select status from public.enquiries where id = '55555555-5555-4555-8555-555555555503'"`, { encoding: "utf8" }).trim();
  ok(st === "new", "enquiry unchanged after signed-out replay");

  // Public HTML never contains seeded customer data
  const pub = await browser.newContext();
  let found = [];
  for (const path of PUBLIC) {
    const html = await (await pub.request.get(B + path)).text();
    for (const needle of ["สมมติ ใจดี", "0800000101", "CK-261001-DEM1", "DEMO-POL-0001"]) if (html.includes(needle)) found.push(`${needle} in ${path}`);
  }
  ok(found.length === 0, "public pages contain no customer records");
  await pub.close();
  await ctx.close();
  await admin.ctx.close();
}

await browser.close();
console.log(`\n${failures ? `${failures} check(s) FAILED` : "All checks passed"}${warnings.length ? `, ${warnings.length} warning(s)` : ""}`);
process.exit(failures ? 1 : 0);
