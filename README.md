# checkkhum

Website for **เช็กคุ้ม (CheckKhum) Car & Travel Insurance**: quotation-focused pages for car,
EV, พ.ร.บ. and travel insurance, plus a demo staff area.

Built with Next.js 16, React 19, TypeScript and Tailwind CSS v4.

## Setup

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # optional in development
npm run dev                  # http://localhost:3000
```

Before committing, run all checks:

```bash
npm run check     # lint, typecheck, production build
npm run db:test   # database tests (needs the local Supabase stack)
```

Production:

```bash
npm run build
npm start
```

## Pages

| Route | Page |
|---|---|
| `/` | Homepage with quote form |
| `/car-insurance` | ประกันรถยนต์ ชั้น 1, 2+, 3+ (with tier comparison) |
| `/ev-insurance` | ประกันรถยนต์ EV |
| `/compulsory-insurance` | พ.ร.บ. รถยนต์ |
| `/travel-insurance` | ประกันเดินทาง |
| `/quote` | Quotation enquiry; `?plan=car-1 \| car-2plus \| car-3plus \| ev \| compulsory \| travel` preselects a plan |
| `/contact` | Contact channels and callback request |
| `/privacy` | Privacy notice: **draft**, not indexed |
| `/customer/login` | Customer sign-in (Supabase Auth): "เข้าสู่ระบบด้วย LINE" or email. Not linked from public navigation for now (quotations need no account); existing customers use the URL or the links in their emails |
| `/line` | LIFF endpoint and LINE Login page (`?link=1` connects LINE to the signed-in email account; `?invite=…` accepts a staff LINE invitation) |
| `/customer/register` | Customer registration (email verification required) |
| `/customer/verify-email` | Resend the verification email; expired verification links land here |
| `/customer/forgot-password` | Request a password reset email |
| `/customer/auth/confirm` | Landing for invitation and reset email links (verifies the token server-side) |
| `/customer/set-password` | Choose a password after an invitation or reset link |
| `/customer` | Customer dashboard ("บัญชีของฉัน"): policies, vehicles, coverage and renewal dates, documents, quotations, request status, renewal request, LINE |
| `/customer/documents/[id]` | Download one of the customer's approved documents (60-second signed URL) |
| `/staff/login` | Staff sign-in (Supabase Auth); discreet footer link "สำหรับเจ้าหน้าที่" |
| `/staff/…` | Staff CRM: overview, enquiries, customers, policies, tasks, reports, admin, account (see "Staff CRM") |
| `/staff/documents/[id]` | Staff download of a policy document |
| `POST /api/enquiries` | Enquiry endpoint used by the quote and contact forms |
| `GET /api/account` | Signed-in state (`signed_out`, `customer` or `staff` only); kept for when the portal returns to the navigation |
| `POST /api/line/session` | Verifies a LINE ID token with LINE, then signs the customer in (or links LINE to the current account) |

## Sitemap and robots.txt

`/sitemap.xml` (`src/app/sitemap.ts`) lists the indexable public pages in
`src/content/indexable-pages.ts` on `https://www.checkkhum.com` (`siteConfig.siteUrl`):
home, the four insurance pages, `/quote` and `/contact`. The draft privacy notice, the
customer portal, `/line`, the CRM and the API are left out, and there is no `<lastmod>`
because the pages have no reliable modification date. `/robots.txt` (`src/app/robots.ts`)
allows public pages, keeps crawlers out of `/staff`, `/api/`, `/customer` and `/line`, and
points to the sitemap. Neither path goes through `src/proxy.ts`. When you add an indexable
page, add it to `indexablePaths`; `npm run audit` fails if one is missing.

## Contact details

All contact details are in **`src/config/site.ts`**: phone, LINE Official Account link,
LINE ID, LINE QR image, email, opening hours, and the company details used in the privacy
notice. **Empty values are hidden** on public pages (no placeholder text, no empty QR box);
only the draft privacy notice marks missing legal details for review. For the
QR code, add the image to `public/images/` and set `lineQrImage`, e.g. `"/images/line-qr.png"`.

