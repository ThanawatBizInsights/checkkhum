/** Thai labels for CRM enums (shared by server and client components). */

export const enquiryStatusLabels: Record<string, string> = {
  new: "ใหม่",
  contacted: "ติดต่อแล้ว",
  quoting: "กำลังเสนอราคา",
  quoted: "เสนอราคาแล้ว",
  won: "ปิดการขาย",
  lost: "ไม่สำเร็จ",
  spam: "สแปม",
};

/** The pipeline shown to staff, in order. */
export const pipeline = ["new", "contacted", "quoted", "won", "lost"] as const;

/** Mirrors private.enforce_enquiry_status() so the UI offers only valid moves. */
export const nextStatuses: Record<string, string[]> = {
  new: ["contacted", "lost", "spam"],
  contacted: ["quoted", "lost"],
  quoting: ["contacted", "quoted", "lost"],
  quoted: ["won", "lost"],
  lost: ["contacted"],
  spam: ["new"],
  won: [],
};

export const statusActionLabels: Record<string, string> = {
  contacted: "บันทึกว่าติดต่อแล้ว",
  quoted: "บันทึกว่าเสนอราคาแล้ว",
  won: "ปิดการขาย",
  lost: "ปิดว่าไม่สำเร็จ",
  spam: "ย้ายไปสแปม",
  new: "นำออกจากสแปม",
};

export const productLabels: Record<string, string> = {
  car_1: "ประกันรถยนต์ ชั้น 1",
  car_2plus: "ประกันรถยนต์ ชั้น 2+",
  car_3plus: "ประกันรถยนต์ ชั้น 3+",
  ev: "ประกันรถยนต์ EV",
  compulsory: "พ.ร.บ.",
  travel: "ประกันเดินทาง",
  contact: "ฝากติดต่อกลับ",
};

export const sourceLabels: Record<string, string> = {
  web_quote_form: "ฟอร์มขอใบเสนอราคา",
  web_contact_form: "ฟอร์มติดต่อ",
  phone: "โทรศัพท์",
  line: "LINE",
  walk_in: "หน้าร้าน",
  referral: "แนะนำต่อ",
};

export const quotationStatusLabels: Record<string, string> = {
  draft: "ร่าง",
  sent: "ส่งให้ลูกค้าแล้ว",
  accepted: "ลูกค้าตอบรับ",
  declined: "ลูกค้าไม่รับ",
  expired: "หมดอายุ",
};

export const policyStatusLabels: Record<string, string> = {
  pending: "รอเริ่มคุ้มครอง",
  active: "คุ้มครองอยู่",
  expired: "หมดอายุ",
  cancelled: "ยกเลิก",
};

export const taskStatusLabels: Record<string, string> = {
  open: "ยังไม่เริ่ม",
  in_progress: "กำลังทำ",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

export const activityTypeLabels: Record<string, string> = {
  call: "โทรศัพท์",
  line: "LINE",
  email: "อีเมล",
  meeting: "พบลูกค้า",
  note: "บันทึก",
};

export const roleLabels: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  agent: "เจ้าหน้าที่",
  viewer: "ดูอย่างเดียว",
};

export const channelLabels: Record<string, string> = {
  phone: "โทรศัพท์",
  line: "LINE",
  email: "อีเมล",
};

const dateFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const dateTimeFmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const moneyFmt = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });

export const formatDate = (d: string | null | undefined) => (d ? dateFmt.format(new Date(d.length === 10 ? `${d}T00:00:00+07:00` : d)) : "-");
export const formatDateTime = (d: string | null | undefined) => (d ? dateTimeFmt.format(new Date(d)) : "-");
export const formatBaht = (n: number | string | null | undefined) => (n == null ? "-" : `${moneyFmt.format(Number(n))} บาท`);

export function formatPhone(digits: string | null | undefined): string {
  if (!digits) return "-";
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  if (digits.length === 9) return digits.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
  return digits;
}

/** Today's date in Bangkok as YYYY-MM-DD. */
export function bangkokToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}
