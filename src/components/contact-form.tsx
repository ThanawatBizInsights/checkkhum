import { isDatabaseConfigured } from "@/lib/server/env";
import { ContactFormClient } from "./contact-form-client";

/** Server wrapper: tells the form whether submissions reach the database. */
export function ContactForm() {
  return (
    <ContactFormClient
      demo={!isDatabaseConfigured()}
      turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined}
    />
  );
}
