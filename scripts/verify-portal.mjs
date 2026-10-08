#!/usr/bin/env node
/**
 * End-to-end checks for the customer portal against a LOCAL Supabase stack
 * (with Mailpit for auth emails). Covers: header navigation (desktop and
 * mobile), a staff invitation through to a linked login, password recovery,
 * logout, renewal requests, documents, and that customer A can never reach
 * customer B's data or any staff page, action or table. It changes data, so
 * it refuses non-local Supabase and expects a fresh `npx supabase db reset`.
 *
 *   npx supabase db reset && npm run build && npm start
 *   BASE_URL=http://localhost:3000 node scripts/verify-portal.mjs
 *
 * The app must run on the URL in supabase/config.toml `site_url`
 * (http://localhost:3000), because email links point there.
 * Needs Playwright (Chromium). Set PLAYWRIGHT_MODULE if it is not resolvable.
 */
import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const B = process.env.BASE_URL ?? "http://localhost:3000";
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error("Refusing to run against a non-local Supabase");
const MAIL = status.MAILPIT_URL ?? status.INBUCKET_URL;
const PASSWORD = "checkkhum-local-only";
const LINE_URL = "https://lin.ee/86TezJV";
const sql = (q) => execFileSync("psql", [status.DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();

const POLICY_A = "77777777-7777-4777-8777-777777777701";
const POLICY_B = "77777777-7777-4777-8777-777777777706";
const CUSTOMER_A = "33333333-3333-4333-8333-333333333301";
const CUSTOMER_B = "33333333-3333-4333-8333-333333333302";
const CUSTOMER_NEW = "33333333-3333-4333-8333-333333333303"; // ทดลอง เที่ยวไกล, no login yet
const NEW_EMAIL = "new-customer@checkkhum.example";

async function waitForApi() {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${status.API_URL}/rest/v1/`, { headers: { apikey: status.PUBLISHABLE_KEY } }).catch(() => null);
    if (r && r.status < 500) return;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("Supabase Data API is not responding");
}
await waitForApi();

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token(email, password = PASSWORD) {
  const r = await fetch(`${status.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: status.PUBLISHABLE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return (await r.json()).access_token;
}
async function rest(path, jwt, init = {}) {
  const r = await fetch(`${status.API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: status.PUBLISHABLE_KEY,
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      "content-type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function storage(path, jwt, init = {}) {
  const r = await fetch(`${status.API_URL}/storage/v1/${path}`, {
    ...init,
    headers: { apikey: status.PUBLISHABLE_KEY, ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}), "content-type": "application/json", ...init.headers },
  });
  return { status: r.status, body: await r.text() };
}

/** Latest auth email to `to` that links to /customer/auth/confirm. */
async function mailLink(to, sinceCount = 0) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const list = (await r.json()).messages ?? [];
    if (list.length > sinceCount) {
      const msg = await (await fetch(`${MAIL}/api/v1/message/${list[0].ID}`)).json();
      const m = (msg.HTML ?? "").match(/href="([^"]*\/customer\/auth\/confirm[^"]*)"/);
      if (m) return { url: m[1].replaceAll("&amp;", "&"), count: list.length, subject: msg.Subject };
    }
    await sleep(500);
  }
  return null;
}
const mailCount = async (to) =>
  ((await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()).messages ?? []).length;

const ALERT = '[role="alert"]:not(#__next-route-announcer__)';
const browser = await chromium.launch();
const pageErrors = [];
async function newPage(width = 1366) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => pageErrors.push(e.message));
  return { ctx, p };
}
async function customerLogin(email, password = PASSWORD, width = 1366) {
  const s = await newPage(width);
  await s.p.goto(`${B}/customer/login`);
  await s.p.fill("#email", email);
  await s.p.fill("#password", password);
  await s.p.click("main form button[type=submit]");
  await s.p.waitForLoadState("networkidle");
  return s;
}
async function staffLogin(email) {
  const s = await newPage();
  await s.p.goto(`${B}/staff/login`);
  await s.p.fill("#email", email);
  await s.p.fill("#password", PASSWORD);
  await s.p.click("main form button[type=submit]");
  await s.p.waitForLoadState("networkidle");
  return s;
}
const pdf = (label) => ({
  name: `${label}.pdf`,
  mimeType: "application/pdf",
  buffer: Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`),
});

await fetch(`${MAIL}/api/v1/messages`, { method: "DELETE" });

// ===========================================================================
console.log("\n# Public navigation: no customer login, discreet staff link");
{
  const { ctx, p } = await newPage(1366);
  await p.goto(B);
  ok(await p.getByRole("link", { name: "ขอใบเสนอราคา" }).first().isVisible(), "desktop: quote button in header");
  const header = p.locator("header").first();
  ok((await header.getByRole("button", { name: "เข้าสู่ระบบ" }).count()) === 0 && (await header.getByRole("link", { name: /เข้าสู่ระบบ|สมัคร|บัญชีของฉัน/ }).count()) === 0,
    "desktop header: no login, registration or account links");
  const footer = p.locator("footer");
  ok((await footer.locator('a[href^="/customer"]').count()) === 0, "footer: no customer portal links");
  const staffLink = footer.getByRole("link", { name: "สำหรับเจ้าหน้าที่", exact: true });
  ok((await staffLink.getAttribute("href")) === "/staff/login" && (await staffLink.getAttribute("rel")) === "nofollow", "footer: สำหรับเจ้าหน้าที่ → /staff/login (nofollow)");
  await p.screenshot({ path: "/tmp/portal-header-desktop.png" });
  await ctx.close();

  const m = await newPage(390);
  await m.p.goto(B);
  await m.p.getByRole("button", { name: "เมนู" }).click();
  const nav = m.p.getByRole("navigation", { name: "เมนูหลัก" });
  await nav.getByRole("link").first().waitFor({ state: "visible" });
  ok((await nav.locator('a[href^="/customer"], a[href^="/staff"]').count()) === 0, "mobile menu: no customer or staff login links");
  ok((await m.p.evaluate(() => document.documentElement.scrollWidth)) <= 390, "mobile: no horizontal scroll with menu open");
  await m.p.screenshot({ path: "/tmp/portal-menu-mobile.png" });
  await m.ctx.close();

  // Existing accounts keep working: the portal pages are still there, just not linked.
  const login = await fetch(`${B}/customer/login`);
  ok(login.status === 200, "/customer/login still serves existing customers");

  const r = await fetch(`${B}/api/account`);
  ok((await r.json()).state === "signed_out" && /no-store/.test(r.headers.get("cache-control") ?? ""), "/api/account: signed_out, not cached");
}

// ===========================================================================
console.log("\n# Anonymous visitors");
{
  for (const path of ["/customer", "/customer/set-password"]) {
    const r = await fetch(`${B}${path}`, { redirect: "manual" });
    ok(r.status === 307 && r.headers.get("location")?.endsWith("/customer/login"), `${path} redirects to /customer/login`);
  }
  const anonDocs = await rest("policy_documents?select=id", null);
  ok(anonDocs.status === 401 || (Array.isArray(anonDocs.body) && anonDocs.body.length === 0), "anon REST: no documents");
  const anonRpc = await rest("rpc/portal_overview", null, { method: "POST", body: "{}" });
  ok(anonRpc.status === 401 || anonRpc.status === 403 || anonRpc.status === 404, `anon cannot call portal_overview (HTTP ${anonRpc.status})`);
  const anonList = await storage("object/list/policy-documents", null, { method: "POST", body: JSON.stringify({ prefix: POLICY_A }) });
  ok(anonList.status >= 400 || anonList.body === "[]", "anon storage: cannot list documents");
}

// ===========================================================================
console.log("\n# Staff: existing CRM still works, upload and approve documents");
const agent = await staffLogin("agent@checkkhum.example");
ok(agent.p.url() === `${B}/staff`, "agent signs in to /staff");
ok(await agent.p.getByRole("heading", { level: 1 }).isVisible(), "staff dashboard renders");
async function upload(policyId, title, visible) {
  await agent.p.goto(`${B}/staff/policies/${policyId}`);
  const form = agent.p.locator("form", { has: agent.p.locator("#doc-file") });
  await form.locator("#doc-kind").selectOption("policy");
  await form.locator("#doc-title").fill(title);
  await form.locator("#doc-file").setInputFiles(pdf(title));
  if (visible) await form.locator("input[name=visible_to_customer]").check();
  await form.getByRole("button", { name: "อัปโหลด" }).click();
  await form.locator('[role="status"]').waitFor({ timeout: 15000 });
  return sql(`select id from public.policy_documents where title = '${title}'`);
}
const DOC_A = await upload(POLICY_A, "เอกสาร A อนุมัติ", true);
const DOC_A_DRAFT = await upload(POLICY_A, "เอกสาร A ร่าง", false);
const DOC_B = await upload(POLICY_B, "เอกสาร B อนุมัติ", true);
ok(DOC_A && DOC_A_DRAFT && DOC_B, "agent uploaded 3 documents through the policy page");
ok(sql(`select count(*) from storage.objects where bucket_id = 'policy-documents'`) === "3", "files stored in the private bucket");
ok(sql(`select approved_by from public.policy_documents where id = '${DOC_A}'`) === "11111111-1111-4111-8111-111111111102", "approval stamped with the agent");
{
  // A disguised file is rejected (type sniffed from content, not the name).
  const form = agent.p.locator("form", { has: agent.p.locator("#doc-file") });
  await form.locator("#doc-title").fill("ไม่ใช่ PDF");
  await form.locator("#doc-file").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("<html>not a pdf</html>") });
  await form.getByRole("button", { name: "อัปโหลด" }).click();
  await form.locator(ALERT).waitFor();
  ok((await form.locator(ALERT).innerText()).includes("PDF, JPG หรือ PNG"), "non-PDF content renamed .pdf is refused");
}
const viewer = await staffLogin("viewer@checkkhum.example");
await viewer.p.goto(`${B}/staff/policies/${POLICY_A}`);
ok((await viewer.p.locator("#doc-file").count()) === 0, "viewer sees no upload form");
ok((await viewer.p.getByRole("link", { name: /เอกสาร A ร่าง/ }).count()) === 1, "viewer can see the document list");
await viewer.ctx.close();

