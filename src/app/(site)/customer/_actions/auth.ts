"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteConfig } from "@/config/site";
import { clientIp, consumeRateLimit, saltedHash } from "@/lib/server/abuse";
import type { ActionResult } from "@/lib/server/crm/action";
import { sessionFromEmailLink } from "@/lib/server/customer-auth";
import { getBackendConfig } from "@/lib/server/env";
import { requestOrigin } from "@/lib/server/origin";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createUserClient } from "@/lib/server/supabase-user";

/*
 * Customer registration, sign-in, email verification, password recovery and
 * sign-out, all through Supabase Auth with the publishable key (the secret key
 * is used only for the registration rate limit). Registering creates a login
 * and, in the database, a customer profile. It never creates staff rows and
 * never links the login to an existing CRM customer: that happens only in
 * accept_customer_invitation(), for a verified email a staff member invited.
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
    if (error?.code === "email_not_confirmed") {
      return { ok: false, message: "ยังไม่ได้ยืนยันอีเมล กดลิงก์ในอีเมลที่เราส่งให้ หรือกด “ส่งอีเมลยืนยันอีกครั้ง” ด้านล่าง" };
    }
    return { ok: false, message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  // Profile, and a link if a staff invitation for this verified email waits.
  const { data: status } = await db.rpc("portal_session");
  redirect(status === "staff" ? "/staff" : "/customer");
}

const resetSchema = z.object({ email: z.email({ error: "กรอกอีเมลให้ถูกต้อง" }).trim().toLowerCase() });

export async function requestPasswordReset(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "กรอกอีเมลให้ถูกต้อง", fieldErrors: { email: "กรอกอีเมลให้ถูกต้อง" } };

  const db = await createUserClient();
  if (!db) return { ok: false, message: NOT_CONNECTED };

  const origin = await requestOrigin();
  const { error } = await db.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: origin ? `${origin}/customer/auth/confirm` : undefined,
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

  const { data: status } = await db.rpc("portal_session");
  redirect(status === "staff" ? "/staff" : "/customer?welcome=1");
}

/** Sign out (customers and staff alike) and go back to the homepage. */
export async function signOutToHome(): Promise<void> {
  const db = await createUserClient();
  await db?.auth.signOut();
  redirect("/");
}

// ---- Registration ---------------------------------------------------------

export type RegisterResult = ActionResult & { email?: string; values?: { full_name: string; email: string } };

const REGISTER_LIMIT = { limit: 10, windowSeconds: 60 * 60 };

const registerSchema = z
  .object({
    full_name: z.string({ error: "กรอกชื่อ-นามสกุล" }).trim().min(2, "กรอกชื่อ-นามสกุล").max(120, "ชื่อยาวเกิน 120 ตัวอักษร"),
    email: z.email({ error: "กรอกอีเมลให้ถูกต้อง" }).trim().toLowerCase().max(254, "อีเมลยาวเกินไป"),
    password: z.string().min(10, "รหัสผ่านต้องยาวอย่างน้อย 10 ตัวอักษร").max(200, "รหัสผ่านยาวเกินไป"),
    confirm: z.string(),
    privacy: z.literal("on", { error: "อ่านและยอมรับประกาศความเป็นส่วนตัวก่อนสมัคร" }),
    website: z.string().max(0).optional(), // honeypot: people never fill it
  });

/** Cross-field checks, run even when other fields fail so every problem shows at once. */
function passwordProblems(raw: Record<string, FormDataEntryValue>): Record<string, string> {
  const password = String(raw.password ?? "");
  const confirm = String(raw.confirm ?? "");
  const emailName = String(raw.email ?? "").trim().toLowerCase().split("@")[0];
  const problems: Record<string, string> = {};
  if (confirm !== password) problems.confirm = "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
  if (emailName.length >= 4 && password.toLowerCase().includes(emailName)) problems.password = "รหัสผ่านต้องไม่มีชื่ออีเมลอยู่ข้างใน";
  return problems;
}

/**
 * Public registration. Supabase Auth creates the login and emails a
 * verification link (email confirmation must be on); the login can't sign in
 * until the link is used. The database trigger creates the customer profile.
 */
export async function registerCustomer(_prev: RegisterResult, formData: FormData): Promise<RegisterResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);
  const problems = passwordProblems(raw);
  if (!parsed.success || Object.keys(problems).length) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? []) fieldErrors[String(issue.path[0])] ??= issue.message;
    for (const [k, v] of Object.entries(problems)) fieldErrors[k] ??= v;
    const values = { full_name: String(formData.get("full_name") ?? "").slice(0, 120), email: String(formData.get("email") ?? "").slice(0, 254) };
    if (fieldErrors.website) return { ok: false, message: "สมัครไม่สำเร็จ ลองอีกครั้ง", values };
    return { ok: false, message: "ข้อมูลบางช่องยังไม่ถูกต้อง", fieldErrors, values };
  }
  const input = parsed.data;
  const result = await signUpCustomer(input);
  return result.ok ? result : { ...result, values: { full_name: input.full_name, email: input.email } };
}

