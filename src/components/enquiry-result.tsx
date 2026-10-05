"use client";

import { useEffect, useRef, useState } from "react";
import { lineMessageUrl, phoneChannel } from "@/lib/contact";
import { Button, buttonClasses } from "./button";
import { DemoBadge } from "./demo-notice";
import type { EnquiryResultState } from "./use-enquiry-submission";

function HandoffLinks({ text, primary }: { text: string; primary: boolean }) {
  const lineUrl = lineMessageUrl(text);
  return (
    <>
      {lineUrl && (
        <a className={buttonClasses(primary ? "primary" : "quiet", "md", true)} href={lineUrl} target="_blank" rel="noopener noreferrer">
          ส่งทาง LINE
        </a>
      )}
      {phoneChannel.href && (
        <a className={buttonClasses(primary && !lineUrl ? "primary" : "quiet", "md", true)} href={phoneChannel.href}>
          โทร {phoneChannel.display}
        </a>
      )}
    </>
  );
}

/** Shown after an enquiry is submitted. */
export function EnquiryResult({
  result,
  onEdit,
  onReset,
}: {
  result: EnquiryResultState;
  onEdit: () => void;
  onReset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (result.kind === "stored") {
    return (
      <div>
        <h3 ref={headingRef} tabIndex={-1} className="text-xl outline-none">
          {result.duplicate ? "เราได้รับคำขอนี้แล้ว" : "ส่งคำขอแล้ว"}
        </h3>
        <p className="mt-1 text-[0.9375rem] text-ink-soft">
          {result.duplicate
            ? "คำขอเดียวกันนี้ส่งถึงเราแล้ว จึงไม่ได้สร้างคำขอซ้ำ ทีมงานจะติดต่อกลับในเวลาทำการ"
            : "ทีมงานจะติดต่อกลับในเวลาทำการ เก็บเลขที่คำขอไว้อ้างอิงเมื่อคุยกับเรา"}
        </p>
        <div className="my-4 rounded-[var(--radius-control)] border-2 border-teal bg-mint px-4 py-3">
          <p className="text-[0.9375rem] text-teal-ink">เลขที่คำขอ</p>
          <p className="font-display text-2xl font-semibold tracking-wide text-navy" data-testid="enquiry-reference">
            {result.reference}
          </p>
        </div>
        <pre className="mb-4 whitespace-pre-wrap break-words rounded-[var(--radius-control)] bg-sky px-4 py-3.5 font-body text-base leading-[1.75] text-ink">
          {result.summary}
        </pre>
        <div className="grid gap-2.5">
          <HandoffLinks text={`เลขที่คำขอ ${result.reference}\n${result.summary}`} primary={false} />
        </div>
        <button type="button" onClick={onReset} className="mt-3 py-1 font-medium text-teal-ink underline underline-offset-4">
          ส่งคำขออื่น
        </button>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.summary);
      setCopyStatus("คัดลอกข้อความแล้ว");
    } catch {
      setCopyStatus("คัดลอกไม่สำเร็จ เลือกข้อความด้านบนแล้วคัดลอกเองได้");
    }
  }

  return (
    <div>
      <div className="mb-3">
        <DemoBadge />
      </div>
      <h3 ref={headingRef} tabIndex={-1} className="text-xl outline-none">
        บันทึกคำขอเป็นข้อมูลสาธิตแล้ว
      </h3>
      <p className="mt-1 text-[0.9375rem] text-ink-soft">
        {result.storedLocally ? "คำขอนี้เก็บไว้ในเบราว์เซอร์นี้เท่านั้น " : ""}
        ทีมงานยังไม่ได้รับ ส่งข้อความนี้ทาง LINE หรือโทรหาเราเพื่อรับใบเสนอราคา
      </p>

      <pre className="my-4 whitespace-pre-wrap break-words rounded-[var(--radius-control)] bg-sky px-4 py-3.5 font-body text-base leading-[1.75] text-ink">
        {result.summary}
      </pre>

      <div className="grid gap-2.5">
        <HandoffLinks text={result.summary} primary />
        <Button variant="quiet" block onClick={copy}>
          คัดลอกข้อความ
        </Button>
      </div>
      {!lineMessageUrl(result.summary) && !phoneChannel.href && (
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
