import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, NotConnected } from "@/components/customer/auth-card";
import { RegisterForm } from "@/components/customer/register-form";
import { getCustomerState } from "@/lib/server/customer-auth";

export const metadata: Metadata = { title: "สมัครสมาชิก", robots: { index: false, follow: false } };

export default async function RegisterPage() {
  const state = await getCustomerState();
  if (state.kind === "customer") redirect("/customer");
  if (state.kind === "staff") redirect("/staff");

  return (
    <AuthCard
      title="สมัครสมาชิก"
      intro="ติดตามคำขอใบเสนอราคาของคุณได้ในที่เดียว ใช้อีเมลที่เปิดอ่านได้ เราจะส่งลิงก์ยืนยันไปให้"
    >
      {state.kind === "unconfigured" ? <NotConnected /> : <RegisterForm />}
      <p className="mt-5 border-t border-line pt-4">
        มีบัญชีแล้ว?{" "}
        <Link href="/customer/login" className="inline-flex min-h-11 items-center font-semibold text-teal-ink underline underline-offset-4">
          เข้าสู่ระบบ
        </Link>
      </p>
      <p className="text-[0.9375rem] text-ink-soft">
        เคยทำประกันกับเช็กคุ้มแล้ว? หลังสมัคร แจ้งทีมงานทาง LINE ทีมงานจะส่งคำเชิญไปที่อีเมลนี้เพื่อเชื่อมกรมธรรม์เดิมให้
      </p>
    </AuthCard>
  );
}
