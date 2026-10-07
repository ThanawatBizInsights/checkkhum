import type { ReactNode } from "react";

/** The narrow white card used by the customer sign-in, reset and password pages. */
export function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-sky py-10 md:py-16">
      <div className="wrap">
        <div className="mx-auto w-full max-w-[440px] rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-7 md:p-8">
          <h1 className="text-[1.75rem] leading-tight">{title}</h1>
          {intro && <div className="mt-2 text-ink-soft">{intro}</div>}
          {children}
        </div>
      </div>
    </section>
  );
}

export function FormField({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-semibold text-navy">
        {label}
      </label>
      <input id={id} className="field-input" aria-describedby={hint ? `${id}-hint` : undefined} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Shown on every customer auth page when Supabase isn't configured. */
export function NotConnected() {
  return (
    <p role="status" className="mt-4 rounded-[var(--radius-control)] bg-warn-bg px-3 py-2 text-[0.9375rem] text-warn">
      ระบบบัญชีลูกค้ายังไม่ได้เชื่อมต่อฐานข้อมูล ตอนนี้ยังเข้าสู่ระบบไม่ได้ ติดต่อทีมงานทาง LINE หรือโทรได้ตามปกติ
    </p>
  );
}
