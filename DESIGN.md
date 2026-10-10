# CheckKhum website — design plan

Built with the `frontend-design` project skill (`.claude/skills/frontend-design/`),
from the approved CheckKhum roll-up poster.

## Brief (from the approved poster)

- **Subject:** เช็กคุ้ม, a Thai broker-style service for car, EV, compulsory (พ.ร.บ.) and travel insurance.
- **Audience:** Thai drivers comparing renewal or new-car cover, many browsing on a phone.
- **Primary job:** get a quotation request (ขอใบเสนอราคา), by form, phone or LINE.
- **Fixed by the client:** the logo, the navy + teal palette taken from it, Thai copy from the poster, and a quotation-first layout.

## Tokens

| Token | Hex | Role |
|---|---|---|
| `--navy` | `#0A2259` | Logo navy: headings, primary text on light |
| `--navy-deep` | `#04183F` | Contact band, footer |
| `--teal` | `#0B9C84` | Logo check mark: the quote action and selected states |
| `--teal-ink` | `#06725F` | Teal for text on white (AA contrast) |
| `--sky` | `#EEF4FB` | Page wash behind the hero, echoing the poster sky |
| `--paper` | `#FFFFFF` | Form panel and surfaces |

Tokens are defined in `src/app/globals.css` (`@theme`) and used as Tailwind classes
(`text-navy`, `bg-teal`, …). Demo labels use `--color-demo` `#8A5A00` on `--color-demo-bg`
`#FFF4D6`: an amber that sits outside the brand palette on purpose, so it never reads as part
of the product.

**Type.** Prompt 600/700 for headings: heavy, loopless Thai close to the poster headline.
IBM Plex Sans Thai Looped 400/500/600 for body, labels and the form: looped letterforms
are easier for older readers and for telling similar Thai glyphs apart in small text.
Body line-height 1.75 (Thai vowels and tone marks stack above and below the line).

**Layout.**

```
desktop                                   mobile
[logo ............ โทร  LINE  ขอใบเสนอราคา]  [logo ........ ขอใบเสนอราคา]
[headline              ][ quote slip   ]  [headline        ]
[sub                   ][ type chips   ]  [quote slip      ]
[car image             ][ fields       ]  [car image       ]
[                      ][ submit       ]  [products        ]
[products: car (lead) | EV | พ.ร.บ. | travel]  [how we help     ]
[how we help: check / compare / coordinate ]  [contact band    ]
[contact band: phone, LINE, QR            ]  [sticky bar: LINE | quote]
```

Left-aligned throughout; the poster centres its headline, but centred multi-line
Thai is harder to scan on screen.

**Principles.**

1. The quote slip is the memorable thing. It sits in the first screen on every width;
   everything else stays quiet.
2. Products keep the poster's hierarchy: ประกันรถยนต์ (ชั้น 1, 2+, 3+) leads, the other
   three follow as a lighter list, not a grid of identical cards.
3. Contact details live in one config file (`src/config/site.ts`). Until real numbers are
   set, the site shows the poster's placeholders rather than invented ones.

## Pages (Next.js version)

```
product page, desktop                      product page, mobile
[icon, h1, intro          ][ quote slip  ]  [icon, h1, intro ]
[what's covered (3)       ][ (sticky,    ]  [quote slip      ]
[car: tier table ✓ / –    ][  plan pre-  ]  [what's covered  ]
[check before choosing | what we need   ]  [tier table      ]
[other products list                     ]  [checklists      ]
[contact band                            ]  [contact band    ]
```

- **Quote page:** the slip is the `h1`. Beside it, "after you send": the one place with
  numbered markers, because it really is a three-step sequence.
- **Contact page:** channels and QR on the left; an "ask us to call back" form on the right.
- **Privacy notice:** long-form reading column (≤ 44em) with gaps highlighted in the demo
  amber, so the draft can't be mistaken for a final notice.
- **Staff area:** separate chrome (logo mark only, no marketing nav), a persistent amber
  demo bar, and a plain list of enquiries rather than a dense table, because staff will
  often check it on a phone.

## Critique notes from screenshots

- The demo notice beside its badge squeezed Thai text into a narrow column inside the form;
  stacked the label above the text instead.
- The car tier table overflowed at 390px; fixed-layout table with narrow tier columns fits
  without horizontal scroll.
- The footer merged into the navy contact band; added a hairline between them.
- On the staff dashboard, quiet sky buttons disappeared on the sky background; added an
  outline button variant.
- The table caption repeated the section heading; reworded it to say what the table does.

## LINE Official Account (first version, superseded by "LINE contact points" below)

