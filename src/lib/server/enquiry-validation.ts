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

const quoteSchema = z.object({
  type: z.literal("quote"),
  planId: z.enum(Object.keys(planToProduct) as [keyof typeof planToProduct, ...(keyof typeof planToProduct)[]], {
    error: "เลือกประเภทประกัน",
  }),
  carModel: optionalText(120, "ยี่ห้อและรุ่นรถ"),
  carYear: optionalInt(1950, currentYear + 1, `ปีรถต้องอยู่ระหว่าง 1950–${currentYear + 1}`),
  destination: optionalText(100, "ประเทศปลายทาง"),
  tripDays: optionalInt(1, 365, "จำนวนวันต้องอยู่ระหว่าง 1–365"),
  travellers: optionalInt(1, 20, "จำนวนผู้เดินทางต้องอยู่ระหว่าง 1–20"),
  message: optionalText(1000, "รายละเอียด"),
  ...base,
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
export const formFields = ["name", "phone", "message", "carModel", "carYear", "destination", "tripDays", "travellers", "planId", "preferredChannel"] as const;

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
