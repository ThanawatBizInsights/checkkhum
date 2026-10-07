import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createUserClient } from "@/lib/server/supabase-user";

/**
 * Landing page for links in Supabase Auth emails (invitation, password
 * reset). The email template sends `token_hash` + `type`; the token is
 * verified here on the server, which signs the visitor in with an httpOnly
 * session cookie. A PKCE `code` is accepted too (reset requested in this
 * browser with the default template).
 */
const allowedTypes = new Set<EmailOtpType>(["invite", "recovery", "email", "magiclink", "signup"]);

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url), { headers: { "Cache-Control": "no-store" } });

  const db = await createUserClient();
  if (!db) return to("/customer/login");

  let flow: EmailOtpType | "code" | null = null;
  if (tokenHash && type && allowedTypes.has(type) && tokenHash.length <= 200) {
    const { error } = await db.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) flow = type;
  } else if (code && code.length <= 200) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) flow = "code";
  }

  if (!flow) return to("/customer/login?error=link");
  // Invited customers and password resets choose a password next.
  if (flow === "invite" || flow === "recovery" || flow === "code") {
    return to(`/customer/set-password?mode=${flow === "invite" ? "invite" : "recovery"}`);
  }
  return to("/customer");
}
