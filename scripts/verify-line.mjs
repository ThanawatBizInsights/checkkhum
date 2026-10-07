#!/usr/bin/env node
/**
 * End-to-end checks for LINE Login / LIFF against a LOCAL Supabase stack.
 *
 * LINE's servers can't be reached from tests, so this script runs a stand-in
 * for LINE's ID-token verify endpoint (POST /oauth2/v2.1/verify) on
 * 127.0.0.1:4555. Start the app pointed at it (the app ignores this setting
 * for anything but localhost):
 *
 *   npx supabase db reset
 *   NEXT_PUBLIC_LINE_LIFF_ID=1234567890-TestLiff LINE_LOGIN_CHANNEL_ID=1234567890 \
 *   LINE_API_BASE_URL=http://127.0.0.1:4555 npm run build
 *   (same three variables) npm start
 *   BASE_URL=http://localhost:3000 node scripts/verify-line.mjs
 *
 * What it can't test here: the LIFF SDK talking to the real LINE app. Do that
 * on a phone after configuring LINE Developers (README › LINE Login).
 */
import { execFileSync, execSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const B = process.env.BASE_URL ?? "http://localhost:3000";
const CHANNEL_ID = "1234567890";
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error("Refusing to run against a non-local Supabase");
const sql = (q) => execFileSync("psql", [status.DB_URL, "-At", "-c", q], { encoding: "utf8" }).trim();
const PASSWORD = "checkkhum-local-only";

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};

// ---- Stand-in for LINE's verify endpoint ------------------------------------
// Test tokens look like JWTs: header.payload.signature, payload = claims JSON.
// The stand-in accepts only signature "valid-signature", like LINE checking a
// real signature, and checks client_id and expiry like LINE does.
const verifyCalls = [];
const mock = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const form = new URLSearchParams(body);
    verifyCalls.push({ path: req.url, clientId: form.get("client_id") });
    const [, payload, sig] = (form.get("id_token") ?? "").split(".");
    let claims = null;
    try {
      claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {}
    const send = (code, obj) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    if (req.url !== "/oauth2/v2.1/verify" || req.method !== "POST") return send(404, { error: "not_found" });
    if (!claims || sig !== "valid-signature") return send(400, { error: "invalid_request", error_description: "Invalid IdToken." });
    if (form.get("client_id") !== claims.aud) return send(400, { error: "invalid_request", error_description: "Invalid IdToken Audience." });
    if (claims.exp * 1000 < Date.now()) return send(400, { error: "invalid_request", error_description: "IdToken expired." });
    send(200, claims);
  });
});
await new Promise((r) => mock.listen(4555, "127.0.0.1", r));

