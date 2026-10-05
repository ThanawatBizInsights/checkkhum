import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addActivity, addPolicy, addVehicle, createEnquiry, createTask, updateCustomer } from "@/app/staff/_actions/crm";
import { ActionForm } from "@/components/staff/action-form";
import { ActivityForm, ActivityList, TaskForm } from "@/components/staff/customer-bits";
import { TaskList } from "@/components/staff/task-list";
import { Empty, Field, PageTitle, Pill, Select, Sheet, StatusBadge } from "@/components/staff/ui";
import {
  addDays,
  bangkokToday,
  channelLabels,
  daysBetween,
  formatBaht,
  formatDate,
  formatDateTime,
  formatPhone,
  policyStatusLabels,
  productLabels,
} from "@/lib/crm-labels";
import { insurerOptions, openTasks, staffOptions } from "@/lib/server/crm/queries";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "ข้อมูลลูกค้า" };

const productOptions = Object.entries(productLabels)
  .filter(([k]) => k !== "contact")
  .map(([value, label]) => ({ value, label }));
const consentLabels: Record<string, string> = {
  quote_processing: "ใช้ข้อมูลเพื่อเสนอราคา",
  marketing: "รับข่าวสารและข้อเสนอ",
  sensitive_data: "ข้อมูลอ่อนไหว",
};

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: c } = await staff.db.from("customers").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [vehicles, enquiries, policies, activities, consents, tasks, staffOpts, insurers] = await Promise.all([
    staff.db.from("vehicles").select("*").eq("customer_id", id).order("created_at"),
    staff.db.from("enquiries").select("id, reference, product, status, source, created_at").eq("customer_id", id).order("created_at", { ascending: false }),
    staff.db.from("policies").select("id, policy_number, product, end_date, status, premium, insurers(name_th)").eq("customer_id", id).order("end_date", { ascending: false }),
    staff.db
      .from("follow_up_activities")
      .select("id, activity_type, summary, outcome, occurred_at, staff_users(full_name)")
      .eq("customer_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    staff.db.from("consent_records").select("id, purpose, granted, notice_version, method, captured_at").eq("customer_id", id).order("captured_at", { ascending: false }),
    openTasks(staff.db, { customerId: id }),
    staffOptions(staff.db),
    insurerOptions(staff.db),
  ]);

  const today = bangkokToday();
  // Latest decision per consent purpose.
  const latestConsent = new Map<string, NonNullable<typeof consents.data>[number]>();
  for (const r of consents.data ?? []) if (!latestConsent.has(r.purpose)) latestConsent.set(r.purpose, r);
  const vehicleOptions = (vehicles.data ?? []).map((v) => ({ value: v.id, label: `${v.description}${v.registration_plate ? ` (${v.registration_plate})` : ""}` }));

  return (
    <>
      <PageTitle
        title={c.full_name}
        sub={`${formatPhone(c.phone)}${c.line_id ? `, LINE ${c.line_id}` : ""}, ติดต่อทาง${channelLabels[c.preferred_channel]}, ลูกค้าตั้งแต่ ${formatDate(c.created_at)}`}
        actions={
          <Link href="/staff/customers" className="font-semibold text-teal-ink underline underline-offset-4">
            กลับไปรายชื่อลูกค้า
          </Link>
        }
      />

      <div className="grid gap-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <Sheet title={`คำขอ (${enquiries.data?.length ?? 0})`} id="enq-title">
            {enquiries.data?.length ? (
              <ul className="divide-y divide-line">
                {enquiries.data.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <Link href={`/staff/enquiries/${e.id}`} className="font-semibold text-navy hover:underline">
                      {e.product ? productLabels[e.product] : productLabels.contact}
                    </Link>
                    <span className="flex items-center gap-2 text-[0.9375rem] text-ink-soft">
                      {e.reference}, {formatDate(e.created_at)} <StatusBadge status={e.status} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ยังไม่มีคำขอ</Empty>
            )}
            {staff.canWrite && (
              <details className="mt-4 rounded-[var(--radius-control)] border border-line px-3 py-2">
                <summary className="cursor-pointer font-semibold text-navy">บันทึกคำขอใหม่ (โทรศัพท์ / LINE / หน้าร้าน)</summary>
                <ActionForm action={createEnquiry} submitLabel="สร้างคำขอ" className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="customer_id" value={c.id} />
                  <Field label="ประเภทประกัน" htmlFor="ne-product">
                    <Select id="ne-product" name="product" options={productOptions} defaultValue="car_1" />
                  </Field>
                  <Field label="ช่องทางที่ติดต่อมา" htmlFor="ne-source">
                    <Select id="ne-source" name="source" options={[{ value: "phone", label: "โทรศัพท์" }, { value: "line", label: "LINE" }, { value: "walk_in", label: "หน้าร้าน" }, { value: "referral", label: "แนะนำต่อ" }]} defaultValue="line" />
                  </Field>
                  <Field label="รถ" htmlFor="ne-vehicle">
                    <Select id="ne-vehicle" name="vehicle_id" options={vehicleOptions} placeholder="ไม่ระบุ" />
                  </Field>
                  <Field label="รายละเอียด" htmlFor="ne-message">
                    <input id="ne-message" name="message" maxLength={1000} className="field-input" />
                  </Field>
                </ActionForm>
              </details>
            )}
          </Sheet>

          <Sheet title={`กรมธรรม์ (${policies.data?.length ?? 0})`} id="pol-title">
            {policies.data?.length ? (
              <ul className="divide-y divide-line">
                {policies.data.map((p) => {
                  const left = daysBetween(today, p.end_date);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <Link href={`/staff/policies/${p.id}`} className="font-semibold text-navy hover:underline">
                        {p.policy_number}, {productLabels[p.product]}
                      </Link>
                      <span className="flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink-soft">
                        {p.insurers?.name_th}, ถึง {formatDate(p.end_date)}
                        <Pill tone={p.status !== "active" ? "neutral" : left <= 30 ? "bad" : left <= 90 ? "warn" : "good"}>
                          {p.status === "active" ? (left >= 0 ? `เหลือ ${left} วัน` : "หมดอายุแล้ว") : policyStatusLabels[p.status]}
                        </Pill>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>ยังไม่มีกรมธรรม์</Empty>
            )}
            {staff.canWrite && (
              <details className="mt-4 rounded-[var(--radius-control)] border border-line px-3 py-2">
                <summary className="cursor-pointer font-semibold text-navy">เพิ่มกรมธรรม์ที่มีอยู่แล้ว</summary>
                <ActionForm action={addPolicy} submitLabel="เพิ่มกรมธรรม์" resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="customer_id" value={c.id} />
                  <Field label="บริษัทประกัน" htmlFor="np-insurer">
                    <Select id="np-insurer" name="insurer_id" options={insurers} required placeholder="เลือกบริษัท" />
                  </Field>
                  <Field label="ประเภท" htmlFor="np-product">
                    <Select id="np-product" name="product" options={productOptions} defaultValue="car_1" />
                  </Field>
                  <Field label="เลขกรมธรรม์" htmlFor="np-number">
                    <input id="np-number" name="policy_number" required maxLength={60} className="field-input" />
                  </Field>
                  <Field label="รถ" htmlFor="np-vehicle">
                    <Select id="np-vehicle" name="vehicle_id" options={vehicleOptions} placeholder="ไม่ระบุ" />
                  </Field>
                  <Field label="เริ่มคุ้มครอง" htmlFor="np-start">
                    <input id="np-start" name="start_date" type="date" required defaultValue={today} className="field-input" />
                  </Field>
                  <Field label="สิ้นสุด" htmlFor="np-end">
                    <input id="np-end" name="end_date" type="date" required defaultValue={addDays(today, 365)} className="field-input" />
                  </Field>
                  <Field label="เบี้ยประกัน (บาท)" htmlFor="np-premium">
                    <input id="np-premium" name="premium" inputMode="decimal" required className="field-input" />
                  </Field>
                  <Field label="สถานะ" htmlFor="np-status">
                    <Select id="np-status" name="status" options={[{ value: "active", label: "คุ้มครองอยู่" }, { value: "pending", label: "รอเริ่มคุ้มครอง" }]} defaultValue="active" />
                  </Field>
                </ActionForm>
              </details>
            )}
          </Sheet>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Sheet title="รถ" id="veh-title">
            {vehicles.data?.length ? (
              <ul className="divide-y divide-line">
                {vehicles.data.map((v) => (
                  <li key={v.id} className="py-2.5">
                    <span className="font-semibold text-navy">{v.description}</span>
                    <span className="text-ink-soft">
                      {v.model_year ? `, ปี ${v.model_year}` : ""}
                      {v.registration_plate ? `, ${v.registration_plate}${v.plate_province ? ` ${v.plate_province}` : ""}` : ""}
                      {v.is_ev ? ", รถไฟฟ้า" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>ยังไม่มีข้อมูลรถ</Empty>
            )}
            {staff.canWrite && (
              <details className="mt-4 rounded-[var(--radius-control)] border border-line px-3 py-2">
                <summary className="cursor-pointer font-semibold text-navy">เพิ่มรถ</summary>
                <ActionForm action={addVehicle} submitLabel="เพิ่มรถ" resetOnSuccess className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="customer_id" value={c.id} />
                  <Field label="ยี่ห้อและรุ่น" htmlFor="nv-desc">
                    <input id="nv-desc" name="description" required maxLength={120} className="field-input" />
                  </Field>
                  <Field label="ปีรถ (ค.ศ.)" htmlFor="nv-year">
                    <input id="nv-year" name="model_year" inputMode="numeric" maxLength={4} className="field-input" />
                  </Field>
                  <Field label="ทะเบียน" htmlFor="nv-plate">
                    <input id="nv-plate" name="registration_plate" maxLength={20} className="field-input" />
                  </Field>
                  <Field label="จังหวัด" htmlFor="nv-prov">
                    <input id="nv-prov" name="plate_province" maxLength={40} className="field-input" />
                  </Field>
                  <label className="flex min-h-11 items-center gap-2 font-medium">
                    <input type="checkbox" name="is_ev" className="size-5 accent-teal" /> รถไฟฟ้า (EV)
                  </label>
                </ActionForm>
              </details>
            )}
          </Sheet>

          <Sheet title="งานที่ต้องทำ" id="ctasks-title">
            <TaskList tasks={tasks} canWrite={staff.canWrite} empty="ไม่มีงานค้างของลูกค้ารายนี้" />
            {staff.canWrite && <TaskForm action={createTask} customerId={c.id} staffOptions={staffOpts} defaultAssignee={staff.userId} backTo={`/staff/customers/${c.id}`} />}
          </Sheet>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Sheet title="ประวัติการติดต่อ" id="act-title">
            {staff.canWrite && <ActivityForm action={addActivity} customerId={c.id} backTo={`/staff/customers/${c.id}`} />}
            <ActivityList activities={activities.data ?? []} />
          </Sheet>

          <div className="grid content-start gap-5">
            <Sheet title="ข้อมูลติดต่อ" id="profile-title">
              {staff.canWrite ? (
                <ActionForm action={updateCustomer} submitLabel="บันทึกข้อมูล" variant="outline">
                  <input type="hidden" name="id" value={c.id} />
                  <Field label="ชื่อ-นามสกุล" htmlFor="c-name">
                    <input id="c-name" name="full_name" required defaultValue={c.full_name} maxLength={120} className="field-input" />
                  </Field>
                  <Field label="LINE ID" htmlFor="c-line">
                    <input id="c-line" name="line_id" defaultValue={c.line_id ?? ""} maxLength={60} className="field-input" />
                  </Field>
                  <Field label="อีเมล" htmlFor="c-email">
                    <input id="c-email" name="email" type="email" defaultValue={c.email ?? ""} className="field-input" />
                  </Field>
                  <Field label="ติดต่อทาง" htmlFor="c-channel">
                    <Select id="c-channel" name="preferred_channel" options={Object.entries(channelLabels).map(([value, label]) => ({ value, label }))} defaultValue={c.preferred_channel} />
                  </Field>
                  <Field label="หมายเหตุ" htmlFor="c-notes">
                    <textarea id="c-notes" name="notes" defaultValue={c.notes ?? ""} maxLength={4000} rows={3} className="field-input" />
                  </Field>
                </ActionForm>
              ) : (
                <p className="whitespace-pre-line">{c.notes || <span className="text-ink-soft">ไม่มีหมายเหตุ</span>}</p>
              )}
              <p className="mt-3 text-[0.9375rem] text-ink-soft">เบอร์โทรเป็นตัวระบุลูกค้า เปลี่ยนได้โดยผู้ดูแลระบบในฐานข้อมูล</p>
            </Sheet>

            <Sheet title="การยินยอม (PDPA)" id="consent-title">
              {latestConsent.size ? (
                <ul className="grid gap-2">
                  {[...latestConsent.values()].map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>{consentLabels[r.purpose]}</span>
                      <Pill tone={r.granted ? "good" : "bad"}>{r.granted ? "ยินยอม" : "ไม่ยินยอม"}</Pill>
                      <span className="w-full text-[0.9375rem] text-ink-soft">
                        {formatDateTime(r.captured_at)}, ประกาศฉบับ {r.notice_version}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty>ไม่มีบันทึกการยินยอม</Empty>
              )}
              {latestConsent.get("marketing")?.granted === false && (
                <p className="mt-3 text-[0.9375rem] font-semibold text-error">ห้ามส่งข้อเสนอทางการตลาดให้ลูกค้ารายนี้</p>
              )}
            </Sheet>

            <p className="text-[0.9375rem] text-ink-soft">เบี้ยรวมของกรมธรรม์ที่คุ้มครองอยู่: {formatBaht((policies.data ?? []).filter((p) => p.status === "active").reduce((s, p) => s + Number(p.premium), 0))}</p>
          </div>
        </div>
      </div>
    </>
  );
}
