import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/server/auth-cookies";

/** Customer pages anyone may open (sign-in, registration, verification and reset requests, email links). */
const publicCustomerPaths = new Set([
  "/customer/login",
  "/customer/register",
  "/customer/verify-email",
  "/customer/forgot-password",
  "/customer/auth/confirm",
]);

/**
 * Gate for the staff CRM (/staff) and the customer portal (/customer).
 * Refreshes the Supabase Auth session cookie and sends signed-out visitors
 * to the right login page. This is an optimistic check only: every page,
 * route handler and server action verifies the user (and their staff role
 * or customer link) again on the server, and row level security enforces
 * permissions in the database.
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isCustomerArea = path === "/customer" || path.startsWith("/customer/");
  const loginPath = isCustomerArea ? "/customer/login" : "/staff/login";
  const isPublic = isCustomerArea ? publicCustomerPaths.has(path) : path === "/staff/login";

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return isPublic ? NextResponse.next() : NextResponse.redirect(new URL(loginPath, request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // The email-link handler verifies its own token; don't spend a call here.
  if (path === "/customer/auth/confirm") return response;

  const { data } = await supabase.auth.getUser();
  // Server-action POSTs are not redirected: the action's own checks refuse
  // them and show "please sign in again" in the form, instead of the click
  // silently doing nothing after an expired session.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  if (!data.user && !isPublic && !isServerAction) {
    const login = new URL(loginPath, request.url);
    if (!isCustomerArea && path !== "/staff") login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/staff", "/staff/:path*", "/customer", "/customer/:path*"],
};