// ===========================================================================
console.log("\n# Staff invites an existing CRM customer");
await agent.p.goto(`${B}/staff/customers/${CUSTOMER_NEW}`);
{
  const form = agent.p.locator("form", { has: agent.p.locator("#invite-email") });
  await form.locator("#invite-email").fill(NEW_EMAIL);
  await form.getByRole("button", { name: "ส่งคำเชิญ" }).click();
  await form.locator('[role="status"]').waitFor({ timeout: 15000 });
  ok((await form.locator('[role="status"]').innerText()).includes(NEW_EMAIL), "invite sent message shown to staff");
  ok(sql(`select count(*) from public.customer_invitations where customer_id = '${CUSTOMER_NEW}' and email = '${NEW_EMAIL}' and accepted_at is null`) === "1",
    "invitation recorded for the chosen customer");
  ok(sql(`select count(*) from public.customer_accounts where customer_id = '${CUSTOMER_NEW}'`) === "0", "not linked before the customer verifies");
  // Staff email can't be invited as a customer.
  await agent.p.reload();
  const f2 = agent.p.locator("form", { has: agent.p.locator("#invite-email") });
  await f2.locator("#invite-email").fill("viewer@checkkhum.example");
  await f2.getByRole("button", { name: /ส่งคำเชิญ/ }).click();
  await f2.locator(ALERT).waitFor();
  ok((await f2.locator(ALERT).innerText()).includes("บัญชีเจ้าหน้าที่"), "staff email cannot be invited as a customer");
}
const invite = await mailLink(NEW_EMAIL);
ok(invite && invite.url.includes("type=invite") && invite.url.startsWith(B), `invitation email delivered with a token_hash link (${invite?.subject})`);

