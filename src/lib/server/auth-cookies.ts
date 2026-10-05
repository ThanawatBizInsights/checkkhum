import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Staff session cookie. The CRM never uses a browser Supabase client, so the
 * session can be httpOnly: scripts in the page (including injected ones)
 * cannot read the staff member's tokens. Secure in production (HTTPS only).
 */
export const authCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
