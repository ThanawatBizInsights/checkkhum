import type { ReactNode } from "react";

/** Marks anything that runs on demo data. Keep it visible until the backend is live. */
export function DemoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-demo-bg px-3 py-0.5 text-[0.9375rem] font-semibold text-demo">
      ข้อมูลสาธิต
    </span>
  );
}

export function DemoNotice({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="rounded-[var(--radius-control)] border border-[#f0d58c] bg-demo-bg px-4 py-3 text-[0.9375rem] leading-relaxed text-ink">
      <p className="font-semibold text-demo">ข้อมูลสาธิต</p>
      <p className="mt-0.5">{children}</p>
    </div>
  );
}
