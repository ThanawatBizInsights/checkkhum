import Image from "next/image";
import Link from "next/link";
import { StaffNav } from "@/components/staff/staff-nav";
import { roleLabels } from "@/lib/crm-labels";
import { requireStaff } from "@/lib/server/staff-auth";
import { signOut } from "../_actions/auth";

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();

  const [{ count: newEnquiries }, { count: unreadReminders }] = await Promise.all([
    staff.db.from("enquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
    staff.db.from("staff_reminders").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  const items = [
    { href: "/staff", label: "ภาพรวม", badge: unreadReminders ?? 0 },
    { href: "/staff/enquiries", label: "คำขอ", badge: newEnquiries ?? 0 },
    { href: "/staff/customers", label: "ลูกค้า" },
    { href: "/staff/policies", label: "กรมธรรม์" },
    { href: "/staff/tasks", label: "งาน" },
    { href: "/staff/reports", label: "รายงาน" },
    ...(staff.isAdmin ? [{ href: "/staff/admin", label: "ผู้ดูแลระบบ" }] : []),
    { href: "/staff/account", label: "บัญชีของฉัน" },
  ];

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#main" className="absolute left-4 top-[-100px] z-30 rounded-[var(--radius-control)] bg-paper px-4 py-2 text-navy focus:top-2">
        ข้ามไปที่เนื้อหา
      </a>
      <header className="bg-navy-deep text-paper">
        <div className="px-4 pb-3 pt-3 lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto lg:px-4 lg:py-6">
        <div className="mb-3 flex items-center justify-between gap-3 lg:mb-8 lg:block">
          <Link href="/staff" className="flex items-center gap-2.5 font-display text-lg font-semibold">
            <span className="grid size-10 place-items-center rounded-[var(--radius-control)] bg-paper">
              <Image src="/images/checkkhum-mark.png" width={200} height={190} alt="" className="h-8 w-auto" />
            </span>
            เช็กคุ้ม CRM
          </Link>
          <div className="text-right text-[0.9375rem] lg:mt-5 lg:text-left">
            <p className="font-semibold">{staff.fullName}</p>
            <p className="text-paper/75">{roleLabels[staff.role]}</p>
          </div>
        </div>
        <StaffNav items={items} />
        <form action={signOut} className="mt-3 hidden lg:mt-8 lg:block">
          <button type="submit" className="min-h-11 px-3 font-semibold text-paper/85 underline underline-offset-4 hover:text-paper">
            ออกจากระบบ
          </button>
        </form>
        </div>
      </header>
      <main id="main" className="min-w-0 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
        <form action={signOut} className="mt-10 lg:hidden">
          <button type="submit" className="min-h-11 font-semibold text-teal-ink underline underline-offset-4">
            ออกจากระบบ
          </button>
        </form>
      </main>
    </div>
  );
}
