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
npm run check   # lint, typecheck, production build
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

## Contact details

All contact details are in **`src/config/site.ts`**: phone, LINE ID, LINE QR image, email,
opening hours, and the company details used in the privacy notice. Empty values show the
poster's placeholders (`[เบอร์โทรศัพท์]`, `[LINE ID]`). For the QR code, add the image to
`public/images/` and set `lineQrImage`, e.g. `"/images/line-qr.png"`.

## Demo mode

There is no backend yet, so two parts of the site run in demo mode and say so on screen.

**Enquiry submissions.** The quote and contact forms save each enquiry as *ข้อมูลสาธิต*
(demo data) in the visitor's own browser (`localStorage`). Nothing reaches the team. After
saving, the visitor can send the summary by LINE or phone once those are configured. To
connect a backend, replace `submitEnquiry` in `src/lib/submissions.ts` and set
`DEMO_SUBMISSIONS = false`.

**Staff area.** One shared demo account and a signed, httpOnly session cookie (8 hours).
The dashboard lists only the demo enquiries saved in the same browser.

| Environment | Staff login |
|---|---|
| Development, no env vars | `demo@checkkhum.local` / `checkkhum-demo` |
| Any, with env vars | `STAFF_DEMO_EMAIL` / `STAFF_DEMO_PASSWORD`, signed with `STAFF_SESSION_SECRET` (32+ characters) |
| Production, env vars missing | Login disabled |

Replace this with a real identity provider and database before staff handle real customer data.

## Before launch

- Fill in contact and legal details in `src/config/site.ts`.
- Have the privacy notice reviewed, fill its highlighted gaps, then remove the draft banner
  and `robots: noindex` in `src/app/(site)/privacy/page.tsx`.
- Connect the enquiry backend and real staff authentication (see Demo mode).
- Replace `public/images/checkkhum-logo.png` and `hero-car.webp` with the original
  high-resolution artwork; the current files are cropped from the 667px-wide approved poster.

## Project notes

- Design tokens and decisions: [`DESIGN.md`](DESIGN.md)
- Instructions for Claude Code: [`CLAUDE.md`](CLAUDE.md)
- `.claude/skills/frontend-design/` is Anthropic's official `frontend-design` skill, copied
  unchanged from [anthropics/skills](https://github.com/anthropics/skills/tree/main/skills/frontend-design)
  at commit `8a1541c4a3ffa5a20a5a91de0dcf3f0bab1d1ef4` (Apache-2.0, see its `LICENSE.txt`).
