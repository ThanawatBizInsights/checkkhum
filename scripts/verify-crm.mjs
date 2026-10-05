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
    body: JSON.stringify({ type: "quote", planId: "ev", carModel: "BYD Seal", carYear: "2025", name: "ทดสอบ จากเว็บ", phone: "0899990002", preferredChannel: "line", marketingConsent: false, idempotencyKey: crypto.randomUUID(), startedAt: Date.now() - 10000, website: "" }),
  });
  ok(res.status === 201, "website enquiry accepted");
  await agent.p.goto(`${B}/staff/enquiries?status=new`);
  ok((await agent.p.locator("text=ทดสอบ จากเว็บ").count()) === 1, "website enquiry appears in the CRM's new list");

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

ok(pageErrors.length === 0, `no page errors ${JSON.stringify(pageErrors)}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
