import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/customer/auth-card";
import { buttonClasses } from "@/components/button";
import { LiffEntry } from "@/components/line/liff-entry";
import { getLineConfig } from "@/lib/server/line";

export const metadata: Metadata = { title: "เข้าสู่ระบบด้วย LINE", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * LIFF endpoint (LINE Developers › LIFF › Endpoint URL = https://<domain>/line)
 * and the LINE Login page for normal browsers. `?link=1` attaches LINE to the
 * signed-in email account; `?invite=<token>` accepts a staff invitation link.
 */
export default async function LinePage({ searchParams }: { searchParams: Promise<{ link?: string }> }) {
  const config = getLineConfig();
  const intent = (await searchParams).link === "1" ? "link" : "login";

  return (
    <AuthCard
      title={intent === "link" ? "เชื่อมบัญชี LINE" : "เข้าสู่ระบบด้วย LINE"}
      intro="ดูคำขอ ใบเสนอราคา กรมธรรม์ เอกสาร และวันต่ออายุของคุณ ด้วยบัญชี LINE"
    >
      <div className="mt-5">
        {config ? (
          <LiffEntry liffId={config.liffId} intent={intent} />
        ) : (
          <>
            <p role="status" className="rounded-[var(--radius-control)] bg-warn-bg px-3 py-2 text-[0.9375rem] text-warn">
              ยังไม่ได้ตั้งค่าเข้าสู่ระบบด้วย LINE ใช้อีเมลเข้าสู่ระบบได้ตามปกติ
            </p>
            <Link href="/customer/login" className={`${buttonClasses("primary", "md", true)} mt-4`}>
              เข้าสู่ระบบด้วยอีเมล
            </Link>
          </>
        )}
      </div>
      <p className="mt-6 border-t border-line pt-4 text-[0.9375rem] text-ink-soft">
        เราใช้ชื่อและรูปโปรไฟล์ LINE เพื่อแสดงในบัญชีของคุณ และใช้ LINE user ID เพื่อจำบัญชี ไม่ได้อ่านแชทหรือรายชื่อเพื่อนของคุณ อ่าน{" "}
        <Link href="/privacy" className="text-teal-ink underline underline-offset-4">
          ประกาศความเป็นส่วนตัว
        </Link>
      </p>
    </AuthCard>
  );
}
