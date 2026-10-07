import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createUserClient } from "./supabase-user";

export type CustomerContext = {
  db: SupabaseClient<Database>;
  userId: string;
  email: string;
  /** False until a staff invitation has been accepted with this verified email. */
  linked: boolean;
};

export type CustomerState =
  | { kind: "unconfigured" }
  | { kind: "signed_out" }
  | { kind: "staff" }
  | { kind: "customer"; customer: CustomerContext };

/**
 * Who is using the customer portal. Verifies the session with Supabase Auth
 * (getUser), keeps staff out, and links the login to its CRM customer when a
 * matching staff invitation is waiting (the database checks the email is
 * verified; nothing here trusts what the visitor typed). Cached per request.
 */
export const getCustomerState = cache(async (): Promise<CustomerState> => {
  const db = await createUserClient();
  if (!db) return { kind: "unconfigured" };

  const { data, error } = await db.auth.getUser();
  const user = data?.user;
  if (error || !user) return { kind: "signed_out" };

  const { data: status } = await db.rpc("accept_customer_invitation");
  if (status === "staff") return { kind: "staff" };

  return {
    kind: "customer",
    customer: { db, userId: user.id, email: user.email ?? "", linked: status === "linked" },
  };
});

/** For portal pages: redirects unless a (non-staff) customer is signed in. */
export async function requireCustomer(): Promise<CustomerContext> {
  const state = await getCustomerState();
  if (state.kind === "staff") redirect("/staff");
  if (state.kind !== "customer") redirect("/customer/login");
  return state.customer;
}

/**
 * True when this session was created by an email link (invitation, reset or
 * magic link), read from the `amr` claim of the token getUser() just
 * verified. Choosing a password without the old one is allowed only then.
 */
export async function sessionFromEmailLink(db: SupabaseClient<Database>): Promise<boolean> {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return false;
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { amr?: { method: string }[] };
    return (claims.amr ?? []).some((a) => ["otp", "recovery", "invite", "magiclink", "email/signup"].includes(a.method));
  } catch {
    return false;
  }
}
