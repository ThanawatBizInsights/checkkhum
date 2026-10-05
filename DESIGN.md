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
[contact band: phone, LINE, QR            ]  [sticky quote bar]
```

Left-aligned throughout; the poster centres its headline, but centred multi-line
Thai is harder to scan on screen.

**Principles.**

1. The quote slip is the memorable thing. It sits in the first screen on every width;
   everything else stays quiet.
2. Products keep the poster's hierarchy: ประกันรถยนต์ (ชั้น 1, 2+, 3+) leads, the other
   three follow as a lighter list, not a grid of identical cards.
3. Contact details live in one config object (`assets/app.js`). Until real numbers are
   set, the page shows the poster's placeholders rather than invented ones.

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

- Phone number, LINE ID and the LINE QR image (`CONTACT` in `assets/app.js`, QR at `assets/line-qr.png`).
- The logo and car image are cropped from the poster at its delivered resolution.
  Swap in the original vector logo and the full-size car render when available.
- The form has no backend: it builds the request and hands it to LINE or the phone.
