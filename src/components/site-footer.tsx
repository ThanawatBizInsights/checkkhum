import Link from "next/link";
import { siteConfig } from "@/config/site";
import { products, productOrder } from "@/content/products";
import { hoursText, lineChannel, phoneChannel } from "@/lib/contact";

export function SiteFooter() {
  return (
    <footer className="border-t border-paper/15 bg-navy-deep pb-28 pt-12 text-paper/85 md:pb-10">
      <div className="wrap grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-xl font-semibold text-paper">
            {siteConfig.name} {siteConfig.tagline}
          </p>
          <p className="mt-2 max-w-[30em] text-[0.9375rem]">
            ช่วยเปรียบเทียบแผนประกันจากหลายบริษัท ก่อนคุณตัดสินใจ
          </p>
        </div>
        <div>
          <h2 className="text-base text-paper">ประกัน</h2>
          <ul className="mt-2 grid gap-1 text-[0.9375rem]">
            {productOrder.map((slug) => (
              <li key={slug}>
                <Link href={products[slug].href} className="hover:text-paper hover:underline">
                  {products[slug].name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="text-base text-paper">ติดต่อ</h2>
          <ul className="mt-2 grid gap-1 text-[0.9375rem]">
            <li>โทร {phoneChannel.display}</li>
            <li>
              LINE{" "}
              {lineChannel.href ? (
                <a href={lineChannel.href} target="_blank" rel="noopener noreferrer" data-line-link className="hover:text-paper hover:underline">
                  {lineChannel.display}
                  <span className="sr-only"> (เปิดในแท็บใหม่)</span>
                </a>
              ) : (
                lineChannel.display
              )}
            </li>
            <li>{hoursText}</li>
            <li>
              <Link href="/contact" className="hover:text-paper hover:underline">
                ช่องทางติดต่อทั้งหมด
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-paper hover:underline">
                ประกาศความเป็นส่วนตัว
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
