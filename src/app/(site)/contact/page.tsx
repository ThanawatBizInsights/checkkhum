import type { Metadata } from "next";
import { ContactChannels, LineQr } from "@/components/contact-channels";
import { ContactForm } from "@/components/contact-form";
import { PageIntro } from "@/components/sections";

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: "โทร หรือแชททาง LINE กับเช็กคุ้ม เพื่อสอบถามเรื่องประกันรถยนต์ พ.ร.บ. และประกันเดินทาง",
};

export default function ContactPage() {
  return (
    <>
      <PageIntro title="ติดต่อเรา">
        <p>โทรหรือแชททาง LINE ได้เลย หรือฝากเบอร์ไว้ให้เราติดต่อกลับ</p>
      </PageIntro>

      <section className="py-14">
        <div className="wrap grid gap-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-14">
          <div>
            <h2 className="mb-5 text-[1.5rem]">ช่องทางติดต่อ</h2>
            <ContactChannels tone="light" showEmail />
            <div className="mt-8">
              <LineQr tone="light" />
            </div>
          </div>

          <div className="rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-6 md:p-8">
            <h2 className="mb-1 text-[1.5rem]">ฝากให้ติดต่อกลับ</h2>
            <p className="mb-5 text-ink-soft">บอกเรื่องที่ต้องการสอบถาม แล้วเราจะติดต่อกลับในเวลาทำการ</p>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
