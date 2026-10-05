import Image from "next/image";
import { LineButton } from "@/components/line-links";
import { QuoteForm } from "@/components/quote-form";
import { ContactBand, HelpSection, ProductOverview } from "@/components/sections";

export default function HomePage() {
  return (
    <>
      <section className="bg-gradient-to-b from-paper to-sky pb-12 pt-7 lg:pb-[72px] lg:pt-14">
        <div className="wrap grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[auto_1fr] lg:gap-x-14 lg:gap-y-8">
          <div>
            <h1 className="text-[clamp(2rem,1.3rem+3.2vw,3.5rem)] leading-[1.3]">
              ประกันรถยนต์
              <span className="block text-[0.72em] font-semibold">เลือกให้คุ้ม เหมาะกับคุณ</span>
            </h1>
            <p className="mt-3.5 max-w-[34em] text-lg text-ink-soft">
              ช่วยเปรียบเทียบแผน ก่อนตัดสินใจ บอกรุ่นรถกับแผนที่สนใจ เราจะส่งใบเสนอราคาจากหลายบริษัทให้ดูเทียบกัน
            </p>
            <LineButton className="mt-5">คุยกับเราผ่าน LINE</LineButton>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <QuoteForm />
          </div>

          <figure className="m-0 lg:self-start">
            <Image
              src="/images/hero-car.webp"
              width={667}
              height={390}
              alt="รถยนต์เก๋งสีเงินบนถนน มีโล่สีน้ำเงินเขียวด้านหลัง"
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="h-auto w-full rounded-[var(--radius-panel)]"
            />
          </figure>
        </div>
      </section>

      <ProductOverview />
      <HelpSection />
      <ContactBand />
    </>
  );
}
