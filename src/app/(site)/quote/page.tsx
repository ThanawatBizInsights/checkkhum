import type { Metadata } from "next";
import { ContactChannels } from "@/components/contact-channels";
import { QuoteForm } from "@/components/quote-form";
import { findPlan } from "@/content/products";

export const metadata: Metadata = {
  title: "ขอใบเสนอราคา",
  description: "ขอใบเสนอราคาประกันรถยนต์ ประกันรถ EV พ.ร.บ. และประกันเดินทาง เราเทียบแผนจากหลายบริษัทให้ ไม่มีค่าใช้จ่าย",
};

const steps = [
  { title: "คุณส่งคำขอ", body: "บอกประเภทประกันและข้อมูลรถหรือทริปของคุณ" },
  { title: "เราเทียบแผนให้", body: "รวบรวมเบี้ยและความคุ้มครองจากหลายบริษัท แล้วสรุปความต่างให้อ่านง่าย" },
  { title: "คุณเลือกแผนที่คุ้ม", body: "ถามได้ทุกข้อก่อนตัดสินใจ ไม่มีข้อผูกมัด" },
];

export default async function QuotePage({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const { plan } = await searchParams;
  const initialPlan = findPlan(Array.isArray(plan) ? plan[0] : plan)?.id ?? "car-1";

  return (
    <section className="bg-gradient-to-b from-paper to-sky pb-16 pt-8 md:pt-14">
      <div className="wrap grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)] lg:gap-14">
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
