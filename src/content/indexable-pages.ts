import { productOrder, products } from "./products";

/**
 * Public pages that may be indexed, from the real routes in src/app/(site).
 * Used by /sitemap.xml. Left out on purpose:
 *  - /privacy (draft notice, noindex until legal review),
 *  - /customer/* and /line (customer portal and LINE sign-in, noindex),
 *  - /staff/* (CRM, noindex and login-only) and /api/*,
 *  - query-string variants such as /quote?plan=… (same page).
 * Add a page here when you add an indexable page; `npm run audit` checks that
 * every listed page answers 200 without noindex, and that no unlisted public
 * page is missing.
 */
export const indexablePaths: readonly string[] = ["/", ...productOrder.map((slug) => products[slug].href), "/quote", "/contact"];