console.log("\n# Customer accepts the invitation");
let newCustomerPassword = "ลองรหัสผ่านใหม่-2569";
{
  const { ctx, p } = await newPage(390);
  await p.goto(invite.url);
  await p.waitForURL(/\/customer\/set-password\?mode=invite/);
  ok(true, "invite link verified on the server and opened set-password");
  ok((await p.locator("h1").innerText()).includes("ยินดีต้อนรับ"), "welcome heading for invited customer");
  await p.fill("#password", "รหัสผ่านไม่ตรงกัน-1");
  await p.fill("#confirm", "รหัสผ่านไม่ตรงกัน-2");
  await p.click("main form button[type=submit]");
  await p.locator(ALERT).waitFor();
  const describedBy = await p.locator("#confirm").getAttribute("aria-describedby");
  ok((await p.locator("#confirm").getAttribute("aria-invalid")) === "true" && !!describedBy && (await p.locator(`[id="${describedBy}"]`).innerText()).includes("ไม่ตรงกัน"),
    "mismatched passwords: field marked invalid and tied to the error text");
  await p.fill("#password", newCustomerPassword);
  await p.fill("#confirm", newCustomerPassword);
  await p.click("main form button[type=submit]");
  await p.waitForURL(`${B}/customer?welcome=1`);
  ok((await p.locator("h1").innerText()).includes("ทดลอง เที่ยวไกล"), "linked to the invited customer record");
  ok(sql(`select count(*) from public.customer_accounts a join auth.users u on u.id = a.user_id where a.customer_id = '${CUSTOMER_NEW}' and u.email = '${NEW_EMAIL}' and u.email_confirmed_at is not null`) === "1",
    "account linked only after email verification");
  ok(sql(`select accepted_at is not null from public.customer_invitations where email = '${NEW_EMAIL}' and revoked_at is null`) === "t", "invitation marked accepted");
  const reuse = await newPage();
  await reuse.p.goto(invite.url);
  await reuse.p.waitForURL(/\/customer\/login\?error=link/);
  ok(true, "invitation link cannot be used twice");
  await reuse.ctx.close();

  // Signing out happens on the dashboard (the portal is not in the public menu).
  await p.goto(`${B}/customer`);
  await p.getByRole("button", { name: "ออกจากระบบ" }).click();
  let after = "customer";
  for (let i = 0; i < 20 && after !== "signed_out"; i++) {
    await sleep(250);
    after = (await (await p.request.get(`${B}/api/account`)).json()).state;
  }
  ok(after === "signed_out", "ออกจากระบบ on the dashboard ends the session");
  await ctx.close();
}

console.log("\n# Password recovery");
{
  const before = await mailCount(NEW_EMAIL);
  const { ctx, p } = await newPage();
  await p.goto(`${B}/customer/forgot-password`);
  await p.fill("#email", NEW_EMAIL);
  await p.click("main form button[type=submit]");
  await p.locator('[role="status"]').waitFor();
  const unknownMsg = await (async () => {
    await p.fill("#email", "nobody@checkkhum.example");
    await p.click("main form button[type=submit]");
    await sleep(800);
    return p.locator('[role="status"]').innerText();
  })();
  ok(unknownMsg.includes("ถ้าอีเมลนี้มีบัญชี"), "same answer for unknown emails (no account discovery)");
  const reset = await mailLink(NEW_EMAIL, before);
  ok(reset && reset.url.includes("type=recovery"), "recovery email delivered");
  await p.goto(reset.url);
  await p.waitForURL(/\/customer\/set-password\?mode=recovery/);
  newCustomerPassword = "รหัสผ่านใหม่อีกครั้ง-2570";
  await p.fill("#password", newCustomerPassword);
  await p.fill("#confirm", newCustomerPassword);
  await p.click("main form button[type=submit]");
  await p.waitForURL(`${B}/customer?welcome=1`);
  ok((await p.locator("h1").innerText()).includes("ทดลอง เที่ยวไกล"), "after reset the customer is in their dashboard");
  await ctx.close();
  const old = await token(NEW_EMAIL, "ลองรหัสผ่านใหม่-2569");
  const fresh = await token(NEW_EMAIL, newCustomerPassword);
  ok(!old && !!fresh, "old password stops working, new password works");
}

