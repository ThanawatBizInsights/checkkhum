"use client";

import { useId, useRef, useState } from "react";
import { updateCustomerLine } from "@/app/staff/_actions/crm";
import { safeLineHref, safeLineOaChatHref } from "@/lib/line-contact";
import { buttonClasses } from "../button";
import { ActionForm } from "./action-form";
import { LineOaChatInput } from "./line-oa-chat-input";
import { Field, Pill } from "./ui";

export type LineContactCardProps = {
  customer: {
    id: string;
    line_display_name: string | null;
    line_id: string | null;
    line_url: string | null;
    line_oa_chat_url: string | null;
  };
  /** "กรอกโดยเจ้าหน้าที่, อัปเดต …" for the typed details, or null when there are none. */
  sourceNote: string | null;
  /** The LINE Login account, the only verified LINE identity. */
  verified: { displayName: string | null; linkedNote: string } | null;
  /** What the visitor typed with this enquiry, when it differs from the customer record. */
  enquiryLine: { lineId: string | null; lineUrl: string | null } | null;
  canWrite: boolean;
  backTo: string;
};

const muted = "text-[0.9375rem] text-ink-soft";
const textButton =
  "min-h-11 rounded-[var(--radius-control)] px-1 font-semibold text-teal-ink underline underline-offset-4 hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal";

/**
 * "ติดต่อผ่าน LINE" on the customer and enquiry pages: who the customer is on
 * LINE (name, ID, verification), one row of actions, and an inline editor.
 *
 * Two different links, never derived from each other:
 *  - "LINE ส่วนตัว" opens customers.line_url, the customer's own profile or
 *    add-friend link (line.me / lin.ee);
 *  - "แชท LINE OA" opens customers.line_oa_chat_url, the conversation in our
 *    LINE OA Manager (chat.line.biz), which only staff signed in to LINE OA
 *    with access to that chat can see.
 * Typed details are always unverified; only a LINE Login account is verified.
 */
