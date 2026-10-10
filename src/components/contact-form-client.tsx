"use client";

import { useRef, useState, type FormEvent } from "react";
import { formatThaiPhone } from "@/lib/contact";
import { isValidThaiPhone, normalizeThaiMobile, type EnquiryInput } from "@/lib/submissions";
import { FormError, HoneypotField, MarketingConsent, TurnstileWidget } from "./anti-spam-fields";
import { Button } from "./button";
import { DemoNotice, IntakeUnavailableNotice } from "./demo-notice";
import { EnquiryResult } from "./enquiry-result";
import { ChipGroup, TextAreaField, TextField } from "./form-fields";
import { LineButton } from "./line-links";
import type { SubmissionMode } from "./quote-form-client";
import { useEnquirySubmission } from "./use-enquiry-submission";

const empty = { name: "", phone: "", message: "" };

/** "Ask us to call you back" form for the contact page. Render via `ContactForm`. */
export function ContactFormClient({ mode, turnstileSiteKey }: { mode: SubmissionMode; turnstileSiteKey?: string }) {
  const [fields, setFields] = useState(empty);
  const [channel, setChannel] = useState<"phone" | "line">("phone");
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const submission = useEnquirySubmission();
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  function focusFirst(errs: Record<string, string>) {
    if (errs.name) nameRef.current?.focus();
    else if (errs.phone) phoneRef.current?.focus();
    else if (errs.message) messageRef.current?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!fields.name.trim()) next.name = "กรอกชื่อเพื่อให้เราติดต่อกลับได้";
    if (!isValidThaiPhone(fields.phone)) next.phone = "กรอกเบอร์โทร 9–10 หลักที่ขึ้นต้นด้วย 0";
    if (!fields.message.trim()) next.message = "บอกเราสั้น ๆ ว่าต้องการสอบถามเรื่องอะไร";
    setErrors(next);
    if (Object.keys(next).length) return focusFirst(next);

    const input: EnquiryInput = {
      type: "contact",
      name: fields.name.trim(),
      phone: formatThaiPhone(normalizeThaiMobile(fields.phone)),
      preferredChannel: channel,
      message: fields.message.trim(),
      marketingConsent: marketing,
    };
    const serverErrors = await submission.submit(input);
    if (serverErrors) {
      setErrors(serverErrors);
      focusFirst(serverErrors);
    }
  }

  if (mode === "unavailable") {
    return (
      <div className="grid gap-4">
        <IntakeUnavailableNotice>ฝากข้อความถึงทีมงานทาง LINE ได้เลย</IntakeUnavailableNotice>
        <LineButton block>ติดต่อทีมงานผ่าน LINE</LineButton>
      </div>
    );
  }

  if (submission.result) {
    return (
      <EnquiryResult
        result={submission.result}
        onEdit={submission.clearResult}
        onReset={() => {
          setFields(empty);
          setMarketing(false);
          submission.clearResult();
        }}
      />
    );
  }

  return (
    <form data-contact-form onSubmit={onSubmit} noValidate className="relative grid gap-4">
      <TextField ref={nameRef} id="contact-name" label="ชื่อที่ให้เราเรียก" autoComplete="given-name" maxLength={120} value={fields.name} onChange={set("name")} error={errors.name} />
      <TextField ref={phoneRef} id="contact-phone" label="เบอร์โทรศัพท์" type="tel" inputMode="tel" autoComplete="tel" placeholder="08x-xxx-xxxx" value={fields.phone} onChange={set("phone")} error={errors.phone} />
      <ChipGroup
        legend="สะดวกให้ติดต่อกลับทาง"
        name="contact-channel"
        value={channel}
        onChange={setChannel}
        options={[
          { value: "phone", label: "โทรศัพท์" },
          { value: "line", label: "LINE" },
        ]}
      />
      <TextAreaField ref={messageRef} id="contact-message" label="เรื่องที่ต้องการสอบถาม" placeholder="เช่น อยากรู้ว่าประกันเดิมคุ้มครองน้ำท่วมไหม" maxLength={1000} value={fields.message} onChange={set("message")} error={errors.message} />
      <MarketingConsent id="contact-marketing" checked={marketing} onChange={setMarketing} />
      <HoneypotField id="contact-website" {...submission.honeypot} />
      {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onToken={submission.onTurnstileToken} />}
      {mode === "demo" && <DemoNotice>โหมดทดลองบนเครื่องนักพัฒนา: ข้อความจะเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ถึงทีมงาน</DemoNotice>}
      <FormError message={submission.formError} />
      <Button type="submit" block disabled={submission.pending} aria-busy={submission.pending || undefined}>
        {submission.pending ? "กำลังส่ง" : "ฝากให้ติดต่อกลับ"}
      </Button>
    </form>
  );
}
