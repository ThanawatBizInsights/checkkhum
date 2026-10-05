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

export function getTurnstileSecret(): string | null {
  return process.env.TURNSTILE_SECRET_KEY?.trim() || null;
}

/** Supabase project ref from the URL, for dashboard links. */
export function supabaseProjectRef(): string | null {
  const url = process.env.SUPABASE_URL;
  const match = url?.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co/);
  return match ? match[1] : null;
}