- **Hierarchy:** LINE is the second way to get a quote, so its buttons are quiet
  outline buttons (white, navy text) with the LINE icon in LINE's green
  (`--color-line-brand` `#06C755`, used for the icon only). The quote slip stays the one
  loud element; LINE never takes the teal primary style.
- **Placement:** homepage hero under the lede ("คุยกับเราผ่าน LINE"); mobile sticky bar
  as a compact "LINE" button beside the full-width quote button; LINE's official
  "เพิ่มเพื่อน" artwork in the contact band and contact page, unmodified; quotation
  confirmation ("ติดต่อทีมงานผ่าน LINE").
- **Copy:** the confirmation says plainly that the LINE button opens a chat but does
  not send the enquiry, and asks the visitor to quote their reference number there.
- **Critique:** the reference number wrapped mid-code in the confirmation note on
  phones; it is now kept on one line.

## Staff CRM (/staff)

- **Job:** a daily work tool for a small brokerage team, mostly on desktop, sometimes on a
  phone between calls. Denser than the public site, same tokens and Thai type.
- **Layout:** navy-deep sidebar (logo mark, name, role, menu with counts) on desktop; on
  phones it becomes a header with a horizontally scrolling tab row. Content sits on
  white "sheets" over the sky background, max 1200px.
- **The one memorable element:** the pipeline strip, ใหม่ → ติดต่อแล้ว → เสนอราคาแล้ว →
  ปิดการขาย / ไม่สำเร็จ. With counts it is the enquiry list's filter; on an enquiry it shows
  how far the deal has got. Below it, only the moves the database allows are offered.
- **Lists, not card grids:** rows with hairline dividers and tables for scanning; tables
  scroll inside their sheet on phones, with the deciding column (e.g. expiry date) first.
- **Status colour:** new = navy outline, contacted = sky, quoted = mint/teal outline,
  won = solid teal, lost/spam = grey. Due dates: red overdue, amber today/tomorrow.
  Warning and error colours are tokens (`--color-warn*`, `--color-error*`).
- **Report chart:** the funnel is one series, so one hue (navy), bars rounded only at the
  data end, exact values printed beside each bar (dataviz skill).
- **Critique fixes:** sidebar background now runs the full page height; meta lines use
  commas instead of "·"; reminder dates use the Buddhist year like the rest of the UI;
  "add quotation" is a permanent section (it collapsed and hid its success message);
  wide tables no longer push the page sideways on phones (`min-w-0` on sheets).
- **Way in from the public site:** a quiet "เข้าสู่ระบบเจ้าหน้าที่" link on its own row at the
  bottom of the footer, below a hairline. It is plain footer text (not a button) so it
  never competes with the quote path, with a 44px tap target and `rel="nofollow"`.
- **ติดต่อผ่าน LINE card:** one compact sheet on the customer and enquiry pages, replacing
  the tall LINE sheet, its nested LINE OA box and the always-open form. Top to bottom: title
  with a quiet "แก้ไข"; name and LINE ID as a two-column list; one pill (ยืนยันแล้วผ่าน
  LINE Login, or ยังไม่ยืนยัน with who typed it and when); one wrapping row of equal outline
  buttons, "LINE ส่วนตัว" (profile link), "แชท LINE OA" (OA conversation), "คัดลอก ID".
  A missing link takes its button's place as muted text ("ยังไม่มีลิงก์ส่วนตัว") with a
  text-style "เพิ่มลิงก์" for agents and admins, which opens the editor on that field; the
  other link keeps working. The OA sign-in note is one helper line tied to the OA button
  with `aria-describedby`, shown only when there is a link. The editor opens inside the
  card under a hairline (name and ID side by side from `md`), with "บันทึก" and "ยกเลิก";
  saving closes it, announces "บันทึกข้อมูล LINE แล้ว" and the card shows the new values;
  focus returns to "แก้ไข". The two links are separate fields and never derived from each
  other. Screenshots: `docs/screenshots/line-contact-card/`.

## Customer portal and login menu

- **Login in the header:** an outline "เข้าสู่ระบบ" button sits beside the teal
  "ขอใบเสนอราคา" so the quote stays the primary action. It opens a small panel:
  "เข้าสู่ระบบในฐานะ" ลูกค้า / เจ้าหน้าที่. Signed in, the same button reads "บัญชีของฉัน"
  with the account link and "ออกจากระบบ". Public pages stay static; the button asks
  `/api/account` after load and keeps its space (invisible) until it knows, so the label
  never flashes the wrong state. On phones the choices are two buttons at the bottom of
  the "เมนู" panel. Escape and outside clicks close the desktop panel.
