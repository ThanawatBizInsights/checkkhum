import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/server/supabase-user";

export const dynamic = "force-dynamic";

/**
 * Whether the visitor is signed in, for the public header's account menu.
 * Public pages stay static; the header asks this after load. Returns only
 * the kind of account, never names, emails or ids.
 */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const db = await createUserClient();
  if (!db) return NextResponse.json({ state: "signed_out" }, { headers });

  const { data } = await db.auth.getUser();
  if (!data.user) return NextResponse.json({ state: "signed_out" }, { headers });

  const { data: staff } = await db.from("staff_users").select("is_active").eq("id", data.user.id).maybeSingle();
  return NextResponse.json({ state: staff?.is_active ? "staff" : "customer" }, { headers });
}
