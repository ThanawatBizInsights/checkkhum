"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_MAX_AGE_SECONDS,
  STAFF_COOKIE,
  createSessionToken,
  getStaffAuthConfig,
  safeEqual,
} from "@/lib/staff-session";

export type LoginState = { error: string | null; email: string };

export async function staffLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const config = getStaffAuthConfig();
  if (!config.enabled) {
    return { error: `ยังเข้าสู่ระบบไม่ได้: ${config.reason}`, email };
  }
  if (!email || !password) {
    return { error: "กรอกอีเมลและรหัสผ่าน", email };
  }

  const emailOk = safeEqual(email, config.email.toLowerCase());
  const passwordOk = safeEqual(password, config.password);
  if (!emailOk || !passwordOk) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง", email };
  }

  const token = await createSessionToken(config.email, config.secret);
  (await cookies()).set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/staff",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect("/staff/dashboard");
}

export async function staffLogout(): Promise<void> {
  (await cookies()).delete({ name: STAFF_COOKIE, path: "/staff" });
  redirect("/staff/login");
}
