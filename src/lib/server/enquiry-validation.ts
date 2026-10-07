import "server-only";
import { z } from "zod";

/** Website plan ids → database `insurance_product` enum. */
export const planToProduct = {
  "car-1": "car_1",
  "car-2plus": "car_2plus",
  "car-3plus": "car_3plus",
  ev: "ev",
  compulsory: "compulsory",
  travel: "travel",
} as const;

const URL_PATTERN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|info|xyz|ru|top)\b)/i;

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const optionalText = (max: number, label: string) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max, `${label}ยาวเกิน ${max} ตัวอักษร`).optional());

const optionalInt = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : Number(v.trim())) : v),
    z.number({ error: message }).int(message).min(min, message).max(max, message).optional(),
  );

const currentYear = new Date().getFullYear();

const base = {
  name: z
    .string({ error: "กรอกชื่อเพื่อให้เราติดต่อกลับได้" })
    .trim()
    .min(1, "กรอกชื่อเพื่อให้เราติดต่อกลับได้")
    .max(120, "ชื่อยาวเกิน 120 ตัวอักษร")
    .refine((v) => !URL_PATTERN.test(v), "ชื่อต้องไม่มีลิงก์"),
  phone: z
    .string({ error: "กรอกเบอร์โทร 9–10 หลักที่ขึ้นต้นด้วย 0" })
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => /^0\d{8,9}$/.test(v), "กรอกเบอร์โทร 9–10 หลักที่ขึ้นต้นด้วย 0"),
  preferredChannel: z.enum(["phone", "line"], { error: "เลือกช่องทางติดต่อกลับ" }),
  marketingConsent: z.boolean().default(false),
  // Anti-abuse metadata
  idempotencyKey: z.uuid({ error: "invalid idempotency key" }),
  startedAt: z.number().int().positive(),
  website: z.string().max(200).optional(), // honeypot: must be empty
  turnstileToken: z.string().max(4096).optional(),
};

const optionalEnum = <T extends string>(values: readonly [T, ...T[]], message: string) =>
  z.preprocess(emptyToUndefined, z.enum(values, { error: message }).optional());

export const renewalTimings = ["within_1_month", "1_3_months", "over_3_months", "no_current_policy", "not_sure"] as const;

const isoDate = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "เลือกวันเดินทาง")
    .refine((v) => {
      const d = Date.parse(`${v}T00:00:00Z`);
      const today = Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
      return !Number.isNaN(d) && d >= today - 86_400_000 && d <= today + 366 * 86_400_000;
    }, "วันเดินทางต้องอยู่ภายใน 1 ปีนับจากวันนี้")
    .optional(),
);

const quoteSchema = z
  .object({
    type: z.literal("quote"),
    planId: z.enum(Object.keys(planToProduct) as [keyof typeof planToProduct, ...(keyof typeof planToProduct)[]], {
      error: "เลือกประเภทประกัน",
    }),
    carBrand: optionalText(60, "ยี่ห้อรถ"),
    carModel: optionalText(60, "รุ่นรถ"),
    carYear: optionalInt(1950, currentYear + 1, `ปีรถต้องอยู่ระหว่าง 1950–${currentYear + 1}`),
    renewalTiming: optionalEnum(renewalTimings, "เลือกช่วงเวลาที่ต้องการความคุ้มครอง"),
    usage: optionalEnum(["personal", "commercial"], "เลือกลักษณะการใช้รถ"),
    repair: optionalEnum(["dealer", "garage", "not_sure"], "เลือกการซ่อมที่ต้องการ"),
    evCharger: optionalEnum(["yes", "no", "not_sure"], "เลือกข้อมูลเครื่องชาร์จ"),
    vehicleType: optionalEnum(["sedan", "pickup", "van", "suv", "motorcycle", "other"], "เลือกประเภทรถ"),
    destination: optionalText(100, "ประเทศปลายทาง"),
    tripStart: isoDate,
    tripDays: optionalInt(1, 365, "จำนวนวันต้องอยู่ระหว่าง 1–365"),
    travellers: optionalInt(1, 20, "จำนวนผู้เดินทางต้องอยู่ระหว่าง 1–20"),
    message: optionalText(1000, "รายละเอียด"),
    ...base,
  })
  .superRefine((v, ctx) => {
    const need = (field: string, message: string, present: unknown) => {
      if (present === undefined || present === null || present === "") ctx.addIssue({ code: "custom", path: [field], message });
    };
    if (v.planId === "travel") {
      need("destination", "กรอกประเทศปลายทาง", v.destination);
      need("tripDays", "กรอกจำนวนวันเดินทาง", v.tripDays);
    } else if (v.planId === "compulsory") {
      need("vehicleType", "เลือกประเภทรถ", v.vehicleType);
    } else {
      need("carBrand", "กรอกยี่ห้อรถ", v.carBrand);
      need("carModel", "กรอกรุ่นรถ", v.carModel);
      need("carYear", "เลือกปีรถ", v.carYear);
    }
  });

const contactSchema = z.object({
  type: z.literal("contact"),
  message: z
    .string({ error: "บอกเราสั้น ๆ ว่าต้องการสอบถามเรื่องอะไร" })
    .trim()
    .min(1, "บอกเราสั้น ๆ ว่าต้องการสอบถามเรื่องอะไร")
    .max(1000, "ข้อความยาวเกิน 1000 ตัวอักษร"),
  ...base,
});

export const enquirySchema = z.discriminatedUnion("type", [quoteSchema, contactSchema], {
  error: "invalid enquiry type",
});

export type EnquiryRequest = z.infer<typeof enquirySchema>;

/** Fields shown in the form; anything else is reported as a general error. */
export const formFields = [
  "name", "phone", "message", "carBrand", "carModel", "carYear", "renewalTiming", "usage", "repair", "evCharger",
  "vehicleType", "destination", "tripStart", "tripDays", "travellers", "planId", "preferredChannel",
] as const;

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function countLinks(text: string | undefined): number {
  return text ? (text.match(/https?:\/\/|www\./gi) ?? []).length : 0;
}
