/**
 * Enquiry submissions.
 *
 * DEMO MODE: there is no backend yet. `submitEnquiry` saves the enquiry in
 * this browser's localStorage and marks it `demo: true`. Nothing reaches the
 * CheckKhum team, and every screen that shows a submission says so.
 *
 * To connect a backend, replace the body of `submitEnquiry` with a real API
 * call, give the staff dashboard a server-side data source in place of
 * `readDemoSubmissionsRaw`, then set `DEMO_SUBMISSIONS` to false.
 */

export const DEMO_SUBMISSIONS = true;

const STORAGE_KEY = "checkkhum.demoSubmissions.v1";
const CHANGE_EVENT = "checkkhum:demo-submissions";

export type EnquiryType = "quote" | "contact";

export type EnquiryInput = {
  type: EnquiryType;
  name: string;
  phone: string;
  preferredChannel: "phone" | "line";
  /** Quote enquiries */
  planId?: string;
  planName?: string;
  carModel?: string;
  carYear?: string;
  destination?: string;
  tripDays?: string;
  travellers?: string;
  /** Contact enquiries and optional notes */
  message?: string;
};

export type Submission = EnquiryInput & {
  id: string;
  createdAt: string;
  demo: true;
};

export type SubmitResult =
  | { ok: true; submission: Submission; storedLocally: boolean }
  | { ok: false; error: string };

/** Raw stored JSON; a stable string, so it works as a useSyncExternalStore snapshot. */
export function readDemoSubmissionsRaw(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseSubmissions(raw: string): Submission[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Submission[]) : [];
  } catch {
    return [];
  }
}

/** Notifies on changes from this tab and from other tabs. */
export function subscribeDemoSubmissions(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readAll(): Submission[] {
  return parseSubmissions(readDemoSubmissionsRaw());
}

function writeAll(items: Submission[]): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
    return true;
  } catch {
    return false;
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function submitEnquiry(input: EnquiryInput): Promise<SubmitResult> {
  const submission: Submission = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
    demo: true,
  };
  const saved = writeAll([submission, ...readAll()].slice(0, 200));
  // A blocked localStorage (private mode, disabled site data) still lets the
  // visitor hand the enquiry over by LINE or phone, so it is not an error.
  return { ok: true, submission, storedLocally: saved };
}

export function clearDemoSubmissions(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* nothing stored */
  }
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
    if (e.carModel) lines.push(`รถ: ${e.carModel}`);
    if (e.carYear) lines.push(`ปีรถ: ${e.carYear}`);
    if (e.destination) lines.push(`ปลายทาง: ${e.destination}`);
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
