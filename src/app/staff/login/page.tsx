import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/staff/action-form";
import { getStaffState } from "@/lib/server/staff-auth";
import { signIn, signOut } from "../_actions/auth";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const state = await getStaffState();
  if (state.kind === "staff") redirect("/staff");
  const { next, error } = await searchParams;

  return (
    <main id="main" className="wrap grid min-h-dvh place-items-center py-10">
      <div className="w-full max-w-[420px]">
        <Link href="/" className="mb-6 flex items-center gap-3 font-display text-lg font-semibold text-navy">
          <Image src="/images/checkkhum-mark.png" width={200} height={190} alt="" className="h-12 w-auto" />
          ระบบพนักงานเช็กคุ้ม
        </Link>
        <div className="rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-7 md:p-8">
          <h1 className="text-[1.75rem]">เข้าสู่ระบบ</h1>
          {state.kind === "unconfigured" ? (
            <p className="mt-3 text-ink-soft">
              ระบบพนักงานยังไม่ได้เชื่อมต่อฐานข้อมูล ตั้งค่า SUPABASE_URL และ SUPABASE_PUBLISHABLE_KEY ก่อน
            </p>
          ) : (
            <>
              {(error === "not_staff" || state.kind === "not_staff") && (
                <p role="alert" className="mt-3 rounded-[var(--radius-control)] bg-error-bg px-3 py-2 text-[0.9375rem] text-error">
                  บัญชีนี้ไม่มีสิทธิ์เข้าใช้ระบบพนักงาน ติดต่อผู้ดูแลระบบ
                </p>
              )}
              {state.kind === "not_staff" && (
                <form action={signOut} className="mt-3">
                  <button type="submit" className="font-semibold text-teal-ink underline underline-offset-4">
                    ออกจากระบบ {state.email}
                  </button>
                </form>
              )}
              <ActionForm action={signIn} submitLabel="เข้าสู่ระบบ" pendingLabel="กำลังเข้าสู่ระบบ" size="md" className="mt-5 grid gap-4">
                <input type="hidden" name="next" value={next ?? ""} />
                <div>
                  <label htmlFor="email" className="mb-1.5 block font-semibold text-navy">
                    อีเมล
                  </label>
                  <input id="email" name="email" type="email" autoComplete="username" required className="field-input" />
                </div>
                <div>
                  <label htmlFor="password" className="mb-1.5 block font-semibold text-navy">
                    รหัสผ่าน
                  </label>
                  <input id="password" name="password" type="password" autoComplete="current-password" required className="field-input" />
                </div>
              </ActionForm>
              <p className="mt-4 text-[0.9375rem] text-ink-soft">ลืมรหัสผ่าน ติดต่อผู้ดูแลระบบเพื่อตั้งรหัสผ่านชั่วคราวใหม่</p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
