import { MobileQuoteBar } from "@/components/mobile-quote-bar";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="absolute left-4 top-[-100px] z-30 rounded-[var(--radius-control)] bg-navy px-4 py-2 text-paper focus:top-2"
      >
        ข้ามไปที่เนื้อหา
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <MobileQuoteBar />
    </>
  );
}
