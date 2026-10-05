import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createUserClient } from "./supabase-user";

export type StaffRole = "admin" | "agent" | "viewer";

export type StaffContext = {
  db: SupabaseClient<Database>;
  userId: string;
  email: string;
  fullName: string;
  role: StaffRole;
  canWrite: boolean;
  isAdmin: boolean;
};

export type StaffState =
  | { kind: "unconfigured" }
  | { kind: "signed_out" }
  | { kind: "not_staff"; email: string }
  | { kind: "staff"; staff: StaffContext };

/**
 * Who is making this request. Verifies the session with Supabase Auth
 * (getUser, not just the cookie), then requires an ACTIVE staff_users row.
 * The staff row is read through RLS, so an inactive or unknown user gets
 * nothing back. Cached per request.
 */
export const getStaffState = cache(async (): Promise<StaffState> => {
  const db = await createUserClient();
  if (!db) return { kind: "unconfigured" };

  const { data: userData, error } = await db.auth.getUser();
  const user = userData?.user;
  if (error || !user) return { kind: "signed_out" };

  const { data: staff } = await db
    .from("staff_users")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!staff || !staff.is_active) return { kind: "not_staff", email: user.email ?? "" };

  const role = staff.role as StaffRole;
  return {
    kind: "staff",
    staff: {
      db,
      userId: user.id,
      email: staff.email,
      fullName: staff.full_name,
      role,
      canWrite: role === "admin" || role === "agent",
      isAdmin: role === "admin",
    },
  };
});

/** For pages: redirects to the login page unless an active staff member is signed in. */
export async function requireStaff(): Promise<StaffContext> {
  const state = await getStaffState();
  if (state.kind !== "staff") redirect(`/staff/login${state.kind === "not_staff" ? "?error=not_staff" : ""}`);
  return state.staff;
}

export class PermissionError extends Error {}

/** For server actions: throws unless the caller has at least `min` role. */
export async function requireRole(min: "viewer" | "agent" | "admin"): Promise<StaffContext> {
  const state = await getStaffState();
  if (state.kind !== "staff") throw new PermissionError("กรุณาเข้าสู่ระบบอีกครั้ง");
  const { staff } = state;
  if (min === "admin" && !staff.isAdmin) throw new PermissionError("เฉพาะผู้ดูแลระบบเท่านั้น");
  if (min === "agent" && !staff.canWrite) throw new PermissionError("บัญชีนี้ดูข้อมูลได้อย่างเดียว");
  return staff;
}