// ===========================================================================
console.log("\n# Customer A: own data only");
const A = await customerLogin("customer-a@checkkhum.example");
ok(A.p.url() === `${B}/customer`, "customer A signs in to /customer");
{
  const p = A.p;
  ok((await p.locator("h1").innerText()).includes("สมมติ ใจดี"), "A sees own name");
  ok((await p.getByText("DEMO-POL-0001").count()) > 0, "A sees own policy");
  ok((await p.getByText("DEMO-POL-0006").count()) === 0, "A does not see B's policy");
  ok((await p.getByText("Toyota Yaris Ativ").count()) > 0, "insured vehicle shown");
  ok((await p.getByText("ครบกำหนดต่ออายุ").count()) > 0, "renewal date shown");
  ok((await p.getByText("ลูกค้าสมมติสำหรับทดสอบ").count()) === 0, "internal customer note not shown");
  ok((await p.getByText("เอกสาร A ร่าง").count()) === 0, "unapproved document not shown");
  const docLink = p.getByRole("link", { name: /เอกสาร A อนุมัติ/ });
  ok((await docLink.getAttribute("href")) === `/customer/documents/${DOC_A}`, "approved document listed");
  const line = p.locator(`a[href="${LINE_URL}"]`).first();
  ok((await line.getAttribute("target")) === "_blank" && (await line.getAttribute("rel")) === "noopener noreferrer", "LINE button opens our OA in a new tab");

  // A password session can't choose a new password without the old one.
  await p.goto(`${B}/customer/set-password`);
  ok(!p.url().includes("/customer/set-password"), "set-password refused for a normal password session");

  // Signed in, public pages still show no account menu.
  await p.goto(`${B}/car-insurance`);
  await p.locator("main").waitFor();
  ok((await p.locator("header").first().getByRole("button", { name: "บัญชีของฉัน" }).count()) === 0, "signed in: public header has no account menu");

  // Downloads.
  const own = await p.request.get(`${B}/customer/documents/${DOC_A}`, { maxRedirects: 0 });
  ok(own.status() === 307 && /\/storage\/v1\/object\/sign\//.test(own.headers().location ?? ""), "own document → short-lived signed URL");
  const file = await fetch(own.headers().location);
  ok(file.ok && (await file.text()).startsWith("%PDF"), "signed URL serves the PDF");
  for (const [id, label] of [[DOC_B, "B's document"], [DOC_A_DRAFT, "own unapproved document"], ["00000000-0000-4000-8000-000000000000", "unknown id"]]) {
    const r = await p.request.get(`${B}/customer/documents/${id}`, { maxRedirects: 0 });
    ok(r.status() === 404, `direct URL to ${label} → 404`);
  }

  // Renewal request.
  await p.goto(`${B}/customer`);
  const renewForm = p.locator("form", { has: p.getByRole("button", { name: "ขอใบเสนอราคาต่ออายุ" }) });
  await renewForm.getByRole("button", { name: "ขอใบเสนอราคาต่ออายุ" }).click();
  await p.getByText("ส่งคำขอต่ออายุแล้ว").first().waitFor();
  const ref = sql(`select reference from public.enquiries where renewal_policy_id = '${POLICY_A}'`);
  ok(/^CK-/.test(ref) && (await p.getByText(ref).count()) > 0, "renewal request created and shown with its reference");
  ok(sql(`select source || '/' || status from public.enquiries where reference = '${ref}'`) === "customer_portal/new", "renewal reaches the CRM pipeline as a new enquiry");
  await p.reload();
  ok((await p.getByRole("button", { name: "ขอใบเสนอราคาต่ออายุ" }).count()) === 0, "button replaced by the open request after reload");

  // Staff pages and staff routes refuse the customer.
  for (const path of ["/staff", `/staff/customers/${CUSTOMER_B}`, `/staff/policies/${POLICY_B}`, "/staff/admin", "/staff/reports"]) {
    await p.goto(`${B}${path}`);
    ok(/\/staff\/login\?error=not_staff/.test(p.url()), `customer opening ${path} is sent to staff login (not staff)`);
  }
  const staffDoc = await p.request.get(`${B}/staff/documents/${DOC_B}`, { maxRedirects: 0 });
  ok(staffDoc.status() === 307 && staffDoc.headers().location?.includes("/staff/login"), "staff document route refuses the customer");
}

console.log("\n# Customer A: database requests with A's own token");
{
  const jwt = await token("customer-a@checkkhum.example");
  for (const t of ["customers", "enquiries", "quotations", "policies", "vehicles", "follow_up_activities", "follow_up_tasks", "renewal_tasks", "staff_users", "staff_reminders", "consent_records", "audit_logs", "customer_invitations", "enquiry_status_history"]) {
    const r = await rest(`${t}?select=*`, jwt);
    ok(r.status === 200 && Array.isArray(r.body) && r.body.length === 0, `REST ${t}: no rows for a customer`);
  }
  const docs = await rest("policy_documents?select=id,policy_id", jwt);
  ok(docs.body?.length === 1 && docs.body[0].id === DOC_A, "REST policy_documents: only A's approved file");
  const acc = await rest("customer_accounts?select=customer_id", jwt);
  ok(acc.body?.length === 1 && acc.body[0].customer_id === CUSTOMER_A, "REST customer_accounts: only A's own link");
  const ov = await rest("rpc/portal_overview", jwt, { method: "POST", body: "{}" });
  ok(ov.body?.policies?.length === 1 && ov.body.policies[0].id === POLICY_A && !JSON.stringify(ov.body).includes("DEMO-POL-0006"), "RPC portal_overview: A's data only");
  const renewB = await rest("rpc/portal_request_renewal", jwt, { method: "POST", body: JSON.stringify({ p_policy_id: POLICY_B }) });
  ok(renewB.status >= 400, "RPC: A cannot request renewal of B's policy");
  const search = await rest("rpc/search_customers", jwt, { method: "POST", body: JSON.stringify({ p_query: "ตัวอย่าง" }) });
  ok(Array.isArray(search.body) && search.body.length === 0, "RPC search_customers: nothing for a customer");
  const report = await rest("rpc/crm_conversion_report", jwt, { method: "POST", body: JSON.stringify({ p_from: "2020-01-01", p_to: "2100-01-01" }) });
  ok(report.status >= 400 || (report.body?.enquiries === 0 && report.body?.policies === 0 && report.body?.by_source?.length === 0),
    "RPC crm_conversion_report: no figures for a customer");
  const job = await rest("rpc/run_renewal_job", jwt, { method: "POST", body: "{}" });
  ok(job.status >= 400, "RPC run_renewal_job refused");
  const ins = await rest("customer_accounts", jwt, { method: "POST", body: JSON.stringify({ user_id: "11111111-1111-4111-8111-111111111201", customer_id: CUSTOMER_B }) });
  ok(ins.status >= 400, "A cannot link itself to customer B");
  const approve = await rest(`policy_documents?id=eq.${DOC_A_DRAFT}`, jwt, { method: "PATCH", body: JSON.stringify({ visible_to_customer: true }) });
  ok(Array.isArray(approve.body) ? approve.body.length === 0 : approve.status >= 400, "A cannot approve its own draft");
  const pathB = sql(`select storage_path from public.policy_documents where id = '${DOC_B}'`);
  const pathDraft = sql(`select storage_path from public.policy_documents where id = '${DOC_A_DRAFT}'`);
  const signB = await storage(`object/sign/policy-documents/${pathB}`, jwt, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) });
  ok(signB.status >= 400, "storage: A cannot sign B's file");
  const getB = await storage(`object/authenticated/policy-documents/${pathB}`, jwt);
  ok(getB.status >= 400, "storage: A cannot download B's file");
  const getDraft = await storage(`object/authenticated/policy-documents/${pathDraft}`, jwt);
  ok(getDraft.status >= 400, "storage: A cannot download its unapproved file");
  const listB = await storage("object/list/policy-documents", jwt, { method: "POST", body: JSON.stringify({ prefix: `${POLICY_B}/` }) });
  ok(listB.body === "[]", "storage: A cannot list B's folder");
  const up = await storage(`object/policy-documents/${POLICY_A}/00000000-0000-4000-8000-000000000001.pdf`, jwt, {
    method: "POST",
    headers: { "content-type": "application/pdf" },
    body: "%PDF-1.4 fake",
  });
  ok(up.status >= 400, "storage: A cannot upload files");
}