async function signUpCustomer(input: z.infer<typeof registerSchema>): Promise<RegisterResult> {

  const db = await createUserClient();
  if (!db) return { ok: false, message: NOT_CONNECTED };

  // Our own per-IP limit (Supabase sees only this server's address).
  const config = getBackendConfig();
  if (config.mode === "database") {
    const ip = clientIp(await headers());
    const admin = getSupabaseAdmin(config.supabaseUrl, config.secretKey);
    const limit = await consumeRateLimit(admin, `register:${saltedHash(config.hashSalt, `ip:${ip}`)}`, REGISTER_LIMIT).catch(() => null);
    if (limit && !limit.allowed) {
      return { ok: false, message: `สมัครจากเครื่องนี้บ่อยเกินไป ลองใหม่ในอีก ${Math.ceil(limit.retryAfterSeconds / 60)} นาที` };
    }
  }

  const origin = await requestOrigin();
  const { data, error } = await db.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: origin ? `${origin}/customer/auth/confirm` : undefined,
      data: { full_name: input.full_name, privacy_notice_version: siteConfig.privacyNoticeVersion },
    },
  });

  if (error) {
    switch (error.code) {
      case "weak_password":
        return { ok: false, message: "รหัสผ่านเดาง่ายเกินไป", fieldErrors: { password: "ใช้รหัสผ่านที่ยาวขึ้นและผสมตัวอักษร ตัวเลข หรือสัญลักษณ์" } };
      case "email_address_invalid":
      case "validation_failed":
        return { ok: false, message: "อีเมลนี้ใช้สมัครไม่ได้", fieldErrors: { email: "ตรวจอีเมลอีกครั้ง" } };
      case "user_already_exists":
      case "email_exists":
        return existingAccount();
      case "signup_disabled":
      case "email_provider_disabled":
        return { ok: false, message: "ขณะนี้ยังสมัครสมาชิกออนไลน์ไม่ได้ ติดต่อทีมงานทาง LINE" };
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return { ok: false, message: "ระบบส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่" };
      default:
        if (error.status === 429) return { ok: false, message: "ระบบส่งอีเมลบ่อยเกินไป รอสักครู่แล้วลองใหม่" };
        console.error(`[customer] sign-up failed ${error.code ?? error.status}`);
        return { ok: false, message: "สมัครไม่สำเร็จ ลองอีกครั้ง หรือติดต่อทีมงานทาง LINE" };
    }
  }

  // Supabase answers an already-registered (confirmed) email with a user that
  // has no identities and sends no email.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return existingAccount();

  if (data.session) {
    // Email confirmation is switched off in Supabase: never start a session
    // for an unverified address. (Fix the setting; see README.)
    console.error("[customer] sign-up returned a session: turn on email confirmation in Supabase Auth");
    await db.auth.signOut();
  }

  return {
    ok: true,
    email: input.email,
    message: `เราส่งลิงก์ยืนยันไปที่ ${input.email} แล้ว กดลิงก์ในอีเมลเพื่อยืนยัน จากนั้นเข้าสู่ระบบได้เลย`,
  };
}

function existingAccount(): RegisterResult {
  return {
    ok: false,
    message: "อีเมลนี้มีบัญชีอยู่แล้ว เข้าสู่ระบบ หรือใช้ “ลืมรหัสผ่าน” ถ้าจำรหัสไม่ได้",
    fieldErrors: { email: "อีเมลนี้มีบัญชีอยู่แล้ว" },
  };
}

const resendSchema = z.object({ email: z.email({ error: "กรอกอีเมลให้ถูกต้อง" }).trim().toLowerCase() });

/** Send the sign-up verification email again (same answer whether or not the address is waiting). */
export async function resendVerification(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = resendSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: "กรอกอีเมลให้ถูกต้อง", fieldErrors: { email: "กรอกอีเมลให้ถูกต้อง" } };

  const db = await createUserClient();
  if (!db) return { ok: false, message: NOT_CONNECTED };

  const origin = await requestOrigin();
  const { error } = await db.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: origin ? `${origin}/customer/auth/confirm` : undefined },
  });
  if (error?.status === 429 || error?.code === "over_email_send_rate_limit") {
    return { ok: false, message: "ขอลิงก์บ่อยเกินไป รอสักครู่แล้วลองใหม่" };
  }
  if (error) console.error(`[customer] resend failed ${error.code ?? error.status}`);
  return {
    ok: true,
    message: "ถ้าอีเมลนี้สมัครไว้และยังไม่ได้ยืนยัน เราส่งลิงก์ยืนยันใหม่ไปแล้ว ตรวจกล่องจดหมาย (และโฟลเดอร์สแปม)",
  };
}
