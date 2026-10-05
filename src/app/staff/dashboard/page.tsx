import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/button";
import { isDatabaseConfigured, supabaseProjectRef } from "@/lib/server/env";
import { STAFF_COOKIE, verifySessionToken } from "@/lib/staff-session";
import { staffLogout } from "../actions";
import { SubmissionList } from "./submission-list";

export const metadata: Metadata = { title: "คำขอจากลูกค้า" };

export default async function StaffDashboardPage() {
  // proxy.ts already redirects signed-out visitors; check again here so the
  // page never relies on the proxy alone.
  const session = await verifySessionToken((await cookies()).get(STAFF_COOKIE)?.value);
  if (!session) redirect("/staff/login");

  return (
    <div className="wrap py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(1.75rem,1.4rem+1.4vw,2.25rem)]">คำขอจากลูกค้า</h1>
          <p className="text-ink-soft">เข้าสู่ระบบในชื่อ {session.email}</p>
        </div>
        <form action={staffLogout}>
          <Button type="submit" variant="outline" size="sm">
            ออกจากระบบ
          </Button>
        </form>
      </div>
      {isDatabaseConfigured() ? <DatabaseNotice projectRef={supabaseProjectRef()} /> : <SubmissionList />}
    </div>
  );
}

/**
 * With Supabase connected, enquiries live in the database, protected by row
 * level security. This demo login cannot read them (it is not a Supabase Auth
 * session), so point staff to the Supabase dashboard until staff sign-in is
 * moved to Supabase Auth.
 */
function DatabaseNotice({ projectRef }: { projectRef: string | null }) {
  const href = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/editor`
    : "https://supabase.com/dashboard/projects";
  return (
    <div className="mt-6 max-w-[44em] rounded-[var(--radius-panel)] bg-paper px-6 py-7">
      <h2 className="text-xl">คำขอจากเว็บไซต์ถูกบันทึกในฐานข้อมูลแล้ว</h2>
      <p className="mt-2">
        คำขอใหม่อยู่ในตาราง <code>enquiries</code> ของ Supabase พร้อมข้อมูลลูกค้าและการยินยอม
        หน้านี้ยังเปิดดูไม่ได้ เพราะการเข้าสู่ระบบพนักงานยังเป็นโหมดสาธิต ไม่ใช่บัญชี Supabase Auth
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block font-semibold text-teal-ink underline underline-offset-4"
      >
        เปิดตาราง enquiries ใน Supabase
      </a>
    </div>
  );
}
