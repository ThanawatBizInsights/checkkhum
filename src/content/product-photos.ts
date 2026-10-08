import type { StaticImageData } from "next/image";
import carSedan from "../../public/images/car-insurance-silver-sedan.webp";
import evCrossover from "../../public/images/ev-insurance-white-crossover-charging.webp";
import travelAirport from "../../public/images/travel-insurance-couple-airport.webp";
import type { ProductSlug } from "./products";

/**
 * Photos for the product pages and homepage product cards. Static imports give
 * Next.js the real width, height and a blur placeholder. `position` is the
 * object-position that keeps the subject in frame when the 16:9 photo is
 * cropped to 16:10 (or narrower on phones). พ.ร.บ. has no photo on purpose.
 */
export type ProductPhoto = { src: StaticImageData; alt: string; position: string };

export const productPhotos: Partial<Record<ProductSlug, ProductPhoto>> = {
  car: {
    src: carSedan,
    alt: "รถเก๋งสีเงินจอดอยู่หน้าบ้าน มีตึกสูงของกรุงเทพฯ เป็นฉากหลัง",
    position: "68% 60%", // the sedan sits right of centre
  },
  ev: {
    src: evCrossover,
    alt: "รถยนต์ไฟฟ้าสีขาวกำลังชาร์จไฟจากเครื่องชาร์จติดผนังที่บ้าน",
    position: "72% 55%", // keep the car and the wall charger
  },
  travel: {
    src: travelAirport,
    alt: "คู่รักลากกระเป๋าเดินทางเดินในอาคารสนามบินที่สว่าง มีเครื่องบินจอดอยู่ด้านนอก",
    position: "74% 45%", // the couple walks on the right
  },
};
