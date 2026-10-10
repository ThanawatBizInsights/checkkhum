import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * /robots.txt. Public pages are open to crawlers; the CRM, the API and the
 * customer/LINE sign-in areas are not crawled (they are login-only or noindex
 * and are still protected by authentication; robots.txt is not a security
 * control). /privacy stays crawlable so crawlers can see its noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/staff", "/api/", "/customer", "/line"],
    },
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
  };
}
