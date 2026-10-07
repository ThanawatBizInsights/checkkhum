import { submissionMode } from "@/lib/server/env";
import { ContactFormClient } from "./contact-form-client";

/** Server wrapper: tells the form whether submissions can be saved. */
export function ContactForm() {
  return <ContactFormClient mode={submissionMode()} turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined} />;
}