**LINE.** `contact.lineUrl` (currently `https://lin.ee/86TezJV`) is used by every LINE
button: the mobile sticky bar ("LINE"), the
official "เพิ่มเพื่อน" button in the contact sections, the contact lists and footer, and
the quotation confirmation ("ติดต่อทีมงานผ่าน LINE"). All open in a new tab with
`rel="noopener noreferrer"`. The link only opens the LINE chat; it never sends form
details. Enquiries are still saved through `/api/enquiries`, and the confirmation asks
the visitor to quote their reference number in the chat.

## Enquiry database (Supabase)

Quote and contact enquiries are stored in Supabase PostgreSQL through a validated
server endpoint, `POST /api/enquiries`. Schema, ER diagram, access rules and the
intake flow are documented in [`docs/database.md`](docs/database.md).

- Versioned migrations: `supabase/migrations/`
- Fictional seed data (local only): `supabase/seed.sql`
- Database tests (pgTAP): `supabase/tests/`
- End-to-end API checks: `scripts/verify-enquiry-api.mjs`

Public visitors can submit enquiries but cannot read any customer record: the
browser never talks to Supabase directly, `anon` has no grants or policies,
and only the server (secret key) may call the intake function. Spam
protection, rate limits and duplicate handling are described in
`docs/database.md`.

### Run it locally

Requires Docker.

```bash
npm run db:start      # local Supabase; prints the local API URL and keys
npm run db:reset      # apply migrations + fictional seed
npm run db:test       # 42 database access-control tests
```

Create `.env.local` (git-ignored) from `.env.example` with the local values
(`npx supabase status` shows them): `SUPABASE_URL` = API URL,
`SUPABASE_SECRET_KEY` = the local secret key, and a random `ENQUIRY_HASH_SALT`.
Then:

```bash
npm run build && npm start
BASE_URL=http://localhost:3000 npm run verify:enquiries   # 43 end-to-end checks (local only)
```

### Configuring environment variables

**Real values never go in git**, in `.env.example`, or in any `NEXT_PUBLIC_` variable.

| Variable | Where to get it | Where to set it |
|---|---|---|
| `SUPABASE_URL` | Supabase dashboard › your project › **Project Settings › API** (Project URL) | Hosting provider env settings; `.env.local` for local dev |
| `SUPABASE_SECRET_KEY` | Supabase dashboard › **Project Settings › API Keys › Secret keys** (create one named e.g. `website-enquiries`; starts with `sb_secret_`) | Hosting provider env settings only, marked secret/sensitive. Server only: never in the browser |
| `ENQUIRY_HASH_SALT` | Generate: `openssl rand -hex 32` | Hosting provider env settings |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (optional) | Cloudflare dashboard › **Turnstile › Add widget** | Hosting provider env settings |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard › **Project Settings › API Keys** (starts with `sb_publishable_`) | Hosting provider env settings; used server-side by the staff CRM |
| `NEXT_PUBLIC_LINE_LIFF_ID` (optional) | LINE Developers Console › your **LINE Login** channel › **LIFF** tab › LIFF ID (e.g. `1234567890-AbCdEfGh`) | Hosting provider env settings. Public by design: the browser needs it to start LIFF |
| `LINE_LOGIN_CHANNEL_ID` (optional) | LINE Developers Console › the same LINE Login channel › **Basic settings** › Channel ID (digits; the LIFF ID starts with it) | Hosting provider env settings. Server only; used to verify LINE ID tokens |

On **Vercel**: Project › **Settings › Environment Variables**; add each for
Production (and Preview if previews should store enquiries, ideally in a
separate Supabase project), then **redeploy**. Pages read the configuration at
build time, so a redeploy is needed after any change.

If the secret key leaks, create a new one in **API Keys**, update the hosting
env, redeploy, then delete the old key.

