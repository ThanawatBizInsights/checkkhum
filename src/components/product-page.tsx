import { coverageDisclaimer, type Product } from "@/content/products";
import { CheckMark, Dash, productIcons } from "./icons";
import { QuoteForm } from "./quote-form";
import { ContactBand, ProductOverview } from "./sections";

/** Tier comparison table (car insurance); also used on the homepage. */
export function TierTable({ product, caption = "เทียบความคุ้มครองแต่ละชั้น" }: { product: Product; caption?: string }) {
  if (!product.tiers) return null;
  const heads = ["ชั้น 1", "ชั้น 2+", "ชั้น 3+"];
  return (
    <div className="mt-8">
      <table className="w-full table-fixed border-collapse text-left">
        <caption className="mb-3 text-left font-display text-xl font-semibold text-navy">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-navy">
            <th scope="col" className="py-3 pr-4 font-semibold text-ink-soft">
              ความคุ้มครอง
            </th>
            {heads.map((h) => (
              <th key={h} scope="col" className="w-[3.75rem] py-3 text-center font-display text-base font-semibold text-navy sm:w-24 sm:text-lg">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {product.tiers.map((row) => (
            <tr key={row.item} className="border-b border-line">
              <th scope="row" className="py-3.5 pr-3 text-[0.9375rem] font-normal sm:pr-4 sm:text-base">
                {row.item}
              </th>
              {row.values.map((v, i) => (
                <td key={heads[i]} className="py-3.5 text-center">
                  {v ? <CheckMark className="mx-auto size-6 text-teal" /> : <Dash className="mx-auto size-6 text-[#9aa6ba]" />}
                  <span className="sr-only">{v ? "คุ้มครอง" : "ไม่คุ้มครอง"}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shared layout for the four product pages. Content lives in src/content/products.ts. */
export function ProductPage({ product }: { product: Product }) {
  const Icon = productIcons[product.slug];
  return (
    <>
      <section className="bg-gradient-to-b from-paper to-sky pb-14 pt-8 md:pb-[72px] md:pt-14">
        <div className="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-x-14 lg:gap-y-12">
          <div className="lg:col-start-1">
            <Icon className="size-16 md:size-20" />
            <h1 className="mt-4 text-[clamp(2rem,1.4rem+2.6vw,3rem)] leading-[1.3]">{product.headline}</h1>
            <p className="mt-3 max-w-[34em] text-lg text-ink-soft">{product.intro}</p>
          </div>

          <div className="lg:col-start-2 lg:row-span-3 lg:row-start-1">
            <div className="lg:sticky lg:top-6">
              <QuoteForm key={product.quotePlan} initialPlan={product.quotePlan} title={`ขอใบเสนอราคา${product.name}`} />
            </div>
          </div>

          <div className="min-w-0 lg:col-start-1">
            <h2 className="text-[1.5rem]">คุ้มครองอะไรบ้าง</h2>
            <dl className="mt-4 grid gap-5 sm:grid-cols-3 sm:gap-6">
              {product.covers.map((c) => (
                <div key={c.title} className="border-t-2 border-teal pt-3">
                  <dt className="font-display text-lg font-semibold text-navy">{c.title}</dt>
                  <dd className="mt-1 text-[0.9375rem] leading-[1.7]">{c.body}</dd>
                </div>
              ))}
            </dl>
            <TierTable product={product} />
          </div>

          <div className="grid gap-10 md:grid-cols-2 lg:col-start-1">
            <div>
              <h2 className="text-[1.5rem]">เรื่องที่ควรเช็กก่อนเลือก</h2>
              <ul className="mt-3 grid gap-2.5">
                {product.checklist.map((item) => (
                  <li key={item} className="flex gap-3">
                    <CheckMark className="mt-1.5 size-5 shrink-0 text-teal" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-[1.5rem]">ข้อมูลที่ใช้ขอใบเสนอราคา</h2>
              <ul className="mt-3 grid list-disc gap-2.5 pl-5 marker:text-teal">
                {product.quoteNeeds.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <p className="text-[0.9375rem] text-ink-soft md:col-span-2">{coverageDisclaimer}</p>
          </div>
        </div>
      </section>

      <ProductOverview exclude={product.slug} title="ประกันอื่นที่เราช่วยเปรียบเทียบ" />
      <ContactBand />
    </>
  );
}
