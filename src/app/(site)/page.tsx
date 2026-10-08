import Link from "next/link";
import { buttonClasses } from "@/components/button";
import { CheckMark, productIcons } from "@/components/icons";
import { ProductPhoto } from "@/components/product-photo";
import { TierTable } from "@/components/product-page";
import { QuoteForm } from "@/components/quote-form";
import { quoteSplit } from "@/components/quote-layout";
import { ContactBand } from "@/components/sections";
import { faqs, processSteps, siteFacts } from "@/content/journey";
import { productPhotos } from "@/content/product-photos";
import { coverageDisclaimer, productOrder, products } from "@/content/products";
import { companyIdentity } from "@/lib/contact";

const sectionTitle = "text-[clamp(1.5rem,1.2rem+1.2vw,2rem)]";

/**
 * Homepage, in the order a visitor needs it: what this is and the quote form,
 * facts they can check, the products, how it works, coverage basics, FAQs,
 * then contact details. Claims stay limited to what the site itself does.
 */
export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-b from-paper to-sky pb-12 pt-7 lg:pb-[72px] lg:pt-14">
        <div className={`wrap ${quoteSplit} lg:grid-rows-[auto_1fr] lg:gap-y-8`}>
          <div>
            <h1 className="text-[clamp(1.875rem,1.3rem+2.6vw,3rem)] leading-[1.3]">
              ขอใบเสนอราคา<span className="whitespace-nowrap">ประกันรถยนต์</span>
              <span className="block text-[0.72em] font-semibold">เทียบแผนก่อนตัดสินใจ</span>
            </h1>
            <p className="mt-3 hidden max-w-[34em] text-lg text-ink-soft sm:block">
              ประกันรถยนต์ชั้น 1, 2+, 3+ รถ EV พ.ร.บ. และประกันเดินทาง กรอกข้อมูลสั้น ๆ ทีมงานจะติดต่อกลับพร้อมใบเสนอราคา
            </p>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <QuoteForm />
          </div>

          <div className="lg:self-start">
            <ul aria-label="ข้อมูลการขอใบเสนอราคา" className="grid gap-2.5">
              {siteFacts.map((fact) => (
                <li key={fact} className="flex gap-2.5">
                  <CheckMark className="mt-1 size-5 shrink-0 text-teal" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
            {companyIdentity && (
              <p className="mt-4 text-[0.9375rem] text-ink-soft">
                ดำเนินการโดย {companyIdentity.name} ใบอนุญาตนายหน้าประกันวินาศภัยเลขที่ {companyIdentity.licenceNo}
              </p>
            )}
            {/* Desktop only, beside the long form; on phones the form comes first instead. Not
                preloaded: phones never show it, and on desktop it is in view so it loads at once. */}
            <ProductPhoto
              photo={productPhotos.car!}
              sizes="(min-width: 1280px) 560px, 420px"
              className="mt-8 hidden lg:block"
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="products-title" className="py-16">
        <div className="wrap">
          <h2 id="products-title" className={`mb-7 ${sectionTitle}`}>
            ประกันที่ขอใบเสนอราคาได้
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {productOrder.map((slug) => {
              const p = products[slug];
              const Icon = productIcons[slug];
              const photo = productPhotos[slug];
              return (
                <li key={slug} className="flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper">
                  {/* Same 16:10 media strip on every card; พ.ร.บ. has no photo, so it shows its icon. */}
                  {photo ? (
                    <ProductPhoto photo={photo} rounded="" sizes="(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw" />
                  ) : (
                    <div className="grid aspect-[16/10] place-items-center bg-sky">
                      <Icon className="size-20" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <h3>
                      <Link href={p.href} className="hover:underline hover:underline-offset-8">
                        {p.name}
                      </Link>
                    </h3>
                    <p className="mt-1 flex-1 text-ink-soft">{p.summary}</p>
                    <Link href={`/quote?plan=${p.quotePlan}`} className={`${buttonClasses("quiet", "md", true)} mt-4`}>
                      ขอใบเสนอราคา<span className="sr-only"> {p.name}</span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="process-title" className="bg-sky py-16">
        <div className="wrap">
          <h2 id="process-title" className={`mb-7 ${sectionTitle}`}>
            ขั้นตอนขอใบเสนอราคา
          </h2>
          <ol className="grid gap-6 md:grid-cols-3 md:gap-8">
            {processSteps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-navy font-display text-lg font-semibold text-paper">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-teal-ink">{s.title}</h3>
                  <p className="mt-1 max-w-[30em]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="coverage-title" className="py-16">
        <div className="wrap grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <h2 id="coverage-title" className={sectionTitle}>
              เลือกชั้นประกันรถยนต์
            </h2>
            <p className="mt-2 max-w-[36em] text-ink-soft">
              ทุกชั้นคุ้มครองความเสียหายต่อบุคคลภายนอก ส่วนที่ต่างกันคือความคุ้มครองรถของคุณเอง
            </p>
            <TierTable product={products.car} caption="ความคุ้มครองโดยทั่วไปของแต่ละชั้น" />
            <p className="mt-4 text-[0.9375rem] text-ink-soft">{coverageDisclaimer}</p>
          </div>
          <div className="grid content-start gap-6">
            <div className="border-t-2 border-navy pt-4">
              <h3>พ.ร.บ. รถยนต์</h3>
              <p className="mt-1">
                กฎหมายกำหนดให้รถทุกคันต้องมี คุ้มครองค่ารักษาพยาบาลและการบาดเจ็บของผู้ประสบภัยจากรถ แต่ไม่คุ้มครองความเสียหายของตัวรถ
              </p>
              <Link href={products.compulsory.href} className="mt-1 inline-flex min-h-11 items-center font-medium text-teal-ink underline underline-offset-4">
                อ่านเรื่อง พ.ร.บ.
              </Link>
            </div>
            <div className="border-t border-line pt-4">
              <h3>รถ EV</h3>
              <p className="mt-1">{products.ev.summary}</p>
              <Link href={products.ev.href} className="mt-1 inline-flex min-h-11 items-center font-medium text-teal-ink underline underline-offset-4">
                อ่านเรื่องประกันรถ EV
              </Link>
            </div>
            <div className="border-t border-line pt-4">
              <h3>ประกันเดินทาง</h3>
              <p className="mt-1">{products.travel.summary}</p>
              <Link href={products.travel.href} className="mt-1 inline-flex min-h-11 items-center font-medium text-teal-ink underline underline-offset-4">
                อ่านเรื่องประกันเดินทาง
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="bg-sky py-16">
        <div className="wrap max-w-[52rem]">
          <h2 id="faq-title" className={`mb-6 ${sectionTitle}`}>
            คำถามที่พบบ่อย
          </h2>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-lg font-semibold text-navy [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden="true" className="text-2xl leading-none text-teal transition-transform group-open:rotate-45 motion-reduce:transition-none">
                    +
                  </span>
                </summary>
                <p className="max-w-[40em] pb-4">{f.a}</p>
              </details>
            ))}
          </div>
          <Link href="/quote" className={`${buttonClasses("primary", "md")} mt-8`}>
            ขอใบเสนอราคา
          </Link>
        </div>
      </section>

      <ContactBand />
    </>
  );
}
