"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/server/crm/action";
import { sessionFromEmailLink } from "@/lib/server/customer-auth";
import { createUserClient } from "@/lib/server/supabase-user";

/*
 * Customer sign-in, password recovery and sign-out. Customers are created
 * only by staff invitations (sign-up is off in Supabase Auth); nothing here
 * creates an account or links one to a customer record. Linking happens in
 * the database (accept_customer_invitation) after the email is verified.
 */

const NOT_CONNECTED = "ระบบบัญชีลูกค้ายังไม่ได้เชื่อมต่อฐานข้อมูล ติดต่อทีมงานทาง LINE";

const signInSchema = z.object({
  email: z.email({ error: "กรอกอีเมล" }).trim().toLowerCase(),
  password: z.string().min(1, "กรอกรหัสผ่าน").max(200),
});

export async function customerSignIn(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "กรอกอีเมลและรหัสผ่าน" };

  const db = await createUserClient();
  if (!db) return { ok: false, message: NOT_CONNECTED };

  const { data, error } = await db.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.status === 429) return { ok: false, message: "ลองเข้าสู่ระบบบ่อยเกินไป รอสักครู่แล้วลองใหม่" };
    if (error?.code === "email_not_confirmed") return { ok: false, message: "ยืนยันอีเมลจากลิงก์ในอีเมลเชิญก่อน แล้วลองอีกครั้ง" };
    return { ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  // Links the account if a staff invitation for this verified email waits.
  const { data: status } = await db.rpc("accept_customer_invitation");
  redirect(status === "staff" ? "/staff" : "/customer");
}

const resetSchema = z.object({ email: z.email({ error: "กรอกอีเมลให้ถูกต้อง" }).trim().toLowerCase() });

export async function requestPasswordReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "กรอกอีเมลให้ถูกต้อง", fieldErrors: { email: "กรอกอีเมลให้ถูกต้อง" } };

  const db = await createUserClient();
  if (!db) return { ok: false, message: NOT_CONNECTED };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const { error } = await db.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: host ? `${proto}://${host}/customer/auth/confirm` : undefined,
  });
  if (error?.status === 429) return { ok: false, message: "ขอลิงก์บ่อยเกินไป รอสักครู่แล้วลองใหม่" };
  if (error) console.error(`[customer] reset request failed ${error.code ?? error.status}`);

  // Same answer whether or not the address has an account.
  return { ok: true, message: "ถ้าอีเมลนี้มีบัญชีกับเรา เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว ตรวจกล่องจดหมาย (และโฟลเดอร์สแปม)" };
}

const passwordSchema = z
  .object({
    password: z.string().min(10, "รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" });

/** Set a password after following an invitation or reset link (signed in by the link). */
export async function setNewPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "ตรวจรหัสผ่านอีกครั้ง", fieldErrors };
  }

  const db = await createUserClient();
  if (!db) return { ok: false, message: NOT_CONNECTED };
  const { data: userData } = await db.auth.getUser();
  if (!userData.user) return { ok: false, message: "ลิงก์หมดอายุแล้ว ขอลิงก์ใหม่ที่หน้าลืมรหัสผ่าน" };
  if (!(await sessionFromEmailLink(db))) return { ok: false, message: "เปิดลิงก์จากอีเมลก่อน หรือขอลิงก์ใหม่ที่หน้าลืมรหัสผ่าน" };

  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      ok: false,
      message: error.code === "same_password" ? "ใช้รหัสผ่านใหม่ที่ไม่ซ้ำกับรหัสเดิม" : "ตั้งรหัสผ่านไม่สำเร็จ ลองรหัสที่เดายากกว่านี้",
    };
  }

  const { data: status } = await db.rpc("accept_customer_invitation");
  redirect(status === "staff" ? "/staff" : "/customer?welcome=1");
}

/** Sign out (customers and staff alike) and go back to the homepage. */
export async function signOutToHome(): Promise<void> {
  const db = await createUserClient();
  await db?.auth.signOut();
  redirect("/");
}
