import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addActivity,
  addQuotation,
  assignEnquiry,
  convertQuotationToPolicy,
  createTask,
  setEnquiryStatus,
  setQuotationStatus,
} from "@/app/staff/_actions/crm";
import { ActionForm } from "@/components/staff/action-form";
import { ActivityList, ActivityForm, TaskForm } from "@/components/staff/customer-bits";
import { TaskList } from "@/components/staff/task-list";
import { Empty, Field, KeyValue, PageTitle, Pill, PipelineStrip, Select, Sheet, StatusBadge } from "@/components/staff/ui";
import {
  addDays,
  bangkokToday,
  channelLabels,
  enquiryStatusLabels,
  formatBaht,
  formatDate,
  formatDateTime,
  formatPhone,
  nextStatuses,
  productLabels,
  quotationStatusLabels,
  sourceLabels,
  statusActionLabels,
} from "@/lib/crm-labels";
import { insurerOptions, openTasks, staffOptions } from "@/lib/server/crm/queries";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "รายละเอียดคำขอ" };

const productOptions = Object.entries(productLabels)
  .filter(([k]) => k !== "contact")
  .map(([value, label]) => ({ value, label }));

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const { data: e } = await staff.db
    .from("enquiries")
    .select("*, customers(id, full_name, phone, line_id, preferred_channel), vehicles(id, description, model_year, registration_plate, is_ev), staff_users(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!e) notFound();

  const [quotes, policies, activities, history, staffOpts, insurers, tasks] = await Promise.all([
    staff.db
      .from("quotations")
      .select("*, insurers(name_th), staff_users(full_name)")
      .eq("enquiry_id", id)
      .order("created_at"),
    staff.db.from("policies").select("id, quotation_id, policy_number, quotations!inner(enquiry_id)").eq("quotations.enquiry_id", id),
    staff.db
      .from("follow_up_activities")
      .select("id, activity_type, summary, outcome, occurred_at, staff_users(full_name)")
      .eq("enquiry_id", id)
      .order("occurred_at", { ascending: false }),
    staff.db
      .from("enquiry_status_history")
      .select("id, from_status, to_status, changed_at, staff_users(full_name)")
      .eq("enquiry_id", id)
      .order("changed_at"),
    staffOptions(staff.db),
    insurerOptions(staff.db),
    openTasks(staff.db, { enquiryId: id }),
  ]);

  const policyByQuote = new Map((policies.data ?? []).map((p) => [p.quotation_id, p]));
  const moves = staff.canWrite ? (nextStatuses[e.status] ?? []).filter((s) => s !== "new" || staff.isAdmin) : [];
  const today = bangkokToday();

  return (
    <>
      <PageTitle
        title={e.contact_name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span>{e.reference}</span>
            <StatusBadge status={e.status} />
            <span>{e.product ? productLabels[e.product] : productLabels.contact}</span>
          </span>
        }
        actions={
          <Link href="/staff/enquiries" className="font-semibold text-teal-ink underline underline-offset-4">
            กลับไปรายการคำขอ
          </Link>
        }
      />

      <div className="grid gap-5">
        <Sheet>
          <PipelineStrip current={e.status} />
          {moves.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2" aria-label="เปลี่ยนสถานะ">
              {moves.map((s) => (
                <ActionForm
                  key={s}
                  action={setEnquiryStatus}
                  submitLabel={statusActionLabels[s]}
                  variant={s === "lost" || s === "spam" ? "outline" : "primary"}
                  confirmText={s === "lost" || s === "spam" ? `ยืนยัน: ${statusActionLabels[s]}` : undefined}
                  inline
                >
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="status" value={s} />
                </ActionForm>
              ))}
            </div>
          )}
          {e.status === "contacted" && staff.canWrite && (
            <p className="mt-3 text-[0.9375rem] text-ink-soft">บันทึกใบเสนอราคาที่ส่งให้ลูกค้าแล้วอย่างน้อย 1 รายการ เพื่อเปลี่ยนเป็น “เสนอราคาแล้ว”</p>
          )}
          {e.status === "quoted" && staff.canWrite && (
            <p className="mt-3 text-[0.9375rem] text-ink-soft">เมื่อลูกค้าตอบรับ ให้ออกกรมธรรม์จากใบเสนอราคาด้านล่าง ระบบจะปิดการขายให้</p>
          )}
        </Sheet>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Sheet title="รายละเอียด" id="detail-title">
            <KeyValue
              items={[
                ["ลูกค้า", e.customers ? <Link href={`/staff/customers/${e.customers.id}`} className="font-semibold text-teal-ink underline underline-offset-4">{e.customers.full_name}</Link> : "-"],
                ["เบอร์โทร", formatPhone(e.contact_phone)],
                ["ติดต่อกลับทาง", channelLabels[e.preferred_channel]],
                ["ช่องทางที่เข้ามา", sourceLabels[e.source]],
                ["เข้ามาเมื่อ", formatDateTime(e.created_at)],
                ...(e.vehicles ? [["รถ", `${e.vehicles.description}${e.vehicles.model_year ? ` ปี ${e.vehicles.model_year}` : ""}${e.vehicles.is_ev ? " (EV)" : ""}`] as [string, string]] : []),
                ...(e.travel_destination ? [["ปลายทาง", `${e.travel_destination}${e.travel_days ? `, ${e.travel_days} วัน` : ""}${e.travellers ? `, ${e.travellers} คน` : ""}`] as [string, string]] : []),
                ...(e.message ? [["ข้อความจากลูกค้า", e.message] as [string, string]] : []),
              ]}
            />
          </Sheet>

          <Sheet title="ผู้รับผิดชอบ" id="assign-title">
            <p className="mb-3">{e.staff_users?.full_name ?? <span className="text-ink-soft">ยังไม่มีผู้รับผิดชอบ</span>}</p>
            {staff.canWrite && (
              <ActionForm action={assignEnquiry} submitLabel="บันทึกผู้รับผิดชอบ" variant="outline">
                <input type="hidden" name="id" value={e.id} />
                <Field label="มอบหมายให้" htmlFor="assigned_to">
                  <Select id="assigned_to" name="assigned_to" options={staffOpts} defaultValue={e.assigned_to ?? ""} placeholder="ไม่ระบุ" />
                </Field>
              </ActionForm>
            )}
          </Sheet>
        </div>

        <Sheet title={`ใบเสนอราคา (${quotes.data?.length ?? 0})`} id="quotes-title">
          {quotes.data?.length ? (
            <ul className="divide-y divide-line">
              {quotes.data.map((q) => {
                const policy = policyByQuote.get(q.id);
                return (
                  <li key={q.id} className="grid gap-3 py-4" data-quotation={q.status}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg">{q.insurers?.name_th}</h3>
                      <span className="font-display text-xl font-semibold text-navy">{formatBaht(q.premium)}</span>
                    </div>
                    <p className="text-[0.9375rem] text-ink-soft">
                      {productLabels[q.product]}
                      {q.sum_insured != null && `, ทุนประกัน ${formatBaht(q.sum_insured)}`}
                      {q.deductible != null && `, ค่าเสียหายส่วนแรก ${formatBaht(q.deductible)}`}
                      {q.repair_type && `, ${q.repair_type === "dealer" ? "ซ่อมห้าง" : "ซ่อมอู่"}`}
                      {q.valid_until && `, ราคานี้ถึง ${formatDate(q.valid_until)}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={q.status === "accepted" ? "good" : q.status === "declined" || q.status === "expired" ? "bad" : "neutral"}>
                        {quotationStatusLabels[q.status]}
                      </Pill>
                      {policy && (
                        <Link href={`/staff/policies/${policy.id}`} className="font-semibold text-teal-ink underline underline-offset-4">
                          กรมธรรม์ {policy.policy_number}
                        </Link>
                      )}
                      <span className="text-sm text-ink-soft">โดย {q.staff_users?.full_name ?? "-"}</span>
                    </div>
                    {q.notes && <p className="text-[0.9375rem]">{q.notes}</p>}
                    {staff.canWrite && !policy && (
                      <div className="flex flex-wrap items-start gap-4">
                        <ActionForm action={setQuotationStatus} submitLabel="เปลี่ยนสถานะ" variant="outline" className="flex flex-wrap items-start gap-2">
                          <input type="hidden" name="id" value={q.id} />
                          <input type="hidden" name="enquiry_id" value={e.id} />
                          <label className="sr-only" htmlFor={`qs-${q.id}`}>
                            สถานะใบเสนอราคา
                          </label>
                          <select id={`qs-${q.id}`} name="status" defaultValue={q.status} className="field-input min-h-11 w-auto py-1.5">
                            {Object.entries(quotationStatusLabels).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </ActionForm>
                        {(q.status === "sent" || q.status === "accepted") && (
                          <details className="min-w-[16rem] flex-1 rounded-[var(--radius-control)] border border-line px-3 py-2">
                            <summary className="cursor-pointer font-semibold text-navy">ลูกค้าตอบรับ: ออกกรมธรรม์</summary>
                            <ActionForm action={convertQuotationToPolicy} submitLabel="ออกกรมธรรม์" className="mt-3 grid gap-3 sm:grid-cols-3">
                              <input type="hidden" name="quotation_id" value={q.id} />
                              <input type="hidden" name="enquiry_id" value={e.id} />
                              <Field label="เลขกรมธรรม์" htmlFor={`pn-${q.id}`}>
                                <input id={`pn-${q.id}`} name="policy_number" required maxLength={60} className="field-input" />
                              </Field>
                              <Field label="เริ่มคุ้มครอง" htmlFor={`ps-${q.id}`}>
                                <input id={`ps-${q.id}`} name="start_date" type="date" required defaultValue={today} className="field-input" />
                              </Field>
                              <Field label="สิ้นสุด" htmlFor={`pe-${q.id}`}>
                                <input id={`pe-${q.id}`} name="end_date" type="date" required defaultValue={addDays(today, 365)} className="field-input" />
                              </Field>
                            </ActionForm>
                          </details>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty>ยังไม่มีใบเสนอราคา</Empty>
          )}

          {staff.canWrite && e.status !== "won" && e.status !== "spam" && (
            <section aria-labelledby="add-quote-title" data-add-quotation className="mt-4 rounded-[var(--radius-control)] border-[1.5px] border-navy px-4 py-3">
              <h3 id="add-quote-title" className="text-lg">เพิ่มใบเสนอราคา</h3>
              <ActionForm action={addQuotation} submitLabel="บันทึกใบเสนอราคา" resetOnSuccess className="mt-3 grid gap-3 md:grid-cols-3">
                <input type="hidden" name="enquiry_id" value={e.id} />
                <Field label="บริษัทประกัน" htmlFor="insurer_id">
                  <Select id="insurer_id" name="insurer_id" options={insurers} required placeholder="เลือกบริษัท" />
                </Field>
                <Field label="ประเภท" htmlFor="product">
                  <Select id="product" name="product" options={productOptions} defaultValue={e.product ?? "car_1"} required />
                </Field>
                <Field label="เบี้ยประกัน (บาท)" htmlFor="premium">
                  <input id="premium" name="premium" inputMode="decimal" required className="field-input" />
                </Field>
                <Field label="ทุนประกัน (บาท)" htmlFor="sum_insured">
                  <input id="sum_insured" name="sum_insured" inputMode="decimal" className="field-input" />
                </Field>
                <Field label="ค่าเสียหายส่วนแรก (บาท)" htmlFor="deductible">
                  <input id="deductible" name="deductible" inputMode="decimal" className="field-input" />
                </Field>
                <Field label="การซ่อม" htmlFor="repair_type">
                  <Select id="repair_type" name="repair_type" options={[{ value: "garage", label: "ซ่อมอู่" }, { value: "dealer", label: "ซ่อมห้าง" }]} placeholder="ไม่ระบุ" />
                </Field>
                <Field label="ราคานี้ใช้ได้ถึง" htmlFor="valid_until">
                  <input id="valid_until" name="valid_until" type="date" defaultValue={addDays(today, 14)} className="field-input" />
                </Field>
                <Field label="สถานะ" htmlFor="qstatus">
                  <Select id="qstatus" name="status" options={[{ value: "sent", label: "ส่งให้ลูกค้าแล้ว" }, { value: "draft", label: "ร่าง (ยังไม่ส่ง)" }]} defaultValue="sent" />
                </Field>
                <Field label="หมายเหตุ" htmlFor="qnotes">
                  <input id="qnotes" name="notes" maxLength={2000} className="field-input" />
                </Field>
              </ActionForm>
            </section>
          )}
        </Sheet>

        <div className="grid gap-5 xl:grid-cols-2">
          <Sheet title="บันทึกการติดตาม" id="notes-title">
            {staff.canWrite && e.customers && (
              <ActivityForm action={addActivity} customerId={e.customers.id} enquiryId={e.id} backTo={`/staff/enquiries/${e.id}`} />
            )}
            <ActivityList activities={activities.data ?? []} />
          </Sheet>

          <Sheet title="งานที่ต้องทำ" id="tasks-title">
            <TaskList tasks={tasks} canWrite={staff.canWrite} empty="ไม่มีงานค้างของคำขอนี้" />
            {staff.canWrite && e.customers && (
              <TaskForm action={createTask} customerId={e.customers.id} enquiryId={e.id} staffOptions={staffOpts} defaultAssignee={e.assigned_to ?? staff.userId} backTo={`/staff/enquiries/${e.id}`} />
            )}
          </Sheet>
        </div>

        <Sheet title="ประวัติสถานะ" id="history-title">
          <ol className="grid gap-2">
            {(history.data ?? []).map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
                <span className="w-44 shrink-0 text-ink-soft">{formatDateTime(h.changed_at)}</span>
                {h.from_status ? (
                  <span>
                    {enquiryStatusLabels[h.from_status]} เป็น <strong>{enquiryStatusLabels[h.to_status]}</strong>
                  </span>
                ) : (
                  <span>สร้างคำขอ ({enquiryStatusLabels[h.to_status]})</span>
                )}
                <span className="text-ink-soft">{h.staff_users?.full_name ? `โดย ${h.staff_users.full_name}` : "โดยระบบ"}</span>
              </li>
            ))}
          </ol>
        </Sheet>
      </div>
    </>
  );
}