export function LineContactCard({ customer, sourceNote, verified, enquiryLine, canWrite, backTo }: LineContactCardProps) {
  const [editing, setEditing] = useState(false);
  const [focusField, setFocusField] = useState<"line-display-name" | "line-url" | "line-oa-chat-url">("line-display-name");
  const [status, setStatus] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const oaNoteId = useId();

  const profileHref = safeLineHref(customer.line_url);
  const oaHref = safeLineOaChatHref(customer.line_oa_chat_url);
  const hasTyped = Boolean(customer.line_display_name || customer.line_id);

  function openEditor(field: typeof focusField) {
    setStatus("");
    setFocusField(field);
    setEditing(true);
  }

  function closeEditor(message = "") {
    setEditing(false);
    setStatus(message);
    // Back to the button that opened the editor, once it is rendered again.
    requestAnimationFrame(() => editButton.current?.focus());
  }

  async function copyId() {
    if (!customer.line_id) return;
    try {
      await navigator.clipboard.writeText(customer.line_id);
      setStatus("คัดลอก LINE ID แล้ว");
    } catch {
      setStatus("คัดลอกไม่สำเร็จ เลือก LINE ID แล้วคัดลอกเองได้");
    }
  }

  const missing = (text: string, field: typeof focusField, testId: string) => (
    <span className={`inline-flex min-h-11 items-center gap-1 ${muted}`} data-line-missing={testId}>
      {text}
      {canWrite && !editing && (
        <button type="button" onClick={() => openEditor(field)} className={textButton} aria-label={`เพิ่มลิงก์ (${text})`}>
          เพิ่มลิงก์
        </button>
      )}
    </span>
  );

  return (
    <section aria-labelledby={titleId} data-line-contact className="min-w-0 rounded-[var(--radius-panel)] bg-paper px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={titleId} className="text-[1.25rem]">
            ติดต่อผ่าน LINE
          </h2>
          {canWrite && !editing && (
            <button ref={editButton} type="button" onClick={() => openEditor("line-display-name")} className={buttonClasses("quiet", "sm")}>
              แก้ไข
            </button>
          )}
        </div>

        {/* Who the customer is on LINE */}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-[0.9375rem] font-semibold text-navy">ชื่อใน LINE</dt>
          <dd className="min-w-0 break-words">{customer.line_display_name ?? <span className="text-ink-soft">ไม่ได้ระบุ</span>}</dd>
          <dt className="text-[0.9375rem] font-semibold text-navy">LINE ID</dt>
          <dd className="min-w-0 break-words">
            {customer.line_id ? <span className="font-semibold" data-line-id>{customer.line_id}</span> : <span className="text-ink-soft">ไม่ได้ระบุ</span>}
          </dd>
        </dl>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          {verified ? (
            <span data-line-verified className="contents">
              <Pill tone="good">ยืนยันแล้วผ่าน LINE Login</Pill>
              <span className={muted}>
                ชื่อในบัญชี {verified.displayName ?? "ไม่ระบุ"}, {verified.linkedNote}
              </span>
            </span>
          ) : (
            <>
              <Pill tone="warn">ยังไม่ยืนยัน</Pill>
              {hasTyped && sourceNote && <span className={muted}>{sourceNote}</span>}
            </>
          )}
        </div>
        {verified && hasTyped && (
          <p className={`mt-1 ${muted}`}>
            ชื่อและ LINE ID ด้านบนเป็นข้อมูลที่กรอกเอง ยังไม่ยืนยัน{sourceNote ? ` (${sourceNote})` : ""}
          </p>
        )}

        {/* Actions: personal profile, OA conversation, copy ID */}
        <div className="mt-3 flex flex-wrap items-center gap-2" data-line-actions>
          {profileHref ? (
            <a href={profileHref} target="_blank" rel="noopener noreferrer" data-line-open className={buttonClasses("outline", "sm")}>
              LINE ส่วนตัว<span className="sr-only"> (เปิดในแท็บใหม่)</span>
            </a>
          ) : (
            missing("ยังไม่มีลิงก์ส่วนตัว", "line-url", "profile")
          )}
          {oaHref ? (
            <a
              href={oaHref}
              target="_blank"
              rel="noopener noreferrer"
              data-line-oa-open
              aria-describedby={oaNoteId}
              className={buttonClasses("outline", "sm")}
            >
              แชท LINE OA<span className="sr-only"> (เปิดในแท็บใหม่)</span>
            </a>
          ) : (
            missing("ยังไม่มีลิงก์แชท LINE OA", "line-oa-chat-url", "oa")
          )}
          <button
            type="button"
            onClick={copyId}
            disabled={!customer.line_id}
            title={customer.line_id ? undefined : "ยังไม่มี LINE ID"}
            className={`${buttonClasses("outline", "sm")} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            คัดลอก ID
          </button>
        </div>
        {oaHref && (
          <p id={oaNoteId} className={`mt-1 ${muted}`}>
            แชท LINE OA เปิดได้เมื่อเข้าสู่ระบบ LINE OA ด้วยบัญชีที่มีสิทธิ์ดูแชทนี้
          </p>
        )}
        {/* A polite live region (not role="status", which the CRM keeps for form results). */}
        <p aria-live="polite" data-copy-status className={`mt-1 ${muted}`}>
          {status}
        </p>

        {enquiryLine && (
          <div className="border-t border-line pt-3" data-enquiry-line>
            <p className="text-[0.9375rem] font-semibold text-navy">ที่ลูกค้ากรอกมากับคำขอนี้ (ยังไม่ยืนยัน)</p>
            <p className="min-w-0 break-words">
              {enquiryLine.lineId && <>LINE ID {enquiryLine.lineId}</>}
              {enquiryLine.lineId && enquiryLine.lineUrl && ", "}
              {enquiryLine.lineUrl && <span className="break-all">{enquiryLine.lineUrl}</span>}
            </p>
            {safeLineHref(enquiryLine.lineUrl) && (
              <a
                href={safeLineHref(enquiryLine.lineUrl)!}
                target="_blank"
                rel="noopener noreferrer"
                data-enquiry-line-open
                className={`${buttonClasses("outline", "sm")} mt-2`}
              >
                เปิดลิงก์ที่ส่งมา<span className="sr-only"> (เปิดในแท็บใหม่)</span>
              </a>
            )}
            {canWrite && <p className={`mt-1 ${muted}`}>ถ้าใช้ได้ กด &ldquo;แก้ไข&rdquo; แล้วบันทึกเป็นข้อมูลลูกค้า</p>}
          </div>
        )}

        {canWrite && editing && (
          <div className="border-t border-line pt-3" data-line-editor>
            <ActionForm
              action={updateCustomerLine}
              submitLabel="บันทึก"
              pendingLabel="กำลังบันทึก"
              onSuccess={(message) => closeEditor(message ?? "บันทึกข้อมูล LINE แล้ว")}
              secondaryActions={
                <button type="button" onClick={() => closeEditor()} className={buttonClasses("quiet", "sm")}>
                  ยกเลิก
                </button>
              }
            >
              <input type="hidden" name="id" value={customer.id} />
              <input type="hidden" name="back_to" value={backTo} />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="ชื่อใน LINE" htmlFor="line-display-name">
                  <input
                    id="line-display-name"
                    name="line_display_name"
                    defaultValue={customer.line_display_name ?? ""}
                    maxLength={100}
                    autoFocus={focusField === "line-display-name"}
                    className="field-input"
                  />
                </Field>
                <Field label="LINE ID" htmlFor="line-id">
                  <input id="line-id" name="line_id" defaultValue={customer.line_id ?? ""} maxLength={51} autoCapitalize="none" spellCheck={false} className="field-input" />
                </Field>
              </div>
              <Field label="ลิงก์โปรไฟล์ LINE" htmlFor="line-url" hint="ลิงก์โปรไฟล์หรือเพิ่มเพื่อนที่ลูกค้าส่งมา (https://line.me/… หรือ https://lin.ee/…)">
                <input
                  id="line-url"
                  name="line_url"
                  type="url"
                  inputMode="url"
                  defaultValue={customer.line_url ?? ""}
                  maxLength={300}
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus={focusField === "line-url"}
                  className="field-input"
                />
              </Field>
              <LineOaChatInput defaultValue={customer.line_oa_chat_url} autoFocus={focusField === "line-oa-chat-url"} />
            </ActionForm>
          </div>
        )}
    </section>
  );
}
