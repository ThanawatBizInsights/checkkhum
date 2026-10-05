# Launch readiness

End-to-end test run on 5 October 2026 against a local Supabase stack (Postgres 17,
PostgREST, Supabase Auth, pg_cron) and a production build of the site. Every suite ran
on a freshly reset database with the fictional seed.

## What was tested

| Suite | Command | Result | Covers |
|---|---|---|---|
| Database | `npm run db:test` | 104/104 | RLS for anon, non-staff, deactivated, viewer, agent, admin; intake function; duplicates; pipeline rules; author stamping; quotation → policy; reminders; renewal job idempotency and schedule |
| Launch audit | `npm run audit` | 273/273 | All 9 public and 12 CRM pages at 360 and 390 px: no horizontal scroll, one h1, `lang="th"`, Prompt + IBM Plex Sans Thai Looped loaded, no garbled text, body line-height ≥ 1.7, no text under 15 px, no console errors; 47 internal links; anonymous REST on 15 tables, 6 RPC functions, GraphQL, `GET /api/enquiries`, signed-out server-action replay; secrets in 59 bundle files and 21 rendered pages (signed-in CRM included); cookie flags; security headers |
| CRM | `npm run verify:crm` | 78/78 | Redirects when signed out; forged cookie; non-staff, deactivated and wrong-password logins; viewer read-only; server actions replayed with lower-privileged sessions; REST with real viewer/agent/non-staff tokens; enquiry new → contacted → quoted (refused until a quotation is sent) → policy → won; two quotations on one enquiry; notes; tasks; customer search by plate; new customer, vehicle, existing policy, manual LINE enquiry; renewal job run-now and no duplicates; 30/60/90-day lists match the database; staff create, deactivate, self-demotion refused, temporary password reset; website enquiry reaches the CRM; reminders; report counts; sign-out |
| Enquiry API | `npm run verify:enquiries` | 31/31 | Content type, origin, size, validation, honeypot, timing, link spam, storage, consent, audit log, idempotency, 30-minute duplicates, 5 concurrent duplicates → 1 row, IP and phone rate limits, anon blocked on tables and functions |
| Website forms, database mode | browser | 28/28 | Pages render; EV plan preselect; double-click stores one enquiry; duplicate resubmission shows the same reference; server validation shown on the field; contact form stored |
| LINE links | browser | 57/57 | Every LINE link is `https://lin.ee/86TezJV`, `target="_blank"`, `rel="noopener noreferrer"`; hero, sticky bar, official Add Friend button, confirmation; new tab gets no referrer and no opener; no form details in the URL; quotation still saved |
| Website, demo mode (no database) | browser | 28/28 | Forms validate and store labelled demo data in the browser; CRM reports "not connected" |
| Scheduler | manual | pass | A temporary one-minute pg_cron schedule ran the renewal job by itself (`succeeded`), logged as `schedule`, created no duplicates; removed afterwards |

## Fixed during this run

1. **Session cookie readable by scripts.** The staff session cookie is now `httpOnly`
   (and `Secure` in production), so an injected script cannot steal a staff session.
2. **No security headers.** Added `frame-ancestors 'none'` / `X-Frame-Options: DENY`
   (clickjacking), `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS.
3. **Expired session gave no feedback.** Clicking a CRM button after the session expired
   did nothing visible (the proxy redirected the action request). The action now answers
   "กรุณาเข้าสู่ระบบอีกครั้ง"; it was refused before and still is.
4. **Thai text below 15px** in the CRM sidebar (name, role, counts) and the QR placeholder.
5. **Pipeline strip cramped on phones**: now two rows; filter pills are 44px touch targets.
6. **No way to recover a forgotten staff password.** Admins can now set a temporary
   password from ผู้ดูแลระบบ.

## Not tested here (environment limits)

- `https://lin.ee/86TezJV` and LINE's official button image: LINE's servers are blocked
  from the test environment. The links' markup and behaviour were tested; open the live
  site and tap one LINE button.
- Cloudflare Turnstile live verification (only if you enable it): Cloudflare is blocked
  here; only "missing token is rejected" was tested.
- Real devices and browsers other than Chromium (Safari on iPhone in particular).

## Launch blockers

Must be done before real customers use the site:

1. **Apply the database to the live Supabase project.** `npx supabase link` +
   `npx supabase db push` (migrations only, never the seed), then Security Advisor shows no
   findings and **Allow new users to sign up** is off. Nothing has been applied to the
   live `checkkhum` project yet.
2. **Deploy with the environment variables** `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
   `SUPABASE_PUBLISHABLE_KEY`, `ENQUIRY_HASH_SALT` set in the hosting provider, on a
   domain with HTTPS. Confirm the platform sets `x-real-ip` / `x-forwarded-for`
   itself (Vercel does), or per-IP rate limits can be bypassed.
3. **Create the first admin** (README › Staff CRM) and the staff accounts.
4. **Contact details** in `src/config/site.ts`: phone number, LINE QR image, opening
   hours, email. Without a phone number the site shows "[เบอร์โทรศัพท์]".
5. **Legal**: company name, address and broker licence number in `src/config/site.ts`;
   privacy notice reviewed by a lawyer, highlighted gaps filled (retention periods,
   processors, DPO), then remove the draft banner and `noindex`. Bump
   `privacyNoticeVersion` when the wording is final.
6. **Check the LINE link on a phone** (see above).

Strongly recommended:

- Original high-resolution logo and car image (current ones are cropped from the
  667px poster and look soft on high-density screens).
- Supabase backups / point-in-time recovery on the live project, and error monitoring
  for the website (server logs currently go to the host's console only).
- Decide whether to enable Turnstile once traffic shows spam.
- Data retention: no automatic deletion of old enquiries exists yet; add it once the
  privacy notice states the retention periods.
