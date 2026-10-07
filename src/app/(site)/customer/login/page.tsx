import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, FormField, NotConnected } from "@/components/customer/auth-card";
import { LineButton } from "@/components/line-links";
import { ActionForm } from "@/components/staff/action-form";
import { getCustomerState } from "@/lib/server/customer-auth";
import { customerSignIn } from "../_actions/auth";

export const metadata: Metadata = { title: "เข้าสู่ระบบลูกค้า", robots: { index: false, follow: false } };

export default async function CustomerLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const state = await getCustomerState();
  if (state.kind === "customer") redirect("/customer");
  if (state.kind === "staff") redirect("/staff");
  const { error } = await searchParams;

  return (
    <AuthCard
      title="เข้าสู่ระบบลูกค้า"
      intro="ดูใบเสนอราคา กรมธรรม์ และวันต่ออายุของคุณ บัญชีลูกค้าเปิดให้โดยทีมงาน ทางอีเมลเชิญ"
    >
      {state.kind === "unconfigured" ? (
        <NotConnected />
      ) : (
        <>
          {error === "link" && (
            <p role="alert" className="mt-4 rounded-[var(--radius-control)] bg-error-bg px-3 py-2 text-[0.9375rem] text-error">
              ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่ที่ “ลืมรหัสผ่าน” หรือขอคำเชิญใหม่จากทีมงาน
            </p>
          )}
          <ActionForm action={customerSignIn} submitLabel="เข้าสู่ระบบ" pendingLabel="กำลังเข้าสู่ระบบ" size="md" className="mt-5 grid gap-4">
            <FormField id="email" name="email" type="email" label="อีเมล" autoComplete="username" required />
            <FormField id="password" name="password" type="password" label="รหัสผ่าน" autoComplete="current-password" required />
          </ActionForm>
          <p className="mt-4">
            <Link href="/customer/forgot-password" className="inline-flex min-h-11 items-center font-semibold text-teal-ink underline underline-offset-4">
              ลืมรหัสผ่าน
            </Link>
          </p>
        </>
      )}
      <div className="mt-6 border-t border-line pt-5">
        <p className="text-[0.9375rem] text-ink-soft">ยังไม่มีบัญชี ขอให้ทีมงานส่งคำเชิญทาง LINE</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <LineButton size="sm">ติดต่อทีมงานผ่าน LINE</LineButton>
        </div>
        <p className="mt-4 text-[0.9375rem]">
          <Link href="/staff/login" className="inline-flex min-h-11 items-center text-ink-soft underline underline-offset-4">
            เข้าสู่ระบบเจ้าหน้าที่
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
