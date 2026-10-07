"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { registerCustomer, resendVerification, type RegisterResult } from "@/app/(site)/customer/_actions/auth";
import { ActionForm } from "@/components/staff/action-form";
import { buttonClasses } from "../button";
import { FormField } from "./auth-card";

const initial: RegisterResult = { ok: false, message: null };

/** Registration form; after success it becomes the "check your email" panel with a resend button. */
export function RegisterForm() {
  const [state, action, pending] = useActionState(registerCustomer, initial);
  const ref = useRef<HTMLFormElement>(null);
  const messageId = useId();
  const doneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = ref.current;
    if (!form || !state.fieldErrors) return;
    form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
    let first: HTMLElement | null = null;
    for (const name of Object.keys(state.fieldErrors)) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLElement) {
        el.setAttribute("aria-invalid", "true");
        first ??= el;
      }
    }
    first?.focus();
  }, [state]);

  useEffect(() => {
    if (state.ok) doneRef.current?.focus();
  }, [state.ok]);

  if (state.ok && state.email) {
    return (
      <div ref={doneRef} tabIndex={-1} className="mt-5 outline-none">
        <div role="status" className="rounded-[var(--radius-control)] bg-mint px-4 py-3 text-teal-ink">
          <p className="font-semibold">ตรวจอีเมลเพื่อยืนยันการสมัคร</p>
          <p className="mt-1">{state.message}</p>
        </div>
        <p className="mt-4 text-[0.9375rem] text-ink-soft">ไม่เห็นอีเมล ดูในโฟลเดอร์สแปม หรือส่งอีกครั้ง (ลิงก์ใหม่ใช้แทนลิงก์เดิม)</p>
        <ActionForm action={resendVerification} submitLabel="ส่งอีเมลยืนยันอีกครั้ง" pendingLabel="กำลังส่ง" variant="outline" className="mt-3 grid gap-3">
          <input type="hidden" name="email" value={state.email} />
        </ActionForm>
        <Link href="/customer/login" className={`${buttonClasses("primary", "md", true)} mt-5`}>
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const err = (name: string) => state.fieldErrors?.[name];
  return (
    <form ref={ref} action={action} className="mt-5 grid gap-4" noValidate>
      <FormField id="full_name" name="full_name" label="ชื่อ-นามสกุล" autoComplete="name" required maxLength={120} defaultValue={state.values?.full_name} error={err("full_name")} />
      <FormField id="email" name="email" type="email" label="อีเมล" autoComplete="email" required defaultValue={state.values?.email} error={err("email")} />
      <FormField
        id="password"
        name="password"
        type="password"
        label="รหัสผ่าน"
        autoComplete="new-password"
        required
        minLength={10}
        hint="อย่างน้อย 10 ตัวอักษร ใช้ประโยคที่จำง่ายแต่เดายากก็ได้"
        error={err("password")}
      />
      <FormField id="confirm" name="confirm" type="password" label="ยืนยันรหัสผ่าน" autoComplete="new-password" required error={err("confirm")} />

      {/* Honeypot for bots; hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">เว็บไซต์</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div>
        <label className="flex items-start gap-3">
          <input
            id="privacy"
            name="privacy"
            type="checkbox"
            required
            aria-describedby={err("privacy") ? "privacy-error" : undefined}
            className="mt-1 size-5 shrink-0 accent-teal"
          />
          <span>
            ฉันอ่านและรับทราบ{" "}
            <Link href="/privacy" target="_blank" className="font-semibold text-teal-ink underline underline-offset-4">
              ประกาศความเป็นส่วนตัว
              <span className="sr-only"> (เปิดในแท็บใหม่)</span>
            </Link>{" "}
            ของเช็กคุ้ม
          </span>
        </label>
        {err("privacy") && (
          <p id="privacy-error" className="mt-1 text-[0.9375rem] text-error">
            {err("privacy")}
          </p>
        )}
      </div>

      <button type="submit" disabled={pending} className={`${buttonClasses("primary", "md", true)} disabled:opacity-60`}>
        {pending ? "กำลังสมัคร" : "สมัครสมาชิก"}
      </button>
      {state.message && !state.ok && (
        <p id={messageId} role="alert" className="text-[0.9375rem] text-error">
          {state.message}
        </p>
      )}
    </form>
  );
}
