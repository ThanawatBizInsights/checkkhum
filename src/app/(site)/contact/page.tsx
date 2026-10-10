import type { Metadata } from "next";
import { ContactChannels, LineQr } from "@/components/contact-channels";
import { ContactForm } from "@/components/contact-form";
import { LineAddFriendButton } from "@/components/line-links";
import { PageIntro } from "@/components/sections";
import { emailChannel, office, phoneChannel } from "@/lib/contact";

export const metadata: Metadata = {
  title: "ติดต่อเรา",
  description: "แชททาง LINE หรือฝากเบอร์ให้เช็กคุ้มติดต่อกลับ เรื่องประกันรถยนต์ พ.ร.บ. และประกันเดินทาง พร้อมที่อยู่สำนักงาน",
};

function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <>
      <PageIntro title="ติดต่อเรา">
        <p>แชททาง LINE ได้เลย หรือฝากเบอร์ไว้ให้เราติดต่อกลับ</p>
      </PageIntro>

      <section className="py-14">
        <div className="wrap grid gap-12 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-14">
          <div className="grid content-start gap-8">
            {/* Phone and email appear once configured; LINE has its own block below. */}
            {(phoneChannel.href || emailChannel.href) && (
              <div>
                <h2 className="mb-5 text-[1.5rem]">ช่องทางติดต่อ</h2>
                <ContactChannels tone="light" showEmail showLine={false} />
              </div>
            )}

            <section aria-labelledby="line-title" className="rounded-[var(--radius-panel)] border border-line bg-sky p-5 sm:p-6">
              <h2 id="line-title" className="text-[1.375rem]">
                คุยกับเราผ่าน LINE
              </h2>
              <p className="mt-1 max-w-[30em] text-ink-soft">เพิ่มเพื่อนแล้วส่งรุ่นรถหรือแผนเดินทางมาได้เลย ทีมงานจะตอบกลับในแชท</p>
              <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-5">
                <LineQr tone="light" />
                <div className="grid gap-2">
                  <p className="text-[0.9375rem] text-ink-soft">ใช้โทรศัพท์อยู่? กดปุ่มนี้แทนการสแกน</p>
                  <div>
                    <LineAddFriendButton />
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="h-fit rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-6 md:p-8">
            <h2 className="mb-1 text-[1.5rem]">ฝากให้ติดต่อกลับ</h2>
            <p className="mb-5 text-ink-soft">บอกเรื่องที่ต้องการสอบถาม แล้วเราจะติดต่อกลับในเวลาทำการ</p>
            <ContactForm />
          </div>
        </div>
      </section>

      <section aria-labelledby="office-title" className="bg-sky py-14">
        <div className={`wrap grid gap-8 ${office.embedUrl ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start" : ""}`}>
          <div className="max-w-[36rem]">
            <h2 id="office-title" className="text-[1.5rem]">
              ที่ตั้งสำนักงาน
            </h2>
            <address className="mt-4 rounded-[var(--radius-panel)] border border-line bg-paper p-5 not-italic sm:p-6">
              <p className="font-display text-lg font-semibold text-navy">{office.companyName}</p>
              <p className="mt-1">
                {office.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </p>
              <a
                href={office.mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                data-maps-link
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-navy px-5 font-display font-semibold text-navy hover:bg-navy hover:text-paper"
              >
                <MapPinIcon className="size-5" />
                เปิดใน Google Maps
                <span className="sr-only"> (เปิดในแท็บใหม่)</span>
              </a>
            </address>
          </div>
          {office.embedUrl && (
            <div className="aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] border border-line bg-paper lg:aspect-[16/11]">
              <iframe
                src={office.embedUrl}
                title={`แผนที่ ${office.companyName}`}
                className="size-full border-0"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
