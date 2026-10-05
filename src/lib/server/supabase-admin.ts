import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: { key: string; client: SupabaseClient } | null = null;

/**
 * Supabase client authenticated with the SECRET key. It bypasses row level
 * security, so it must only run on the server and only call the narrow
 * functions the enquiry endpoint needs.
 */
export function getSupabaseAdmin(supabaseUrl: string, secretKey: string): SupabaseClient {
  const cacheKey = `${supabaseUrl}|${secretKey.slice(0, 12)}`;
  if (cached?.key === cacheKey) return cached.client;
  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "checkkhum-enquiry-endpoint" } },
  });
  cached = { key: cacheKey, client };
  return client;
}
