import Link from "next/link";
import { siteConfig } from "@/config/site";
import { products, productOrder } from "@/content/products";
import { hoursText, phoneChannel } from "@/lib/contact";
import { LineAddFriendButton } from "./line-links";

export function SiteFooter() {
  return (
    <footer data-site-footer className="border-t border-paper/15 bg-navy-deep pb-28 pt-12 text-paper/85 md:pb-10">
      <div className="wrap grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="font-display text-xl font-semibold text-paper">
            {siteConfig.name} {siteConfig.tagline}
          </p>
          <p className="mt-2 max-w-[30em] text-[0.9375rem]">
            ขอใบเสนอราคาประกันรถยนต์ พ.ร.บ. และประกันเดินทาง เทียบแผนก่อนตัดสินใจ
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
            {phoneChannel.href && (
              <li>
                โทร{" "}
                <a href={phoneChannel.href} className="hover:text-paper hover:underline">
                  {phoneChannel.display}
                </a>
              </li>
            )}
            <li className="py-1.5">
              <LineAddFriendButton />
            </li>
            {hoursText && <li>{hoursText}</li>}
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
      <div className="wrap mt-10 flex justify-end border-t border-paper/15 pt-2 text-[0.9375rem]">
        {/* Discreet way in for the team; the CRM itself requires a staff login. */}
        <Link href="/staff/login" rel="nofollow" className="inline-flex min-h-11 items-center text-paper/60 hover:text-paper hover:underline">
          สำหรับเจ้าหน้าที่
        </Link>
      </div>
    </footer>
  );
}
