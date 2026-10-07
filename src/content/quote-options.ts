/**
 * Choices for the quotation form. Labels are what customers see; values are
 * what the server validates and stores (see enquiry-validation.ts).
 *
 * Vehicle brands are SUGGESTIONS only (a <datalist>): customers can type any
 * brand, and the model is always free text. This is not a verified vehicle
 * database; staff confirm the exact vehicle when they prepare the quotation.
 */

export const carBrandSuggestions = [
  "Toyota", "Honda", "Isuzu", "Mitsubishi", "Nissan", "Mazda", "Ford", "MG", "Suzuki", "Hyundai", "Kia",
  "BYD", "GWM", "Haval", "ORA", "NETA", "AION", "Changan", "Deepal", "Zeekr", "Tesla", "Volvo",
  "Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Lexus", "Subaru", "Chevrolet", "Peugeot", "MINI", "Porsche",
] as const;

export const renewalTimingOptions = [
  { value: "within_1_month", label: "ภายใน 1 เดือน" },
  { value: "1_3_months", label: "1–3 เดือน" },
  { value: "over_3_months", label: "มากกว่า 3 เดือน" },
  { value: "no_current_policy", label: "ยังไม่มีประกัน / รถใหม่" },
  { value: "not_sure", label: "ไม่แน่ใจ" },
] as const;

export const usageOptions = [
  { value: "personal", label: "ใช้ส่วนตัว" },
  { value: "commercial", label: "ใช้เพื่อการค้า" },
] as const;

export const repairOptions = [
  { value: "dealer", label: "ซ่อมศูนย์" },
  { value: "garage", label: "ซ่อมอู่" },
  { value: "not_sure", label: "ยังไม่แน่ใจ" },
] as const;

export const evChargerOptions = [
  { value: "yes", label: "มี" },
  { value: "no", label: "ไม่มี" },
  { value: "not_sure", label: "ไม่แน่ใจ" },
] as const;

export const vehicleTypeOptions = [
  { value: "sedan", label: "รถเก๋ง" },
  { value: "pickup", label: "รถกระบะ" },
  { value: "suv", label: "รถอเนกประสงค์ / SUV" },
  { value: "van", label: "รถตู้" },
  { value: "motorcycle", label: "รถจักรยานยนต์" },
  { value: "other", label: "อื่น ๆ" },
] as const;

/** Model years offered in the form: next year back 30 years. */
export function modelYears(now = new Date()): { value: string; label: string }[] {
  const latest = now.getFullYear() + 1;
  return Array.from({ length: 31 }, (_, i) => {
    const y = latest - i;
    return { value: String(y), label: `${y} (พ.ศ. ${y + 543})` };
  });
}

const labelOf = <T extends readonly { value: string; label: string }[]>(list: T) =>
  Object.fromEntries(list.map((o) => [o.value, o.label])) as Record<string, string>;

export const renewalTimingLabels = labelOf(renewalTimingOptions);
export const usageLabels = labelOf(usageOptions);
export const repairLabels = labelOf(repairOptions);
export const evChargerLabels = labelOf(evChargerOptions);
export const vehicleTypeLabels = labelOf(vehicleTypeOptions);