console.log("\n# Customer A: staff server actions refuse a customer session");
{
  // Render the agent's forms, then swap the browser's session to customer A
  // and submit: the server action must refuse and change nothing.
  const custCookies = await A.ctx.cookies();
  await agent.p.goto(`${B}/staff/customers/33333333-3333-4333-8333-333333333304`); // not linked: invite form shown
  await agent.ctx.clearCookies();
  await agent.ctx.addCookies(custCookies);
  const before = sql(`select count(*) from public.customer_invitations`);
  const form = agent.p.locator("form", { has: agent.p.locator("#invite-email") });
  await form.locator("#invite-email").fill("attacker@checkkhum.example");
  await form.getByRole("button", { name: /ส่งคำเชิญ/ }).click();
  await form.locator(ALERT).waitFor();
  ok((await form.locator(ALERT).innerText()).includes("กรุณาเข้าสู่ระบบอีกครั้ง"), "inviteCustomer action refuses a customer session");
  ok(sql(`select count(*) from public.customer_invitations`) === before, "no invitation created");

  await agent.ctx.clearCookies();
  await agent.p.goto(`${B}/staff/login`);
  await agent.p.fill("#email", "agent@checkkhum.example");
  await agent.p.fill("#password", PASSWORD);
  await agent.p.click("main form button[type=submit]");
  await agent.p.waitForURL(`${B}/staff`);
  await agent.p.goto(`${B}/staff/policies/${POLICY_A}`);
  await agent.ctx.clearCookies();
  await agent.ctx.addCookies(custCookies);
  const draftRow = agent.p.locator("li", { has: agent.p.getByRole("link", { name: /เอกสาร A ร่าง/ }) });
  await draftRow.getByRole("button", { name: "อนุมัติให้ลูกค้าเห็น" }).click();
  await draftRow.locator(ALERT).waitFor();
  ok(sql(`select visible_to_customer from public.policy_documents where id = '${DOC_A_DRAFT}'`) === "f", "setDocumentVisibility refuses a customer session");
}
await agent.ctx.close();
await A.ctx.close();

