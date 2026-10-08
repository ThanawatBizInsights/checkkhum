"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { findPlan, plans, type PlanId } from "@/content/products";
import {
  carBrandSuggestions,
  evChargerOptions,
  modelYearLabel,
  modelYears,
  renewalTimingOptions,
  repairOptions,
  usageOptions,
  vehicleTypeOptions,
} from "@/content/quote-options";
import { formatThaiPhone } from "@/lib/contact";
import { isValidThaiPhone, normalizeThaiMobile, type EnquiryInput } from "@/lib/submissions";
import { FormError, HoneypotField, MarketingConsent, TurnstileWidget } from "./anti-spam-fields";
import { Button } from "./button";
import { DemoNotice, IntakeUnavailableNotice } from "./demo-notice";
import { EnquiryResult } from "./enquiry-result";
import { ChipGroup, SelectField, TextAreaField, TextField } from "./form-fields";
import { LineButton } from "./line-links";
import { useEnquirySubmission } from "./use-enquiry-submission";

export type SubmissionMode = "database" | "demo" | "unavailable";

const emptyFields = {
  carBrand: "",
  carModel: "",
  carYear: "",
  renewalTiming: "",
  usage: "",
  repair: "",
  evCharger: "",
  vehicleType: "",
  destination: "",
  tripStart: "",
  tripDays: "",
  travellers: "1",
  name: "",
  phone: "",
  message: "",
};
type Fields = typeof emptyFields;

export type QuoteFormProps = {
  initialPlan?: PlanId;
  title?: string;
  titleAs?: "h1" | "h2";
  showNotes?: boolean;
  idPrefix?: string;
};

/** Fields each insurance type needs before we can quote. */
function missingFields(planId: PlanId, f: Fields): Record<string, string> {
  const e: Record<string, string> = {};
  if (planId === "travel") {
    if (!f.destination.trim()) e.destination = "กรอกประเทศปลายทาง";
    if (!/^\d{1,3}$/.test(f.tripDays.trim()) || Number(f.tripDays) < 1) e.tripDays = "กรอกจำนวนวันเดินทาง";
  } else if (planId === "compulsory") {
    if (!f.vehicleType) e.vehicleType = "เลือกประเภทรถ";
  } else {
    if (!f.carBrand.trim()) e.carBrand = "กรอกยี่ห้อรถ";
    if (!f.carModel.trim()) e.carModel = "กรอกรุ่นรถ";
    if (!f.carYear) e.carYear = "เลือกปีรถ";
  }
  if (!f.name.trim()) e.name = "กรอกชื่อเพื่อให้เราติดต่อกลับได้";
  if (!isValidThaiPhone(f.phone)) e.phone = "กรอกเบอร์โทร 9–10 หลักที่ขึ้นต้นด้วย 0";
  return e;
}

const fieldOrder = ["vehicleType", "carBrand", "carModel", "carYear", "destination", "tripStart", "tripDays", "travellers", "name", "phone"];

/**
 * The quotation form, used on the homepage, product pages and /quote. No
 * account needed. Render it through `QuoteForm` (server), which supplies the
 * submission mode and the Turnstile site key.
 */
