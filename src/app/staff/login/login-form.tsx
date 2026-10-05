"use client";

import { useActionState } from "react";
import { Button } from "@/components/button";
import { staffLogin, type LoginState } from "../actions";

const initial: LoginState = { error: null, email: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(staffLogin, initial);

  return (
    <form action={action} className="mt-5 grid gap-4">
      <div>
        <label htmlFor="staff-email" className="mb-1.5 block font-semibold text-navy">
          อีเมล
        </label>
        <input id="staff-email" name="email" type="email" autoComplete="username" required defaultValue={state.email} className="field-input" />
      </div>
      <div>
        <label htmlFor="staff-password" className="mb-1.5 block font-semibold text-navy">
          รหัสผ่าน
        </label>
        <input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field-input"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "staff-login-error" : undefined}
        />
      </div>
      {state.error && (
        <p id="staff-login-error" role="alert" className="text-[0.9375rem] text-error">
          {state.error}
        </p>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? "กำลังเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
      </Button>
    </form>
  );
}