### Applying the migrations to your Supabase project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # from the dashboard URL
npx supabase db push                                  # applies supabase/migrations only
```

`db push` does **not** run `seed.sql`; never load the fictional seed into
production. Then, in the Supabase dashboard:

1. **Authentication**: configure sign-up and emails as described in
   "Customer portal › Supabase configuration" below (customers may register;
   staff never can). `supabase/config.toml` only affects the local stack.
2. **Advisors › Security Advisor**: confirm there are no findings.
3. To add staff later: invite the user under **Authentication › Users**, then
   insert their row into `staff_users` with a role (`admin`, `agent`, `viewer`).

## Deploying on Vercel

`vercel.json` sets `"framework": "nextjs"`. Without it, a Vercel project created
before the app existed keeps the "Other" preset: the build succeeds and shows
Ready, but only `public/` is deployed and `/` returns 404 NOT_FOUND.

| Setting | Value |
|---|---|
| Framework Preset | Next.js |
| Root Directory | blank (repository root) |
| Build Command | default (`npm run build`, which runs `next build`) |
| Output Directory | default (blank; never `public`) |
| Install Command | default |

Staff sign in at `/staff/login` (linked as "สำหรับเจ้าหน้าที่" in the footer);
the dashboard is `/staff`.

## Demo mode (local development only)

Demo mode exists only under `npm run dev` (`NODE_ENV=development`) with
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` both empty: the endpoint validates and
spam-checks each enquiry, replies `mode: "demo"`, and the form keeps it as
*ข้อมูลสาธิต* in the browser and says so on screen.

In a production build, the site never shows a success screen unless the
database saved the enquiry and returned a `CK-…` reference. If `SUPABASE_URL`,
`SUPABASE_SECRET_KEY` or `ENQUIRY_HASH_SALT` (32+ characters) is missing, the
quote and contact forms are replaced with "ตอนนี้ส่งคำขอทางเว็บไซต์ไม่ได้ชั่วคราว"
and a LINE button, the endpoint answers `503 not_configured`, and the server log
names the missing variables (names only, never values). Pages are prerendered,
so **redeploy after changing environment variables**.

Without Supabase configured, the staff CRM is unavailable and its login page says so.

## Staff CRM

`/staff` is the internal CRM. Staff sign in with Supabase Auth (email and password);
every page and server action runs **as that staff member**, so the database's row
level security decides what they can see and change. The secret key is used only to
create staff logins (admins) and by the public enquiry endpoint.

| Area | What staff can do |
|---|---|
| ภาพรวม | Reminders, my tasks due within 7 days, pipeline counts, policies expiring in 30/60/90 days, newest enquiries |
| คำขอ | Pipeline ใหม่ → ติดต่อแล้ว → เสนอราคาแล้ว → ปิดการขาย / ไม่สำเร็จ; search; assign; several quotations per enquiry; turn an accepted quotation into a policy; notes, tasks, status history |
| ลูกค้า | Search by name, phone, LINE ID, plate or reference; full history (enquiries, policies, vehicles, notes, tasks, PDPA consent); add customers, vehicles, existing policies and phone/LINE enquiries |
| กรมธรรม์ | Active policies ending within 30, 60 or 90 days with their renewal task; expired policies |
| งาน | Open follow-up and renewal tasks: mine, unassigned, all; assign, start, complete |
| รายงาน | Enquiry funnel and win rate, premium won, time to quote, by product and by channel, for any date range |
| ผู้ดูแลระบบ | Admins only: staff accounts and roles, insurers, renewal job runs and "run now", recent audit log |

**Roles**

| Role | Read | Create / edit | Delete | Staff, insurers, audit log, run job |
|---|---|---|---|---|
| ผู้ดูแลระบบ (`admin`) | ✓ | ✓ | ✓ | ✓ |
| เจ้าหน้าที่ (`agent`) | ✓ | ✓ | | |
| ดูอย่างเดียว (`viewer`) | ✓ | | | |

Users who are not in `staff_users`, or are deactivated, cannot sign in to the CRM and
can read nothing through the API. Admins cannot demote or deactivate themselves.

The enquiry pipeline is enforced in the database: an enquiry can only become
"เสนอราคาแล้ว" after a quotation is sent, and "ปิดการขาย" only with an accepted
quotation. Notes, tasks and quotations are always recorded in the name of the signed-in
staff member.

**Renewal tasks and reminders.** A `pg_cron` job runs daily at 06:05 Bangkok time
(`checkkhum-renewal-job`). For every active policy ending within 90 days it creates one
renewal task (due 30 days before expiry, assigned to whoever handled the original
enquiry), and it creates internal reminders for new renewal tasks and for any task due
by tomorrow. A unique index allows one renewal task per policy and every insert uses
`ON CONFLICT DO NOTHING`, so repeated runs never duplicate tasks or reminders. Admins
can also run it from ผู้ดูแลระบบ. Customer messaging (LINE, SMS) is not part of this
job; it will be a separate integration reading the same tasks.

