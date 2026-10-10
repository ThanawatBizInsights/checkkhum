"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionFailure, check, f, runAction, type ActionResult } from "@/lib/server/crm/action";
import { LINE_ID_ERROR, LINE_URL_ERROR, isLineId, isLineUrl } from "@/lib/line-contact";

/*
 * CRM server actions. Each one:
 *  1. requires a minimum role (runAction → requireRole),
 *  2. validates the form with zod,
 *  3. writes through the staff member's own Supabase session, so row level
 *     security and the database triggers enforce permissions and workflow
 *     rules even if this code had a bug.
 * Updates use .select() and expectRows so an RLS-filtered "0 rows changed"
 * is reported instead of silently succeeding.
 */

/** Optional LINE ID, same rule as the database (private.is_line_id). */
const optionalLineId = () =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().refine(isLineId, LINE_ID_ERROR).optional());

const products = ["car_1", "car_2plus", "car_3plus", "ev", "compulsory", "travel"] as const;
const taskStatuses = ["open", "in_progress", "done", "cancelled"] as const;

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

export async function setEnquiryStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    id: f.uuid(),
    status: z.enum(["new", "contacted", "quoted", "won", "lost", "spam"]),
  });
  return runAction("agent", schema, formData, async ({ id, status }, staff) => {
    check(await staff.db.from("enquiries").update({ status }).eq("id", id).select("id"), { expectRows: true });
    refresh(`/staff/enquiries/${id}`, "/staff/enquiries", "/staff");
    return "เปลี่ยนสถานะแล้ว";
  });
}

export async function assignEnquiry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid(), assigned_to: f.optionalUuid() });
  return runAction("agent", schema, formData, async ({ id, assigned_to }, staff) => {
    check(await staff.db.from("enquiries").update({ assigned_to: assigned_to ?? null }).eq("id", id).select("id"), { expectRows: true });
    refresh(`/staff/enquiries/${id}`, "/staff/enquiries");
    return assigned_to ? "มอบหมายแล้ว" : "ยกเลิกการมอบหมายแล้ว";
  });
}

export async function createEnquiry(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    customer_id: f.uuid(),
    vehicle_id: f.optionalUuid(),
    product: z.enum(products, { error: "เลือกประเภทประกัน" }),
    source: z.enum(["phone", "line", "walk_in", "referral"], { error: "เลือกช่องทาง" }),
    message: f.optionalText(1000),
  });
  let newId = "";
  const result = await runAction("agent", schema, formData, async (input, staff) => {
    const customer = check(
      await staff.db.from("customers").select("full_name, phone, preferred_channel").eq("id", input.customer_id).single(),
    );
    if (!customer.phone) throw new ActionFailure("เพิ่มเบอร์โทรของลูกค้าก่อนสร้างคำขอ");
    const row = check(
      await staff.db
        .from("enquiries")
        .insert({
          customer_id: input.customer_id,
          vehicle_id: input.vehicle_id ?? null,
          type: "quote",
          product: input.product,
          source: input.source,
          contact_name: customer.full_name,
          contact_phone: customer.phone,
          preferred_channel: customer.preferred_channel,
          message: input.message ?? null,
          assigned_to: staff.userId,
        })
        .select("id")
        .single(),
    );
    newId = row.id;
  });
  if (result.ok && newId) redirect(`/staff/enquiries/${newId}`);
  return result;
}

// ---------------------------------------------------------------------------
// Quotations and policies
// ---------------------------------------------------------------------------

export async function addQuotation(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    enquiry_id: f.uuid(),
    insurer_id: f.uuid("เลือกบริษัทประกัน"),
    product: z.enum(products, { error: "เลือกประเภทประกัน" }),
    premium: f.money("กรอกเบี้ยประกัน"),
    sum_insured: f.optionalMoney(),
    deductible: f.optionalMoney(),
    repair_type: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["dealer", "garage"]).optional()),
    valid_until: f.optionalDate(),
    status: z.enum(["draft", "sent"]),
    notes: f.optionalText(2000),
  });
  return runAction("agent", schema, formData, async (input, staff) => {
    check(await staff.db.from("quotations").insert({ ...input, prepared_by: staff.userId }).select("id"));
    refresh(`/staff/enquiries/${input.enquiry_id}`);
    return input.status === "sent" ? "บันทึกใบเสนอราคาที่ส่งแล้ว" : "บันทึกร่างใบเสนอราคาแล้ว";
  });
}

export async function setQuotationStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    id: f.uuid(),
    enquiry_id: f.uuid(),
    status: z.enum(["draft", "sent", "accepted", "declined", "expired"]),
  });
  return runAction("agent", schema, formData, async ({ id, enquiry_id, status }, staff) => {
    check(await staff.db.from("quotations").update({ status }).eq("id", id).select("id"), { expectRows: true });
    refresh(`/staff/enquiries/${enquiry_id}`);
    return "อัปเดตใบเสนอราคาแล้ว";
  });
}

