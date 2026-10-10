#!/usr/bin/env node
/**
 * End-to-end checks for the staff CRM against a LOCAL Supabase stack.
 * Covers unauthorized access at three layers (pages, server actions, database
 * API) and the main CRM flows. It changes data, so it refuses non-local
 * Supabase and expects a fresh `npx supabase db reset`.
 *
 *   npx supabase db reset && npm run build && npm start
 *   BASE_URL=http://localhost:3000 node scripts/verify-crm.mjs
 *
 * Needs Playwright (Chromium). Set PLAYWRIGHT_MODULE if it is not resolvable.
 */
import { execFileSync, execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const B = process.env.BASE_URL ?? "http://localhost:3000";
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error("Refusing to run against a non-local Supabase");
const PASSWORD = "checkkhum-local-only";
const sql = (q) => execFileSync("psql", [status.DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();

// After `supabase db reset` the Data API needs a moment to reconnect.
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
    headers: { apikey: status.PUBLISHABLE_KEY, Authorization: `Bearer ${jwt}`, "content-type": "application/json", Prefer: "return=representation", ...init.headers },
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}

// Next.js adds its own role="alert" route announcer; ignore it.
const ALERT = '[role="alert"]:not(#__next-route-announcer__)';
const browser = await chromium.launch();
const pageErrors = [];
async function login(email, password = PASSWORD) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => pageErrors.push(e.message));
  await p.goto(`${B}/staff/login`);
  await p.fill("#email", email);
  await p.fill("#password", password);
  await p.click("button[type=submit]");
  await p.waitForLoadState("networkidle");
  return { ctx, p };
}
/** For actions whose form disappears on success: click, then poll the database. */
async function clickUntil(locator, query, expected, timeoutMs = 15000) {
  await locator.click();
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (sql(query) === expected) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
/** Click a form's submit button and read that form's result message (scope defaults to the page). */
async function submitAndRead(p, locator, scope = p) {
  await locator.click();
  const msg = scope.locator(`${ALERT}, [role="status"]`).last();
  await msg.waitFor({ timeout: 15000 });
  await p.waitForTimeout(300);
  return (await msg.innerText()).trim();
}

// ===== 1. Signed-out visitors ===============================================
{
  const ctx = await browser.newContext();
  for (const path of ["/staff", "/staff/enquiries", "/staff/customers/33333333-3333-4333-8333-333333333301", "/staff/policies", "/staff/tasks", "/staff/reports", "/staff/admin", "/staff/account"]) {
    const res = await ctx.request.get(B + path, { maxRedirects: 0 });
    ok(res.status() === 307 && (res.headers().location ?? "").includes("/staff/login"), `signed out: ${path} redirects to login`);
  }
  await ctx.addCookies([{ name: "sb-127-auth-token", value: "base64-eyJmb3JnZWQiOnRydWV9", url: B }]);
  const res = await ctx.request.get(`${B}/staff`, { maxRedirects: 0 });
  ok(res.status() === 307, "forged session cookie is rejected");
  await ctx.close();
}

// ===== 2. Signed-in but not allowed ===========================================
for (const [email, label] of [["outsider@checkkhum.example", "user without a staff record"], ["former@checkkhum.example", "deactivated staff"]]) {
  const { ctx, p } = await login(email);
  ok(p.url().includes("/staff/login") && (await p.locator(ALERT).first().innerText()).includes("ไม่มีสิทธิ์"), `${label} cannot sign in to the CRM`);
  const res = await ctx.request.get(`${B}/staff/enquiries`, { maxRedirects: 0 });
  ok(res.status() === 307, `${label} has no session afterwards`);
  await ctx.close();
}
{
  const { ctx, p } = await login("agent@checkkhum.example", "wrong-password");
  ok((await p.locator(ALERT).first().innerText()).includes("ไม่ถูกต้อง"), "wrong password is rejected");
  await ctx.close();
}

// ===== 3. Viewer: read-only ===================================================
const viewer = await login("viewer@checkkhum.example");
ok(viewer.p.url() === `${B}/staff`, "viewer signs in");
await viewer.p.goto(`${B}/staff/enquiries/55555555-5555-4555-8555-555555555503`);
ok((await viewer.p.locator("text=บันทึกว่าติดต่อแล้ว").count()) === 0, "viewer sees no status buttons");
ok((await viewer.p.locator("text=เพิ่มใบเสนอราคา").count()) === 0, "viewer sees no quotation form");
ok((await viewer.p.locator('a[href="/staff/admin"]').count()) === 0, "viewer has no admin menu");
await viewer.p.goto(`${B}/staff/admin`);
ok(await viewer.p.locator("text=ไม่มีสิทธิ์เข้าถึงหน้านี้").isVisible(), "viewer gets 'no access' on the admin page");
ok((await viewer.p.locator("[data-staff]").count()) === 0, "admin page shows viewer no staff list");

// ===== 4. Server actions refuse the wrong role (cookie swap) ===================
const agent = await login("agent@checkkhum.example");
const admin = await login("admin@checkkhum.example");
const viewerCookies = await viewer.ctx.cookies();
const agentCookies = await agent.ctx.cookies();
{
  // Agent's page has the buttons; replay the action with the viewer's session.
  const { ctx, p } = await (async () => {
    const ctx = await browser.newContext();
    await ctx.addCookies(agentCookies);
    const p = await ctx.newPage();
    await p.goto(`${B}/staff/enquiries/55555555-5555-4555-8555-555555555503`);
    return { ctx, p };
  })();
  await ctx.clearCookies();
  await ctx.addCookies(viewerCookies);
  const msg = await submitAndRead(p, p.locator('button:has-text("บันทึกว่าติดต่อแล้ว")'));
  ok(msg.includes("ดูข้อมูลได้อย่างเดียว"), `viewer session: status-change action refused ("${msg}")`);
  ok(sql("select status from public.enquiries where id = '55555555-5555-4555-8555-555555555503'") === "new", "enquiry unchanged");
  await ctx.close();
}
{
  const ctx = await browser.newContext();
  await ctx.addCookies(await admin.ctx.cookies());
  const p = await ctx.newPage();
  await p.goto(`${B}/staff/admin`);
  await ctx.clearCookies();
  await ctx.addCookies(agentCookies);
  const runsBefore = sql("select count(*) from public.renewal_job_runs");
  const msg = await submitAndRead(p, p.locator('button:has-text("ทำงานตอนนี้")'));
  ok(msg.includes("เฉพาะผู้ดูแลระบบ"), `agent session: run-job action refused ("${msg}")`);
  ok(sql("select count(*) from public.renewal_job_runs") === runsBefore, "no job run recorded");
  const row = p.locator('[data-staff="agent@checkkhum.example"]');
  await row.locator("select").selectOption("admin");
  const msg2 = await submitAndRead(p, row.locator('button:has-text("บันทึก")'));
  ok(msg2.includes("เฉพาะผู้ดูแลระบบ"), "agent session: cannot promote self to admin");
  ok(sql("select role from public.staff_users where email = 'agent@checkkhum.example'") === "agent", "agent role unchanged");
  await ctx.close();
}

// ===== 5. Database API with real staff tokens ===================================
{
  const vt = await token("viewer@checkkhum.example");
  const at = await token("agent@checkkhum.example");
  const ot = await token("outsider@checkkhum.example");
  let r = await rest("enquiries?id=eq.55555555-5555-4555-8555-555555555503", vt, { method: "PATCH", body: JSON.stringify({ status: "contacted" }) });
  ok(Array.isArray(r.body) && r.body.length === 0, `viewer token: PATCH enquiry changes nothing (${r.status})`);
  r = await rest("follow_up_tasks", vt, { method: "POST", body: JSON.stringify({ customer_id: "33333333-3333-4333-8333-333333333301", title: "x", due_date: "2026-12-01" }) });
  ok(r.status === 403, `viewer token: INSERT task forbidden (${r.status})`);
  r = await rest("rpc/run_renewal_job", vt, { method: "POST", body: "{}" });
  ok(r.status === 403, `viewer token: run_renewal_job forbidden (${r.status})`);
  r = await rest("customers?phone=eq.0800000104", at, { method: "DELETE" });
  ok(Array.isArray(r.body) && r.body.length === 0, "agent token: DELETE customer changes nothing");
  r = await rest("audit_logs?select=id&limit=1", at);
  ok(Array.isArray(r.body) && r.body.length === 0, "agent token: audit log not visible");
  r = await rest("renewal_job_runs?select=id", at);
  ok(Array.isArray(r.body) && r.body.length === 0, "agent token: job runs not visible");
  r = await rest("staff_users?id=eq.11111111-1111-4111-8111-111111111102", at, { method: "PATCH", body: JSON.stringify({ role: "admin" }) });
  ok(Array.isArray(r.body) && r.body.length === 0, "agent token: cannot promote self via API");
  r = await rest("customers?select=id", ot);
  ok(Array.isArray(r.body) && r.body.length === 0, "non-staff token: no customers");
  r = await rest("enquiries?id=eq.55555555-5555-4555-8555-555555555503", at, { method: "PATCH", body: JSON.stringify({ status: "won" }) });
  ok(r.status === 400 && /เปลี่ยนสถานะ/.test(r.body?.message ?? ""), "agent token: pipeline rules enforced by the database (new → won refused)");
}

// ===== 6. Agent: enquiry → quotations → policy ==================================
{
  const p = agent.p;
  await p.goto(`${B}/staff/enquiries/55555555-5555-4555-8555-555555555503`);
  const enqStatus = "select status from public.enquiries where id = '55555555-5555-4555-8555-555555555503'";
  ok(await clickUntil(p.locator('button:has-text("บันทึกว่าติดต่อแล้ว")'), enqStatus, "contacted"), "agent marks enquiry contacted");
  await p.reload();
  let msg;
  msg = await submitAndRead(p, p.locator('button:has-text("บันทึกว่าเสนอราคาแล้ว")'));
  ok(msg.includes("ใบเสนอราคา"), `"quoted" refused until a quotation is sent ("${msg}")`);

  for (const [premium, statusValue] of [["890", "draft"], ["950", "sent"]]) {
    await p.reload();
    const form = p.locator("[data-add-quotation]");
    await form.locator("#insurer_id").selectOption({ index: premium === "890" ? 1 : 2 });
    await form.locator("#premium").fill(premium);
    await form.locator("#qstatus").selectOption(statusValue);
    msg = await submitAndRead(p, form.locator('button:has-text("บันทึกใบเสนอราคา")'));
    ok(msg.includes("บันทึก"), `quotation ${premium} (${statusValue}) saved`);
  }
  await p.reload();
  ok((await p.locator("[data-quotation]").count()) === 2, "enquiry shows 2 quotations");
  ok(await clickUntil(p.locator('button:has-text("บันทึกว่าเสนอราคาแล้ว")'), enqStatus, "quoted"), "now marked quoted");
  await p.reload();
  const sent = p.locator('[data-quotation="sent"]');
  await sent.locator("summary").click();
  await sent.locator('input[name="policy_number"]').fill("E2E-POL-0001");
  ok(await clickUntil(sent.locator('button:has-text("ออกกรมธรรม์")'), "select count(*) from public.policies where policy_number = 'E2E-POL-0001'", "1"), "policy issued from the accepted quotation");
  ok(sql(enqStatus) === "won", "enquiry closed as won");
  await p.reload();
  ok((await p.locator('a:has-text("กรมธรรม์ E2E-POL-0001")').count()) === 1, "quotation links to its policy");
  ok(sql("select count(*) from public.policies where policy_number = 'E2E-POL-0001' and premium = 950") === "1", "policy saved with the quotation premium");

  // Note + task
  await p.reload();
  await p.locator('textarea[name="summary"]').fill("โทรยืนยันการออกกรมธรรม์แล้ว");
  msg = await submitAndRead(p, p.locator('form:has(textarea[name="summary"]) button[type=submit]'));
  ok(msg.includes("บันทึกแล้ว"), "follow-up note saved");
  await p.locator("summary:has-text('เพิ่มงานติดตาม')").click();
  await p.locator('input[name="title"]').fill("ส่งเอกสารกรมธรรม์ให้ลูกค้า");
  msg = await submitAndRead(p, p.locator('button:has-text("เพิ่มงาน")'));
  ok(msg.includes("เพิ่มงานแล้ว"), "follow-up task created");
  await p.goto(`${B}/staff/tasks?view=mine`);
  const task = p.locator('li:has-text("ส่งเอกสารกรมธรรม์ให้ลูกค้า")');
  ok((await task.count()) === 1, "task appears in my tasks");
  ok(await clickUntil(task.locator('button:has-text("ทำเสร็จแล้ว")'), "select status from public.follow_up_tasks where title = 'ส่งเอกสารกรมธรรม์ให้ลูกค้า'", "done"), "task completed");

  // Customer search + new customer + manual enquiry + existing policy
  await p.goto(`${B}/staff/customers?q=${encodeURIComponent("2กค 0000")}`);
  ok((await p.locator("text=จำลอง ขับดี").count()) > 0, "customer search by plate");
  await p.goto(`${B}/staff/customers`);
  await p.fill("#full_name", "ทดสอบ ลูกค้าโทรมา");
  await p.fill("#phone", "089-999-0001");
  await p.click('button:has-text("เพิ่มลูกค้า")');
  await p.waitForURL(/\/staff\/customers\/[0-9a-f-]{36}$/);
  ok(true, "new customer created and opened");
  await p.locator("summary:has-text('เพิ่มรถ')").click();
  await p.fill("#nv-desc", "Toyota Vios");
  await p.fill("#nv-year", "2020");
  msg = await submitAndRead(p, p.locator('button:has-text("เพิ่มรถ")'));
  ok(msg.includes("เพิ่มรถแล้ว"), "vehicle added");
  await p.reload();
  await p.locator("summary:has-text('เพิ่มกรมธรรม์ที่มีอยู่แล้ว')").click();
  await p.selectOption("#np-insurer", { index: 1 });
  await p.selectOption("#np-product", "car_3plus");
  await p.fill("#np-number", "E2E-POL-0040");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
  const shift = (d) => new Date(Date.parse(`${today}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);
  await p.fill("#np-start", shift(-325));
  await p.fill("#np-end", shift(40));
  await p.fill("#np-premium", "7200");
  msg = await submitAndRead(p, p.locator('button:has-text("เพิ่มกรมธรรม์")'));
  ok(msg.includes("เพิ่มกรมธรรม์แล้ว"), "existing policy (ends in 40 days) added");
  await p.reload();
  await p.locator("summary:has-text('บันทึกคำขอใหม่')").click();
  await p.selectOption("#ne-source", "line");
  await p.click('button:has-text("สร้างคำขอ")');
  await p.waitForURL(/\/staff\/enquiries\/[0-9a-f-]{36}$/);
  ok(/CK-\d{6}-[A-Z0-9]{4}/.test(await p.locator("h1 + div").innerText()), "manual LINE enquiry created with a reference");
}

// ===== 7. Admin: renewal job, staff management ===================================
{
  const p = admin.p;
  await p.goto(`${B}/staff/admin`);
  let msg = await submitAndRead(p, p.locator('button:has-text("ทำงานตอนนี้")'));
  ok(msg.includes("สร้างงานต่ออายุ 1 รายการ"), `run now: picks up the new policy ("${msg}")`);
  await p.reload();
  msg = await submitAndRead(p, p.locator('button:has-text("ทำงานตอนนี้")'));
  ok(msg.includes("สร้างงานต่ออายุ 0 รายการ"), "run again: no duplicate task");
  ok(sql("select count(*) from public.renewal_tasks t join public.policies p on p.id = t.policy_id where p.policy_number = 'E2E-POL-0040'") === "1", "exactly one renewal task for the policy");

  await p.goto(`${B}/staff/policies?within=60`);
  const polRow = p.locator('tr[data-policy="E2E-POL-0040"]');
  ok((await polRow.count()) === 1 && (await polRow.innerText()).includes("เหลือ 40 วัน"), "policy listed under 'within 60 days' with days left");
  ok((await p.locator('tr[data-policy="E2E-POL-0040"]').innerText()).includes("ครบกำหนด"), "renewal task shown on the expiring list");
  for (const d of [30, 60, 90]) {
    const expected = sql(`select count(*) from public.policies where status = 'active' and end_date between (now() at time zone 'Asia/Bangkok')::date and (now() at time zone 'Asia/Bangkok')::date + ${d}`);
    await p.goto(`${B}/staff/policies?within=${d}`);
    ok((await p.locator("tbody tr").count()) === Number(expected), `within ${d} days lists ${expected} policies`);
  }

  // Create a staff member, sign in as them, then deactivate.
  await p.goto(`${B}/staff/admin`);
  await p.locator("summary:has-text('เพิ่มพนักงาน')").click();
  await p.fill("#ns-email", "newagent@checkkhum.example");
  await p.fill("#ns-name", "พนักงานใหม่ ทดสอบ");
  await p.fill("#ns-pass", "temporary-pass-1234");
  msg = await submitAndRead(p, p.locator('button:has-text("เพิ่มพนักงาน")'));
  ok(msg.includes("เพิ่ม newagent@checkkhum.example แล้ว"), "admin creates a staff account");
  const fresh = await login("newagent@checkkhum.example", "temporary-pass-1234");
  ok(fresh.p.url() === `${B}/staff`, "new staff member can sign in");
  await p.reload();
  const row = p.locator('[data-staff="newagent@checkkhum.example"]');
  await row.locator('input[name="is_active"]').uncheck();
  msg = await submitAndRead(p, row.locator('button:has-text("บันทึก")'));
  ok(msg.includes("บันทึกสิทธิ์แล้ว"), "admin deactivates the account");
  await fresh.p.goto(`${B}/staff/enquiries`);
  ok(fresh.p.url().includes("/staff/login"), "deactivated user is locked out on the next request");
  await fresh.ctx.close();

  const self = p.locator('[data-staff="admin@checkkhum.example"]');
  await self.locator("select").selectOption("agent");
  msg = await submitAndRead(p, self.locator('button:has-text("บันทึก")'), self);
  ok(msg.includes("ของตัวเองไม่ได้"), `admin cannot demote themselves ("${msg}")`);
  ok(sql("select role from public.staff_users where email = 'admin@checkkhum.example'") === "admin", "admin role unchanged");

  // Admin sets a temporary password for a staff member who forgot theirs.
  await p.reload();
  const vrow = p.locator('[data-staff="viewer@checkkhum.example"]');
  await vrow.locator("summary:has-text('ตั้งรหัสผ่านชั่วคราวใหม่')").click();
  await vrow.locator('input[name="temp_password"]').fill("viewer-temp-pass-2026");
  msg = await submitAndRead(p, vrow.locator('button:has-text("ตั้งรหัสผ่าน")'), vrow);
  ok(msg.includes("ตั้งรหัสผ่านชั่วคราวแล้ว"), "admin sets a temporary password");
  ok(!(await token("viewer@checkkhum.example")), "old password no longer works");
  ok(!!(await token("viewer@checkkhum.example", "viewer-temp-pass-2026")), "temporary password works");
}

// ===== 8. Website enquiry reaches the CRM; reminders; reports ======================
{
  const res = await fetch(`${B}/api/enquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: B, "x-real-ip": "198.51.100.77" },
    body: JSON.stringify({ type: "quote", planId: "ev", carBrand: "BYD", carModel: "Seal", carYear: "2025", renewalTiming: "within_1_month", evCharger: "yes", usage: "personal", name: "ทดสอบ จากเว็บ", phone: "0899990002", preferredChannel: "line", marketingConsent: false, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 10000, website: "" }),
  });
  ok(res.status === 201, "website enquiry accepted");
  await agent.p.goto(`${B}/staff/enquiries?status=new`);
  ok((await agent.p.locator("text=ทดสอบ จากเว็บ").count()) === 1, "website enquiry appears in the CRM's new list");
  await agent.p.locator("a", { hasText: "ทดสอบ จากเว็บ" }).first().click();
  await agent.p.waitForURL(/\/staff\/enquiries\/[0-9a-f-]{36}$/);
  const detail = await agent.p.locator("main").innerText();
  ok(detail.includes("BYD Seal ปี 2025") && detail.includes("เครื่องชาร์จที่บ้าน") && detail.includes("ต้องการความคุ้มครอง"),
    "CRM enquiry page shows brand/model/year, renewal timing and EV answers");

  await agent.p.goto(`${B}/staff`);
  const reminders = agent.p.locator("[data-reminder]");
  const before = await reminders.count();
  ok(before > 0, `agent sees reminders (${before})`);
  const unread = "select count(*) from public.staff_reminders where read_at is null";
  const unreadBefore = Number(sql(unread));
  await clickUntil(reminders.first().locator('button:has-text("รับทราบ")'), unread, String(unreadBefore - 1));
  await agent.p.reload();
  ok((await agent.p.locator("[data-reminder]").count()) === before - 1, "marking a reminder read removes it");

  await agent.p.goto(`${B}/staff/reports`);
  const won = await agent.p.locator('[data-stage="ปิดการขาย"]').innerText();
  const expectedWon = sql("select count(*) from public.enquiries where status = 'won' and created_at > now() - interval '90 days'");
  ok(won.startsWith(expectedWon), `report 'won' count matches the database (${won})`);
}