// ===========================================================================
console.log("\n# Customer B and an unlinked login");
{
  const Bc = await customerLogin("customer-b@checkkhum.example", PASSWORD, 390);
  ok((await Bc.p.locator("h1").innerText()).includes("ตัวอย่าง รักษ์รถ"), "B sees own dashboard (mobile)");
  ok((await Bc.p.getByText("DEMO-POL-0001").count()) === 0 && (await Bc.p.getByText("เอกสาร A").count()) === 0, "B sees none of A's data");
  ok((await Bc.p.evaluate(() => document.documentElement.scrollWidth)) <= 390, "portal: no horizontal scroll at 390px");
  await Bc.p.screenshot({ path: "/tmp/portal-mobile.png", fullPage: true });
  const r = await Bc.p.request.get(`${B}/customer/documents/${DOC_A}`, { maxRedirects: 0 });
  ok(r.status() === 404, "B opening A's document URL → 404");
  await Bc.ctx.close();

  const out = await customerLogin("outsider@checkkhum.example");
  ok((await out.p.locator("h1").innerText()).includes("ยินดีต้อนรับ") && (await out.p.getByText("ยังไม่มีกรมธรรม์ในบัญชีนี้").count()) === 1,
    "unlinked login: helpful empty state");
  ok((await out.p.locator(`a[href="${LINE_URL}"]`).count()) > 0, "unlinked login: LINE contact button");
  ok(sql(`select count(*) from public.customer_accounts where user_id = '11111111-1111-4111-8111-111111111105'`) === "0", "unlinked login is not linked by typing an email");
  await out.ctx.close();
}

console.log("\n# Staff and customer logins stay separate");
{
  const s = await customerLogin("admin@checkkhum.example");
  ok(s.p.url() === `${B}/staff`, "staff signing in on the customer page goes to /staff");
  await s.p.goto(`${B}/customer`);
  ok(s.p.url() === `${B}/staff`, "staff opening /customer are sent to /staff");
  const acct = await (await s.p.request.get(`${B}/api/account`)).json();
  ok(acct.state === "staff", "/api/account reports staff");
  await s.ctx.close();
}

// ===========================================================================
console.log("\n# Self-registration");
const REG_A = "reg-a@checkkhum.example";
const REG_B = "reg-b@checkkhum.example";
const REG_CLAIM = "claim-attempt@checkkhum.example";
const REG_PASSWORD = "สมัครเองรหัสผ่าน-2569";
/** All verification links sent to `to`, newest first. */
async function allMailLinks(to) {
  const list = (await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()).messages ?? [];
  const links = [];
  for (const m of list) {
    const msg = await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json();
    const found = (msg.HTML ?? "").match(/href="([^"]*\/customer\/auth\/confirm[^"]*)"/);
    if (found) links.push({ url: found[1].replaceAll("&amp;", "&"), subject: msg.Subject });
  }
  return links;
}
async function waitForMails(to, n) {
  for (let i = 0; i < 40; i++) {
    const links = await allMailLinks(to);
    if (links.length >= n) return links;
    await sleep(500);
  }
  return allMailLinks(to);
}
async function register(p, { name, email, password = REG_PASSWORD, confirm = password, privacy = true }) {
  await p.goto(`${B}/customer/register`);
  await p.fill("#full_name", name);
  await p.fill("#email", email);
  await p.fill("#password", password);
  await p.fill("#confirm", confirm);
  if (privacy) await p.check("#privacy");
  await p.locator("main form").getByRole("button", { name: "สมัครสมาชิก" }).click();
}
const staffBefore = sql("select count(*) from public.staff_users");
{
  const { ctx, p } = await newPage(390);
  await p.goto(`${B}/customer/login`);
  const regLink = p.locator("main").getByRole("link", { name: "สมัครสมาชิก" });
  ok((await regLink.getAttribute("href")) === "/customer/register" && (await p.getByText("ยังไม่มีบัญชี?").count()) === 1,
    "login page: “ยังไม่มีบัญชี? สมัครสมาชิก” links to /customer/register");
  ok((await p.getByText("ขอให้ทีมงานส่งคำเชิญ").count()) === 0, "invitation-only message removed");
  await regLink.click();
  await p.waitForURL(`${B}/customer/register`);
  ok((await p.locator("h1").innerText()) === "สมัครสมาชิก", "register page opens");
  ok((await p.locator("main").getByRole("link", { name: "เข้าสู่ระบบ" }).getAttribute("href")) === "/customer/login", "register page links back to login");
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, "register page: no horizontal scroll at 390px");
  await p.screenshot({ path: "/tmp/register-mobile.png", fullPage: true });

  // Validation: kept values, field errors tied to fields.
  await register(p, { name: "ทดสอบ สมัครเอ", email: REG_A, password: "short", confirm: "other", privacy: false });
  await p.locator("main [role=alert]").waitFor();
  ok((await p.inputValue("#full_name")) === "ทดสอบ สมัครเอ" && (await p.inputValue("#email")) === REG_A, "name and email kept after a validation error");
  ok((await p.locator("#password").getAttribute("aria-invalid")) === "true" && (await p.locator("#password-error").innerText()).includes("10 ตัวอักษร"),
    "short password: error tied to the field");
  ok((await p.locator("#confirm-error").innerText()).includes("ไม่ตรงกัน"), "mismatched confirmation reported");
  ok((await p.locator("#privacy-error").innerText()).includes("ประกาศความเป็นส่วนตัว"), "privacy acknowledgement required");
  ok(sql(`select count(*) from auth.users where email = '${REG_A}'`) === "0", "nothing created on a validation error");

  // Successful registration.
  await register(p, { name: "ทดสอบ สมัครเอ", email: REG_A });
  await p.getByText("ตรวจอีเมลเพื่อยืนยันการสมัคร").waitFor();
  ok((await p.locator("[role=status]").first().innerText()).includes(REG_A), "Thai confirmation message names the email");
  ok(sql(`select (email_confirmed_at is null)::text from auth.users where email = '${REG_A}'`) === "true", "login created, email not yet verified");
  ok(sql(`select source || '/' || full_name || '/' || (privacy_acknowledged_at is not null) from public.customer_profiles p join auth.users u on u.id = p.user_id where u.email = '${REG_A}'`) === "self_registration/ทดสอบ สมัครเอ/true",
    "customer profile created with name and privacy acknowledgement");
  const first = await waitForMails(REG_A, 1);
  ok(first.length === 1 && first[0].url.includes("type=email"), `verification email sent (${first[0]?.subject})`);

  // Sign-in before verifying is refused with a clear message.
  const early = await customerLogin(REG_A, REG_PASSWORD);
  ok((await early.p.locator("main [role=alert]").innerText()).includes("ยังไม่ได้ยืนยันอีเมล"), "login before verification: clear Thai message");
  await early.ctx.close();

  // Resend, then the old link no longer works and the new one does.
  await p.getByRole("button", { name: "ส่งอีเมลยืนยันอีกครั้ง" }).click();
  await p.locator("main form [role=status]").waitFor();
  const both = await waitForMails(REG_A, 2);
  ok(both.length === 2, "verification email resent");
  await p.goto(both[1].url); // the older link
  await p.waitForURL(/\/customer\/verify-email\?error=expired/);
  ok((await p.locator("[role=alert]").first().innerText()).includes("หมดอายุ"), "superseded/expired link: Thai message and resend form");
  await p.goto(both[0].url);
  await p.waitForURL(`${B}/customer?verified=1`);
  ok((await p.locator("h1").innerText()).includes("ยินดีต้อนรับ คุณทดสอบ สมัครเอ"), "verified: signed in to the new-customer dashboard");
  ok((await p.getByText("ยืนยันอีเมลแล้ว").count()) === 1, "verified message shown");
  ok((await p.locator("section", { has: p.locator("#start-title") }).getByRole("link", { name: "ขอใบเสนอราคา" }).getAttribute("href")) === "/quote", "dashboard: ขอใบเสนอราคา button");
  ok((await p.getByText("ยังไม่มีกรมธรรม์ในบัญชีนี้").count()) === 1, "dashboard: helpful empty state for policies");
  await p.screenshot({ path: "/tmp/new-customer-mobile.png", fullPage: true });
  await p.goto(both[0].url);
  await p.waitForURL(/\/customer\/verify-email\?error=expired/);
  ok(true, "a verification link works only once");
  await ctx.close();
}
{
  // Existing account.
  const { ctx, p } = await newPage();
  await register(p, { name: "ซ้ำ", email: REG_A });
  await p.locator("#email-error").waitFor();
  ok((await p.locator("main [role=alert]").innerText()).includes("มีบัญชีอยู่แล้ว"), "existing account: Thai message");
  await register(p, { name: "ซ้ำ", email: "agent@checkkhum.example" });
  await p.locator("#email-error").waitFor();
  ok(sql("select count(*) from public.staff_users") === staffBefore, "staff email: no new account, staff unchanged");
  await ctx.close();
}