export function QuoteFormClient({
  initialPlan = "car-1",
  title = "ขอใบเสนอราคา",
  titleAs: TitleTag = "h2",
  showNotes = false,
  idPrefix = "quote",
  mode,
  turnstileSiteKey,
}: QuoteFormProps & { mode: SubmissionMode; turnstileSiteKey?: string }) {
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const [channel, setChannel] = useState<"phone" | "line">("phone");
  const [marketing, setMarketing] = useState(false);
  const [fields, setFields] = useState(emptyFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const submission = useEnquirySubmission();
  const brandListId = useId();
  const years = useMemo(() => modelYears(), []);
  // A year outside the generated range (e.g. kept from an older page) still shows as selected.
  const yearOptions = useMemo(
    () => (fields.carYear && !years.some((y) => y.value === fields.carYear) ? [...years, { value: fields.carYear, label: modelYearLabel(fields.carYear) }] : years),
    [years, fields.carYear],
  );

  const plan = findPlan(planId) ?? plans[0];
  const isTravel = planId === "travel";
  const isCompulsory = planId === "compulsory";
  const id = (s: string) => `${idPrefix}-${s}`;
  const set = (key: keyof Fields) => (e: { target: { value: string } }) => setFields((f) => ({ ...f, [key]: e.target.value }));
  const choose = (key: keyof Fields) => (value: string) => setFields((f) => ({ ...f, [key]: value }));

  function focusFirst(errs: Record<string, string>) {
    const first = fieldOrder.find((k) => errs[k]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`#${id(first)}, [name="${id(first)}"]`);
    el?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "unavailable") return;
    const next = missingFields(planId, fields);
    setErrors(next);
    if (Object.keys(next).length) return focusFirst(next);

    const t = (v: string) => v.trim() || undefined;
    const input: EnquiryInput = {
      type: "quote",
      planId: plan.id,
      planName: plan.fullName,
      name: fields.name.trim(),
      phone: formatThaiPhone(normalizeThaiMobile(fields.phone)),
      preferredChannel: channel,
      renewalTiming: isTravel ? undefined : t(fields.renewalTiming),
      ...(isTravel
        ? { destination: t(fields.destination), tripStart: t(fields.tripStart), tripDays: t(fields.tripDays), travellers: t(fields.travellers) }
        : {
            carBrand: t(fields.carBrand),
            carModel: t(fields.carModel),
            carYear: t(fields.carYear),
            usage: isCompulsory ? undefined : t(fields.usage),
            repair: planId === "car-1" ? t(fields.repair) : undefined,
            evCharger: planId === "ev" ? t(fields.evCharger) : undefined,
            vehicleType: isCompulsory ? t(fields.vehicleType) : undefined,
          }),
      message: fields.message.trim() || undefined,
      marketingConsent: marketing,
    };

    const serverErrors = await submission.submit(input);
    if (serverErrors) {
      setErrors(serverErrors);
      focusFirst(serverErrors);
    }
  }

  return (
    <section
      id="quote"
      data-quote-form
      aria-labelledby={id("title")}
      className="rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-6 shadow-[0_18px_40px_-24px_rgba(10,34,89,.45)] sm:px-7 sm:py-7 lg:px-8 lg:py-8"
    >
      <TitleTag id={id("title")} className="text-[1.5rem] sm:text-[1.75rem]">
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
      ) : mode === "unavailable" ? (
        <div className="mt-4 grid gap-4">
          <IntakeUnavailableNotice>
            ทักทีมงานทาง LINE พร้อมบอกประเภทประกันและรุ่นรถ เราจะเตรียมใบเสนอราคาให้
          </IntakeUnavailableNotice>
          <LineButton block>ขอใบเสนอราคาทาง LINE</LineButton>
        </div>
      ) : (
        <>
          <p className="mb-6 mt-1 max-w-[36em] text-base text-ink-soft">
            ไม่ต้องสมัครสมาชิก กรอกข้อมูลสั้น ๆ ทีมงานจะติดต่อกลับ<span className="whitespace-nowrap">พร้อมใบเสนอราคา</span>
          </p>
          <form ref={formRef} onSubmit={onSubmit} noValidate className="@container relative grid gap-6">
            <ChipGroup
              legend="ประกันที่ต้องการ"
              name={id("plan")}
              value={planId}
              onChange={(v) => {
                setPlanId(v);
                setErrors({});
              }}
              options={plans.map((p) => ({ value: p.id, label: p.label }))}
              layout="tiles"
            />

            {isTravel ? (
              <>
                <div className="grid gap-5 @lg:grid-cols-2 @lg:gap-x-4">
                  <TextField id={id("destination")} label="ประเทศปลายทาง" placeholder="เช่น ญี่ปุ่น" autoComplete="off" maxLength={100} value={fields.destination} onChange={set("destination")} error={errors.destination} />
                  <TextField id={id("tripStart")} label="วันเริ่มเดินทาง" optional type="date" value={fields.tripStart} onChange={set("tripStart")} error={errors.tripStart} />
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <TextField id={id("tripDays")} label="จำนวนวัน" inputMode="numeric" placeholder="เช่น 7" maxLength={3} value={fields.tripDays} onChange={set("tripDays")} error={errors.tripDays} />
                  <TextField id={id("travellers")} label="จำนวนผู้เดินทาง" inputMode="numeric" maxLength={2} value={fields.travellers} onChange={set("travellers")} error={errors.travellers} />
                </div>
              </>
            ) : (
              <>
                {isCompulsory && (
                  <ChipGroup legend="ประเภทรถ" name={id("vehicleType")} value={fields.vehicleType} onChange={choose("vehicleType")} options={[...vehicleTypeOptions]} error={errors.vehicleType} />
                )}
                <div className="grid gap-5 @lg:grid-cols-2 @lg:gap-x-4">
                  <div>
                    <TextField
                      id={id("carBrand")}
                      label="ยี่ห้อรถ"
                      optional={isCompulsory}
                      placeholder="เช่น Toyota"
                      list={brandListId}
                      autoComplete="off"
                      maxLength={60}
                      value={fields.carBrand}
                      onChange={set("carBrand")}
                      error={errors.carBrand}
                    />
                    <datalist id={brandListId}>
                      {carBrandSuggestions.map((b) => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>
                  <TextField
                    id={id("carModel")}
                    label="รุ่นรถ"
                    optional={isCompulsory}
                    placeholder="เช่น Yaris Ativ"
                    autoComplete="off"
                    maxLength={60}
                    value={fields.carModel}
                    onChange={set("carModel")}
                    error={errors.carModel}
                  />
                </div>
                <div className="grid gap-5 @lg:grid-cols-2 @lg:gap-x-4">
                  <SelectField
                    id={id("carYear")}
                    label="ปีรถ (พ.ศ.)"
                    optional={isCompulsory}
                    placeholder="เลือกปีรถ"
                    options={yearOptions}
                    value={fields.carYear}
                    onChange={set("carYear")}
                    error={errors.carYear}
                  />
                  <SelectField
                    id={id("renewalTiming")}
                    label={isCompulsory ? "พ.ร.บ. เดิมหมดเมื่อไร" : "ประกันเดิมหมดเมื่อไร"}
                    optional
                    placeholder="เลือกช่วงเวลา"
                    options={[...renewalTimingOptions]}
                    value={fields.renewalTiming}
                    onChange={set("renewalTiming")}
                    error={errors.renewalTiming}
                  />
                </div>
                {planId === "ev" && (
                  <ChipGroup legend="มีเครื่องชาร์จที่บ้านไหม" optional name={id("evCharger")} value={fields.evCharger} onChange={choose("evCharger")} options={[...evChargerOptions]} error={errors.evCharger} />
                )}
                {planId === "car-1" && (
                  <ChipGroup legend="อยากซ่อมแบบไหน" optional name={id("repair")} value={fields.repair} onChange={choose("repair")} options={[...repairOptions]} error={errors.repair} />
                )}
                {!isCompulsory && (
                  <ChipGroup legend="ลักษณะการใช้รถ" optional name={id("usage")} value={fields.usage} onChange={choose("usage")} options={[...usageOptions]} error={errors.usage} />
                )}
              </>
            )}

            <div className="grid gap-5 border-t border-line pt-6 @lg:grid-cols-2 @lg:gap-x-4">
              <TextField id={id("name")} label="ชื่อที่ให้เราเรียก" autoComplete="given-name" maxLength={120} required value={fields.name} onChange={set("name")} error={errors.name} />
              <TextField
                id={id("phone")}
                label="เบอร์โทรศัพท์"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08x-xxx-xxxx"
                required
                value={fields.phone}
                onChange={set("phone")}
                error={errors.phone}
              />
            </div>

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
              <TextAreaField
                id={id("message")}
                label="รายละเอียดเพิ่มเติม"
                optional
                placeholder="เช่น ทุนประกันที่ต้องการ หรือคำถามถึงทีมงาน"
                maxLength={1000}
                value={fields.message}
                onChange={set("message")}
                error={errors.message}
              />
            )}

            <MarketingConsent id={id("marketing")} checked={marketing} onChange={setMarketing} />
            <HoneypotField id={id("website")} {...submission.honeypot} />
            {turnstileSiteKey && <TurnstileWidget siteKey={turnstileSiteKey} onToken={submission.onTurnstileToken} />}

            {mode === "demo" && (
              <DemoNotice>โหมดทดลองบนเครื่องนักพัฒนา: คำขอจะเก็บไว้ในเบราว์เซอร์นี้เท่านั้น ไม่ถึงทีมงาน</DemoNotice>
            )}

            <FormError message={submission.formError} />

            <Button type="submit" size="lg" block disabled={submission.pending} aria-busy={submission.pending || undefined}>
              {submission.pending ? "กำลังส่งคำขอ" : "ขอใบเสนอราคา"}
            </Button>
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
              เราใช้ข้อมูลนี้เพื่อจัดทำใบเสนอราคาและติดต่อกลับเรื่องคำขอนี้ อ่าน
              <Link href="/privacy" className="whitespace-nowrap text-teal-ink underline underline-offset-4">
                ประกาศความเป็นส่วนตัว
              </Link>
            </p>
          </form>
        </>
      )}
    </section>
  );
}