const now = () => Math.floor(Date.now() / 1000);
function idToken(sub, name, { aud = CHANNEL_ID, exp = now() + 3600, sig = "valid-signature", picture } = {}) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "ES256" })}.${enc({ iss: "https://access.line.me", sub, aud, exp, iat: now(), name, ...(picture ? { picture } : {}) })}.${sig}`;
}
const L1 = "U1111111111111111111111111111111a";
const L2 = "U2222222222222222222222222222222b";
const L3 = "U3333333333333333333333333333333c";
const L4 = "U4444444444444444444444444444444d";

const browser = await chromium.launch();
const pageErrors = [];
async function context(width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => pageErrors.push(e.message));
  return { ctx, p };
}
/** POST /api/line/session from this browser context (shares its cookies). */
async function lineSession(ctx, body, { origin = B } = {}) {
  const res = await ctx.request.post(`${B}/api/line/session`, {
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    data: JSON.stringify(body),
  });
  return { status: res.status(), body: await res.json().catch(() => ({})) };
}
async function emailLogin(email, path = "/customer/login") {
  const s = await context(1366);
  await s.p.goto(`${B}${path}`);
  await s.p.fill("#email", email);
  await s.p.fill("#password", PASSWORD);
  await s.p.locator("main form button[type=submit]").click();
  await s.p.waitForLoadState("networkidle");
  return s;
}
const usersBefore = Number(sql("select count(*) from auth.users"));
const staffBefore = sql("select count(*) from public.staff_users");

// ===========================================================================
console.log("\n# Entry points");
{
  const { ctx, p } = await context();
  await p.goto(`${B}/customer/login`);
  const lineBtn = p.getByRole("link", { name: "เข้าสู่ระบบด้วย LINE" });
  ok((await lineBtn.getAttribute("href")) === "/line?start=1", "customer login: “เข้าสู่ระบบด้วย LINE” button");
  ok((await p.locator("#email").count()) === 1, "email login still offered");
  await p.goto(`${B}/line`);
  ok((await p.locator("h1").innerText()) === "เข้าสู่ระบบด้วย LINE", "/line page renders (LIFF endpoint)");
  // LINE's servers are unreachable here, like a broken network outside LINE:
  // the page must explain and offer email login instead of hanging.
  const alert = p.locator("main [role=alert]");
  await alert.waitFor({ timeout: 20000 });
  ok((await alert.innerText()).includes("ใช้อีเมลแทน") && (await p.getByRole("link", { name: "ใช้อีเมลเข้าสู่ระบบ" }).count()) === 1,
    "LIFF can't start: clear Thai message with email fallback");
  ok((await p.evaluate(() => document.documentElement.scrollWidth)) <= 390, "/line: no horizontal scroll at 390px");
  await p.screenshot({ path: "/tmp/line-error-mobile.png", fullPage: true });
  const html = await (await ctx.request.get(`${B}/line`)).text();
  ok(!html.includes("LINE_LOGIN_CHANNEL_ID") && !html.includes("sb_secret"), "no server settings in the page");
  await ctx.close();
}

console.log("\n# Request checks");
{
  const { ctx } = await context();
  ok((await lineSession(ctx, { idToken: idToken(L1, "หนึ่ง") }, { origin: null })).status === 403, "no Origin header → 403");
  ok((await lineSession(ctx, { idToken: idToken(L1, "หนึ่ง") }, { origin: "https://evil.example" })).status === 403, "cross-site Origin → 403");
  ok((await lineSession(ctx, { idToken: idToken(L1, "หนึ่ง", { sig: "forged" }) })).status === 401, "forged token (LINE rejects) → 401");
  ok((await lineSession(ctx, { idToken: idToken(L1, "หนึ่ง", { aud: "9999999999" }) })).status === 401, "token for another channel → 401");
  ok((await lineSession(ctx, { idToken: idToken(L1, "หนึ่ง", { exp: now() - 10 }) })).status === 401, "expired token → 401");
  ok((await lineSession(ctx, { mode: "login" })).status === 400, "missing token → 400");
  ok((await lineSession(ctx, { idToken: "not-a-token" })).status === 401, "malformed token → 401");
  ok(verifyCalls.every((c) => c.clientId === CHANNEL_ID && c.path === "/oauth2/v2.1/verify"), "server verifies with LINE's endpoint and our channel ID");
  ok(Number(sql("select count(*) from auth.users")) === usersBefore, "no login created by rejected requests");
  await ctx.close();
}

// ===========================================================================
console.log("\n# First LINE login creates a customer login");
const line1 = await context();
{
  const r = await lineSession(line1.ctx, { idToken: idToken(L1, "ไลน์ หนึ่ง", { picture: "https://profile.line-scdn.net/abc" }) });
  ok(r.status === 200 && r.body.status === "signed_in" && r.body.next === "/customer", "signed in");
  const uid = sql(`select user_id from public.customer_line_accounts where line_user_id = '${L1}'`);
  ok(/^[0-9a-f-]{36}$/.test(uid), "LINE user id stored for that login");
  ok(sql(`select source || '/' || full_name from public.customer_profiles where user_id = '${uid}'`) === "line/ไลน์ หนึ่ง", "customer profile: source line, LINE display name");
  ok(sql(`select count(*) from public.staff_users where id = '${uid}'`) === "0", "no staff row");
  await line1.p.goto(`${B}/customer`);
  ok(line1.p.url() === `${B}/customer`, "dashboard opens");
  ok((await line1.p.locator("h1").innerText()).includes("ไลน์ หนึ่ง"), "greets with the LINE name");
  ok((await line1.p.getByText("เชื่อมกับ LINE").count()) === 1 && (await line1.p.locator('img[src="https://profile.line-scdn.net/abc"]').count()) === 1, "shows LINE name and picture");
  ok((await line1.p.getByText("line.checkkhum.invalid").count()) === 0, "internal login email never shown");
  ok((await line1.p.locator("section", { has: line1.p.locator("#start-title") }).getByRole("link", { name: "ขอใบเสนอราคา" }).count()) === 1, "new LINE customer: ขอใบเสนอราคา");
  await line1.p.screenshot({ path: "/tmp/line-dashboard-mobile.png", fullPage: true });
  const acct = await (await line1.ctx.request.get(`${B}/api/account`)).json();
  ok(acct.state === "customer", "header knows a customer is signed in");

  // Same LINE user again in a fresh browser → same login, no duplicate.
  const again = await context();
  const r2 = await lineSession(again.ctx, { idToken: idToken(L1, "ชื่อเปลี่ยน") });
  ok(r2.body.status === "signed_in", "second LINE login signs in");
  ok(sql(`select count(*) from public.customer_line_accounts where line_user_id = '${L1}'`) === "1" && Number(sql("select count(*) from auth.users")) === usersBefore + 1,
    "same login reused (no duplicate account)");
  ok(sql(`select display_name || '/' || coalesce(picture_url, '-') from public.customer_line_accounts where line_user_id = '${L1}'`) === "ชื่อเปลี่ยน/-", "LINE name and picture refreshed from the verified token");
  await again.ctx.close();
}

console.log("\n# Quotation while signed in with LINE, and isolation from another LINE user");
let quoteRef;
{
  const p = line1.p;
  await p.goto(`${B}/quote?plan=car-1`);
  const form = p.locator("main form").first();
  await form.getByLabel("ยี่ห้อและรุ่นรถ").fill("Toyota Vios");
  await form.getByLabel("ปีรถ (ค.ศ.)").fill("2020");
  await form.getByLabel("ชื่อที่ให้เราเรียก").fill("ไลน์ หนึ่ง");
  await form.getByLabel("เบอร์โทรศัพท์").fill("0899990333");
  await new Promise((r) => setTimeout(r, 3000));
  await form.getByRole("button", { name: "ขอใบเสนอราคา" }).click();
  await p.getByTestId("enquiry-reference").waitFor({ timeout: 15000 });
  quoteRef = (await p.getByTestId("enquiry-reference").innerText()).trim();
  const uid = sql(`select user_id from public.customer_line_accounts where line_user_id = '${L1}'`);
  ok(sql(`select submitted_by_user_id from public.enquiries where reference = '${quoteRef}'`) === uid, `quote ${quoteRef} attributed to the LINE customer`);
  await p.goto(`${B}/customer`);
  ok((await p.getByText(`เลขอ้างอิง ${quoteRef}`).count()) === 1, "it shows in the LINE customer's dashboard");
}
const line2 = await context();
{
  const r = await lineSession(line2.ctx, { idToken: idToken(L2, "ไลน์ สอง") });
  ok(r.body.status === "signed_in", "a second LINE user signs in to its own login");
  await line2.p.goto(`${B}/customer`);
  ok((await line2.p.locator("h1").innerText()).includes("ไลน์ สอง") && (await line2.p.getByText(quoteRef).count()) === 0, "LINE user 2 does not see user 1's request");
  for (const path of ["/staff", "/staff/customers"]) {
    await line2.p.goto(`${B}${path}`);
    ok(/\/staff\/login\?error=not_staff/.test(line2.p.url()), `LINE customer refused at ${path}`);
  }
  const r404 = await line2.ctx.request.get(`${B}/customer/documents/00000000-0000-4000-8000-000000000000`, { maxRedirects: 0 });
  ok(r404.status() === 404, "LINE customer: unknown document → 404");
}

// ===========================================================================
console.log("\n# Existing email account links LINE, then opens from LINE");
{
  const a = await emailLogin("customer-a@checkkhum.example");
  ok((await a.p.getByRole("link", { name: "เชื่อมบัญชี LINE" }).getAttribute("href")) === "/line?link=1", "email dashboard offers “เชื่อมบัญชี LINE”");
  const taken = await lineSession(a.ctx, { idToken: idToken(L1, "x"), mode: "link" });
  ok(taken.status === 409 && taken.body.message.includes("บัญชีเช็กคุ้มอื่น"), "a LINE user already used elsewhere can't be linked (no takeover)");
  const r = await lineSession(a.ctx, { idToken: idToken(L3, "เอ ในไลน์"), mode: "link" });
  ok(r.status === 200 && r.body.status === "linked", "LINE linked to the signed-in email account");
  const r2 = await lineSession(a.ctx, { idToken: idToken(L4, "อีกไลน์"), mode: "link" });
  ok(r2.status === 409, "an account can't link a second LINE user");
  await a.p.goto(`${B}/customer?line=linked`);
  ok((await a.p.getByText("เชื่อมบัญชี LINE แล้ว").count()) === 1 && (await a.p.getByText("เอ ในไลน์").count()) === 1, "dashboard confirms the LINE link");
  await a.ctx.close();

  const fromLine = await context();
  const r3 = await lineSession(fromLine.ctx, { idToken: idToken(L3, "เอ ในไลน์") });
  ok(r3.body.status === "signed_in", "opening from LINE signs in to that email account");
  await fromLine.p.goto(`${B}/customer`);
  ok((await fromLine.p.getByText("DEMO-POL-0001").count()) === 1, "sees customer A's policy, vehicle and renewal date");
  ok((await fromLine.p.getByText("Toyota Yaris Ativ").count()) > 0 && (await fromLine.p.getByText("ครบกำหนดต่ออายุ").count()) > 0, "vehicle and renewal information shown");
  ok((await fromLine.p.getByText("DEMO-POL-0006").count()) === 0, "not customer B's policy");
  await fromLine.ctx.close();
  ok(Number(sql("select count(*) from auth.users")) === usersBefore + 2, "linking created no extra login");
}

console.log("\n# Signed in with email, opening LINE with a new LINE user: ask first");
{
  const b = await emailLogin("customer-b@checkkhum.example");
  const r = await lineSession(b.ctx, { idToken: idToken(L4, "บี ในไลน์") });
  ok(r.body.status === "choose" && /^cu•+@checkkhum\.example$/.test(r.body.account ?? ""), `asks before linking (${r.body.account})`);
  ok(sql(`select count(*) from public.customer_line_accounts where line_user_id = '${L4}'`) === "0", "nothing linked without consent");
  const r2 = await lineSession(b.ctx, { idToken: idToken(L4, "บี ในไลน์"), choice: "new" });
  ok(r2.body.status === "signed_in", "“ใช้บัญชี LINE แยก” signs in to a separate LINE login");
  await b.p.goto(`${B}/customer`);
  ok((await b.p.getByText("DEMO-POL-0006").count()) === 0 && (await b.p.locator("h1").innerText()).includes("บี ในไลน์"), "the separate login doesn't see customer B's records");
  await b.ctx.close();
}

console.log("\n# Staff stay separate");
{
  const agent = await context(1366);
  await agent.p.goto(`${B}/staff/login`);
  await agent.p.fill("#email", "agent@checkkhum.example");
  await agent.p.fill("#password", PASSWORD);
  await agent.p.locator("main form button[type=submit]").click();
  await agent.p.waitForURL(`${B}/staff`);
  const r = await lineSession(agent.ctx, { idToken: idToken(L1, "x") });
  ok(r.status === 409 && r.body.status === "staff", "LINE login refused while a staff session is active");
  await agent.p.goto(`${B}/staff`);
  ok(agent.p.url() === `${B}/staff`, "staff session untouched");
  const link = await lineSession(agent.ctx, { idToken: idToken("U5555555555555555555555555555555e", "x"), mode: "link" });
  ok(link.status === 409, "staff login can't be linked to LINE");
  ok(sql("select count(*) from public.customer_line_accounts l join public.staff_users s on s.id = l.user_id") === "0", "no staff login is mapped to LINE");
  ok(sql("select count(*) from public.staff_users") === staffBefore, "LINE created no staff rows");

  // Staff invitation link for a customer who has LINE but no email.
  await agent.p.goto(`${B}/staff/customers/33333333-3333-4333-8333-333333333304`);
  const form = agent.p.locator("form", { has: agent.p.getByRole("button", { name: "สร้างลิงก์เชิญทาง LINE" }) });
  await form.getByRole("button", { name: "สร้างลิงก์เชิญทาง LINE" }).click();
  await form.locator('[role="status"]').waitFor({ timeout: 15000 });
  const msg = await form.locator('[role="status"]').innerText();
  const token = msg.match(/invite=([0-9a-f]{48})/)?.[1];
  ok(!!token && msg.includes("https://liff.line.me/1234567890-TestLiff?invite="), "staff get a single-use LIFF invitation link");
  ok(sql(`select count(*) from public.customer_invitations where token_hash = encode(extensions.digest('${token}', 'sha256'), 'hex')`) === "1", "only the token's hash is stored");

  const viaLine = await lineSession(line2.ctx, { idToken: idToken(L2, "ไลน์ สอง"), invite: token });
  ok(viaLine.body.status === "signed_in" && viaLine.body.invite === "linked", "LINE user 2 opens the link: linked to that customer");
  await line2.p.goto(`${B}/customer`);
  ok((await line2.p.getByText("DEMO-POL-0002").count()) === 1, "and now sees that customer's policy");
  const reuse = await lineSession(line1.ctx, { idToken: idToken(L1, "ไลน์ หนึ่ง"), invite: token });
  ok(reuse.body.invite === "invalid", "the link works only once");
  await line1.p.goto(`${B}/customer`);
  ok((await line1.p.getByText("DEMO-POL-0002").count()) === 0, "LINE user 1 still sees no one else's policy");
  await agent.p.goto(`${B}/staff/customers/33333333-3333-4333-8333-333333333304`);
  ok((await agent.p.getByText(/LINE: ไลน์ สอง/).count()) === 1, "CRM shows the account is linked through LINE");
  await agent.ctx.close();
}

await line1.ctx.close();
await line2.ctx.close();
await browser.close();
mock.close();
ok(pageErrors.length === 0, `no browser errors (${pageErrors.length}${pageErrors.length ? `: ${pageErrors[0]}` : ""})`);
console.log(failures ? `\n${failures} check(s) failed` : "\nAll LINE checks passed");
process.exit(failures ? 1 : 0);
