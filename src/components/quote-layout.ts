/**
 * Two-column layout for pages that show the quotation form beside content:
 * homepage hero, product pages and /quote. The form column is 520px from
 * 1024px and 600px from 1280px; below 1024px the form stacks full width.
 * Keep these in one place so the form looks the same wherever it appears.
 */
export const quoteSplit =
  "grid gap-8 lg:grid-cols-[minmax(0,1fr)_520px] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_600px] xl:gap-x-14";