**First admin.** After applying the migrations to your project:

1. Supabase dashboard › **Authentication › Users › Add user**: enter the email and a
   strong password, tick auto-confirm.
2. Supabase dashboard › **SQL Editor**:
   ```sql
   insert into public.staff_users (id, email, full_name, role)
   select id, email, 'ชื่อผู้ดูแลระบบ', 'admin' from auth.users where email = 'you@example.com';
   ```
3. Sign in at `/staff/login`. Add other staff from ผู้ดูแลระบบ › เพิ่มพนักงาน.

Staff accounts are added by admins only. Public sign-up (for customers) never creates a
`staff_users` row or grants a role: staff rights come only from that table, which only
admins can write. A login added by hand in the dashboard gets a customer profile until
its `staff_users` row is inserted, which removes the profile.

**Local logins** (fictional seed, password `checkkhum-local-only`):
`admin@checkkhum.example`, `agent@checkkhum.example`, `viewer@checkkhum.example`,
plus `former@` (deactivated) and `outsider@` (not staff) for testing refusals, and
customer portal logins `customer-a@checkkhum.example` and `customer-b@checkkhum.example`.
Local auth emails (sign-up verification, invitations, resets) arrive in Mailpit at http://127.0.0.1:54324.

**Checks**

```bash
npm run db:test                                   # 240 database tests (5 suites)
npx supabase db reset && npm run build && npm start
PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 npm run verify:crm      # 78 end-to-end checks
npx supabase db reset
PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 npm run verify:portal   # 160 customer portal + registration checks
npx supabase db reset   # app built and started with the test LINE settings in scripts/verify-line.mjs
PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 npm run verify:line     # 62 LINE Login checks
PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 npm run verify:journey  # 201 quote journey checks (UNCONFIGURED_URL=… adds the no-settings case)
```

Full launch audit (mobile layouts at 360/390px, Thai fonts and text size, every internal
link, anonymous data access via REST/RPC/GraphQL/API/server actions, secrets in the
browser bundle and rendered HTML, cookie flags, security headers):

```bash
PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 npm run audit
```

Latest results and the launch blockers: [`docs/launch-readiness.md`](docs/launch-readiness.md).

`verify:crm` signs in as each role and confirms unauthorized access is blocked at three
layers: pages (redirects, "no access"), server actions (replayed with a lower-privileged
session) and the database API (real staff tokens against RLS). It also walks through the
enquiry → quotation → policy flow, the renewal job and staff management.

After changing the schema, run `npm run db:types` to refresh `src/lib/database.types.ts`.

## Customer portal

Customers sign in at `/customer/login` (not in the public navigation for now; quotations need no account) and
see only their own records at `/customer` ("บัญชีของฉัน"): policies with insurer, policy
number, insured vehicle, coverage dates and renewal date; documents staff have approved;
quotations staff have sent; the status of their requests; a "ขอใบเสนอราคาต่ออายุ"
button that opens a renewal enquiry in the CRM pipeline; and LINE contact buttons.

**Registering.** Anyone can register at `/customer/register` (login page: "ยังไม่มีบัญชี?
สมัครสมาชิก"; header menu: "ลูกค้าใหม่? สมัครสมาชิก") with name, email, password (10+
characters), confirmation and the privacy notice acknowledgement. Supabase emails a
verification link; until it is used the login can't sign in ("ส่งอีเมลยืนยันอีกครั้ง" on
the login page and `/customer/verify-email` sends a new one; expired or reused links land
there too). After verifying, the customer is signed in to `/customer` and sees a welcome,
a "ขอใบเสนอราคา" button and the status of any request they submit while signed in.
A database trigger creates their `customer_profiles` row (one per login, unique), with an
idempotent fallback on first use. Registration is limited to 10 per hour per IP.

