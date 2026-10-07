import "server-only";

/**
 * Server-only configuration. Nothing here is ever sent to the browser:
 * none of these variables use the NEXT_PUBLIC_ prefix, and `server-only`
 * makes the build fail if this module is imported from a client component.
 */

export type BackendConfig =
  | { mode: "database"; supabaseUrl: string; secretKey: string; hashSalt: string }
  | { mode: "demo" }
  | { mode: "misconfigured"; problem: string };

export function getBackendConfig(): BackendConfig {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const hashSalt = process.env.ENQUIRY_HASH_SALT?.trim();

  if (!supabaseUrl && !secretKey) return { mode: "demo" };
  if (!supabaseUrl || !secretKey) {
    return { mode: "misconfigured", problem: "Set both SUPABASE_URL and SUPABASE_SECRET_KEY, or neither." };
  }
  if (!hashSalt || hashSalt.length < 32) {
    return { mode: "misconfigured", problem: "ENQUIRY_HASH_SALT must be set to a random string of at least 32 characters." };
  }
  return { mode: "database", supabaseUrl, secretKey, hashSalt };
}

export function isDatabaseConfigured(): boolean {
  return getBackendConfig().mode === "database";
}

/**
 * How the public forms behave:
 *  - "database": enquiries are saved and get a reference;
 *  - "demo": LOCAL DEVELOPMENT ONLY (`npm run dev` without Supabase), kept in
 *    the browser and labelled as demo data;
 *  - "unavailable": anything else, including a deployed site with missing
 *    settings. The forms say online requests are unavailable and point to
 *    LINE; nothing ever looks saved when it wasn't.
 */
export type SubmissionMode = "database" | "demo" | "unavailable";

export function submissionMode(): SubmissionMode {
  const config = getBackendConfig();
  if (config.mode === "database") return "database";
  if (config.mode === "demo" && process.env.NODE_ENV === "development") return "demo";
  return "unavailable";
}

/** Names (never values) of the settings the enquiry intake still needs. */
export function missingEnquirySettings(): string[] {
  const missing: string[] = [];
  if (!process.env.SUPABASE_URL?.trim()) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SECRET_KEY?.trim()) missing.push("SUPABASE_SECRET_KEY");
  const salt = process.env.ENQUIRY_HASH_SALT?.trim();
  if (!salt) missing.push("ENQUIRY_HASH_SALT");
  else if (salt.length < 32) missing.push("ENQUIRY_HASH_SALT (at least 32 characters)");
  return missing;
}

export function getTurnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || null;
}

/** Supabase project ref from the URL, for dashboard links. */
export function supabaseProjectRef(): string | null {
  const url = process.env.SUPABASE_URL;
  const match = url?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/);
  return match ? match[1] : null;
}

/** Supabase Auth for the staff CRM (server-side only; the browser never gets these). */
export function getAuthConfig(): { supabaseUrl: string; publishableKey: string } | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  return supabaseUrl && publishableKey ? { supabaseUrl, publishableKey } : null;
}
