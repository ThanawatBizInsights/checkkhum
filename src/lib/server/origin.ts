import "server-only";
import { headers } from "next/headers";

/**
 * This site's origin for links in auth emails. Supabase only redirects to
 * URLs on its allow list (Authentication › URL Configuration), so a forged
 * Host header can't send people elsewhere.
 */
export async function requestOrigin(): Promise<string | undefined> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}` : undefined;
}
