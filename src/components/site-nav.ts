import { products } from "@/content/products";

export const mainNav = [
  { href: products.car.href, label: "ประกันรถยนต์" },
  { href: products.ev.href, label: "รถ EV" },
  { href: products.compulsory.href, label: "พ.ร.บ." },
  { href: products.travel.href, label: "ประกันเดินทาง" },
  { href: "/contact", label: "ติดต่อเรา" },
] as const;
