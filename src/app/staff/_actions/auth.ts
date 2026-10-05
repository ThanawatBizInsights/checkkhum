"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionFailure, runAction, type ActionResult } from "@/lib/server/crm/action";
import { createUserClient } from "@/lib/server/supabase-user";

const signInSchema = z.object({
  email: z.email({ error: "กรอกอีเมล" }).trim().toLowerCase(),
  password: z.string().min(1, "กรอกรหัสผ่าน").max(200),
  next: z.string().optional(),
});

/** Only same-site staff paths, e.g. "/staff/enquiries/…"; never "//evil.com". */
function safeNext(next: string | undefined): string {
  return next && /^\/staff(\/[A-Za-z0-9/_-]*)?$/.test(next) && next !== "/staff/login" ? next : "/staff";
}

export async function signIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "กรอกอีเมลและรหัสผ่าน" };

  const db = await createUserClient();
  if (!db) return { ok: false, message: "ระบบพนักงานยังไม่ได้เชื่อมต่อฐานข้อมูล" };

  const { data, error } = await db.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return {
      ok: false,
      message: error?.status === 429 ? "ลองเข้าสู่ระบบบ่อยเกินไป รอสักครู่แล้วลองใหม่" : "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    };
  }

  // A valid Supabase login is not enough: the user must be active staff.
  const { data: staff } = await db.from("staff_users").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!staff?.is_active) {
    await db.auth.signOut();
    return { ok: false, message: "บัญชีนี้ไม่มีสิทธิ์เข้าใช้ระบบพนักงาน ติดต่อผู้ดูแลระบบ" };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const db = await createUserClient();
  await db?.auth.signOut();
  redirect("/staff/login");
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "กรอกรหัสผ่านปัจจุบัน"),
    password: z.string().min(12, "รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวอักษร").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน" })
  .refine((v) => v.password !== v.current, { path: ["password"], message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" });

export async function changePassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  return runAction("viewer", passwordSchema, formData, async (input, staff) => {
    // Re-check the current password before allowing a change.
    const { error: authError } = await staff.db.auth.signInWithPassword({ email: staff.email, password: input.current });
    if (authError) throw new ActionFailure("รหัสผ่านปัจจุบันไม่ถูกต้อง");
    const { error } = await staff.db.auth.updateUser({ password: input.password });
    if (error) throw new ActionFailure("เปลี่ยนรหัสผ่านไม่สำเร็จ ลองรหัสที่เดายากกว่านี้");
    return "เปลี่ยนรหัสผ่านแล้ว";
  });
}
