import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { cookies } from "next/headers";
import { authCookieOptions } from "./auth-cookies";
import { getAuthConfig } from "./env";

/**
 * Supabase client acting AS the signed-in staff member (publishable key +
 * their session cookie). Row level security applies to every query, so this
 * is the client all CRM reads and writes use. Never use the secret key here.
 */
export async function createUserClient(): Promise<SupabaseClient<Database> | null> {
  const config = getAuthConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(config.supabaseUrl, config.publishableKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session cookie on every staff request.
        }
      },
    },
  });
}
