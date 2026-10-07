/** Shape of public.portal_overview(): customer-safe columns only. */
export type PortalVehicle = {
  description: string;
  registration_plate: string | null;
  plate_province: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  is_ev: boolean;
};

export type PortalPolicy = {
  id: string;
  policy_number: string;
  insurer: string;
  product: string;
  premium: number;
  start_date: string;
  end_date: string;
  status: "pending" | "active" | "expired" | "cancelled";
  vehicle: PortalVehicle | null;
  open_renewal_reference: string | null;
};

export type PortalQuotation = {
  id: string;
  enquiry_reference: string;
  insurer: string;
  product: string;
  premium: number;
  sum_insured: number | null;
  deductible: number | null;
  repair_type: "dealer" | "garage" | null;
  valid_until: string | null;
  status: "sent" | "accepted" | "declined" | "expired";
  created_at: string;
};

export type PortalEnquiry = {
  reference: string;
  type: "quote" | "contact";
  product: string | null;
  status: "new" | "contacted" | "quoting" | "quoted" | "won" | "lost";
  created_at: string;
  renewal_policy_id: string | null;
};

export type PortalOverview = {
  customer: { full_name: string };
  enquiries: PortalEnquiry[];
  quotations: PortalQuotation[];
  policies: PortalPolicy[];
  vehicles: PortalVehicle[];
};

/** Request status in the customer's words (staff see the CRM labels). */
export const customerEnquiryStatus: Record<PortalEnquiry["status"], string> = {
  new: "ได้รับคำขอแล้ว",
  contacted: "ทีมงานติดต่อแล้ว",
  quoting: "กำลังเตรียมใบเสนอราคา",
  quoted: "ส่งใบเสนอราคาแล้ว",
  won: "ตกลงทำประกันแล้ว",
  lost: "ปิดคำขอแล้ว",
};

export const customerQuotationStatus: Record<PortalQuotation["status"], string> = {
  sent: "รอคุณตัดสินใจ",
  accepted: "คุณเลือกแผนนี้",
  declined: "ไม่ได้เลือก",
  expired: "หมดอายุ",
};

export const documentKindLabels: Record<string, string> = {
  policy: "ตารางกรมธรรม์",
  receipt: "ใบเสร็จรับเงิน",
  endorsement: "เอกสารแนบท้าย",
  other: "เอกสารอื่น",
};

/** Days before the end date when we suggest renewing. */
export const RENEWAL_WINDOW_DAYS = 60;
