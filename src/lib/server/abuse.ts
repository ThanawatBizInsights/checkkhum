import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimum time a person needs to fill the form; faster means a script. */
export const MIN_FILL_MS = 2500;

export const RATE_LIMITS = {
  /** Per visitor IP address. */
  ip: { limit: 5, windowSeconds: 10 * 60 },
  /** Per phone number, across all IPs. */
  phone: { limit: 5, windowSeconds: 60 * 60 },
} as const;

/** Salted SHA-256, so raw IPs and phone numbers never reach the rate-limit table. */
export function saltedHash(salt: string, value: string): string {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/**
 * Client IP from the platform's proxy headers. On Vercel, x-forwarded-for is
 * set by the platform; behind another proxy, make sure it overwrites (not
 * appends to) this header, or rate limits can be dodged by spoofing it.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export async function consumeRateLimit(
  db: SupabaseClient,
  bucketKey: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const { data, error } = await db.rpc("consume_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`rate limit check failed: ${error.code ?? ""} ${error.message}`);
  const result = data as { allowed: boolean; retry_after_seconds: number };
  return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
}

/** Cloudflare Turnstile server-side verification (only when TURNSTILE_SECRET_KEY is set). */
export async function verifyTurnstile(secret: string, token: string | undefined, ip: string): Promise<boolean> {
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
