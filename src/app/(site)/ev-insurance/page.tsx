import type { Metadata } from "next";
import { ProductPage } from "@/components/product-page";
import { products } from "@/content/products";

const product = products.ev;

export const metadata: Metadata = {
  title: product.headline,
  description: product.intro,
};

export default function EvInsurancePage() {
  return <ProductPage product={product} />;
}