- **The one memorable element:** each policy is a navy "policy card" (like the card in a
  glovebox) with the insured car, and a coverage timeline: teal fill from the start date
  to today, the last 60 days shaded as the renewal window, start and renewal dates under
  it. In the window the status pill turns amber ("ต่ออายุภายใน N วัน") and the renewal
  button becomes the teal primary. Below the card, on white: documents and the button.
- **Everything else is quiet:** a sky greeting band with the LINE and new-quote buttons;
  plain lists for requests (status chips in the customer's words, not CRM labels),
  quotation cards with the premium in Prompt, and vehicles. Empty states say what will
  appear and how to get it; an unlinked login gets one card with the LINE button.
- **Auth pages:** a narrow white card with a navy border on the sky band, the same as the
  staff login, inside the public header and footer so customers stay on the brand site.
- Screenshots: desktop 1366px and mobile 390px of the portal, the header menu (signed
  out and in) at 1366/1024/390px; no horizontal scroll at 390px.

## Customer registration

- **Entry points:** the customer login card ends with "ยังไม่มีบัญชี? สมัครสมาชิก" (larger
  type than the help text so it reads as the next step), the header login panel and the
  mobile menu add "ลูกค้าใหม่? สมัครสมาชิก". Staff login stays a quiet text link.
- **Form:** the same narrow navy-bordered card as login. Name, email, password (hint: 10+
  characters, a memorable sentence works), confirmation, and the privacy notice checkbox
  with the notice opening in a new tab. Server validation reports every problem at once,
  each error under its field and tied with `aria-describedby`; name and email are kept.
- **After submit:** the form becomes a mint "ตรวจอีเมลเพื่อยืนยันการสมัคร" panel naming the
  address, with "ส่งอีเมลยืนยันอีกครั้ง" and a primary "ไปหน้าเข้าสู่ระบบ". Focus moves to
  the panel. Expired links land on a page that says so and offers a new one.
- **New-customer dashboard:** a sky welcome band with the verified note; one navy-bordered
  card "เริ่มจากขอใบเสนอราคา" with the teal quote button and LINE; "คำขอของฉัน" (status
  chips in the customer's words) and a policy empty state that explains how an existing
  policyholder gets linked. No policy cards until staff link the account.

## LINE Login and LIFF

- **Mobile first, inside LINE:** `/line` is the same narrow navy-bordered card as the other
  customer auth pages, so the LIFF view looks like the site customers already know. In
  LINE it shows only a spinner ("กำลังเปิด LINE", "กำลังตรวจสอบกับ LINE") and goes straight
  to "บัญชีของฉัน"; there is nothing to tap on the happy path.
- **Outside LINE:** a short explanation and three full-width buttons in order of
  likelihood: เข้าสู่ระบบด้วย LINE (primary), เปิดในแอป LINE, ใช้อีเมลเข้าสู่ระบบแทน.
  Failures say what happened in Thai and always offer email login; retry where it helps.
- **Asking before linking:** if an email account is signed in and a new LINE user arrives,
  the card asks "เชื่อมบัญชี LINE กับบัญชีที่เข้าสู่ระบบอยู่?" with the email partly hidden;
  "ไม่ใช่ฉัน ใช้บัญชี LINE แยก" keeps the accounts apart.
- **Login page:** "เข้าสู่ระบบด้วย LINE" sits above the email form as the primary button
  (teal with the LINE mark; LINE green on white text fails contrast), then "หรือใช้อีเมล".
- **Dashboard:** under the greeting, the LINE picture and name ("เชื่อมกับ LINE …"); email
  accounts without LINE get an outline "เชื่อมบัญชี LINE" button. The internal login email
  of LINE-only accounts is never shown.
- **Staff:** the customer's online-account sheet adds "สร้างลิงก์เชิญทาง LINE"; the link is
  shown once in the result message to copy into the customer's LINE chat.

## Launch audit fixes

- No text below 15px anywhere (CRM name/role/badges and the QR placeholder were 14px).
- Pipeline strip on phones: two rows, open stages above and outcomes (won/lost) below,
  so Thai labels wrap only at word boundaries instead of being squeezed into five columns.
- Filter pills on the enquiry list are 44px tall touch targets.

## Launch audit fixes

- No text below 15px anywhere (CRM name/role/badges and the QR placeholder were 14px).
- Pipeline strip on phones: two rows, open stages above and outcomes (won/lost) below,
  so Thai labels wrap only at word boundaries instead of being squeezed into five columns.
- Filter pills on the enquiry list are 44px tall touch targets.

## Review against the brief

- *Generic default caught:* a four-up grid of identical rounded product cards with soft
  shadows (the SaaS-card kit). Revised to a lead row plus a plain list, matching the poster.
- *Generic default caught:* `ชั้น 1 • 2+ • 3+` as a middle-dot meta string. Revised to
  selectable chips in the quote slip, where the tiers are an actual choice.
- *Kept on purpose:* navy and teal with a light sky wash. That is the client's brand, not
  a default.
- *Not numbered:* "check, compare, coordinate" reads as three things we do, not steps the
  user follows, so no 01/02/03 markers.

## Quotation-first journey (stage 1)

Plan: a visitor should reach a saved quotation request without an account, on a phone,
in one screen. Decisions:

- **Navigation.** Login/registration links and the header account menu are gone; the
  portal still works at `/customer/login` for existing customers (sign-out now sits on
  the dashboard). The footer's bottom row has a muted "สำหรับเจ้าหน้าที่" link
  (`rel="nofollow"`, 44px target) to `/staff/login`.
- **Homepage order:** headline + quote form (form is the first thing under the headline on
  phones; the hero paragraph and image are desktop-only) → three checkable facts about the
  site → product cards with "ขอใบเสนอราคา" per product → numbered process → coverage
  guidance (tier table reused from the product page, พ.ร.บ./EV/travel notes) → FAQs
  (`details`/`summary`, + rotates, motion-reduce safe) → contact band.
- **Claims.** Removed "หลายบริษัท", "ไม่มีค่าใช้จ่าย", "คุ้มที่สุด" and similar; nothing about
  licences, partners, prices, discounts, reviews, counts or response times until confirmed.
  The licence line appears only when `legal.companyName` and `legal.brokerLicenseNo` are set.
- **Quote form.** Plan chips first, then only that product's questions: brand (free text
  with a suggestion list, not a verified database), model (free text), year (select labelled
  "ปีรถ (พ.ศ.)", options "2569 (2026)"; see below), renewal timing (select), optional repair (ชั้น 1), home charger
  (EV), usage; พ.ร.บ. asks vehicle type with brand/model optional; travel asks destination,
  start date, days, travellers. Chip groups now carry errors with `aria-describedby`.
- **Confirmation.** Only after the server returns a `CK-` reference: reference in a mint
  panel with a copy button, "ขั้นตอนต่อไป" list, summary, LINE button (lin.ee/86TezJV).
  Errors keep the visitor's answers and say nothing was saved.
- **Missing contact details** are hidden rather than shown as `[เบอร์โทรศัพท์]` or an empty
  QR box.

Critique from screenshots (1366 and 390): the headline split "ประกัน / รถยนต์" on phones,
fixed with a no-wrap span; the hero paragraph repeated the form's intro on phones, so it is
hidden below `sm`. No horizontal scroll at 390px on any journey screen (checked by
`verify:journey`).

## Quotation form: width and tidiness (stage 2)

Problem: on desktop the form sat in a fixed 440px column (480px on `/quote`) inside a
1120px `.wrap`, leaving 178px year selects, a renewal label that wrapped and pushed its
select out of line, and plan chips spilling onto a second ragged row.

- **Width.** `.wrap` is 1240px site-wide (header, sections and footer stay aligned). The
  form column comes from one shared class, `quoteSplit` in `src/components/quote-layout.ts`,
  used by the homepage hero, product pages and `/quote`: 600px from 1280px, 520px from
  1024px, full width below (704px on a 768px tablet, 358px on a 390px phone). The content
  column keeps about 520px beside it at 1366px; the product pages stack their three cover
  notes between 1024 and 1279px, where that column is narrower.
- **Rows by container, not viewport.** The `<form>` is an `@container`; paired fields (brand
  and model, year and renewal, name and phone, destination and start date) share a row only
  at `@lg` (form content ≥ 32rem). So they pair at 768px and ≥ 1280px, and stack on phones
  and at 1024px, where they would otherwise squeeze labels onto two lines.
- **Plan selector as tiles.** Six equal-width tiles (2 per row, 3 from `@sm`) instead of
  wrapping pills; labels never wrap. This is the form's one distinctive element.
- **Optional fields** carry a quiet "ไม่บังคับ" tag after the label instead of "(ไม่บังคับ)"
  inside it, keeping labels short and on one line. Renewal labels shortened to
  "ประกันเดิมหมดเมื่อไร" / "พ.ร.บ. เดิมหมดเมื่อไร".
- **Year.** Label "ปีรถ (พ.ศ.)", placeholder "เลือกปีรถ", options "2569 (2026)" (พ.ศ. = ค.ศ. +
  543), same 31-year range. Values stay Gregorian, so the API, database and CRM are unchanged;
  the confirmation summary shows "ปีรถ: 2569 (2026)".
- **Spacing and button.** Padding 20/28/32px by width, 24px between groups, 50px fields,
  and a 56px-tall submit button (`Button size="lg"`).

Screenshots before and after (390, 768, 1024, 1366): `docs/screenshots/quote-form/`.

## Product photography (stage 3)

Three supplied photos, saved as WebP in `public/images/` (`car-insurance-silver-sedan`,
`ev-insurance-white-crossover-charging`, `travel-insurance-couple-airport`; 77–152 KB,
1672×941) and listed with Thai alt text and a focal point in `src/content/product-photos.ts`.
They are statically imported, so next/image knows their size, serves resized AVIF/WebP and
shows a blur placeholder. พ.ร.บ. has no photo and keeps its icon; nothing is substituted.

- **One treatment** (`ProductPhoto`): 16:10 crop, panel radius, `object-cover` with each
  photo's own `object-position` (sedan right of centre, EV car plus wall charger, travellers
  on the right). No text sits on the photos, so busy areas never compete with type.
