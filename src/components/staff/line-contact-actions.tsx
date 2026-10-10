"use client";

import { useState } from "react";
import { buttonClasses } from "../button";
import { safeLineHref } from "@/lib/line-contact";

/**
 * "คัดลอก LINE ID" and "เปิด LINE" for a saved LINE ID / link. The link opens
 * only if it is a saved, valid LINE URL; nothing is ever built from an ID,
 * name or phone number.
 */
export function LineContactActions({ lineId, lineUrl, label = "" }: { lineId: string | null; lineUrl: string | null; label?: string }) {
  const [status, setStatus] = useState("");
  const href = safeLineHref(lineUrl);

  async function copy() {
    if (!lineId) return;
    try {
      await navigator.clipboard.writeText(lineId);
      setStatus("คัดลอก LINE ID แล้ว");
    } catch {
      setStatus("คัดลอกไม่สำเร็จ เลือก LINE ID แล้วคัดลอกเองได้");
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          disabled={!lineId}
          aria-label={label ? `คัดลอก LINE ID ${label}` : undefined}
          className={`${buttonClasses("outline", "sm")} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          คัดลอก LINE ID
        </button>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            data-line-open
            aria-label={label ? `เปิด LINE ${label} (เปิดในแท็บใหม่)` : undefined}
            className={buttonClasses("outline", "sm")}
          >
            เปิด LINE
            {!label && <span className="sr-only"> (เปิดในแท็บใหม่)</span>}
          </a>
        ) : (
          <button type="button" disabled title="ยังไม่มีลิงก์ LINE ที่บันทึกไว้" className={`${buttonClasses("outline", "sm")} cursor-not-allowed opacity-50`}>
            เปิด LINE
          </button>
        )}
      </div>
      {/* A polite live region (not role="status", which the CRM keeps for form results). */}
      <p aria-live="polite" data-copy-status className="mt-1 min-h-[1.5em] text-[0.9375rem] text-ink-soft">
        {status}
      </p>
    </div>
  );
}
