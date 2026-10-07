import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard, FormField, NotConnected } from "@/components/customer/auth-card";
import { ActionForm } from "@/components/staff/action-form";
import { getCustomerState } from "@/lib/server/customer-auth";
import { resendVerification } from "../_actions/auth";

export const metadata: Metadata = { title: "ยืนยันอีเมล", robots: { index: false, follow: false } };

/** Resend the sign-up verification email; also where expired verification links land. */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const state = await getCustomerState();
  const { error } = await searchParams;
  return (
    <AuthCard title="ยืนยันอีเมล" intro="ต้องยืนยันอีเมลก่อนเข้าสู่ระบบครั้งแรก กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ยืนยันใหม่ให้">
      {error === "expired" && (
        <p role="alert" className="mt-4 rounded-[var(--radius-control)] bg-error-bg px-3 py-2 text-[0.9375rem] text-error">
          ลิงก์ยืนยันหมดอายุหรือถูกใช้ไปแล้ว ถ้ายืนยันแล้ว เข้าสู่ระบบได้เลย ถ้ายังไม่ได้ยืนยัน ขอลิงก์ใหม่ด้านล่าง
        </p>
      )}
      {state.kind === "unconfigured" ? (
        <NotConnected />
      ) : (
        <ActionForm action={resendVerification} submitLabel="ส่งอีเมลยืนยันอีกครั้ง" pendingLabel="กำลังส่ง" size="md" className="mt-5 grid gap-4">
          <FormField id="email" name="email" type="email" label="อีเมล" autoComplete="email" required />
        </ActionForm>
      )}
      <p className="mt-4 flex flex-wrap gap-x-6">
        <Link href="/customer/login" className="inline-flex min-h-11 items-center font-semibold text-teal-ink underline underline-offset-4">
          เข้าสู่ระบบ
        </Link>
        <Link href="/customer/register" className="inline-flex min-h-11 items-center font-semibold text-teal-ink underline underline-offset-4">
          สมัครสมาชิก
        </Link>
      </p>
    </AuthCard>
  );
}
