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
| `/staff/login` | Staff login (demo) |
| `/staff/dashboard` | Staff dashboard (demo, requires login) |
| `POST /api/enquiries` | Enquiry endpoint used by the quote and contact forms |

## Contact details

All contact details are in **`src/config/site.ts`**: phone, LINE ID, LINE QR image, email,
opening hours, and the company details used in the privacy notice. Empty values show the
poster's placeholders (`[เบอร์โทรศัพท์]`, `[LINE ID]`). For the QR code, add the image to
`public/images/` and set `lineQrImage`, e.g. `"/images/line-qr.png"`.

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
| `STAFF_DEMO_*`, `STAFF_SESSION_SECRET` | You choose; secret via `openssl rand -hex 32` | Hosting provider env settings |

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

## Demo mode

If `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are both empty, the endpoint still
validates and spam-checks each enquiry, then replies `mode: "demo"`. The form
keeps it as *ข้อมูลสาธิต* (demo data) in the visitor's own browser and says so
on screen; the visitor can send the summary by LINE or phone once those are
configured. Setting only one of the two variables is treated as a
misconfiguration and the endpoint returns an error rather than losing enquiries.

**Staff area.** One shared demo account and a signed, httpOnly session cookie (8 hours).
Without a database, the dashboard lists the demo enquiries saved in the same browser.
With a database, it links to the `enquiries` table in the Supabase dashboard, because
this demo login is not a Supabase Auth session and RLS (correctly) gives it no access.

| Environment | Staff login |
|---|---|
| Development, no env vars | `demo@checkkhum.local` / `checkkhum-demo` |
| Any, with env vars | `STAFF_DEMO_EMAIL` / `STAFF_DEMO_PASSWORD`, signed with `STAFF_SESSION_SECRET` (32+ characters) |
| Production, env vars missing | Login disabled |

Next step: move staff sign-in to Supabase Auth so the dashboard can read
enquiries through the staff RLS policies already in the database.

## Before launch

- Fill in contact and legal details in `src/config/site.ts`.
- Have the privacy notice reviewed, fill its highlighted gaps, then remove the draft banner
  and `robots: noindex` in `src/app/(site)/privacy/page.tsx`.
- Apply the migrations to your Supabase project and set the environment variables
  (see "Enquiry database").
- Move staff sign-in to Supabase Auth (see Demo mode).
- Replace `public/images/checkkhum-logo.png` and `hero-car.webp` with the original
  high-resolution artwork; the current files are cropped from the 667px-wide approved poster.

## Project notes

- Design tokens and decisions: [`DESIGN.md`](DESIGN.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- `.claude/skills/frontend-design/` is Anthropic's official `frontend-design` skill, copied
  unchanged from [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
  at commit `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` (Apache-2.0, see its `LICENSE.txt`).
