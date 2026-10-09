# CheckKhum website: project instructions

เช็กคุ้ม (CheckKhum) is a Thai car and travel insurance comparison service. The site's job
is to get quotation requests. Audience: Thai drivers, mostly on phones.

## Stack and commands

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS v4 ·
Supabase PostgreSQL (`@supabase/supabase-js`, server-side only) · zod.

```bash
npm run dev        # http://localhost:3000
npm run lint       # eslint . (flat config, eslint-config-next)
npm run typecheck  # tsc --noEmit
npm run build
npm run check      # lint + typecheck + build; run before every commit
npm run db:start   # local Supabase (Docker); then db:reset, db:test, db:lint
npm run verify:enquiries  # end-to-end API checks against LOCAL Supabase only
npm run verify:crm        # CRM permissions + flows (LOCAL only, after db:reset)
npm run verify:portal     # customer portal: invites, resets, A-vs-B isolation (LOCAL only, after db:reset)
npm run verify:line       # LINE Login/LIFF with a local stand-in for LINE's verify API (LOCAL only, see script header)
npm run verify:journey    # quote journey in a phone browser: each product, confirmation, CRM, failures (LOCAL only)
npm run audit             # launch audit: mobile, Thai text, links, anon access, secrets, headers
```

Next.js 16 differs from older versions: middleware is `src/proxy.ts` (exported `proxy`),
`searchParams`/`params`/`cookies()` are async, and `next lint` no longer exists. When in doubt,
read the bundled docs in `node_modules/next/dist/docs/` rather than relying on memory.

## Where things live

| Path | What |
|---|---|
| `src/config/site.ts` | **The only place for contact details** (phone, LINE, QR, email, hours) and legal entity details |
| `src/lib/contact.ts` | Derived links and placeholders from the config; use these, never format contact details inline |
| `src/content/products.ts` | Product copy, plans, car tier table |
| `src/lib/submissions.ts` | Browser side of enquiry submission (posts to `/api/enquiries`; demo fallback) |
| `src/app/api/enquiries/route.ts`, `src/lib/server/` | Enquiry endpoint: validation, spam checks, rate limits, Supabase calls (server only) |
| `supabase/migrations/`, `supabase/seed.sql`, `supabase/tests/` | Database schema, fictional seed, pgTAP tests |
| `docs/database.md` | ER diagram, access matrix, intake flow |
| `src/app/staff/(crm)/`, `src/app/staff/_actions/` | Staff CRM pages and server actions |
| `src/lib/server/staff-auth.ts`, `src/lib/server/supabase-user.ts`, `src/proxy.ts` | Staff sign-in (Supabase Auth), role checks, session refresh |
| `src/lib/server/crm/` | Action helper (role check + zod + DB error mapping) and shared queries |
| `src/lib/database.types.ts` | Generated DB types (`npm run db:types`) |
| `src/components/` | Reusable UI: `QuoteForm`, `ProductPage`, `ContactChannels`, `ContactBand`, `DemoNotice`, `Button` |
| `src/app/(site)/` | Public pages, with header/footer/mobile quote bar |
| `src/app/staff/` | Staff login and dashboard, separate layout, `noindex` |
| `src/app/(site)/customer/`, `src/lib/server/customer-auth.ts`, `src/components/customer/` | Customer portal (register, verify email, login, reset, dashboard, documents), `noindex` |
| `src/app/staff/_actions/portal.ts`, `src/components/staff/portal-sheets.tsx` | Staff side of the portal: invitations, account links, policy documents |
| `src/content/quote-options.ts`, `src/content/journey.ts` | Quote form choices (brands are suggestions only) and homepage/quote journey copy, FAQs |
| `src/app/(site)/line/`, `src/components/line/`, `src/app/api/line/session/route.ts`, `src/lib/server/line.ts` | LINE Login / LIFF: entry page, client LIFF start-up, server token verification and session |
| `supabase/templates/` | Thai auth email templates (sign-up confirmation, invite, recovery) using `token_hash` links |
| `DESIGN.md` | Design tokens, layout, rationale |

