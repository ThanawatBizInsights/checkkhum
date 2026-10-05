import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "พนักงาน", template: "%s | พนักงานเช็กคุ้ม" },
  robots: { index: false, follow: false },
};

/** Staff area: separate from the public site chrome, never indexed. */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-sky">
      <div className="bg-demo-bg py-2 text-center text-[0.9375rem] font-semibold text-demo">
        ระบบพนักงานโหมดสาธิต: การเข้าสู่ระบบยังไม่ได้ใช้บัญชี Supabase Auth
      </div>
      <header className="border-b border-line bg-paper">
        <div className="wrap flex items-center justify-between gap-4 py-2">
          <Link href="/staff/dashboard" className="flex items-center gap-3 font-display text-lg font-semibold text-navy">
            <Image src="/images/checkkhum-mark.png" width={200} height={190} alt="" className="h-11 w-auto" />
            พนักงานเช็กคุ้ม
          </Link>
          <Link href="/" className="text-[0.9375rem] font-medium text-teal-ink underline underline-offset-4">
            ไปหน้าเว็บไซต์
          </Link>
        </div>
      </header>
      <main id="main">{children}</main>
    </div>
  );
}