export async function convertQuotationToPolicy(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z
    .object({
      quotation_id: f.uuid(),
      enquiry_id: f.uuid(),
      policy_number: f.text(60, "กรอกเลขกรมธรรม์"),
      start_date: f.date("เลือกวันเริ่มคุ้มครอง"),
      end_date: f.date("เลือกวันสิ้นสุด"),
    })
    .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: "วันสิ้นสุดต้องหลังวันเริ่มคุ้มครอง" });
  return runAction("agent", schema, formData, async (input, staff) => {
    check(
      await staff.db.rpc("convert_quotation_to_policy", {
        p_quotation_id: input.quotation_id,
        p_policy_number: input.policy_number,
        p_start_date: input.start_date,
        p_end_date: input.end_date,
      }),
    );
    refresh(`/staff/enquiries/${input.enquiry_id}`, "/staff/policies", "/staff");
    return "ออกกรมธรรม์แล้ว";
  });
}

export async function addPolicy(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z
    .object({
      customer_id: f.uuid(),
      vehicle_id: f.optionalUuid(),
      insurer_id: f.uuid("เลือกบริษัทประกัน"),
      product: z.enum(products, { error: "เลือกประเภทประกัน" }),
      policy_number: f.text(60, "กรอกเลขกรมธรรม์"),
      start_date: f.date("เลือกวันเริ่มคุ้มครอง"),
      end_date: f.date("เลือกวันสิ้นสุด"),
      premium: f.money("กรอกเบี้ยประกัน"),
      status: z.enum(["pending", "active"]),
    })
    .refine((v) => v.end_date > v.start_date, { path: ["end_date"], message: "วันสิ้นสุดต้องหลังวันเริ่มคุ้มครอง" });
  return runAction("agent", schema, formData, async (input, staff) => {
    check(await staff.db.from("policies").insert({ ...input, vehicle_id: input.vehicle_id ?? null }).select("id"));
    refresh(`/staff/customers/${input.customer_id}`, "/staff/policies");
    return "เพิ่มกรมธรรม์แล้ว";
  });
}

export async function setPolicyStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid(), status: z.enum(["pending", "active", "expired", "cancelled"]) });
  return runAction("agent", schema, formData, async ({ id, status }, staff) => {
    check(await staff.db.from("policies").update({ status }).eq("id", id).select("id"), { expectRows: true });
    refresh(`/staff/policies/${id}`, "/staff/policies");
    return "อัปเดตสถานะกรมธรรม์แล้ว";
  });
}

// ---------------------------------------------------------------------------
// Customers and vehicles
// ---------------------------------------------------------------------------

export async function createCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    full_name: f.text(120, "กรอกชื่อลูกค้า"),
    phone: f.phone(),
    line_id: optionalLineId(),
    email: z.preprocess((v) => (v === "" ? undefined : v), z.email({ error: "อีเมลไม่ถูกต้อง" }).optional()),
    preferred_channel: z.enum(["phone", "line", "email"]),
  });
  let newId = "";
  const result = await runAction("agent", schema, formData, async (input, staff) => {
    const { data: existing } = await staff.db.from("customers").select("id").eq("phone", input.phone).maybeSingle();
    if (existing) throw new ActionFailure("มีลูกค้าที่ใช้เบอร์นี้อยู่แล้ว ค้นหาด้วยเบอร์โทรเพื่อเปิดข้อมูล");
    newId = check(await staff.db.from("customers").insert(input).select("id").single()).id;
  });
  if (result.ok && newId) redirect(`/staff/customers/${newId}`);
  return result;
}

export async function updateCustomer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    id: f.uuid(),
    full_name: f.text(120, "กรอกชื่อลูกค้า"),
    email: z.preprocess((v) => (v === "" ? undefined : v), z.email({ error: "อีเมลไม่ถูกต้อง" }).optional()),
    preferred_channel: z.enum(["phone", "line", "email"]),
    notes: f.optionalText(4000),
  });
  return runAction("agent", schema, formData, async ({ id, ...input }, staff) => {
    check(
      await staff.db
        .from("customers")
        .update({ ...input, email: input.email ?? null, notes: input.notes ?? null })
        .eq("id", id)
        .select("id"),
      { expectRows: true },
    );
    refresh(`/staff/customers/${id}`);
    return "บันทึกข้อมูลลูกค้าแล้ว";
  });
}

/**
 * LINE contact details on the customer record (shared by all their enquiries).
 * Typed by staff, so always unverified: the database stamps them
 * line_contact_source = 'staff_entry'. The verified LINE identity
 * (customer_line_accounts) is never written here.
 */
