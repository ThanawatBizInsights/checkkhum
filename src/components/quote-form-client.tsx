"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { findPlan, plans, type PlanId } from "@/content/products";
import { formatThaiPhone } from "@/lib/contact";
import { isValidThaiPhone, normalizeThaiMobile, type EnquiryInput } from "@/lib/submissions";
import { FormError, HoneypotField, MarketingConsent, TurnstileWidget } from "./anti-spam-fields";
import { Button } from "./button";
import { DemoNotice } from "./demo-notice";
import { EnquiryResult } from "./enquiry-result";
import { ChipGroup, TextAreaField, TextField } from "./form-fields";
import { useEnquirySubmission } from "./use-enquiry-submission";

const emptyFields = {
  carModel: "",
  carYear: "",
  destination: "",
  tripDays: "",
  travellers: "",
  name: "",
  phone: "",
  message: "",
};

export type QuoteFormProps = {
  initialPlan?: PlanId;
  title?: string;
  titleAs?: "h1" | "h2";
  showNotes?: boolean;
  idPrefix?: string;
};

/**
 * The quote slip. Used on the homepage, product pages and /quote.
 * Render it through `QuoteForm` (server), which supplies `demo` and the
 * Turnstile site key.
 */
export function QuoteFormClient({
  initialPlan = "car-1",
  title = "ขอใบเสนอราคา",
  titleAs: TitleTag = "h2",
  showNotes = false,
  idPrefix = "quote",
  demo,
  turnstileSiteKey,
}: QuoteFormProps & { demo: boolean; turnstileSiteKey?: string }) {
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const [channel, setChannel] = useState<"phone" | "line">("phone");
  const [marketing, setMarketing] = useState(false);
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const submission = useEnquirySubmission();

  const plan = findPlan(planId) ?? plans[0];
  const id = (s: string) => `${idPrefix}-${s}`;
  const set = (key: keyof typeof emptyFields) => (e: { target: { value: string } }) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!fields.name.trim()) next.name = "กรอกชื่อเพื่อให้เราติดต่อกลับได้";
    if (!isValidThaiPhone(fields.phone)) next.phone = "กรอกเบอร์โทร 9–10 หลักที่ขึ้นต้นด้วย 0";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.phone) return phoneRef.current?.focus();

    const input: EnquiryInput = {
      type: "quote",
      planId: plan.id,
      planName: plan.fullName,
      name: fields.name.trim(),
      phone: formatThaiPhone(normalizeThaiMobile(fields.phone)),
      preferredChannel: channel,
      ...(plan.kind === "car"
        ? { carModel: fields.carModel.trim(), carYear: fields.carYear.trim() }
        : {
            destination: fields.destination.trim(),
            tripDays: fields.tripDays.trim(),
            travellers: fields.travellers.trim(),
          }),
      message: fields.message.trim() || undefined,
      marketingConsent: marketing,
    };

    const serverErrors = await submission.submit(input);
    if (serverErrors) {
      setErrors(serverErrors);
      if (serverErrors.name) nameRef.current?.focus();
      else if (serverErrors.phone) phoneRef.current?.focus();
    }
  }

  return (
    <section
      id="quote"
      data-quote-form
      aria-labelledby={id("title")}
      className="rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-6 shadow-[0_18px_40px_-24px_rgba(10,34,89,.45)] md:p-8"
    >
      <TitleTag id={id("title")} className="text-[1.75rem]">
        {title}
      </TitleTag>

      {submission.result ? (
        <div className="mt-4">
          <EnquiryResult
            result={submission.result}
            onEdit={submission.clearResult}
            onReset={() => {
              setFields(emptyFields);
              setMarketing(false);
              submission.clearResult();
            }}
          />
        </div>
      ) : (
        <>
          <p className="mb-5 mt-1 text-base text-ink-soft">กรอกข้อมูลสั้น ๆ แล้วเราจะเทียบแผนจากหลายบริษัทให้ ไม่มีค่าใช้จ่าย</p>
          <form onSubmit={onSubmit} noValidate className="relative grid gap-4">
            <ChipGroup
              legend="สนใจประกันแบบไหน"
              name={id("plan")}
              value={planId}
              onChange={setPlanId}
              options={plans.map((p) => ({ value: p.id, label: p.label }))}
            />

            {plan.kind === "car" ? (
              <div className="flex gap-3">
                <TextField id={id("car-model")} label="ยี่ห้อและรุ่นรถ" placeholder="เช่น Honda City" autoComplete="off" maxLength={120} value={fields.carModel} onChange={set("carModel")} error={errors.carModel} />
                <TextField id={id("car-year")} label="ปีรถ (ค.ศ.)" placeholder="เช่น 2022" inputMode="numeric" maxLength={4} narrow value={fields.carYear} onChange={set("carYear")} error={errors.carYear} />
              </div>
            ) : (
              <>
                <TextField id={id("destination")} label="ประเทศปลายทาง" placeholder="เช่น ญี่ปุ่น" autoComplete="off" maxLength={100} value={fields.destination} onChange={set("destination")} error={errors.destination} />
                <div className="flex gap-3">
                  <TextField id={id("trip-days")} label="จำนวนวัน" placeholder="เช่น 7" inputMode="numeric" maxLength={3} value={fields.tripDays} onChange={set("tripDays")} error={errors.tripDays} />
                  <TextField id={id("travellers")} label="จำนวนผู้เดินทาง" placeholder="เช่น 2" inputMode="numeric" maxLength={2} value={fields.travellers} onChange={set("travellers")} error={errors.travellers} />
                </div>
              </>
            )}

            <TextField ref={nameRef} id={id("name")} label="ชื่อที่ให้เราเรียก" autoComplete="given-name" maxLength={120} required value={fields.name} onChange={set("name")} error={errors.name} />
            <TextField ref={phoneRef} id={id("phone")} label="เบอร์โทรศัพท์" type="tel" inputMode="tel" autoComplete="tel" placeholder="08x-xxx-xxxx" required value={fields.phone} onChange={set("phone")} error={errors.phone} />

            <ChipGroup
              legend="สะดวกให้ติดต่อกลับทาง"
              name={id("channel")}
              value={channel}
              onChange={setChannel}
              options={[
                { value: "phone", label: "โทรศัพท์" },
                { value: "line", label: "LINE" },
              ]}
            />

            {showNotes && (
              <TextAreaField id={id("message")} label="รายละเอียดเพิ่มเติม (ไม่บังคับ)" placeholder="เช่น วันหมดอายุกรมธรรม์เดิม หรือทุนประกันที่ต้องการ" maxLength={1000} value={fields.message} onChange={set("message")} error={errors.message} />
            )}

            <MarketingConsent id={id("marketing")} checked={marketing} onChange={setMarketing} />
            <HoneypotField id={id("website")} {...submission.honeypot} />
            {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onToken={submission.onTurnstileToken} />}

            {demo && (
              <DemoNotice>ตอนนี้ระบบรับคำขอยังไม่เชื่อมต่อ คำขอจะถูกบันทึกเป็นข้อมูลสาธิตในเบราว์เซอร์นี้ แล้วคุณส่งต่อให้เราทาง LINE หรือโทรได้ในขั้นถัดไป</DemoNotice>
            )}

            <FormError message={submission.formError} />

            <Button type="submit" block disabled={submission.pending} aria-busy={submission.pending || undefined}>
              {submission.pending ? "กำลังส่งคำขอ" : "ขอใบเสนอราคา"}
            </Button>
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
              เราใช้ข้อมูลนี้เพื่อจัดทำใบเสนอราคาและติดต่อกลับเท่านั้น อ่าน
              <Link href="/privacy" className="text-teal-ink underline underline-offset-4">
                ประกาศความเป็นส่วนตัว
              </Link>
            </p>
          </form>
        </>
      )}
    </section>
  );
}
