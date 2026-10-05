import { NextResponse, type NextRequest } from "next/server";
import { STAFF_COOKIE, verifySessionToken } from "@/lib/staff-session";

// Optimistic gate for the staff dashboard. The dashboard page verifies the
// session again on the server, so this is not the only check.
export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(STAFF_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/staff/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/staff/dashboard/:path*"],
};
