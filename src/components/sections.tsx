import Link from "next/link";
import type { ReactNode } from "react";
import { products, type ProductSlug } from "@/content/products";
import { ContactChannels, LineQr } from "./contact-channels";
import { productIcons } from "./icons";

/** Title block for inner pages. */
export function PageIntro({ title, children, aside }: { title: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="bg-gradient-to-b from-paper to-sky py-10 md:py-14">
      <div className="wrap">
        <h1 className="max-w-[18em] text-[clamp(2rem,1.4rem+2.6vw,3rem)] leading-[1.3]">{title}</h1>
        {children && <div className="mt-3 max-w-[38em] text-lg text-ink-soft">{children}</div>}
        {aside}
      </div>
    </div>
  );
}

/**
 * The four products in the poster's hierarchy: car insurance leads with its
 * tiers, the other three follow as a lighter list.
 */
export function ProductOverview({ exclude, title = "ประกันที่เราช่วยเปรียบเทียบให้" }: { exclude?: ProductSlug; title?: string }) {
  const lead = products.car;
  const rest = (["ev", "compulsory", "travel"] as const).filter((s) => s !== exclude);
  const LeadIcon = productIcons.car;

  return (
    <section aria-labelledby="products-title" className="py-16">
      <div className="wrap">
        <h2 id="products-title" className="mb-7 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
          {title}
        </h2>
        {exclude !== "car" && (
          <div className="flex gap-5 border-t-2 border-navy py-6">
            <LeadIcon className="size-[72px] shrink-0" />
            <div>
              <h3 className="text-[1.625rem]">
                <Link href={lead.href} className="hover:underline hover:underline-offset-8">
                  {lead.name}
                </Link>
              </h3>
              <p className="mt-1 max-w-[36em]">{lead.summary}</p>
              <ul aria-label="ชั้นประกันรถยนต์" className="mt-3.5 flex flex-wrap gap-2">
                {["ชั้น 1", "ชั้น 2+", "ชั้น 3+"].map((t) => (
                  <li key={t} className="rounded-full bg-mint px-3.5 py-0.5 font-semibold text-teal-ink">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <ul className={`grid md:grid-cols-3 md:gap-x-8 ${exclude === "car" ? "border-t-2 border-navy" : ""}`}>
          {rest.map((slug) => {
            const p = products[slug];
            const Icon = productIcons[slug];
            return (
              <li
                key={slug}
                className={`flex gap-5 border-t border-line py-5 md:flex-col md:gap-3 ${exclude === "car" ? "first:border-t-0 md:first:border-t" : ""}`}
              >
                <Icon className="size-14 shrink-0" />
                <div>
                  <h3>
                    <Link href={p.href} className="hover:underline hover:underline-offset-8">
                      {p.name}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-ink-soft">{p.summary}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const helpItems = [
  {
    title: "เช็กความคุ้มครอง",
    body: "อ่านเงื่อนไขกรมธรรม์ให้ แล้วสรุปเป็นภาษาที่เข้าใจง่าย ว่าคุ้มครองอะไรและไม่คุ้มครองอะไร",
  },
  {
    title: "เปรียบเทียบเบี้ย",
    body: "วางราคาและทุนประกันจากหลายบริษัทไว้ข้างกัน เพื่อให้คุณเลือกแผนที่คุ้มที่สุดสำหรับรถของคุณ",
  },
  {
    title: "ช่วยประสานงาน",
    body: "ตั้งแต่ทำกรมธรรม์ ต่ออายุ ไปจนถึงตอนเคลม เราช่วยติดต่อบริษัทประกันให้",
  },
];

export function HelpSection() {
  return (
    <section aria-labelledby="help-title" className="bg-sky pb-16 pt-14">
      <div className="wrap">
        <h2 id="help-title" className="mb-6 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]">
          เราช่วยอะไรคุณได้บ้าง
        </h2>
        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {helpItems.map((h) => (
            <div key={h.title}>
              <h3 className="text-teal-ink">{h.title}</h3>
              <p className="mt-1 max-w-[30em]">{h.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Navy band with phone, LINE and QR: the poster's footer. */
export function ContactBand({ title = "สอบถาม หรือขอใบเสนอราคา" }: { title?: string }) {
  return (
    <section aria-labelledby="contact-band-title" className="bg-navy-deep py-14 text-paper">
      <div className="wrap grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <h2 id="contact-band-title" className="mb-5 text-[clamp(1.5rem,1.2rem+1.2vw,2rem)] text-paper">
            {title}
          </h2>
          <ContactChannels tone="dark" />
        </div>
        <LineQr tone="dark" />
      </div>
    </section>
  );
}
