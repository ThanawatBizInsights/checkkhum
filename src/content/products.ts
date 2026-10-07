/**
 * Product copy. Coverage notes describe what each type of policy typically
 * includes in Thailand; actual cover always depends on the insurer's policy
 * wording, which each product page says.
 */

export type PlanId = "car-1" | "car-2plus" | "car-3plus" | "ev" | "compulsory" | "travel";

export type Plan = {
  id: PlanId;
  /** Short chip label in the quote form. */
  label: string;
  /** Full name used in the enquiry summary. */
  fullName: string;
  kind: "car" | "travel";
};

export const plans: Plan[] = [
  { id: "car-1", label: "ชั้น 1", fullName: "ประกันรถยนต์ ชั้น 1", kind: "car" },
  { id: "car-2plus", label: "ชั้น 2+", fullName: "ประกันรถยนต์ ชั้น 2+", kind: "car" },
  { id: "car-3plus", label: "ชั้น 3+", fullName: "ประกันรถยนต์ ชั้น 3+", kind: "car" },
  { id: "ev", label: "รถ EV", fullName: "ประกันรถยนต์ EV", kind: "car" },
  { id: "compulsory", label: "พ.ร.บ.", fullName: "พ.ร.บ. รถยนต์", kind: "car" },
  { id: "travel", label: "ประกันเดินทาง", fullName: "ประกันเดินทาง", kind: "travel" },
];

export function findPlan(id: string | undefined | null): Plan | undefined {
  return plans.find((p) => p.id === id);
}

export type ProductSlug = "car" | "ev" | "compulsory" | "travel";

export type Product = {
  slug: ProductSlug;
  href: string;
  name: string;
  /** One line for lists and cards. */
  summary: string;
  /** Page title and intro. */
  headline: string;
  intro: string;
  /** Plan to preselect when the visitor asks for a quote from this page. */
  quotePlan: PlanId;
  /** What's typically covered, as short plain statements. */
  covers: { title: string; body: string }[];
  /** Things to check before choosing. */
  checklist: string[];
  /** What we need from the visitor to quote. */
  quoteNeeds: string[];
  /** Car insurance only: the three tiers compared. */
  tiers?: TierRow[];
};

export type TierRow = {
  item: string;
  values: [boolean, boolean, boolean];
};