export async function updateCustomerLine(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    id: f.uuid(),
    line_display_name: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().max(100, "ชื่อใน LINE ยาวเกิน 100 ตัวอักษร").refine((v) => !/[\u0000-\u001f\u007f]/.test(v), "ชื่อใน LINE มีอักขระที่ใช้ไม่ได้").optional(),
    ),
    line_id: optionalLineId(),
    line_url: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z.string().trim().refine(isLineUrl, LINE_URL_ERROR).optional(),
    ),
    back_to: z.string().regex(/^\/staff\/[a-z0-9/-]+$/),
  });
  return runAction("agent", schema, formData, async ({ id, back_to, ...input }, staff) => {
    check(
      await staff.db
        .from("customers")
        .update({ line_display_name: input.line_display_name ?? null, line_id: input.line_id ?? null, line_url: input.line_url ?? null })
        .eq("id", id)
        .select("id"),
      { expectRows: true },
    );
    refresh(back_to, `/staff/customers/${id}`);
    return "บันทึกข้อมูล LINE แล้ว";
  });
}

export async function addVehicle(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const year = new Date().getFullYear() + 1;
  const schema = z.object({
    customer_id: f.uuid(),
    description: f.text(120, "กรอกยี่ห้อและรุ่น"),
    model_year: z.preprocess(
      (v) => (v === "" ? undefined : Number(v)),
      z.number({ error: "ปีรถไม่ถูกต้อง" }).int().min(1950, "ปีรถไม่ถูกต้อง").max(year, "ปีรถไม่ถูกต้อง").optional(),
    ),
    registration_plate: f.optionalText(20),
    plate_province: f.optionalText(40),
    is_ev: f.checkbox(),
  });
  return runAction("agent", schema, formData, async (input, staff) => {
    check(await staff.db.from("vehicles").insert(input).select("id"));
    refresh(`/staff/customers/${input.customer_id}`);
    return "เพิ่มรถแล้ว";
  });
}

// ---------------------------------------------------------------------------
// Follow-up notes, tasks, reminders
// ---------------------------------------------------------------------------

export async function addActivity(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    customer_id: f.uuid(),
    enquiry_id: f.optionalUuid(),
    policy_id: f.optionalUuid(),
    activity_type: z.enum(["call", "line", "email", "meeting", "note"]),
    summary: f.text(2000, "เขียนบันทึก"),
    outcome: f.optionalText(200),
    back_to: z.string().regex(/^\/staff\/[a-z0-9/-]+$/),
  });
  return runAction("agent", schema, formData, async ({ back_to, ...input }, staff) => {
    check(await staff.db.from("follow_up_activities").insert(input).select("id"));
    refresh(back_to, `/staff/customers/${input.customer_id}`);
    return "บันทึกแล้ว";
  });
}

export async function createTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    customer_id: f.uuid(),
    enquiry_id: f.optionalUuid(),
    policy_id: f.optionalUuid(),
    title: f.text(200, "กรอกสิ่งที่ต้องทำ"),
    due_date: f.date("เลือกวันครบกำหนด"),
    assigned_to: f.optionalUuid(),
    back_to: z.string().regex(/^\/staff\/[a-z0-9/-]+$/),
  });
  return runAction("agent", schema, formData, async ({ back_to, ...input }, staff) => {
    check(await staff.db.from("follow_up_tasks").insert({ ...input, assigned_to: input.assigned_to ?? null }).select("id"));
    refresh(back_to, "/staff/tasks", "/staff");
    return "เพิ่มงานแล้ว";
  });
}

const taskTable = { follow_up: "follow_up_tasks", renewal: "renewal_tasks" } as const;

export async function setTaskStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ kind: z.enum(["follow_up", "renewal"]), id: f.uuid(), status: z.enum(taskStatuses) });
  return runAction("agent", schema, formData, async ({ kind, id, status }, staff) => {
    check(await staff.db.from(taskTable[kind]).update({ status }).eq("id", id).select("id"), { expectRows: true });
    refresh("/staff/tasks", "/staff", "/staff/policies");
    return status === "done" ? "ทำเสร็จแล้ว" : "อัปเดตงานแล้ว";
  });
}

export async function assignTask(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ kind: z.enum(["follow_up", "renewal"]), id: f.uuid(), assigned_to: f.optionalUuid() });
  return runAction("agent", schema, formData, async ({ kind, id, assigned_to }, staff) => {
    check(await staff.db.from(taskTable[kind]).update({ assigned_to: assigned_to ?? null }).eq("id", id).select("id"), { expectRows: true });
    refresh("/staff/tasks", "/staff", "/staff/policies");
    return "มอบหมายแล้ว";
  });
}

export async function markReminderRead(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid() });
  return runAction("viewer", schema, formData, async ({ id }, staff) => {
    check(await staff.db.from("staff_reminders").update({ read_at: new Date().toISOString() }).eq("id", id).select("id"), { expectRows: true });
    refresh("/staff");
    return "รับทราบแล้ว";
  });
}
