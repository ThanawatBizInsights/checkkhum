"use client";

import { useEffect, useRef, useState } from "react";
import { lineMessageUrl, phoneChannel } from "@/lib/contact";
import { DEMO_SUBMISSIONS } from "@/lib/submissions";
import { Button, buttonClasses } from "./button";
import { DemoBadge } from "./demo-notice";

/** Shown after an enquiry is saved: summary plus ways to hand it to the team. */
export function EnquiryResult({
  summary,
  storedLocally,
  onEdit,
  onReset,
}: {
  summary: string;
  storedLocally: boolean;
  onEdit: () => void;
  onReset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const lineUrl = lineMessageUrl(summary);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("คัดลอกข้อความแล้ว");
    } catch {
      setCopyStatus("คัดลอกไม่สำเร็จ เลือกข้อความด้านบนแล้วคัดลอกเองได้");
    }
  }

  return (
    <div>
      {DEMO_SUBMISSIONS && (
        <div className="mb-3">
          <DemoBadge />
        </div>
      )}
      <h3 ref={headingRef} tabIndex={-1} className="text-xl outline-none">
        {DEMO_SUBMISSIONS ? "บันทึกคำขอเป็นข้อมูลสาธิตแล้ว" : "ส่งคำขอแล้ว"}
      </h3>
      {DEMO_SUBMISSIONS && (
        <p className="mt-1 text-[0.9375rem] text-ink-soft">
          {storedLocally ? "คำขอนี้เก็บไว้ในเบราว์เซอร์นี้เท่านั้น " : ""}
          ทีมงานยังไม่ได้รับ ส่งข้อความนี้ทาง LINE หรือโทรหาเราเพื่อรับใบเสนอราคา
        </p>
      )}

      <pre className="my-4 whitespace-pre-wrap break-words rounded-[var(--radius-control)] bg-sky px-4 py-3.5 font-body text-base leading-[1.75] text-ink">
        {summary}
      </pre>

      <div className="grid gap-2.5">
        {lineUrl && (
          <a className={buttonClasses("primary", "md", true)} href={lineUrl} target="_blank" rel="noopener noreferrer">
            ส่งทาง LINE
          </a>
        )}
        {phoneChannel.href && (
          <a className={buttonClasses(lineUrl ? "quiet" : "primary", "md", true)} href={phoneChannel.href}>
            โทร {phoneChannel.display}
          </a>
        )}
        <Button variant="quiet" block onClick={copy}>
          คัดลอกข้อความ
        </Button>
      </div>
      {!lineUrl && !phoneChannel.href && (
        <p className="mt-3 text-[0.9375rem] text-ink-soft">
          ยังไม่ได้ตั้งค่าเบอร์โทรและ LINE ของเว็บไซต์ ช่องทางส่งจึงยังไม่เปิดใช้งาน
        </p>
      )}
      <p role="status" className="mt-2 min-h-[1.5em] text-[0.9375rem] text-ink-soft">
        {copyStatus}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-6">
        <button type="button" onClick={onEdit} className="py-1 font-medium text-teal-ink underline underline-offset-4">
          แก้ไขข้อมูล
        </button>
        <button type="button" onClick={onReset} className="py-1 font-medium text-teal-ink underline underline-offset-4">
          เริ่มคำขอใหม่
        </button>
      </div>
    </div>
  );
}