- **Product pages** (car, EV, travel): heading, intro and photo in the content column beside
  the 600px form on desktop; the photo replaces the product icon. Below 1024px the order is
  photo → heading → "ขอใบเสนอราคา" button (jumps to the form) → form; tablets crop to 2:1 so
  the form starts in the first screen. The hero photo is preloaded (Next 16 `preload`).
- **Homepage**: product cards get the same 16:10 strip (photos for car, EV and travel; a
  light-blue icon panel for พ.ร.บ.), lazy-loaded. The hero's old poster crop (`hero-car.webp`,
  667px) is replaced by the sedan photo, desktop only and not preloaded because phones never
  show it. The sedan therefore appears twice on desktop (hero and car card); drop it from the
  card if that feels repetitive.
- Form titles drop to 1.5rem below 640px so long names such as "ขอใบเสนอราคาประกันเดินทาง"
  stay on one line.

Screenshots before and after (390, 768, 1366): `docs/screenshots/product-photos/`.

## LINE contact points and office (stage 4)

Reference: the supplied screenshots of a bottom-right "แอดไลน์…" chip and a LINE QR modal.

- **One link, one place:** `lineUrl` `https://lin.ee/sAdMA0r`, LINE's official Thai button and
  the OA QR are config values; the old `lin.ee/86TezJV` is gone. No link shows a raw URL or ID.
