import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { indexablePaths } from "@/content/indexable-pages";

/**
 * /sitemap.xml for the pages in src/content/indexable-pages.ts, on the
 * canonical origin. No <lastmod>: the pages have no reliable modification
 * date (a build time would claim every page changed on every deploy).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return indexablePaths.map((path) => ({ url: new URL(path, siteConfig.siteUrl).toString() }));
}
