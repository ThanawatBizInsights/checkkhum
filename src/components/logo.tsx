import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

/**
 * The approved CheckKhum logo, cropped from the approved poster.
 * Keep the artwork as is: no recolouring, stretching or redrawing.
 */
export function Logo({ className = "h-[68px] md:h-[88px]" }: { className?: string }) {
  return (
    <Link href="/" aria-label={`${siteConfig.name} หน้าแรก`} className="inline-block shrink-0">
      <Image
        src="/images/checkkhum-logo.png"
        width={282}
        height={299}
        alt={`${siteConfig.name} ${siteConfig.tagline}`}
        priority
        className={`w-auto ${className}`}
      />
    </Link>
  );
}