- **Header:** official button (36px, aspect kept, 116×36 box reserved while it loads) just left
  of "ขอใบเสนอราคา" from 640px; below that it moves into the menu so the header never overflows.
- **Floating widget:** white card with a LINE-green round logo, "แอดไลน์เพื่อเช็กเบี้ย",
  "ส่งคำขอเช็กเบี้ยประกันรถฟรีได้ 24 ชม." (about sending a request any time, not about reply
  times) and a teal "เพิ่มเพื่อน LINE" label; 340px bottom-right on desktop, a compact
  full-width card above the quote bar on phones (the whole card is the link). No overlay;
  close button (44px, labelled) keeps it closed for the session (`sessionStorage`). It fades
  out while any form (quote, contact, login, registration), the footer or a focused field (keyboard) is on screen, so
  it never covers fields or submit buttons; because product-page forms are sticky on desktop,
  the widget stays out of the way there and the header button carries LINE. The phone quote
  bar lost its own LINE button so there is only one floating LINE control.
- **Contact page:** "คุยกับเราผ่าน LINE" card (QR 180px on white with a 16px quiet zone,
  caption "สแกนเพื่อเพิ่มเพื่อน LINE", plus the official button for people already on their
  phone); "ที่ตั้งสำนักงาน" with the address as text and a "เปิดใน Google Maps" button that
  opens the business's confirmed pin (`office.mapPinUrl`), and the same pin embedded beside it
  (`office.mapEmbedUrl`, Google's "Embed a map"; titled, lazy-loaded, 4:3 on phones, 16:11
  next to the address from 1024px).
- **Elsewhere:** "ไม่สะดวกกรอกฟอร์ม? คุยกับเราผ่าน LINE" under every quote form; the official
  button in the footer.

## Open items for the client

- Phone number, LINE ID, LINE QR image, email, opening hours and company details
  (legal name, address, broker licence number, privacy email) in `src/config/site.ts`;
  each appears on the site only once set.
- The logo and car image are cropped from the poster at its delivered resolution.
  Swap in the original vector logo and the full-size car render when available.
- Production needs `ENQUIRY_HASH_SALT` (and the Supabase variables) before forms accept
  requests; see README "Demo mode (local development only)".
