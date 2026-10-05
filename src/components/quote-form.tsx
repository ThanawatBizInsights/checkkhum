import { isDatabaseConfigured } from "@/lib/server/env";
import { QuoteFormClient, type QuoteFormProps } from "./quote-form-client";

/** Server wrapper: tells the form whether submissions reach the database. */
export function QuoteForm(props: QuoteFormProps) {
  return (
    <QuoteFormClient
      {...props}
      demo={!isDatabaseConfigured()}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
    />
  );
}
