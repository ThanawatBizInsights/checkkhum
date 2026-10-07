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
| `/customer/login` | Customer sign-in (Supabase Auth); header "เข้าสู่ระบบ" › ลูกค้า |
| `/customer/forgot-password` | Request a password reset email |
| `/customer/auth/confirm` | Landing for invitation and reset email links (verifies the token server-side) |
| `/customer/set-password` | Choose a password after an invitation or reset link |
| `/customer` | Customer dashboard ("บัญชีของฉัน"): policies, vehicles, coverage and renewal dates, documents, quotations, request status, renewal request, LINE |
| `/customer/documents/[id]` | Download one of the customer's approved documents (60-second signed URL) |
| `/staff/login` | Staff sign-in (Supabase Auth); header "เข้าสู่ระบบ" › เจ้าหน้าที่ |
| `/staff/…` | Staff CRM: overview, enquiries, customers, policies, tasks, reports, admin, account (see "Staff CRM") |
| `/staff/documents/[id]` | Staff download of a policy document |
| `POST /api/enquiries` | Enquiry endpoint used by the quote and contact forms |
| `GET /api/account` | Signed-in state for the header menu (`signed_out`, `customer` or `staff` only) |

## Contact details

All contact details are in **`src/config/site.ts`**: phone, LINE Official Account link,
LINE ID, LINE QR image, email, opening hours, and the company details used in the privacy
notice. Empty values show the poster's placeholders (`[เบอร์โทรศัพท์]`, `[LINE ID]`). For the
QR code, add the image to `public/images/` and set `lineQrImage`, e.g. `"/images/line-qr.png"`.

**LINE.** `contact.lineUrl` (currently `https://lin.ee/86TezJV`) is used by every LINE
button: the homepage hero ("คุยกับเราผ่าน LINE"), the mobile sticky bar ("LINE"), the
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
BASE_URL=http://localhost:3000 npm run verify:enquiries   # 31 end-to-end checks (local only)
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

1. **Authentication › Sign In / Providers**: turn off **Allow new users to sign up**
   (staff are invited, not self-registered). `supabase/config.toml` only
   affects the local stack.
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

Staff sign in at `/staff/login` (linked as "เข้าสู่ระบบเจ้าหน้าที่" in the footer);
the dashboard is `/staff`.

## Demo mode

If `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are both empty, the endpoint still
validates and spam-checks each enquiry, then replies `mode: "demo"`. The form
keeps it as *ข้อมูลสาธิต* (demo data) in the visitor's own browser and says so
on screen; the visitor can copy the summary and paste it into the LINE chat, or call. Setting only one of the two variables is treated as a
misconfiguration and the endpoint returns an error rather than losing enquiries.

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

Keep **Authentication › Sign In / Providers › Allow new users to sign up** off: staff are
added by admins only.

**Local logins** (fictional seed, password `checkkhum-local-only`):
`admin@checkkhum.example`, `agent@checkkhum.example`, `viewer@checkkhum.example`,
plus `former@` (deactivated) and `outsider@` (not staff) for testing refusals, and
customer portal logins `customer-a@checkkhum.example` and `customer-b@checkkhum.example`.
Local auth emails (invitations, resets) arrive in Mailpit at http://127.0.0.1:54324.

**Checks**

```bash
npm run db:test                                   # 160 database tests (3 suites)
npx supabase db reset && npm run build && npm start
PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 npm run verify:crm      # 78 end-to-end checks
npx supabase db reset
PLAYWRIGHT_MODULE=… BASE_URL=http://localhost:3000 npm run verify:portal   # 109 customer portal checks
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

Customers sign in at `/customer/login` (header "เข้าสู่ระบบ" › ลูกค้า, or the footer) and
see only their own records at `/customer` ("บัญชีของฉัน"): policies with insurer, policy
number, insured vehicle, coverage dates and renewal date; documents staff have approved;
quotations staff have sent; the status of their requests; a "ขอใบเสนอราคาต่ออายุ"
button that opens a renewal enquiry in the CRM pipeline; and LINE contact buttons.

**How a customer gets an account.** Customers can't sign up. Staff open the customer in
the CRM › "บัญชีลูกค้าออนไลน์", enter the customer's email and press "ส่งคำเชิญ"
(agents and admins). Supabase emails an invitation; the customer clicks it (this
verifies the email), chooses a password, and the database links the login to that
customer record. A login is linked only when its **verified** email matches a pending
invitation; typing an email or phone number never reveals anything. A signed-in login
without a link sees an empty state with the LINE button. Admins can unlink an account.
Staff and customer logins are kept separate (a staff email can't be invited).

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
2. **Authentication › Emails › Templates**: paste the Thai templates from
   `supabase/templates/invite.html` ("Invite user") and `supabase/templates/recovery.html`
   ("Reset password"), with the subjects from `supabase/config.toml`. Their links go to
   `/customer/auth/confirm?token_hash=…`, which the server verifies; the default
   templates don't work with this server-side login.
3. **Authentication › Emails › SMTP Settings**: set up your own SMTP sender. Supabase's
   built-in sender is for testing only and sends very few emails per hour.
4. **Authentication › Sign In / Providers**: keep "Allow new users to sign up" **off**
   and email confirmation on. Optionally set the minimum password length to 10 (the
   site requires 10 for customers, 12 for staff).
5. **Advisors › Security Advisor**: confirm there are no findings.

## Before launch

- Fill in contact and legal details in `src/config/site.ts`.
- Have the privacy notice reviewed, fill its highlighted gaps, then remove the draft banner
  and `robots: noindex` in `src/app/(site)/privacy/page.tsx`.
- Apply the migrations to your Supabase project and set the environment variables
  (see "Enquiry database").
- Create the first admin account (see "Staff CRM") and confirm sign-ups are disabled.
- Configure Site URL, redirect URL, email templates and SMTP for customer invitations
  (see "Customer portal").
- Replace `public/images/checkkhum-logo.png` and `hero-car.webp` with the original
  high-resolution artwork; the current files are cropped from the 667px-wide approved poster.

## Project notes

- Design tokens and decisions: [`DESIGN.md`](DESIGN.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- `.claude/skills/frontend-design/` is Anthropic's official `frontend-design` skill, copied
  unchanged from [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
  at commit `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` (Apache-2.0, see its `LICENSE.txt`).
