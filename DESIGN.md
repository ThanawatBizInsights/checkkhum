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

## LINE Official Account (lin.ee/86TezJV)

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

## Open items for the client

- Phone number, LINE ID, LINE QR image and company details in `src/config/site.ts`.
- The logo and car image are cropped from the poster at its delivered resolution.
  Swap in the original vector logo and the full-size car render when available.
- Forms save demo submissions only; see README "Demo mode".
