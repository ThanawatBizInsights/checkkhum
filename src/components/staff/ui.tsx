import Link from "next/link";
import type { ReactNode } from "react";
import { enquiryStatusLabels, pipeline } from "@/lib/crm-labels";

/** Page heading row: title, optional subtitle and actions. */
export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.6rem,1.3rem+1.2vw,2.1rem)] leading-tight">{title}</h1>
        {sub && <div className="mt-1 text-ink-soft">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A white sheet on the sky background. */
export function Sheet({ title, children, actions, id }: { title?: string; children: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={title && id ? id : undefined} className="min-w-0 rounded-[var(--radius-panel)] bg-paper px-4 py-5 md:px-6">
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h2 id={id} className="text-[1.25rem]">
              {title}
            </h2>
          )}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const statusStyles: Record<string, string> = {
  new: "border-navy text-navy bg-paper",
  contacted: "border-sky bg-sky text-navy",
  quoting: "border-sky bg-sky text-navy",
  quoted: "border-teal bg-mint text-teal-ink",
  won: "border-teal bg-teal text-paper",
  lost: "border-line bg-line text-ink-soft",
  spam: "border-dashed border-ink-soft text-ink-soft bg-paper",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border-[1.5px] px-2.5 py-0.5 text-[0.9375rem] font-semibold ${statusStyles[status] ?? statusStyles.new}`}>
      {enquiryStatusLabels[status] ?? status}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "bg-sky text-navy",
    good: "bg-mint text-teal-ink",
    warn: "bg-warn-bg text-warn",
    bad: "bg-error-bg text-error",
  };
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.9375rem] font-semibold ${tones[tone]}`}>{children}</span>;
}

/**
 * The enquiry pipeline: new → contacted → quoted → won / lost.
 * With `counts` + `hrefFor` it is the filter on the enquiry list; with
 * `current` it shows where one enquiry is.
 */
export function PipelineStrip({
  current,
  counts,
  hrefFor,
  active,
}: {
  current?: string;
  counts?: Record<string, number>;
  hrefFor?: (status: string) => string;
  active?: string;
}) {
  const reachedIndex = current ? Math.max(pipeline.indexOf(current === "quoting" ? "contacted" : (current as (typeof pipeline)[number])), 0) : -1;
  return (
    // Phones: open stages on the first row, the two outcomes on the second.
    <ol className="grid grid-cols-6 gap-px overflow-hidden rounded-[var(--radius-control)] border-[1.5px] border-navy bg-line text-center sm:grid-cols-5">
      {pipeline.map((s, i) => {
        const isClosed = s === "won" || s === "lost";
        const reached = current ? (isClosed ? current === s : i <= reachedIndex && current !== "lost" && current !== "spam") : false;
        const isActive = active === s || current === s;
        const body = (
          <>
            <span className="block text-[0.9375rem] font-semibold leading-tight sm:text-[0.9375rem]">{enquiryStatusLabels[s]}</span>
            {counts && <span className="mt-0.5 block font-display text-xl font-semibold leading-none sm:text-2xl">{counts[s] ?? 0}</span>}
          </>
        );
        const cls = `block h-full px-1.5 py-2.5 sm:px-2 ${
          isActive ? "bg-navy text-paper" : reached ? (s === "won" ? "bg-teal text-paper" : "bg-mint text-teal-ink") : "bg-paper text-navy"
        }`;
        return (
          <li key={s} className={`min-w-0 ${i < 3 ? "col-span-2" : "col-span-3"} sm:col-span-1`}>
            {hrefFor ? (
              <Link href={hrefFor(s)} aria-current={isActive ? "page" : undefined} className={`${cls} hover:bg-sky hover:text-navy`}>
                {body}
              </Link>
            ) : (
              <span className={cls} aria-current={isActive ? "step" : undefined}>
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[var(--radius-control)] bg-sky px-4 py-6 text-center text-ink-soft">{children}</p>;
}

/** Simple label + control wrapper for server-rendered forms. */
export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-[0.9375rem] font-semibold text-navy">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[0.9375rem] text-ink-soft">{hint}</p>}
    </div>
  );
}

export function Select({
  id,
  name,
  options,
  defaultValue,
  required,
  placeholder,
}: {
  id: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue ?? ""} required={required} className="field-input">
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function AccessDenied({ need = "ผู้ดูแลระบบ" }: { need?: string }) {
  return (
    <div role="alert" className="rounded-[var(--radius-panel)] bg-paper px-6 py-10 text-center">
      <h1 className="text-2xl">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
      <p className="mt-2 text-ink-soft">หน้านี้สำหรับ{need}เท่านั้น ติดต่อผู้ดูแลระบบหากต้องการสิทธิ์เพิ่ม</p>
      <Link href="/staff" className="mt-4 inline-block font-semibold text-teal-ink underline underline-offset-4">
        กลับหน้าหลัก
      </Link>
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(8rem,auto)_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[0.9375rem] font-semibold text-navy">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
