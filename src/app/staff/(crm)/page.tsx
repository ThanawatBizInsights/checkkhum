import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/staff/action-form";
import { TaskList } from "@/components/staff/task-list";
import { Empty, PageTitle, PipelineStrip, Sheet, StatusBadge } from "@/components/staff/ui";
import { addDays, bangkokToday, formatDate, formatDateTime, productLabels } from "@/lib/crm-labels";
import { enquiryStatusCounts, expiringCounts, horizons, openTasks } from "@/lib/server/crm/queries";
import { requireStaff } from "@/lib/server/staff-auth";
import { markReminderRead } from "../_actions/crm";

export const metadata: Metadata = { title: "ภาพรวม" };

export default async function StaffHome() {
  const staff = await requireStaff();
  const today = bangkokToday();

  const [reminders, myTasks, counts, expiring, latest] = await Promise.all([
    staff.db
      .from("staff_reminders")
      .select("id, message, kind, due_date, created_at, recipient_id")
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    openTasks(staff.db, { assignedTo: staff.userId, dueBy: addDays(today, 7) }),
    enquiryStatusCounts(staff.db),
    expiringCounts(staff.db),
    staff.db
      .from("enquiries")
      .select("id, reference, contact_name, product, status, created_at")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <>
      <PageTitle title={`สวัสดี ${staff.fullName}`} sub={`วันนี้ ${formatDate(today)}`} />

      <div className="grid gap-5">
        <Sheet title="คำขอตามขั้นตอน" id="pipeline-title">
          <PipelineStrip counts={counts} hrefFor={(s) => `/staff/enquiries?status=${s}`} />
        </Sheet>

        <div className="grid gap-5 xl:grid-cols-2">
          <Sheet title="การแจ้งเตือน" id="reminders-title">
            {reminders.data?.length ? (
              <ul className="divide-y divide-line">
                {reminders.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-reminder={r.kind}>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{r.message}</p>
                      <p className="text-sm text-ink-soft">
                        {r.recipient_id ? "ถึงคุณ" : "งานของทีม (ยังไม่มีผู้รับผิดชอบ)"}, {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <ActionForm action={markReminderRead} submitLabel="รับทราบ" variant="outline" inline>
                      <input type="hidden" name="id" value={r.id} />
                    </ActionForm>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ไม่มีการแจ้งเตือนใหม่</Empty>
            )}
          </Sheet>

          <Sheet
            title="งานของฉันใน 7 วัน"
            id="my-tasks-title"
            actions={
              <Link href="/staff/tasks" className="font-semibold text-teal-ink underline underline-offset-4">
                งานทั้งหมด
              </Link>
            }
          >
            <TaskList tasks={myTasks} canWrite={staff.canWrite} empty="ไม่มีงานที่ถึงกำหนดใน 7 วัน" />
          </Sheet>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Sheet title="กรมธรรม์ใกล้หมดอายุ" id="expiring-title">
            <ul className="grid grid-cols-3 gap-3">
              {horizons.map((d) => (
                <li key={d}>
                  <Link href={`/staff/policies?within=${d}`} className="block rounded-[var(--radius-control)] border-[1.5px] border-line px-3 py-3 hover:border-navy">
                    <span className="block text-[0.9375rem] text-ink-soft">ภายใน {d} วัน</span>
                    <span className="font-display text-3xl font-semibold text-navy">{expiring[d]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Sheet>

          <Sheet
            title="คำขอใหม่ล่าสุด"
            id="latest-title"
            actions={
              <Link href="/staff/enquiries?status=new" className="font-semibold text-teal-ink underline underline-offset-4">
                ดูทั้งหมด
              </Link>
            }
          >
            {latest.data?.length ? (
              <ul className="divide-y divide-line">
                {latest.data.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/staff/enquiries/${e.id}`} className="min-w-0 font-semibold text-navy hover:underline">
                      {e.contact_name}, {e.product ? productLabels[e.product] : productLabels.contact}
                    </Link>
                    <span className="flex items-center gap-2 text-sm text-ink-soft">
                      {formatDateTime(e.created_at)} <StatusBadge status={e.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ไม่มีคำขอใหม่</Empty>
            )}
          </Sheet>
        </div>
      </div>
    </>
  );
}
