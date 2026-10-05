"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/button";
import { DemoNotice } from "@/components/demo-notice";
import {
  clearDemoSubmissions,
  parseSubmissions,
  readDemoSubmissionsRaw,
  subscribeDemoSubmissions,
  type EnquiryType,
  type Submission,
} from "@/lib/submissions";

const dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });

const filters: { value: "all" | EnquiryType; label: string }[] = [
  { value: "all", label: "ทั้งหมด" },
  { value: "quote", label: "ขอใบเสนอราคา" },
  { value: "contact", label: "ฝากให้ติดต่อกลับ" },
];

function details(s: Submission): string {
  if (s.type === "contact") return s.message ?? "";
  const parts = [s.carModel, s.carYear && `ปี ${s.carYear}`, s.destination, s.tripDays && `${s.tripDays} วัน`, s.travellers && `${s.travellers} คน`];
  return [parts.filter(Boolean).join(" "), s.message].filter(Boolean).join(" / ");
}

export function SubmissionList() {
  // Server snapshot is null so the first render matches the server and
  // the list appears once the browser store is read.
  const raw = useSyncExternalStore(subscribeDemoSubmissions, readDemoSubmissionsRaw, () => null);
  const submissions = useMemo(() => (raw === null ? null : parseSubmissions(raw)), [raw]);
  const [filter, setFilter] = useState<"all" | EnquiryType>("all");

  const shown = submissions?.filter((s) => filter === "all" || s.type === filter) ?? [];

  return (
    <div className="mt-6 grid gap-5">
      <DemoNotice>
        รายการด้านล่างเป็นคำขอสาธิตที่บันทึกไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ใช่คำขอจริงจากลูกค้า
        เมื่อเชื่อมต่อระบบหลังบ้านแล้ว หน้านี้จะแสดงคำขอจากฐานข้อมูลแทน
      </DemoNotice>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="กรองประเภทคำขอ" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className="min-h-11 rounded-full border-[1.5px] border-line bg-paper px-4 font-medium text-navy aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-paper"
            >
              {f.label}
            </button>
          ))}
        </div>
        {submissions && submissions.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm("ลบคำขอสาธิตทั้งหมดในเบราว์เซอร์นี้?")) clearDemoSubmissions();
            }}
          >
            ลบข้อมูลสาธิต
          </Button>
        )}
      </div>

      {submissions === null ? (
        <p className="text-ink-soft">กำลังโหลดคำขอ</p>
      ) : shown.length === 0 ? (
        <div className="rounded-[var(--radius-panel)] bg-paper px-6 py-10 text-center">
          <p className="font-display text-xl font-semibold text-navy">ยังไม่มีคำขอสาธิต{filter !== "all" ? "ในหมวดนี้" : ""}</p>
          <p className="mx-auto mt-1 max-w-[30em] text-ink-soft">ลองส่งคำขอจากหน้าเว็บไซต์ในเบราว์เซอร์นี้ แล้วกลับมาดูที่หน้านี้</p>
          <ButtonLink href="/quote" size="sm" className="mt-5">
            เปิดฟอร์มขอใบเสนอราคา
          </ButtonLink>
        </div>
      ) : (
        <ul className="grid gap-3">
          {shown.map((s) => (
            <li key={s.id} className="rounded-[var(--radius-control)] border border-line bg-paper px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-lg">{s.type === "quote" ? s.planName : "ฝากให้ติดต่อกลับ"}</h2>
                <time dateTime={s.createdAt} className="text-[0.9375rem] text-ink-soft">
                  {dateFormat.format(new Date(s.createdAt))}
                </time>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-[0.9375rem] sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold text-navy">ลูกค้า</dt>
                <dd>
                  {s.name}, {s.phone}
                </dd>
                <dt className="font-semibold text-navy">ติดต่อกลับทาง</dt>
                <dd>{s.preferredChannel === "line" ? "LINE" : "โทรศัพท์"}</dd>
                {details(s) && (
                  <>
                    <dt className="font-semibold text-navy">รายละเอียด</dt>
                    <dd className="break-words">{details(s)}</dd>
                  </>
                )}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
