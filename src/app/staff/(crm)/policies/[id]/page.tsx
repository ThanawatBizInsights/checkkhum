import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addActivity, createTask, setPolicyStatus } from "@/app/staff/_actions/crm";
import { ActionForm } from "@/components/staff/action-form";
import { ActivityForm, ActivityList, TaskForm } from "@/components/staff/customer-bits";
import { PolicyDocumentsSheet } from "@/components/staff/portal-sheets";
import { TaskList } from "@/components/staff/task-list";
import { Empty, Field, KeyValue, PageTitle, Pill, Select, Sheet } from "@/components/staff/ui";
import { bangkokToday, daysBetween, formatBaht, formatDate, formatDateTime, policyStatusLabels, productLabels, taskStatusLabels } from "@/lib/crm-labels";
import { openTasks, staffOptions } from "@/lib/server/crm/queries";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "กรมธรรม์" };

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: p } = await staff.db
    .from("policies")
    .select("*, customers(id, full_name, phone), insurers(name_th), vehicles(description, registration_plate), quotations(enquiry_id)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const [renewals, tasks, activities, staffOpts] = await Promise.all([
    staff.db.from("renewal_tasks").select("id, status, due_date, notes, completed_at, created_at, staff_users(full_name)").eq("policy_id", id),
    openTasks(staff.db, { policyId: id }),
    staff.db
      .from("follow_up_activities")
      .select("id, activity_type, summary, outcome, occurred_at, staff_users(full_name)")
      .eq("policy_id", id)
      .order("occurred_at", { ascending: false }),
    staffOptions(staff.db),
  ]);
  const left = daysBetween(bangkokToday(), p.end_date);

  return (
    <>
      <PageTitle
        title={`กรมธรรม์ ${p.policy_number}`}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {productLabels[p.product]}, {p.insurers?.name_th}
            <Pill tone={p.status !== "active" ? "neutral" : left <= 30 ? "bad" : left <= 90 ? "warn" : "good"}>
              {p.status === "active" ? (left >= 0 ? `เหลือ ${left} วัน` : "เลยวันหมดอายุ") : policyStatusLabels[p.status]}
            </Pill>
          </span>
        }
      />
      <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <Sheet title="รายละเอียด" id="pdetail-title">
            <KeyValue
              items={[
                ["ลูกค้า", p.customers ? <Link href={`/staff/customers/${p.customers.id}`} className="font-semibold text-teal-ink underline underline-offset-4">{p.customers.full_name}</Link> : "-"],
                ["รถ", p.vehicles ? `${p.vehicles.description}${p.vehicles.registration_plate ? `, ${p.vehicles.registration_plate}` : ""}` : "-"],
                ["คุ้มครอง", `${formatDate(p.start_date)} ถึง ${formatDate(p.end_date)}`],
                ["เบี้ยประกัน", formatBaht(p.premium)],
                ["สถานะ", policyStatusLabels[p.status]],
                ...(p.quotations?.enquiry_id ? [["มาจากคำขอ", <Link key="enq" href={`/staff/enquiries/${p.quotations.enquiry_id}`} className="text-teal-ink underline underline-offset-4">เปิดคำขอ</Link>] as [string, React.ReactNode]] : []),
              ]}
            />
            {staff.canWrite && (
              <ActionForm action={setPolicyStatus} submitLabel="เปลี่ยนสถานะ" variant="outline" className="mt-4 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={p.id} />
                <Field label="สถานะกรมธรรม์" htmlFor="pstatus">
                  <Select id="pstatus" name="status" options={Object.entries(policyStatusLabels).map(([value, label]) => ({ value, label }))} defaultValue={p.status} />
                </Field>
              </ActionForm>
            )}
          </Sheet>

          <Sheet title="งานต่ออายุ" id="renewal-title">
            {renewals.data?.length ? (
              <ul className="grid gap-2">
                {renewals.data.map((r) => (
                  <li key={r.id} className="rounded-[var(--radius-control)] bg-sky px-3 py-2">
                    <p className="font-semibold text-navy">
                      {taskStatusLabels[r.status]}, ครบกำหนด {formatDate(r.due_date)}
                    </p>
                    <p className="text-[0.9375rem] text-ink-soft">
                      {r.staff_users?.full_name ?? "ยังไม่มีผู้รับผิดชอบ"}, สร้างเมื่อ {formatDateTime(r.created_at)}
                    </p>
                    {r.notes && <p className="text-[0.9375rem]">{r.notes}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>
                {p.status === "active" && left <= 90 ? "ระบบจะสร้างงานต่ออายุในรอบทำงานถัดไป" : "ระบบจะสร้างงานต่ออายุเมื่อกรมธรรม์เหลือไม่เกิน 90 วัน"}
              </Empty>
            )}
            <h3 className="mb-2 mt-5 text-lg">งานที่ยังเปิดอยู่</h3>
            <TaskList tasks={tasks} canWrite={staff.canWrite} staffOptions={staffOpts} showAssign empty="ไม่มีงานค้าง" />
            {staff.canWrite && p.customers && (
              <TaskForm action={createTask} customerId={p.customers.id} policyId={p.id} staffOptions={staffOpts} defaultAssignee={staff.userId} backTo={`/staff/policies/${p.id}`} />
            )}
          </Sheet>
        </div>

        <PolicyDocumentsSheet staff={staff} policyId={p.id} />

        <Sheet title="บันทึกการติดตาม" id="pnotes-title">
          {staff.canWrite && p.customers && <ActivityForm action={addActivity} customerId={p.customers.id} policyId={p.id} backTo={`/staff/policies/${p.id}`} />}
          <ActivityList activities={activities.data ?? []} />
        </Sheet>
      </div>
    </>
  );
}
