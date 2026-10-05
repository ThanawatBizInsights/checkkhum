import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { STAFF_COOKIE, getStaffAuthConfig, verifySessionToken } from "@/lib/staff-session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function StaffLoginPage() {
  const session = await verifySessionToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (session) redirect("/staff/dashboard");

  const config = getStaffAuthConfig();

  return (
    <div className="wrap grid place-items-center py-14">
      <div className="w-full max-w-[420px] rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-7 md:p-8">
        <h1 className="text-[1.75rem]">เข้าสู่ระบบพนักงาน</h1>
        {config.enabled ? (
          <>
            {config.usingDevDefaults && (
              <p className="mb-1 mt-3 rounded-[var(--radius-control)] bg-demo-bg px-3 py-2 text-[0.9375rem] text-ink">
                บัญชีสาธิตสำหรับการพัฒนา ดูอีเมลและรหัสผ่านได้ใน README.md
              </p>
            )}
            <LoginForm />
          </>
        ) : (
          <p className="mt-3 text-ink-soft">ยังเข้าสู่ระบบไม่ได้: {config.reason}</p>
        )}
      </div>
    </div>
  );
}