**Linking to existing CRM records stays staff-approved.** Registering never claims an
existing customer, policy or document, even when the email or phone matches. Staff open
the customer in the CRM › "บัญชีลูกค้าออนไลน์", enter the email (confirm it with the
customer first) and press "ส่งคำเชิญ" (agents and admins). A new address gets an
invitation email; an address that already registered gets linked the next time that
customer signs in. Either way the database links only a login whose **verified** email
equals that pending invitation. The CRM customers page lists the newest online accounts
and whether each is linked. Admins can unlink. Staff and customer logins are kept
separate (a staff email can't be invited or registered).

**Documents.** On a policy page staff upload PDF/JPG/PNG files (max 10 MB, type checked
from the file content) to the private `policy-documents` bucket and approve each one
("อนุมัติให้ลูกค้าเห็น") before the customer can see it. Downloads use 60-second signed
URLs created with the requester's own session, so storage policies decide.

What customers never see: internal notes, draft quotations, who prepared what, tasks,
renewal tasks, reminders, consent and audit records, staff, other customers. Details in
[`docs/database.md`](docs/database.md) › Customer portal.

### Supabase configuration for the portal (hosted project)

Apply the migrations first (`npx supabase db push`, see above); they create the tables,
policies, functions and the private storage bucket. No new environment variables are
needed. Then in the Supabase dashboard:

1. **Authentication › URL Configuration**
   - **Site URL**: your production URL, e.g. `https://www.your-domain.co.th` (email
     links are built from it).
   - **Redirect URLs**: add `https://www.your-domain.co.th/customer/auth/confirm` (and
     your Vercel preview pattern if previews should work).
2. **Authentication › Emails › Templates**: paste the three Thai templates, with the
   subjects from `supabase/config.toml`:
   - "Confirm sign up": `supabase/templates/confirmation.html`
   - "Invite user": `supabase/templates/invite.html`
   - "Reset password": `supabase/templates/recovery.html`

   Their links go to `/customer/auth/confirm?token_hash=…&type=…`, which the server
   verifies. Don't keep the default templates: their links don't work with this
   server-side login.
3. **Authentication › Emails › SMTP Settings**: set up your own SMTP sender (e.g. your
   domain's mail service, Resend, Amazon SES, SendGrid) with a sender on your domain
   and SPF/DKIM set up. Supabase's built-in sender is for testing only: it sends only a
   few emails per hour, so registrations would fail without this.
4. **Authentication › Sign In / Providers › Email**:
   - **Allow new users to sign up**: **on** (customer registration).
   - **Confirm email**: **on**. Required: unverified logins can't sign in. (If it is
     off, the site refuses to start a session after sign-up and logs an error.)
   - **Minimum password length**: 10 (the site requires 10 for customers, 12 for staff).
   - Leave anonymous sign-ins and other providers off.
5. **Authentication › Rate Limits**: sign-ups and sign-ins reach Supabase from the
   website server, so Supabase sees few IP addresses. Raise "sign-ups and sign-ins" and
   "emails sent" to fit your traffic (the site applies its own per-visitor limit to
   registrations).
6. **Advisors › Security Advisor**: confirm there are no findings.

## LINE Login and LIFF (customers)

Customers can open their account from the LINE Official Account's Rich Menu, or choose
"เข้าสู่ระบบด้วย LINE" on `/customer/login`. It's the same Next.js site: the LIFF app's
endpoint is `/line`, and the dashboard is the normal `/customer`.

**How it works**
1. `/line` starts the LIFF SDK (`@line/liff`) in the browser. In LINE the visitor is
   signed in to LINE automatically; in a normal browser they choose
   "เข้าสู่ระบบด้วย LINE" (LINE Login web page) or switch to email. If LIFF can't start
   (no network, wrong LIFF ID, opened in an unsupported place) the page says so in Thai
   and offers email login.
2. The page sends only the **LINE ID token** to `POST /api/line/session`. The server
   verifies it with LINE (`https://api.line.me/oauth2/v2.1/verify`, our channel ID)
   and uses only what LINE returns: user ID, display name, picture. Profile data from
   the browser is never trusted.
3. The server signs the visitor in to the Supabase login mapped to that LINE user ID
   (`customer_line_accounts`, unique on both sides), or creates a customer login for a
   new LINE user. Sessions are the same httpOnly cookies as email login, so RLS and all
   portal rules apply unchanged.

**Linking to existing records (never by name, email or phone)**
- A customer who already has an email account opens `/customer` and taps
  "เชื่อมบัญชี LINE" (or, signed in with email, opens the LIFF app and confirms
  "เชื่อมกับบัญชีนี้"). Both proofs are required: the email session and LINE's token.
- A customer who only uses LINE: staff open the customer in the CRM › "บัญชีลูกค้าออนไลน์"
  › "สร้างลิงก์เชิญทาง LINE", and paste the link into that customer's LINE chat. It's
  single-use, expires in 7 days, and only its hash is stored. Opening it links the
  LINE login to that customer, after which the dashboard shows quotations, policies,
  vehicles, approved documents and renewal dates.
- One LINE user can belong to only one account, and an account to only one LINE user.
  A LINE user already used by another account is refused, never taken over.

**Staff stay separate.** LINE never signs anyone in to a staff login, staff logins can't
be linked to LINE, and a LINE-linked login can't be made staff. If a staff session is
active in the browser, LINE login is refused until staff sign out.

### Set up in LINE Developers Console

1. **Provider:** use the provider that owns the CheckKhum LINE Official Account (so LINE
   user IDs match the OA's).
2. **Create a channel › LINE Login.** App type: **Web app**. Then:
   - **Basic settings:** note the **Channel ID** (`LINE_LOGIN_CHANNEL_ID`). Under
     "Linked LINE Official Account", choose the CheckKhum OA.
   - **LINE Login › Callback URL:** `https://<your-domain>/line` (add the
     `https://<project>.vercel.app/line` URL too if you test there). Used when customers
     log in from a normal browser.
3. **LIFF tab › Add:**
   - Size: **Full**
   - Endpoint URL: `https://<your-domain>/line`
   - Scopes: **openid** and **profile** (email is not needed)
   - Add friend option: **On (normal)**
   - Note the **LIFF ID** (`NEXT_PUBLIC_LINE_LIFF_ID`).
4. **Publish** the channel. While it's "Developing", only the channel's admins and
   testers can log in.
5. **Rich Menu** (LINE Official Account Manager › Rich menus): set the button's action to
   **Link** › `https://liff.line.me/<LIFF ID>`.

### Vercel

Add `NEXT_PUBLIC_LINE_LIFF_ID` and `LINE_LOGIN_CHANNEL_ID` (Production, and Preview if
wanted), then **redeploy** (the LIFF ID is built into the page). The existing
`SUPABASE_*` variables are reused; no LINE channel secret is needed. Then apply the
migration `20261010090000_line_login.sql` (`npx supabase db push`).

Leaving the two LINE variables empty hides LINE Login; email login keeps working.

**Test on a phone** after setup: tap the Rich Menu, check you land in "บัญชีของฉัน";
open `/customer/login` in a phone browser and use "เข้าสู่ระบบด้วย LINE"; send yourself a
staff LINE invitation link. The automated tests (`npm run verify:line`) use a local
stand-in for LINE's verify endpoint, so the LIFF handshake itself is only tested on
a real device.

## Before launch

- Fill in contact and legal details in `src/config/site.ts`.
- Have the privacy notice reviewed, fill its highlighted gaps, then remove the draft banner
  and `robots: noindex` in `src/app/(site)/privacy/page.tsx`.
- Apply the migrations to your Supabase project and set the environment variables
  (see "Enquiry database").
- Create the first admin account (see "Staff CRM").
- Configure Site URL, redirect URL, the three email templates, SMTP, sign-up with
  email confirmation and rate limits (see "Customer portal").
- For LINE: LINE Login channel, LIFF app, callback URL, Rich Menu link and the two
  Vercel variables (see "LINE Login and LIFF").
- Replace `public/images/checkkhum-logo.png` with the original
  high-resolution artwork; the current file is cropped from the 667px-wide approved poster.

## Project notes

- Design tokens and decisions: [`DESIGN.md`](DESIGN.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- `.claude/skills/frontend-design/` is Anthropic's official `frontend-design` skill, copied
  unchanged from [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
  at commit `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` (Apache-2.0, see its `LICENSE.txt`).