// ===== 9. Sign out ===============================================================
{
  await agent.p.goto(`${B}/staff/account`);
  await agent.p.locator('header button:has-text("ออกจากระบบ")').click();
  await agent.p.waitForURL(/\/staff\/login/);
  const res = await agent.ctx.request.get(`${B}/staff`, { maxRedirects: 0 });
  ok(res.status() === 307, "after sign-out the CRM is closed again");
}

// ===== LINE contact details (customer record, shared by every enquiry) ==========
{
  const C2 = "33333333-3333-4333-8333-333333333302";
  const E2 = "55555555-5555-4555-8555-555555555502";
  // A second enquiry for the same customer, from the public form, with LINE details.
  const res = await fetch(`${B}/api/enquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: B, "x-real-ip": "198.51.100.88" },
    body: JSON.stringify({ type: "quote", planId: "car-1", carBrand: "Honda", carModel: "City", carYear: "2021", name: "ตัวอย่าง รักษ์รถ", phone: "0800000102",
      preferredChannel: "line", lineContact: "https://lin.ee/Form123", marketingConsent: false, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 10000, website: "" }),
  });
  const ref = (await res.json()).reference;
  const E2b = sql(`select id from public.enquiries where reference = '${ref}'`);
  ok(res.status === 201 && sql(`select coalesce(line_url, '-') from public.customers where id = '${C2}'`) === "-",
    "public form: LINE link kept on the enquiry, existing customer record untouched");

  // Click the form's submit button and wait for a message containing `expect` (so a stale message never counts).
  const submitExpect = async (form, expect) => {
    const button = form.getByRole("button", { name: "บันทึกข้อมูล LINE" });
    await button.click();
    // Wait for the round trip (the button reads "กำลังบันทึก" meanwhile), then for the message.
    await form.getByRole("button", { name: "บันทึกข้อมูล LINE" }).waitFor({ timeout: 15000 });
    await form.page().waitForTimeout(150);
    const msg = form.locator(`${ALERT}, [role="status"]`).filter({ hasText: expect });
    await msg.first().waitFor({ timeout: 15000 }).catch(() => {});
    return (await form.locator(`${ALERT}, [role="status"]`).last().innerText().catch(() => "")).trim();
  };
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: B });
  await ctx.addCookies(await (await login("agent@checkkhum.example")).ctx.cookies());
  const p = await ctx.newPage();
  await p.goto(`${B}/staff/enquiries/${E2}`);
  const sec = p.locator("[data-line-contact]");
  ok((await sec.innerText()).includes("ยังไม่มีข้อมูล LINE") && (await sec.getByRole("button", { name: "เปิด LINE" }).isDisabled()) && (await sec.getByRole("button", { name: "คัดลอก LINE ID" }).first().isDisabled()),
    "empty: ยังไม่มีข้อมูล LINE, copy and open disabled");

  // Invalid link: refused with a message, nothing saved.
  for (const bad of ["javascript:alert(1)", "http://line.me/ti/p/~x", "https://line.me.evil.example/ti/p/x", "https://evil.example/x"]) {
    await p.fill("#line-url", bad);
    await p.fill("#line-display-name", "ยังพิมพ์อยู่");
    const msg = await submitExpect(sec.locator("form"), "https://line.me");
    ok(msg.includes("https://line.me") && sql(`select coalesce(line_url, '-') from public.customers where id = '${C2}'`) === "-", `invalid link refused: ${bad}`);
    ok((await p.inputValue("#line-url")) === bad && (await p.inputValue("#line-display-name")) === "ยังพิมพ์อยู่", `typed values kept after the error (${bad})`);
  }
  await p.fill("#line-url", "https://line.me/ti/p/~ok");
  await p.fill("#line-id", "bad id with spaces");
  const idMsg = await submitExpect(sec.locator("form"), "LINE ID ใช้ได้");
  ok(idMsg.includes("LINE ID") && sql(`select coalesce(line_id, '-') from public.customers where id = '${C2}'`) === "-", "invalid LINE ID refused");

  // Save valid details on enquiry 1's page.
  await p.fill("#line-display-name", "รักษ์รถ ใจเย็น");
  await p.fill("#line-id", "raksrot.demo");
  await p.fill("#line-url", "https://line.me/ti/p/~raksrot.demo");
  const saved = await submitExpect(sec.locator("form"), "บันทึกข้อมูล LINE แล้ว");
  ok(saved.includes("บันทึกข้อมูล LINE แล้ว"), "agent saves LINE details");
  ok(sql(`select line_display_name || '|' || line_id || '|' || line_url || '|' || line_contact_source from public.customers where id = '${C2}'`)
    === "รักษ์รถ ใจเย็น|raksrot.demo|https://line.me/ti/p/~raksrot.demo|staff_entry", "stored on the customer as an unverified staff entry");
  ok(sql(`select count(*) from public.audit_logs where table_name = 'customers' and record_id = '${C2}' and action = 'update' and new_values->>'line_id' = 'raksrot.demo'`) === "1",
    "edit recorded in the audit log");

  // Persistence across enquiries: the other enquiry and the customer page show it too.
  for (const path of [`/staff/enquiries/${E2b}`, `/staff/customers/${C2}`]) {
    await p.goto(`${B}${path}`);
    const t = await p.locator("[data-line-contact]").innerText();
    ok(t.includes("raksrot.demo") && t.includes("รักษ์รถ ใจเย็น") && t.includes("ยังไม่ยืนยัน"), `${path.split("/")[2]} page shows the same customer LINE details, marked unverified`);
  }
  await p.goto(`${B}/staff/enquiries/${E2b}`);
  const fromEnquiry = p.locator("[data-enquiry-line]");
  ok((await fromEnquiry.innerText()).includes("https://lin.ee/Form123"), "enquiry page shows what the visitor sent with that enquiry, separately");
  ok((await fromEnquiry.getByRole("link", { name: /เปิด LINE/ }).getAttribute("href")) === "https://lin.ee/Form123", "enquiry-supplied link can be opened as sent");

  // Copy and open.
  const mainSec = p.locator("[data-line-contact]");
  await mainSec.getByRole("button", { name: "คัดลอก LINE ID" }).first().click();
  ok((await p.evaluate(() => navigator.clipboard.readText())) === "raksrot.demo" && (await mainSec.locator("[data-copy-status]").first().innerText()).includes("คัดลอก LINE ID แล้ว"),
    "คัดลอก LINE ID copies the saved ID");
  const open = mainSec.locator("[data-line-open]").first();
  ok((await open.getAttribute("href")) === "https://line.me/ti/p/~raksrot.demo" && (await open.getAttribute("target")) === "_blank" && (await open.getAttribute("rel")) === "noopener noreferrer",
    "เปิด LINE opens the saved link in a new tab, noopener noreferrer");
  const html = await (await ctx.request.get(`${B}/staff/enquiries/${E2b}`)).text();
  ok(!/line\.me\/R\/ti\/p\/|line:\/\/|0800000102[^"]*line/i.test(html), "no LINE link is built from a phone number or ID");

  // ----- LINE OA conversation link (customers.line_oa_chat_url) -----
  const OA1 = "https://chat.line.biz/U0123456789abcdef0123456789abcdef/chat/Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1";
  const OA2 = "https://chat.line.biz/U0123456789abcdef0123456789abcdef/chat/Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa2";
  const oaSql = () => sql(`select coalesce(line_oa_chat_url, '-') from public.customers where id = '${C2}'`);
  const typedBefore = sql(`select line_url || '|' || line_contact_source || '|' || line_contact_updated_at from public.customers where id = '${C2}'`);
  await p.goto(`${B}/staff/enquiries/${E2}`);
  const oa = p.locator("[data-line-oa-chat]");
  ok((await oa.getByRole("button", { name: "เปิดแชท LINE OA" }).isDisabled()) && (await oa.innerText()).includes("ยังไม่มีลิงก์แชท LINE OA"),
    "OA chat: no saved link, button disabled");
  ok((await p.locator('label[for="line-url"]').innerText()) === "ลิงก์โปรไฟล์ LINE" && (await p.locator('label[for="line-oa-chat-url"]').innerText()) === "ลิงก์แชท LINE OA",
    "labels: ลิงก์โปรไฟล์ LINE and ลิงก์แชท LINE OA");
  const oaHint = await p.locator(`#${(await p.getAttribute("#line-oa-chat-url", "aria-describedby")).split(" ").pop().replace(/:/g, "\\:")}`).innerText();
  ok(oaHint === "เปิดแชทของลูกค้าใน LINE OA แล้วคัดลอก URL จากแถบที่อยู่ของเบราว์เซอร์", "OA chat field helper text tied with aria-describedby");

  const badOa = ["http://chat.line.biz/Uabc/chat/Udef", "https://chat.line.biz.evil.example/Uabc", "https://evil.example/chat.line.biz/Uabc",
    "https://user:pw@chat.line.biz/Uabc", "https://chat.line.biz@evil.example/Uabc", "https://chat.line.biz:8443/Uabc", "https://chat.line.biz:443/Uabc",
    "https://chat.line.biz/", "https:///chat.line.biz", "javascript:alert(1)", "https://line.me/ti/p/~raksrot.demo"];
  for (const bad of badOa) {
    await p.fill("#line-oa-chat-url", bad);
    await sec.locator("form").getByRole("button", { name: "บันทึกข้อมูล LINE" }).click();
    await p.waitForTimeout(150);
    ok((await p.getAttribute("#line-oa-chat-url", "aria-invalid")) === "true" && (await p.locator("[data-field-error]").innerText()).includes("chat.line.biz")
      && oaSql() === "-", `browser blocks invalid OA chat link: ${bad}`);
  }
  // The server refuses the same links when the browser check is bypassed.
  await sec.locator("form").evaluate((f) => { f.noValidate = true; });
  for (const bad of ["https://chat.line.biz.evil.example/Uabc", "https://user:pw@chat.line.biz/Uabc", "https://chat.line.biz:443/Uabc", "javascript:alert(1)"]) {
    await p.fill("#line-oa-chat-url", bad);
    const msg = await submitExpect(sec.locator("form"), "chat.line.biz");
    ok(msg.includes("chat.line.biz") && oaSql() === "-" && (await p.inputValue("#line-oa-chat-url")) === bad, `server refuses invalid OA chat link: ${bad}`);
  }
  // Save, reload, edit, clear.
  await p.reload();
  await p.fill("#line-oa-chat-url", OA1);
  ok((await submitExpect(sec.locator("form"), "บันทึกข้อมูล LINE แล้ว")).includes("บันทึกข้อมูล LINE แล้ว") && oaSql() === OA1, "agent saves the OA chat link");
  ok(sql(`select line_url || '|' || line_contact_source || '|' || line_contact_updated_at from public.customers where id = '${C2}'`) === typedBefore,
    "saving the OA chat link keeps the personal profile link and does not restamp the typed LINE details");
  ok(sql(`select count(*) from public.audit_logs where table_name = 'customers' and record_id = '${C2}' and new_values->>'line_oa_chat_url' = '${OA1}'`) === "1",
    "OA chat link change recorded in the audit log");
  for (const path of [`/staff/customers/${C2}`, `/staff/enquiries/${E2b}`]) {
    await p.goto(`${B}${path}`);
    const link = p.locator("[data-line-oa-open]");
    ok((await link.getAttribute("href")) === OA1 && (await link.getAttribute("target")) === "_blank" && (await link.getAttribute("rel")) === "noopener noreferrer"
      && (await link.innerText()).includes("เปิดแชท LINE OA") && (await p.locator("[data-line-oa-chat]").innerText()).includes("ต้องเข้าสู่ระบบ LINE OA")
      && (await p.inputValue("#line-oa-chat-url")) === OA1,
      `${path.split("/")[2]} page: เปิดแชท LINE OA opens the saved link in a new tab, with the sign-in note`);
  }
  ok((await p.locator("[data-line-verified]").count()) === 0, "an OA chat link never shows the customer as verified");
  await p.fill("#line-oa-chat-url", OA2);
  ok((await submitExpect(sec.locator("form"), "บันทึกข้อมูล LINE แล้ว")) && oaSql() === OA2, "agent edits the OA chat link");
  await p.reload();
  await p.fill("#line-oa-chat-url", "");
  await submitExpect(sec.locator("form"), "บันทึกข้อมูล LINE แล้ว");
  await p.reload();
  ok(oaSql() === "-" && (await p.locator("[data-line-oa-chat]").getByRole("button", { name: "เปิดแชท LINE OA" }).isDisabled())
    && sql(`select line_url from public.customers where id = '${C2}'`) === "https://line.me/ti/p/~raksrot.demo",
    "agent clears the OA chat link; the profile link stays");
  await p.fill("#line-oa-chat-url", OA1);
  await submitExpect(sec.locator("form"), "บันทึกข้อมูล LINE แล้ว");

  // The public form cannot set it, whatever it sends.
  const pubOa = await fetch(`${B}/api/enquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: B, "x-real-ip": "198.51.100.89" },
    body: JSON.stringify({ type: "quote", planId: "car-1", carBrand: "Honda", carModel: "Jazz", carYear: "2020", name: "ตัวอย่าง รักษ์รถ", phone: "0800000102",
      preferredChannel: "line", lineOaChatUrl: OA2, line_oa_chat_url: OA2, marketingConsent: false, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 10000, website: "" }),
  });
  ok(pubOa.status < 500 && oaSql() === OA1 && !(await pubOa.text()).includes("chat.line.biz"), `public form cannot set or read the OA chat link (${pubOa.status})`);

  // Verified LINE Login account is shown as verified (and only that one).
  const userA = sql("select a.user_id from public.customer_accounts a where a.customer_id = '33333333-3333-4333-8333-333333333301'");
  sql(`insert into public.customer_line_accounts (user_id, line_user_id, display_name) values ('${userA}', 'U${"a".repeat(32)}', 'สมมติ LINE จริง')`);
  await p.goto(`${B}/staff/enquiries/55555555-5555-4555-8555-555555555501`);
  ok((await p.locator("[data-line-verified]").innerText()).includes("สมมติ LINE จริง"), "verified LINE Login account shown as verified");
  await p.goto(`${B}/staff/enquiries/${E2}`);
  ok((await p.locator("[data-line-verified]").count()) === 0, "typed details are never shown as verified");

  // Viewer: sees the details, cannot edit; replayed action refused.
  // (Section 7 above gave the viewer a temporary password.)
  const v = await login("viewer@checkkhum.example", "viewer-temp-pass-2026");
  await v.p.goto(`${B}/staff/customers/${C2}`);
  ok((await v.p.locator("[data-line-contact]").innerText()).includes("raksrot.demo") && (await v.p.locator("#line-id").count()) === 0, "viewer sees LINE details without an edit form");
  ok((await v.p.locator("[data-line-oa-open]").getAttribute("href")) === OA1 && (await v.p.locator("#line-oa-chat-url").count()) === 0, "viewer can open the OA chat but not edit the link");
  await v.ctx.close();
  const viewerCookies2 = await (await login("viewer@checkkhum.example", "viewer-temp-pass-2026")).ctx.cookies();
  await p.goto(`${B}/staff/customers/${C2}`);
  await p.fill("#line-id", "viewer.hijack");
  await ctx.clearCookies();
  await ctx.addCookies(viewerCookies2);
  const refused = await submitExpect(p.locator("[data-line-contact] form"), "ดูข้อมูลได้อย่างเดียว");
  ok(refused.includes("ดูข้อมูลได้อย่างเดียว") && sql(`select line_id from public.customers where id = '${C2}'`) === "raksrot.demo", `viewer session: LINE edit refused ("${refused}")`);

  // Signed out and public API: nothing exposed.
  const anon = await browser.newContext();
  const r = await anon.request.get(`${B}/staff/customers/${C2}`, { maxRedirects: 0 });
  ok(r.status() === 307, "signed out: customer page with LINE details redirects to login");
  await anon.close();
  const pub = await fetch(`${status.API_URL}/rest/v1/customers?select=line_id,line_url,line_oa_chat_url`, { headers: { apikey: status.PUBLISHABLE_KEY } });
  ok(pub.status >= 400, `publishable key cannot read customer LINE details (${pub.status})`);
  await ctx.close();
}

ok(pageErrors.length === 0, `no page errors ${JSON.stringify(pageErrors)}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