export const products: Record<ProductSlug, Product> = {
  car: {
    slug: "car",
    href: "/car-insurance",
    name: "ประกันรถยนต์",
    summary: "ชั้น 1, 2+ และ 3+ เทียบความคุ้มครองและเบี้ยของแต่ละชั้นให้เห็นชัด",
    headline: "ประกันรถยนต์ ชั้น 1, 2+ และ 3+",
    intro:
      "แต่ละชั้นต่างกันที่ว่าคุ้มครองรถของเราแค่ไหน เราช่วยดูอายุรถ ทุนประกัน และการใช้งานจริง แล้วเสนอแผนที่เหมาะให้เทียบ",
    quotePlan: "car-1",
    tiers: [
      { item: "ความเสียหายต่อชีวิตและทรัพย์สินของบุคคลภายนอก", values: [true, true, true] },
      { item: "รถเราเสียหายจากการชนกับยานพาหนะทางบก (มีคู่กรณี)", values: [true, true, true] },
      { item: "รถหายและไฟไหม้", values: [true, true, false] },
      { item: "รถเราเสียหายแม้ไม่มีคู่กรณี เช่น ชนเสา ตกข้างทาง", values: [true, false, false] },
    ],
    covers: [
      {
        title: "ชั้น 1",
        body: "คุ้มครองกว้างที่สุด รวมถึงอุบัติเหตุที่ไม่มีคู่กรณี เหมาะกับรถใหม่หรือรถที่ใช้งานทุกวัน",
      },
      {
        title: "ชั้น 2+",
        body: "คุ้มครองเมื่อชนกับยานพาหนะทางบก รวมถึงรถหายและไฟไหม้ เบี้ยมักต่ำกว่าชั้น 1",
      },
      {
        title: "ชั้น 3+",
        body: "คุ้มครองเมื่อชนกับยานพาหนะทางบกและความเสียหายต่อบุคคลภายนอก เหมาะกับรถที่อายุมากขึ้น",
      },
    ],
    checklist: [
      "ทุนประกันใกล้เคียงราคารถในตลาดตอนนี้หรือไม่",
      "ซ่อมห้างหรือซ่อมอู่ และอู่ในเครืออยู่ใกล้คุณไหม",
      "ค่าเสียหายส่วนแรกที่ต้องจ่ายเองเมื่อเป็นฝ่ายผิด",
      "ระบุผู้ขับขี่หรือไม่ระบุ ซึ่งมีผลต่อเบี้ย",
    ],
    quoteNeeds: ["ยี่ห้อ รุ่น และปีรถ", "ชั้นประกันที่สนใจ", "วันหมดอายุกรมธรรม์เดิม ถ้ามี"],
  },

  ev: {
    slug: "ev",
    href: "/ev-insurance",
    name: "ประกันรถยนต์ EV",
    summary: "แผนสำหรับรถไฟฟ้า เช็กความคุ้มครองแบตเตอรี่และอุปกรณ์ชาร์จก่อนเลือก",
    headline: "ประกันรถยนต์ไฟฟ้า (EV)",
    intro:
      "แบตเตอรี่เป็นชิ้นส่วนราคาสูงของรถไฟฟ้า แผนประกัน EV แต่ละบริษัทดูแลส่วนนี้ไม่เท่ากัน เราช่วยอ่านเงื่อนไขและเทียบให้",
    quotePlan: "ev",
    covers: [
      {
        title: "แบตเตอรี่",
        body: "บางแผนคุ้มครองแบตเตอรี่เมื่อเสียหายจากอุบัติเหตุ และกำหนดการหักค่าเสื่อมตามอายุแบตเตอรี่ต่างกัน",
      },
      {
        title: "อุปกรณ์ชาร์จ",
        body: "บางแผนรวมเครื่องชาร์จที่บ้าน (wall charger) และสายชาร์จ ทั้งกรณีเสียหายและสูญหาย",
      },
      {
        title: "ระหว่างชาร์จ",
        body: "ตรวจดูว่าคุ้มครองความเสียหายและไฟไหม้ที่เกิดขณะชาร์จหรือไม่",
      },
    ],
    checklist: [
      "การหักค่าเสื่อมแบตเตอรี่ตามอายุรถ",
      "ศูนย์ซ่อมที่รับซ่อมรถไฟฟ้ายี่ห้อของคุณ",
      "บริการช่วยเหลือฉุกเฉินเมื่อแบตเตอรี่หมดระหว่างทาง",
      "ความคุ้มครองเครื่องชาร์จที่ติดตั้งที่บ้าน",
    ],
    quoteNeeds: ["ยี่ห้อ รุ่น และปีรถ", "ติดตั้งเครื่องชาร์จที่บ้านหรือไม่", "วันหมดอายุกรมธรรม์เดิม ถ้ามี"],
  },

  compulsory: {
    slug: "compulsory",
    href: "/compulsory-insurance",
    name: "พ.ร.บ. รถยนต์",
    summary: "ประกันภาคบังคับตามกฎหมาย ต้องมีก่อนต่อภาษีรถทุกปี",
    headline: "พ.ร.บ. รถยนต์",
    intro:
      "พ.ร.บ. เป็นประกันภาคบังคับที่รถทุกคันต้องมี และต้องใช้ตอนต่อภาษีประจำปี เราช่วยต่อให้ จะต่อพร้อมประกันภาคสมัครใจหรือต่อแยกก็ได้",
    quotePlan: "compulsory",
    covers: [
      {
        title: "ค่ารักษาพยาบาล",
        body: "ดูแลค่ารักษาของผู้บาดเจ็บจากรถ ทั้งคนขับ ผู้โดยสาร และคนเดินถนน",
      },
      {
        title: "กรณีเสียชีวิตหรือทุพพลภาพ",
        body: "จ่ายค่าเสียหายตามวงเงินที่กฎหมายกำหนด",
      },
      {
        title: "ไม่รวมตัวรถ",
        body: "พ.ร.บ. ไม่คุ้มครองความเสียหายของรถหรือทรัพย์สิน ส่วนนั้นต้องใช้ประกันภาคสมัครใจ",
      },
    ],
    checklist: [
      "วันหมดอายุ พ.ร.บ. เดิม และวันครบกำหนดต่อภาษี",
      "ประเภทรถและลักษณะการใช้งาน เช่น ส่วนบุคคลหรือรับจ้าง",
      "ต้องการต่อพร้อมประกันภาคสมัครใจหรือไม่",
    ],
    quoteNeeds: ["ยี่ห้อ รุ่น และปีรถ", "ประเภทการใช้รถ", "วันหมดอายุ พ.ร.บ. เดิม"],
  },

  travel: {
    slug: "travel",
    href: "/travel-insurance",
    name: "ประกันเดินทาง",
    summary: "ค่ารักษาและเหตุไม่คาดฝันระหว่างเดินทาง ทั้งในและต่างประเทศ",
    headline: "ประกันเดินทาง",
    intro:
      "บอกเราว่าไปที่ไหน กี่วัน กี่คน เราจะเทียบแผนที่ครอบคลุมพอสำหรับทริปนั้น รวมถึงแผนที่ใช้ยื่นขอวีซ่าได้",
    quotePlan: "travel",
    covers: [
      {
        title: "ค่ารักษาพยาบาล",
        body: "ค่ารักษาเมื่อป่วยหรือบาดเจ็บระหว่างทริป ซึ่งในต่างประเทศอาจสูงมาก",
      },
      {
        title: "การเดินทางสะดุด",
        body: "เที่ยวบินล่าช้า กระเป๋าหายหรือมาช้า และการยกเลิกการเดินทาง ตามที่แต่ละแผนระบุ",
      },
      {
        title: "ใช้ยื่นวีซ่า",
        body: "บางประเทศ เช่น กลุ่มเชงเก้น กำหนดวงเงินค่ารักษาขั้นต่ำ เราช่วยเลือกแผนที่ผ่านเกณฑ์",
      },
    ],
    checklist: [
      "วงเงินค่ารักษาพอสำหรับค่าครองชีพของประเทศปลายทาง",
      "กิจกรรมเสี่ยงที่จะทำ เช่น ดำน้ำหรือเล่นสกี อยู่ในความคุ้มครองไหม",
      "ซื้อแบบรายเที่ยวหรือรายปี ถ้าเดินทางบ่อย",
    ],
    quoteNeeds: ["ประเทศปลายทาง", "วันเดินทางไปและกลับ", "จำนวนผู้เดินทาง"],
  },
};

export const productOrder: ProductSlug[] = ["car", "ev", "compulsory", "travel"];

export const coverageDisclaimer =
  "ความคุ้มครองจริงขึ้นอยู่กับเงื่อนไขกรมธรรม์ของแต่ละบริษัทประกัน เราจะแจ้งรายละเอียดของแผนที่เสนอให้ก่อนคุณตัดสินใจ";
