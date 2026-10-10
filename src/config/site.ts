/**
 * The single source of truth for CheckKhum's business and contact details.
 * Every page, the footer, contact page, quote confirmation and privacy
 * notice read from here. Leave a value as an empty string until the real
 * detail is confirmed: public pages then simply don't show it (no fake
 * number, no placeholder). Only the DRAFT privacy notice marks missing legal
 * details, so the lawyer can see what to fill. Never put an invented value here.
 */
export const siteConfig = {
  name: "เช็กคุ้ม",
  nameLatin: "CheckKhum",
  /** Canonical public origin (no trailing slash). Used by sitemap.xml and robots.txt. */
  siteUrl: "https://www.checkkhum.com",
  tagline: "Car & Travel Insurance",
  description:
    "เช็กคุ้ม ช่วยเปรียบเทียบแผนประกันรถยนต์ ชั้น 1, 2+, 3+, ประกันรถ EV, พ.ร.บ. และประกันเดินทาง ก่อนตัดสินใจ",

  contact: {
    /** Mobile or landline, digits only or with dashes, e.g. "081-234-5678". */
    phone: "",
    /**
     * LINE Official Account link. Every LINE button on the site opens this.
     * It only opens the chat: it never sends form details to LINE.
     */
    lineUrl: "https://lin.ee/86TezJV",
    /** LINE Official Account ID including "@", e.g. "@checkkhum". Shown as text if set. */
    lineId: "",
    /** Path under /public to the LINE QR image, e.g. "/images/line-qr.png". */
    lineQrImage: "",
    email: "",
    /** e.g. "จันทร์–เสาร์ 9:00–18:00 น." */
    hours: "",
  },

  /**
   * Version label of the privacy notice text. Stored with every consent
   * record, so change it whenever the notice wording changes.
   */
  privacyNoticeVersion: "draft-2026-10",

  /**
   * Legal entity details. Shown on the homepage ("ข้อมูลผู้ให้บริการ") only once
   * filled in, and used by the privacy notice. Fill in before launch.
   */
  legal: {
    companyName: "",
    address: "",
    brokerLicenseNo: "",
    privacyEmail: "",
  },
} as const;

export const placeholders = {
  phone: "[เบอร์โทรศัพท์]",
  lineId: "[LINE ID]",
  email: "[อีเมล]",
  hours: "[วันและเวลาทำการ]",
  companyName: "[ชื่อนิติบุคคล]",
  address: "[ที่อยู่บริษัท]",
  brokerLicenseNo: "[เลขที่ใบอนุญาตนายหน้า]",
  privacyEmail: "[อีเมลสำหรับเรื่องข้อมูลส่วนบุคคล]",
} as const;
