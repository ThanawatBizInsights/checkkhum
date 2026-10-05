"use client";

import { useRef, useState, type FormEvent } from "react";
import { formatThaiPhone } from "@/lib/contact";
import {
  DEMO_SUBMISSIONS,
  isValidThaiPhone,
  normalizeThaiMobile,
  submitEnquiry,
  summarizeEnquiry,
  type EnquiryInput,
} from "@/lib/submissions";
import { Button } from "./button";
import { DemoNotice } from "./demo-notice";
import { EnquiryResult } from "./enquiry-result";
import { ChipGroup, TextAreaField, TextField } from "./form-fields";

type Errors = Partial<Record<"name" | "phone" | "message", string>>;
const empty = { name: "", phone: "", message: "" };

/** "Ask us to call you back" form for the contact page. */
export function ContactForm() {
  const [fields, setFields] = useState(empty);
  const [channel, setChannel] = useState<"phone" | "line">("phone");
  const [errors, setErrors] = useState<Errors>({});
  const [result, setResult] = useState<{ summary: string; storedLocally: boolean } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!fields.name.trim()) next.name = "กรอกชื่อเพื่อให้เราติดต่อกลับได้";
    if (!isValidThaiPhone(fields.phone)) next.phone = "กรอกเบอร์โทร 9–10 หลักที่ขึ้นต้นด้วย 0";
    if (!fields.message.trim()) next.message = "บอกเราสั้น ๆ ว่าต้องการสอบถามเรื่องอะไร";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.phone) return phoneRef.current?.focus();
    if (next.message) return messageRef.current?.focus();

    const input: EnquiryInput = {
      type: "contact",
      name: fields.name.trim(),
      phone: formatThaiPhone(normalizeThaiMobile(fields.phone)),
      preferredChannel: channel,
      message: fields.message.trim(),
    };
    const res = await submitEnquiry(input);
    if (res.ok) setResult({ summary: summarizeEnquiry(input), storedLocally: res.storedLocally });
  }

  if (result) {
    return (
      <EnquiryResult
        summary={result.summary}
        storedLocally={result.storedLocally}
        onEdit={() => setResult(null)}
        onReset={() => {
          setFields(empty);
          setResult(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <TextField ref={nameRef} id="contact-name" label="ชื่อที่ให้เราเรียก" autoComplete="given-name" value={fields.name} onChange={set("name")} error={errors.name} />
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
      <TextAreaField ref={messageRef} id="contact-message" label="เรื่องที่ต้องการสอบถาม" placeholder="เช่น อยากรู้ว่าประกันเดิมคุ้มครองน้ำท่วมไหม" value={fields.message} onChange={set("message")} error={errors.message} />
      {DEMO_SUBMISSIONS && (
        <DemoNotice>ระบบรับข้อความยังไม่เชื่อมต่อ ข้อความจะถูกบันทึกเป็นข้อมูลสาธิตในเบราว์เซอร์นี้ แล้วคุณส่งต่อให้เราทาง LINE หรือโทรได้</DemoNotice>
      )}
      <Button type="submit" block>
        ฝากให้ติดต่อกลับ
      </Button>
    </form>
  );
}
