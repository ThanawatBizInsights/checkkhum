import type { Metadata } from "next";
import { ContactChannels } from "@/components/contact-channels";
import { QuoteForm } from "@/components/quote-form";
import { quoteSplit } from "@/components/quote-layout";
import { processSteps as steps } from "@/content/journey";
import { findPlan } from "@/content/products";

export const metadata: Metadata = {
  title: "ขอใบเสนอราคา",
  description: "ขอใบเสนอราคาประกันรถยนต์ ประกันรถ EV พ.ร.บ. และประกันเดินทาง ไม่ต้องสมัครสมาชิก ทีมงานติดต่อกลับพร้อมใบเสนอราคา",
};



export default async function QuotePage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const { plan } = await searchParams;
  const initialPlan = findPlan(Array.isArray(plan) ? plan[0] : plan)?.id ?? "car-1";

  return (
    <section className="bg-gradient-to-b from-paper to-sky pb-16 pt-8 md:pt-14">
      <div className={`wrap ${quoteSplit} lg:gap-y-10`}>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <QuoteForm key={initialPlan} initialPlan={initialPlan} title="ขอใบเสนอราคา" titleAs="h1" showNotes />
        </div>

        <div className="lg:col-start-1 lg:row-start-1">
          <h2 className="text-[1.5rem]">หลังส่งคำขอ</h2>
          {/* A real sequence, so it is numbered. */}
          <ol className="mt-4 grid gap-5">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-navy font-display font-semibold text-paper">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg">{s.title}</h3>
                  <p className="text-ink-soft">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:col-start-1">
          <h2 className="mb-4 text-[1.5rem]">อยากคุยกับเราโดยตรง</h2>
          <ContactChannels tone="light" />
        </div>
      </div>
    </section>
  );
}
