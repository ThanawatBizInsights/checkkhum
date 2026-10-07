import { evChargerLabels, renewalTimingLabels, repairLabels, usageLabels, vehicleTypeLabels } from "@/content/quote-options";

/**
 * Enquiry submissions (browser side).
 *
 * Every enquiry is POSTed to /api/enquiries, which validates it and applies
 * spam checks and rate limits. Then:
 * - database mode (Supabase configured on the server): the server stores it
 *   and returns a reference number;
 * - demo mode (local development only, no database): the server answers
 *   `mode: "demo"` and the enquiry is kept in this browser's localStorage,
 *   marked `demo: true`. Nothing reaches the team, and every screen says so;
 * - anything else (validation, rate limit, not configured, errors) is shown
 *   as an error. Success is never shown unless the server saved the enquiry.
 */

const STORAGE_KEY = "checkkhum.demoSubmissions.v1";

export type EnquiryType = "quote" | "contact";

export type EnquiryInput = {
  type: EnquiryType;
  name: string;
  phone: string;
  preferredChannel: "phone" | "line";
  /** Quote enquiries */
  planId?: string;
  planName?: string;
  carBrand?: string;
  carModel?: string;
  carYear?: string;
  renewalTiming?: string;
  usage?: string;
  repair?: string;
  evCharger?: string;
  vehicleType?: string;
  destination?: string;
  tripStart?: string;
  tripDays?: string;
  travellers?: string;
  /** Contact enquiries and optional notes */
  message?: string;
  marketingConsent?: boolean;
};

/** Anti-abuse fields sent alongside the enquiry. */
export type SubmissionMeta = {
  idempotencyKey: string;
  startedAt: number;
  /** Honeypot: hidden from people, so it must stay empty. */
  website: string;
  turnstileToken?: string;
};

export type Submission = EnquiryInput & {
  id: string;
  createdAt: string;
  demo: true;
};

export type SubmitOutcome =
  | { kind: "stored"; reference: string; duplicate: boolean }
  | { kind: "demo"; storedLocally: boolean }
  | { kind: "invalid"; fieldErrors: Record<string, string>; message: string }
  | { kind: "error"; message: string };

function readAll(): Submission[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as Submission[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: Submission[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/** RFC 4122 v4 UUID; crypto.randomUUID is missing on plain-http origins. */
export function newUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const NETWORK_ERROR = "ส่งคำขอไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง หรือติดต่อเราทาง LINE หรือโทรศัพท์";

function saveDemo(input: EnquiryInput): boolean {
  const submission: Submission = { ...input, id: newUuid(), createdAt: new Date().toISOString(), demo: true };
  return writeAll([submission, ...readAll()].slice(0, 200));
}

export async function submitEnquiry(input: EnquiryInput, meta: SubmissionMeta): Promise<SubmitOutcome> {
  // planName is display-only; the server derives everything from planId.
  const { planName: _planName, ...payload } = input;
  void _planName;

  let res: Response;
  try {
    res = await fetch("/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, ...meta }),
    });
  } catch {
    return { kind: "error", message: NETWORK_ERROR };
  }

  const body = (await res.json().catch(() => null)) as
    | { ok: true; mode: "database"; reference: string; duplicate: boolean }
    | { ok: true; mode: "demo" }
    | { ok: false; error: string; message?: string; fieldErrors?: Record<string, string> }
    | null;

  if (!body) return { kind: "error", message: NETWORK_ERROR };
  // Success only when the server says it saved the enquiry and gave a reference.
  if (res.ok && body.ok && body.mode === "database" && typeof body.reference === "string" && /^CK-/.test(body.reference)) {
    return { kind: "stored", reference: body.reference, duplicate: body.duplicate };
  }
  if (body.ok && body.mode === "demo" && process.env.NODE_ENV === "development") {
    // Demo mode exists only in local development; a production build treats
    // a "demo" answer as a failure, so nothing unsaved looks submitted.
    // A blocked localStorage (private mode) still lets the visitor hand the
    // enquiry over by LINE or phone, so it is not an error.
    return { kind: "demo", storedLocally: saveDemo(input) };
  }
  if (!body.ok && body.error === "validation" && body.fieldErrors) {
    return { kind: "invalid", fieldErrors: body.fieldErrors, message: body.message ?? "ข้อมูลบางช่องยังไม่ถูกต้อง" };
  }
  return { kind: "error", message: (!body.ok && body.message) || NETWORK_ERROR };
}

export function normalizeThaiMobile(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidThaiPhone(value: string): boolean {
  return /^0\d{8,9}$/.test(normalizeThaiMobile(value));
}

/** Plain-text summary for LINE handoff, copying, and the dashboard. */
export function summarizeEnquiry(e: EnquiryInput): string {
  const lines: string[] = [];
  if (e.type === "quote") {
    lines.push(`ขอใบเสนอราคา: ${e.planName ?? "-"}`);
    if (e.vehicleType) lines.push(`ประเภทรถ: ${vehicleTypeLabels[e.vehicleType] ?? e.vehicleType}`);
    const car = [e.carBrand, e.carModel].filter(Boolean).join(" ");
    if (car) lines.push(`รถ: ${car}`);
    if (e.carYear) lines.push(`ปีรถ: ${e.carYear}`);
    if (e.usage) lines.push(`การใช้รถ: ${usageLabels[e.usage] ?? e.usage}`);
    if (e.repair) lines.push(`การซ่อม: ${repairLabels[e.repair] ?? e.repair}`);
    if (e.evCharger) lines.push(`เครื่องชาร์จที่บ้าน: ${evChargerLabels[e.evCharger] ?? e.evCharger}`);
    if (e.renewalTiming) lines.push(`ต้องการความคุ้มครอง: ${renewalTimingLabels[e.renewalTiming] ?? e.renewalTiming}`);
    if (e.destination) lines.push(`ปลายทาง: ${e.destination}`);
    if (e.tripStart) lines.push(`วันเริ่มเดินทาง: ${e.tripStart}`);
    if (e.tripDays) lines.push(`จำนวนวัน: ${e.tripDays}`);
    if (e.travellers) lines.push(`จำนวนผู้เดินทาง: ${e.travellers}`);
  } else {
    lines.push("ฝากให้ติดต่อกลับ");
  }
  if (e.message) lines.push(`รายละเอียด: ${e.message}`);
  lines.push(`ชื่อ: ${e.name}`);
  lines.push(`เบอร์โทร: ${e.phone}`);
  lines.push(`สะดวกให้ติดต่อทาง: ${e.preferredChannel === "line" ? "LINE" : "โทรศัพท์"}`);
  return lines.join("\n");
}
