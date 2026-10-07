import { submissionMode } from "@/lib/server/env";
import { QuoteFormClient, type QuoteFormProps } from "./quote-form-client";

/** Server wrapper: tells the form whether submissions can be saved. */
export function QuoteForm(props: QuoteFormProps) {
  return (
    <QuoteFormClient
      {...props}
      mode={submissionMode()}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
    />
  );
}
