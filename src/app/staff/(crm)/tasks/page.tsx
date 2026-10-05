import type { Metadata } from "next";
import Link from "next/link";
import { TaskList } from "@/components/staff/task-list";
import { PageTitle, Sheet } from "@/components/staff/ui";
import { openTasks, staffOptions } from "@/lib/server/crm/queries";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "งาน" };

const views = { mine: "งานของฉัน", unassigned: "ยังไม่มีผู้รับผิดชอบ", all: "งานทั้งหมด" } as const;
type View = keyof typeof views;

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const staff = await requireStaff();
  const raw = (await searchParams).view;
  const view: View = raw && raw in views ? (raw as View) : "mine";

  const [tasks, staffOpts] = await Promise.all([
    openTasks(staff.db, view === "mine" ? { assignedTo: staff.userId } : view === "unassigned" ? { assignedTo: null } : {}),
    staffOptions(staff.db),
  ]);

  return (
    <>
      <PageTitle title="งาน" sub="งานติดตามลูกค้าและงานต่ออายุที่ยังเปิดอยู่ เรียงตามวันครบกำหนด" />
      <nav aria-label="มุมมอง" className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(views) as View[]).map((v) => (
          <Link
            key={v}
            href={`/staff/tasks?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={`min-h-11 rounded-full px-4 py-2 font-semibold ${view === v ? "bg-navy text-paper" : "bg-paper text-navy hover:bg-mint"}`}
          >
            {views[v]}
          </Link>
        ))}
      </nav>
      <Sheet>
        <TaskList tasks={tasks} canWrite={staff.canWrite} staffOptions={staffOpts} showAssign empty={view === "mine" ? "ไม่มีงานค้างของคุณ" : "ไม่มีงานค้าง"} />
      </Sheet>
      <p className="mt-4 text-[0.9375rem] text-ink-soft">
        ระบบสร้างงานต่ออายุและการแจ้งเตือนทุกวันเวลา 06:05 น. สำหรับกรมธรรม์ที่หมดอายุภายใน 90 วัน
      </p>
    </>
  );
}