console.log("\n# Registered customer: login, quotation, isolation");
const regA = await customerLogin(REG_A, REG_PASSWORD);
ok(regA.p.url() === `${B}/customer`, "registered customer logs in with email and password");
const regAId = sql(`select id from auth.users where email = '${REG_A}'`);
let quoteRef;
{
  const p = regA.p;
  await p.goto(`${B}/quote?plan=car-1`);
  const form = p.locator("main form").first();
  await form.getByLabel("ยี่ห้อรถ").fill("Mazda");
  await form.getByLabel("รุ่นรถ").fill("2");
  await form.getByLabel("ปีรถ (พ.ศ.)").selectOption("2021");
  await form.getByLabel("ชื่อที่ให้เราเรียก").fill("ทดสอบ สมัครเอ");
  await form.getByLabel("เบอร์โทรศัพท์").fill("0899990111");
  await sleep(3000); // the form's minimum fill time
  await form.getByRole("button", { name: "ขอใบเสนอราคา" }).click();
  await p.getByTestId("enquiry-reference").waitFor({ timeout: 15000 });
  quoteRef = (await p.getByTestId("enquiry-reference").innerText()).trim();
  ok(/^CK-/.test(quoteRef), `quotation submitted while signed in (${quoteRef})`);
  ok(sql(`select submitted_by_user_id from public.enquiries where reference = '${quoteRef}'`) === regAId, "enquiry attributed to the signed-in customer");
  ok(sql(`select status || '/' || source from public.enquiries where reference = '${quoteRef}'`) === "new/web_quote_form", "it reaches the CRM pipeline as a new web enquiry");
  await p.goto(`${B}/customer`);
  ok((await p.getByText(`เลขอ้างอิง ${quoteRef}`).count()) === 1, "the request and its status appear in the dashboard");
  for (const path of ["/staff", "/staff/customers", "/staff/admin"]) {
    await p.goto(`${B}${path}`);
    ok(/\/staff\/login\?error=not_staff/.test(p.url()), `registered customer refused at ${path}`);
  }
}
// A second registered account (verified directly through its email link).
{
  const { ctx, p } = await newPage();
  await register(p, { name: "ทดสอบ สมัครบี", email: REG_B });
  await p.getByText("ตรวจอีเมลเพื่อยืนยันการสมัคร").waitFor();
  const [link] = await waitForMails(REG_B, 1);
  await p.goto(link.url);
  await p.waitForURL(`${B}/customer?verified=1`);
  ok((await p.getByText(quoteRef).count()) === 0, "customer B does not see A's request");
  await ctx.close();
}
{
  const jwtA = await token(REG_A, REG_PASSWORD);
  const jwtB = await token(REG_B, REG_PASSWORD);
  const profA = await rest("customer_profiles?select=user_id,full_name", jwtA);
  ok(profA.body?.length === 1 && profA.body[0].user_id === regAId, "REST: A reads only its own profile");
  const renameB = await rest(`customer_profiles?user_id=eq.${regAId}`, jwtB, { method: "PATCH", body: JSON.stringify({ full_name: "แฮก" }) });
  ok(Array.isArray(renameB.body) && renameB.body.length === 0, "REST: B cannot rename A");
  const enqB = await rest("enquiries?select=reference", jwtB);
  ok(Array.isArray(enqB.body) && enqB.body.length === 0, "REST: B reads no enquiries table rows");
  const ovB = await rest("rpc/portal_overview", jwtB, { method: "POST", body: "{}" });
  ok(ovB.body?.linked === false && ovB.body.enquiries.length === 0, "RPC: B's overview has none of A's requests");
  const ovA = await rest("rpc/portal_overview", jwtA, { method: "POST", body: "{}" });
  ok(ovA.body?.enquiries?.some((e) => e.reference === quoteRef) && ovA.body.policies.length === 0, "RPC: A sees its request and no policies");
  for (const [jwt, who] of [[jwtA, "A"], [jwtB, "B"]]) {
    const staffRows = await rest("staff_users?select=id", jwt);
    const custRows = await rest("customers?select=id", jwt);
    const docRows = await rest("policy_documents?select=id", jwt);
    ok([staffRows, custRows, docRows].every((r) => Array.isArray(r.body) && r.body.length === 0), `REST: registered ${who} reads no staff, customers or documents`);
    const mkStaff = await rest("staff_users", jwt, { method: "POST", body: JSON.stringify({ id: regAId, email: REG_A, full_name: "x", role: "admin" }) });
    ok(mkStaff.status >= 400, `REST: registered ${who} cannot create a staff row`);
    const mkProfile = await rest("customer_profiles", jwt, { method: "POST", body: JSON.stringify({ user_id: regAId, full_name: "x", email: "x", source: "other" }) });
    ok(mkProfile.status >= 400, `REST: registered ${who} cannot insert profiles`);
    const attach = await rest("rpc/record_enquiry_submitter", jwt, { method: "POST", body: JSON.stringify({ p_reference: "CK-261001-DEM1", p_user: regAId }) });
    ok(attach.status >= 400, `RPC: registered ${who} cannot attach enquiries`);
  }
  ok(sql("select count(*) from public.staff_users") === staffBefore, "public registration created no staff_users rows");
  ok(sql(`select count(*) from public.customer_profiles p join public.staff_users s on s.id = p.user_id`) === "0", "no staff login has a customer profile");
  ok(sql(`select count(*) from public.customer_profiles where user_id = '${regAId}'`) === "1", "exactly one profile per registered login");
}
await regA.ctx.close();