## Rules

- **Contact details:** never hard-code a phone number, LINE ID, email or address in a page or
  component. Read from `siteConfig` via `src/lib/contact.ts`. Never invent real-looking values;
  empty config values are hidden on public pages (only the draft privacy notice marks them).
- **LINE links:** every LINE button uses `siteConfig.contact.lineUrl` through
  `src/components/line-links.tsx` (`LineButton`, `LineAddFriendButton`, `LineTextLink`,
  `lineLinkProps`), opening in a new tab with `rel="noopener noreferrer"`. LINE links never
  carry form details; enquiries are always saved through `/api/enquiries`. Use LINE's official
  "เพิ่มเพื่อน" image (`contact.lineAddFriendImage`) unmodified (plain `<img>`, height 36)
  and the OA QR (`contact.lineQrImage`) square and uncropped. Never show the raw LINE URL
  or account ID as text. There is one floating LINE control, `LineFloatingWidget`, on public
  pages only; it must keep stepping aside for any form in `main`, the footer and focused
  fields, and stay closed for the session once dismissed.
- **Office and map:** office details live in `siteConfig.office`. Only embed a map or link a
  pin the business has confirmed (`mapPinUrl`, `mapEmbedUrl`); otherwise use the address search.
- **Secrets:** `SUPABASE_SECRET_KEY`, `ENQUIRY_HASH_SALT` and `TURNSTILE_SECRET_KEY` are
  server-only. (`SUPABASE_PUBLISHABLE_KEY` is not secret, but is also only used server-side.) Read them only in `src/lib/server/*` (which imports
  `server-only`) or server routes. Never prefix them with `NEXT_PUBLIC_`, log them, return
  them in a response, or put real values in `.env.example`.
- **Database changes:** add a new timestamped migration (`npx supabase migration new <name>`);
  never edit an applied one. Every new table in `public` must enable RLS, revoke `anon`, and
  get explicit `to authenticated` policies using the `private.is_staff()/can_write()/is_admin()`
  helpers; add an audit trigger for customer data. Extend `supabase/tests/` and run
  `npm run db:test` and `npm run db:lint`. Update `docs/database.md` (ERD + access table).
- **Public writes go through `/api/enquiries` only.** Don't give `anon` grants, policies or
  function execute rights, and don't call Supabase from the browser for customer data.
  Keep the validation, honeypot, timing, rate-limit and idempotency checks in that path.
- **No personal data in logs**, including names, phone numbers and IPs. Log references and error codes.
- **Seed data is fictional and local only.** Never run `seed.sql` or
  `scripts/verify-enquiry-api.mjs` against production.
- **Demo mode is development-only** (`submissionMode()` in `src/lib/server/env.ts`). In
  production, missing intake settings mean `unavailable`: forms show `IntakeUnavailableNotice`
  plus LINE, the API returns 503 `not_configured`, and the log names missing variables only.
  Never show a success screen unless the server returned `mode: "database"` and a `CK-` reference.
- **Quotation-first:** no login or registration links in the public header, mobile menu or
  footer; the only staff entry is the footer's "สำหรับเจ้าหน้าที่". Don't publish licences,
  partners, prices, discounts, reviews, customer counts or response-time promises until the
  business confirms them; facts live in `src/content/journey.ts`.
- **Staff CRM permissions:** CRM code reads and writes only through `requireStaff()` /
  `runAction(minRole, …)` and the staff member's own client (`staff.db`), so RLS applies.
  Never use the secret key in CRM code except for Auth admin calls that create logins:
  staff logins only after `runAction("admin", …)`; customer invitation emails only after
  `runAction("agent", …)` has recorded the invitation through RLS; LINE customer logins
  only in `/api/line/session` after LINE has verified the ID token. Every new action declares its minimum role
  (`viewer` < `agent` < `admin`), validates with zod, and uses `check(…, { expectRows: true })`
  on updates so an RLS-filtered update is reported, not silently "saved". Every page calls
  `requireStaff()` itself; layouts and `proxy.ts` are not the only gate.
