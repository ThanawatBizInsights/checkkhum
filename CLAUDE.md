# CheckKhum website: project instructions

เช็กคุ้ม (CheckKhum) is a Thai car and travel insurance comparison service. The site's job
is to get quotation requests. Audience: Thai drivers, mostly on phones.

## Stack and commands

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) · Tailwind CSS v4.

```bash
npm run dev        # http://localhost:3000
npm run lint       # eslint . (flat config, eslint-config-next)
npm run typecheck  # tsc --noEmit
npm run build
npm run check      # lint + typecheck + build; run before every commit
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
| `src/lib/submissions.ts` | Enquiry submission (currently demo-only, see below) |
| `src/lib/staff-session.ts`, `src/app/staff/actions.ts`, `src/proxy.ts` | Demo staff auth |
| `src/components/` | Reusable UI: `QuoteForm`, `ProductPage`, `ContactChannels`, `ContactBand`, `DemoNotice`, `Button` |
| `src/app/(site)/` | Public pages, with header/footer/mobile quote bar |
| `src/app/staff/` | Staff login and dashboard, separate layout, `noindex` |
| `DESIGN.md` | Design tokens, layout, rationale |

## Rules

- **Contact details:** never hard-code a phone number, LINE ID, email or address in a page or
  component. Read from `siteConfig` via `src/lib/contact.ts`. Never invent real-looking values;
  empty config values must render the poster placeholders (`[เบอร์โทรศัพท์]`, `[LINE ID]`).
- **Demo submissions:** until a backend exists, enquiries are saved only in the visitor's
  browser (`localStorage`) and marked `demo: true`. Every UI that collects or shows them must
  say so (`DemoNotice` / `DemoBadge`). Do not remove those labels until `DEMO_SUBMISSIONS` is
  false and a real backend is wired in `submitEnquiry`.
- **Staff auth is a demo:** a single shared account from env vars and an HMAC-signed httpOnly
  cookie. Keep the server-side session check in each staff page as well as in `proxy.ts`.
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
