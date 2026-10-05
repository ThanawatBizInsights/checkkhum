"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionFailure, check, f, runAction, type ActionResult } from "@/lib/server/crm/action";
import { getBackendConfig } from "@/lib/server/env";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";

/*
 * Administrator actions. runAction("admin") rejects everyone else before any
 * work happens, and RLS on staff_users / insurers / renewal_job_runs rejects
 * non-admins again in the database.
 */

export async function createStaffUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    email: z.email({ error: "อีเมลไม่ถูกต้อง" }).trim().toLowerCase(),
    full_name: f.text(120, "กรอกชื่อ"),
    role: z.enum(["admin", "agent", "viewer"]),
    temp_password: z.string().min(12, "รหัสผ่านชั่วคราวต้องยาวอย่างน้อย 12 ตัวอักษร").max(200),
  });
  return runAction("admin", schema, formData, async (input, staff) => {
    const config = getBackendConfig();
    if (config.mode !== "database") throw new ActionFailure("ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY");
    // Creating a login needs the Auth admin API (secret key). Only reached
    // after the caller has been verified as an admin above.
    const admin = getSupabaseAdmin(config.supabaseUrl, config.secretKey);
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.temp_password,
      email_confirm: true,
    });
    if (error || !data.user) {
      throw new ActionFailure(error?.code === "email_exists" ? "อีเมลนี้มีบัญชีอยู่แล้ว" : "สร้างบัญชีไม่สำเร็จ ลองรหัสผ่านที่เดายากกว่านี้");
    }
    // The staff row is written with the admin's own session (RLS: admins only).
    const { error: staffError } = await staff.db
      .from("staff_users")
      .insert({ id: data.user.id, email: input.email, full_name: input.full_name, role: input.role });
    if (staffError) {
      await admin.auth.admin.deleteUser(data.user.id);
      throw new ActionFailure("เพิ่มพนักงานไม่สำเร็จ");
    }
    revalidatePath("/staff/admin");
    return `เพิ่ม ${input.email} แล้ว ส่งรหัสผ่านชั่วคราวให้พนักงานทางช่องทางที่ปลอดภัย และให้เปลี่ยนรหัสหลังเข้าสู่ระบบ`;
  });
}

export async function updateStaffUser(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    id: f.uuid(),
    role: z.enum(["admin", "agent", "viewer"]),
    is_active: f.checkbox(),
  });
  return runAction("admin", schema, formData, async ({ id, role, is_active }, staff) => {
    if (id === staff.userId && (role !== "admin" || !is_active)) {
      throw new ActionFailure("เปลี่ยนสิทธิ์หรือปิดบัญชีของตัวเองไม่ได้ ให้ผู้ดูแลระบบคนอื่นทำ");
    }
    check(await staff.db.from("staff_users").update({ role, is_active }).eq("id", id).select("id"), { expectRows: true });
    revalidatePath("/staff/admin");
    return "บันทึกสิทธิ์แล้ว";
  });
}

export async function addInsurer(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,20}$/, "รหัสใช้ A–Z, 0–9 และ _ ยาว 2–20 ตัว"),
    name_th: f.text(120, "กรอกชื่อบริษัท"),
    name_en: f.optionalText(120),
  });
  return runAction("admin", schema, formData, async (input, staff) => {
    check(await staff.db.from("insurers").insert(input).select("id"));
    revalidatePath("/staff/admin");
    return "เพิ่มบริษัทประกันแล้ว";
  });
}

export async function setInsurerActive(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({ id: f.uuid(), is_active: z.enum(["true", "false"]).transform((v) => v === "true") });
  return runAction("admin", schema, formData, async ({ id, is_active }, staff) => {
    check(await staff.db.from("insurers").update({ is_active }).eq("id", id).select("id"), { expectRows: true });
    revalidatePath("/staff/admin");
    return is_active ? "เปิดใช้แล้ว" : "ปิดใช้แล้ว";
  });
}

export async function runRenewalJobNow(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction("admin", z.object({}), formData, async (_input, staff) => {
    const result = check(await staff.db.rpc("run_renewal_job")) as { tasks_created: number; reminders_created: number };
    revalidatePath("/staff/admin");
    revalidatePath("/staff/tasks");
    revalidatePath("/staff");
    return `สร้างงานต่ออายุ ${result.tasks_created} รายการ และการแจ้งเตือน ${result.reminders_created} รายการ`;
  });
}

export async function resetStaffPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const schema = z.object({
    id: f.uuid(),
    temp_password: z.string().min(12, "รหัสผ่านชั่วคราวต้องยาวอย่างน้อย 12 ตัวอักษร").max(200),
  });
  return runAction("admin", schema, formData, async ({ id, temp_password }, staff) => {
    // Only existing staff accounts, read through the admin's own RLS session.
    check(await staff.db.from("staff_users").select("id").eq("id", id).single());
    const config = getBackendConfig();
    if (config.mode !== "database") throw new ActionFailure("ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY");
    const admin = getSupabaseAdmin(config.supabaseUrl, config.secretKey);
    const { error } = await admin.auth.admin.updateUserById(id, { password: temp_password });
    if (error) throw new ActionFailure("ตั้งรหัสผ่านไม่สำเร็จ ลองรหัสที่เดายากกว่านี้");
    return "ตั้งรหัสผ่านชั่วคราวแล้ว ส่งให้พนักงานทางช่องทางที่ปลอดภัย และให้เปลี่ยนหลังเข้าสู่ระบบ";
  });
}
