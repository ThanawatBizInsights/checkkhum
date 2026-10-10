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
  tagline: "Car & Travel Insurance",
  description:
    "เช็กคุ้ม ช่วยเปรียบเทียบแผนประกันรถยนต์ ชั้น 1, 2+, 3+, ประกันรถ EV, พ.ร.บ. และประกันเดินทาง ก่อนตัดสินใจ",

  contact: {
    /** Mobile or landline, digits only or with dashes, e.g. "081-234-5678". */
    phone: "",
    /**
     * LINE Official Account add-friend link. Every LINE button, the header
     * button, the floating widget and the QR card open this. It only opens
     * the chat: it never sends form details to LINE.
     */
    lineUrl: "https://lin.ee/sAdMA0r",
    /**
     * LINE Official Account ID including "@", e.g. "@checkkhum". Shown as text
     * only if set; otherwise links read "เพิ่มเพื่อน LINE" (never a raw URL).
     */
    lineId: "",
    /** LINE's official Thai "เพิ่มเพื่อน" button artwork, used unmodified from LINE's CDN. */
    lineAddFriendImage: "https://scdn.line-apps.com/n/line_add_friends/btn/th.png",
    /**
     * LINE OA QR code (LINE-hosted image or a path under /public). Shown
     * square and uncropped with "สแกนเพื่อเพิ่มเพื่อน LINE".
     */
    lineQrImage: "https://qr-official.line.me/gs/M_103yhsnv_GW.png?oat_content=qr",
    email: "",
    /** e.g. "จันทร์–เสาร์ 9:00–18:00 น." */
    hours: "",
  },

  /**
   * Office shown on the contact page. `mapPinUrl` is the Google Maps pin the
   * business confirmed (2026-10); without it the "เปิดใน Google Maps" button
   * runs an address search. No map is embedded until `mapEmbedUrl` is set.
   * `mapEmbedUrl` must be a https://www.google.com/maps/embed?pb=… URL
   * (Google Maps › Share › Embed a map).
   */
  office: {
    companyName: "บริษัท แสงพันล้าน จำกัด",
    addressLines: ["89/9-10 หมู่ 3 ต.บางม่วง อ.บางใหญ่", "จ.นนทบุรี 11140"],
    mapPinUrl: "https://maps.app.goo.gl/NNjScXSdXoJZunkV9",
    mapEmbedUrl: "",
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
