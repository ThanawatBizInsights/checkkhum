import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, FormField, NotConnected } from "@/components/customer/auth-card";
import { ActionForm } from "@/components/staff/action-form";
import { getCustomerState } from "@/lib/server/customer-auth";
import { requestPasswordReset } from "../_actions/auth";

export const metadata: Metadata = { title: "ลืมรหัสผ่าน", robots: { index: false, follow: false } };

export default async function ForgotPasswordPage() {
  const state = await getCustomerState();
  return (
    <AuthCard title="ลืมรหัสผ่าน" intro="กรอกอีเมลที่ใช้กับบัญชีลูกค้า เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้">
      {state.kind === "unconfigured" ? (
        <NotConnected />
      ) : (
        <ActionForm action={requestPasswordReset} submitLabel="ส่งลิงก์ตั้งรหัสผ่าน" pendingLabel="กำลังส่ง" size="md" className="mt-5 grid gap-4">
          <FormField id="email" name="email" type="email" label="อีเมล" autoComplete="email" required />
        </ActionForm>
      )}
      <p className="mt-4">
        <Link href="/customer/login" className="inline-flex min-h-11 items-center font-semibold text-teal-ink underline underline-offset-4">
          กลับไปเข้าสู่ระบบ
        </Link>
      </p>
    </AuthCard>
  );
}
