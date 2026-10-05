import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/button";
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
      <SubmissionList />
    </div>
  );
}