console.log("\n# Registration never claims existing records; staff invitation still does");
{
  // An existing CRM customer with policies, whose email someone registers with.
  sql(`update public.customers set email = '${REG_CLAIM}' where id = '33333333-3333-4333-8333-333333333305'`);
  const { ctx, p } = await newPage();
  await register(p, { name: "คนที่อ้างเป็นลูกค้า", email: REG_CLAIM });
  await p.getByText("ตรวจอีเมลเพื่อยืนยันการสมัคร").waitFor();
  const [link] = await waitForMails(REG_CLAIM, 1);
  await p.goto(link.url);
  await p.waitForURL(`${B}/customer?verified=1`);
  ok((await p.getByText("DEMO-POL-0003").count()) === 0, "verified email matching a CRM customer does NOT reveal their policy");
  ok(sql(`select count(*) from public.customer_accounts a join auth.users u on u.id = a.user_id where u.email = '${REG_CLAIM}'`) === "0", "and is not linked");
  await ctx.close();

  // The staff-approved path: an agent invites that customer at that email.
  const ag = await staffLogin("agent@checkkhum.example");
  await ag.p.goto(`${B}/staff/customers`);
  const row = ag.p.locator("li", { hasText: REG_CLAIM });
  ok((await row.getByText("ยังไม่เชื่อมข้อมูล").count()) === 1, "CRM lists the self-registered account as not linked");
  await ag.p.goto(`${B}/staff/customers/33333333-3333-4333-8333-333333333305`);
  const form = ag.p.locator("form", { has: ag.p.locator("#invite-email") });
  await form.locator("#invite-email").fill(REG_CLAIM);
  await form.getByRole("button", { name: /ส่งคำเชิญ/ }).click();
  await form.locator('[role="status"]').waitFor({ timeout: 15000 });
  ok((await form.locator('[role="status"]').innerText()).includes("มีบัญชีอยู่แล้ว"), "inviting an existing (self-registered) login: clear message to staff");
  await ag.ctx.close();
  const c = await customerLogin(REG_CLAIM, REG_PASSWORD);
  ok((await c.p.getByText("DEMO-POL-0003").count()) === 1, "after the staff invitation the verified login sees that customer's policy");
  await c.ctx.close();
}

await browser.close();
ok(pageErrors.length === 0, `no browser errors (${pageErrors.length})`);
console.log(failures ? `\n${failures} check(s) failed` : "\nAll portal checks passed");
process.exit(failures ? 1 : 0);