- **Customer portal:** customers have no direct access to CRM tables. They read through
  `portal_overview()` (fixed customer-safe columns) and RLS on `policy_documents` /
  `customer_accounts` / storage, always scoped by `private.current_customer_id()`. Never
  add a customer policy to a CRM table or return internal columns (notes, staff, tasks,
  drafts) from portal functions. Linking a login to a customer happens only in
  `accept_customer_invitation()` (verified email + staff invitation); never link or look
  up records from a typed email or phone. Documents reach customers only after staff
  approval. Portal pages call `requireCustomer()`; routes use the customer's own client.
  Self-registration (`/customer/register`) only creates a login and its `customer_profiles`
  row; it must never create `staff_users` rows, grant roles, or attach existing CRM
  records. Unlinked logins see only their profile and enquiries recorded as submitted by
  them (`record_enquiry_submitter`, server only, from the verified session). Keep email
  confirmation required. Extend `supabase/tests/portal.test.sql`,
  `supabase/tests/registration.test.sql` and `scripts/verify-portal.mjs` with every change.
- **LINE Login:** the browser sends only the LINE ID token; the server verifies it with
  LINE (`verifyLineIdToken`, our channel ID) and never trusts LIFF profile data. Map LINE
  users only through `link_line_account()` (one-to-one, never staff) and sign in only the
  login `line_login_user()` returns. Linking LINE to an existing account needs the
  account's session too; linking to a CRM customer needs a staff invitation (email or
  LINE link). Never match by LINE name, email or phone. `LINE_API_BASE_URL` may only point
  at localhost (tests). The LIFF ID is public; there is no LINE secret in this app.
  Extend `supabase/tests/line.test.sql` and `scripts/verify-line.mjs` with every change.
- **Workflow rules live in the database** (`private.enforce_enquiry_status`, author
  stamping, `convert_quotation_to_policy`). Mirror them in the UI (`nextStatuses`) but
  never rely on the UI alone.
- **Renewal tasks come only from the scheduled job** (`private.run_renewal_job`, pg_cron).
  Keep it idempotent (unique index + `on conflict do nothing`). Customer messaging is a
  separate integration; don't add it to the job.
- **Test permissions with every CRM change:** extend `supabase/tests/crm.test.sql` and
  `scripts/verify-crm.mjs` (refusals at page, action and API level).
- **Privacy notice is a draft:** keep the draft banner and `noindex` until legal review.
- **Brand:** use the logo files in `public/images/` as they are (no recolouring or redrawing).
  Colours come from the logo: navy `#0A2259`, teal `#0B9C84`. Use the Tailwind tokens in
  `src/app/globals.css` (`text-navy`, `bg-teal`, …), not raw hex values.
- **Thai readability:** body text stays in IBM Plex Sans Thai Looped at line-height ≥ 1.7;
  headings in Prompt. Don't set Thai in all caps-style letter-spacing, condensed widths, or
  below 15px. Keep lines under ~80 characters. Copy is Thai, plain, sentence-style.
- **Quotation-first:** every public page keeps a clear path to `/quote`; product pages show
  the quote form in the first screen on mobile, preselecting the product's plan.
- **Accessibility floor:** visible focus, labelled fields, errors tied with `aria-describedby`,
  `prefers-reduced-motion` respected, no horizontal scroll at 390px.

## Design work

Use the project skill `.claude/skills/frontend-design/` (Anthropic's official
`frontend-design` skill) for any new UI or visual change. Follow its plan → review → build →
critique process, record decisions in `DESIGN.md`, and screenshot desktop (1366px) and mobile
(390px) before committing. Do not edit the skill files; they are vendored unchanged.
