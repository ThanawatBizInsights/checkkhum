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
| `src/lib/staff-session.ts`, `src/app/staff/actions.ts`, `src/proxy.ts` | Demo staff auth |
| `src/components/` | Reusable UI: `QuoteForm`, `ProductPage`, `ContactChannels`, `ContactBand`, `DemoNotice`, `Button` |
| `src/app/(site)/` | Public pages, with header/footer/mobile quote bar |
| `src/app/staff/` | Staff login and dashboard, separate layout, `noindex` |
| `DESIGN.md` | Design tokens, layout, rationale |

## Rules

- **Contact details:** never hard-code a phone number, LINE ID, email or address in a page or
  component. Read from `siteConfig` via `src/lib/contact.ts`. Never invent real-looking values;
  empty config values must render the poster placeholders (`[เบอร์โทรศัพท์]`, `[LINE ID]`).
- **Secrets:** `SUPABASE_SECRET_KEY`, `ENQUIRY_HASH_SALT`, `TURNSTILE_SECRET_KEY` and
  `STAFF_*` are server-only. Read them only in `src/lib/server/*` (which imports
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
- **Demo mode:** without Supabase env vars, enquiries stay in the visitor's browser marked
  `demo: true`, and every UI that collects or shows them says so (`DemoNotice` / `DemoBadge`).
  Keep those labels tied to `isDatabaseConfigured()`.
- **Staff auth is a demo:** a single shared account from env vars and an HMAC-signed httpOnly
  cookie. It is not a Supabase Auth session, so it cannot read customer tables (by design). Keep the server-side session check in each staff page as well as in `proxy.ts`.
  Production must refuse login when env vars are missing. Replace with a real identity
  provider before staff handle real customer data.
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
