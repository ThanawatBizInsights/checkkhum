import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/lib/server/auth-cookies";

/**
 * Staff area gate. Refreshes the Supabase Auth session cookie and sends
 * signed-out visitors to the login page. This is an optimistic check only:
 * every staff page and server action verifies the user and their staff role
 * again on the server, and row level security enforces permissions in the
 * database.
 */
export async function proxy(request: NextRequest) {
  const isLogin = request.nextUrl.pathname === "/staff/login";
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return isLogin ? NextResponse.next() : NextResponse.redirect(new URL("/staff/login", request.url));
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

  const { data } = await supabase.auth.getUser();
  // Server-action POSTs are not redirected: the action's own requireRole()
  // refuses them and shows "please sign in again" in the form, instead of
  // the click silently doing nothing after an expired session.
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  if (!data.user && !isLogin && !isServerAction) {
    const login = new URL("/staff/login", request.url);
    if (request.nextUrl.pathname !== "/staff") login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/staff", "/staff/:path*"],
};
