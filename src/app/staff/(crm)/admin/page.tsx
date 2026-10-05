import type { Metadata } from "next";
import { addInsurer, createStaffUser, runRenewalJobNow, setInsurerActive, updateStaffUser } from "@/app/staff/_actions/admin";
import { ActionForm } from "@/components/staff/action-form";
import { AccessDenied, Empty, Field, PageTitle, Pill, Select, Sheet } from "@/components/staff/ui";
import { formatDate, formatDateTime, roleLabels } from "@/lib/crm-labels";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "ผู้ดูแลระบบ" };

const roleOptions = Object.entries(roleLabels).map(([value, label]) => ({ value, label }));
const tableLabels: Record<string, string> = {
  customers: "ลูกค้า",
  enquiries: "คำขอ",
  quotations: "ใบเสนอราคา",
  policies: "กรมธรรม์",
  vehicles: "รถ",
  staff_users: "พนักงาน",
  insurers: "บริษัทประกัน",
  follow_up_activities: "บันทึก",
  follow_up_tasks: "งานติดตาม",
  renewal_tasks: "งานต่ออายุ",
  consent_records: "การยินยอม",
};

export default async function AdminPage() {
  const staff = await requireStaff();
  // Page-level check for a clear message; RLS also returns nothing to non-admins.
  if (!staff.isAdmin) return <AccessDenied />;

  const [staffRows, insurers, runs, audit] = await Promise.all([
    staff.db.from("staff_users").select("id, email, full_name, role, is_active, created_at").order("created_at"),
    staff.db.from("insurers").select("id, code, name_th, name_en, is_active").order("name_th"),
    staff.db.from("renewal_job_runs").select("*").order("started_at", { ascending: false }).limit(10),
    staff.db.from("audit_logs").select("id, occurred_at, actor_id, actor_role, action, table_name, record_id").order("occurred_at", { ascending: false }).limit(30),
  ]);

  const staffName = new Map((staffRows.data ?? []).map((s) => [s.id, s.full_name]));

  return (
    <>
      <PageTitle title="ผู้ดูแลระบบ" sub="จัดการพนักงานและสิทธิ์ บริษัทประกัน งานต่ออายุอัตโนมัติ และประวัติการแก้ไขข้อมูล" />
      <div className="grid gap-5">
        <Sheet title="พนักงานและสิทธิ์" id="staff-title">
          <p className="mb-3 text-[0.9375rem] text-ink-soft">
            ผู้ดูแลระบบ: ทำได้ทุกอย่าง รวมถึงลบข้อมูลและจัดการพนักงาน เจ้าหน้าที่: ดูและแก้ไขข้อมูลลูกค้า ดูอย่างเดียว: ดูข้อมูลได้ แก้ไขไม่ได้
          </p>
          <ul className="divide-y divide-line">
            {(staffRows.data ?? []).map((s) => (
              <li key={s.id} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" data-staff={s.email}>
                <div className="min-w-0">
                  <p className="font-semibold text-navy">
                    {s.full_name} {s.id === staff.userId && <Pill tone="good">คุณ</Pill>} {!s.is_active && <Pill tone="bad">ปิดใช้งาน</Pill>}
                  </p>
                  <p className="break-all text-[0.9375rem] text-ink-soft">
                    {s.email}, เพิ่มเมื่อ {formatDate(s.created_at)}
                  </p>
                </div>
                <ActionForm action={updateStaffUser} submitLabel="บันทึก" variant="outline" className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={s.id} />
                  <label className="sr-only" htmlFor={`role-${s.id}`}>
                    สิทธิ์ของ {s.full_name}
                  </label>
                  <select id={`role-${s.id}`} name="role" defaultValue={s.role} className="field-input min-h-11 w-auto py-1.5">
                    {roleOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 font-medium">
                    <input type="checkbox" name="is_active" defaultChecked={s.is_active} className="size-5 accent-teal" />
                    ใช้งานได้
                  </label>
                </ActionForm>
              </li>
            ))}
          </ul>
          <details className="mt-4 rounded-[var(--radius-control)] border-[1.5px] border-navy px-4 py-3">
            <summary className="cursor-pointer font-display text-lg font-semibold text-navy">เพิ่มพนักงาน</summary>
            <ActionForm action={createStaffUser} submitLabel="เพิ่มพนักงาน" resetOnSuccess className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="อีเมล" htmlFor="ns-email">
                <input id="ns-email" name="email" type="email" required className="field-input" autoComplete="off" />
              </Field>
              <Field label="ชื่อ-นามสกุล" htmlFor="ns-name">
                <input id="ns-name" name="full_name" required maxLength={120} className="field-input" />
              </Field>
              <Field label="สิทธิ์" htmlFor="ns-role">
                <Select id="ns-role" name="role" options={roleOptions} defaultValue="agent" />
              </Field>
              <Field label="รหัสผ่านชั่วคราว" htmlFor="ns-pass" hint="อย่างน้อย 12 ตัวอักษร ให้พนักงานเปลี่ยนหลังเข้าสู่ระบบครั้งแรก">
                <input id="ns-pass" name="temp_password" type="password" required minLength={12} autoComplete="new-password" className="field-input" />
              </Field>
            </ActionForm>
          </details>
        </Sheet>

        <div className="grid gap-5 xl:grid-cols-2">
          <Sheet title="งานต่ออายุอัตโนมัติ" id="job-title">
            <p className="mb-3 text-[0.9375rem]">
              ระบบทำงานทุกวันเวลา 06:05 น. สร้างงานต่ออายุสำหรับกรมธรรม์ที่หมดอายุภายใน 90 วัน (กรมธรรม์ละ 1 งาน ไม่สร้างซ้ำ)
              และแจ้งเตือนพนักงานเมื่องานถึงกำหนด การแจ้งลูกค้าจะเป็นระบบแยกในภายหลัง
            </p>
            <ActionForm action={runRenewalJobNow} submitLabel="ทำงานตอนนี้" variant="outline" />
            <h3 className="mb-2 mt-5 text-lg">รอบล่าสุด</h3>
            {runs.data?.length ? (
              <ul className="divide-y divide-line text-[0.9375rem]" data-job-runs>
                {runs.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      {formatDateTime(r.started_at)} ({r.trigger_source === "schedule" ? "ตามเวลา" : "สั่งเอง"})
                    </span>
                    <span className="text-ink-soft">
                      ตรวจ {r.policies_checked} ฉบับ, งานใหม่ {r.tasks_created}, แจ้งเตือนใหม่ {r.reminders_created}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ยังไม่เคยทำงาน</Empty>
            )}
          </Sheet>

          <Sheet title="บริษัทประกัน" id="insurers-title">
            <ul className="divide-y divide-line">
              {(insurers.data ?? []).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-semibold text-navy">{i.name_th}</span>{" "}
                    <span className="text-sm text-ink-soft">({i.code})</span> {!i.is_active && <Pill tone="bad">ปิดใช้</Pill>}
                  </span>
                  <ActionForm action={setInsurerActive} submitLabel={i.is_active ? "ปิดใช้" : "เปิดใช้"} variant="outline" inline>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="is_active" value={i.is_active ? "false" : "true"} />
                  </ActionForm>
                </li>
              ))}
            </ul>
            <ActionForm action={addInsurer} submitLabel="เพิ่มบริษัทประกัน" resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="รหัส" htmlFor="ni-code">
                <input id="ni-code" name="code" required maxLength={20} className="field-input" placeholder="เช่น ABC" />
              </Field>
              <Field label="ชื่อภาษาไทย" htmlFor="ni-th">
                <input id="ni-th" name="name_th" required maxLength={120} className="field-input" />
              </Field>
              <Field label="ชื่อภาษาอังกฤษ" htmlFor="ni-en">
                <input id="ni-en" name="name_en" maxLength={120} className="field-input" />
              </Field>
            </ActionForm>
          </Sheet>
        </div>

        <Sheet title="ประวัติการแก้ไขข้อมูลล่าสุด" id="audit-title">
          {audit.data?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-[0.9375rem]">
                <thead className="border-b-2 border-navy text-ink-soft">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">เวลา</th>
                    <th className="py-2 pr-3 font-semibold">โดย</th>
                    <th className="py-2 pr-3 font-semibold">การกระทำ</th>
                    <th className="py-2 font-semibold">ข้อมูล</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {audit.data.map((a) => (
                    <tr key={a.id}>
                      <td className="py-2 pr-3">{formatDateTime(a.occurred_at)}</td>
                      <td className="py-2 pr-3">{(a.actor_id && staffName.get(a.actor_id)) ?? (a.actor_role === "service_role" ? "เว็บไซต์" : "ระบบ")}</td>
                      <td className="py-2 pr-3">{{ insert: "เพิ่ม", update: "แก้ไข", delete: "ลบ" }[a.action] ?? a.action}</td>
                      <td className="py-2">{tableLabels[a.table_name] ?? a.table_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>ยังไม่มีประวัติ</Empty>
          )}
        </Sheet>
      </div>
    </>
  );
}
