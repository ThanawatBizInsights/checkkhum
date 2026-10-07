import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { clientIp, consumeRateLimit, saltedHash } from "@/lib/server/abuse";
import { getBackendConfig } from "@/lib/server/env";
import { getLineConfig, lineLoginEmail, LineVerifyError, verifyLineIdToken, type LineIdentity } from "@/lib/server/line";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createUserClient } from "@/lib/server/supabase-user";

/**
 * POST /api/line/session: turn a verified LINE identity into a customer
 * session (httpOnly Supabase cookies), for LIFF and LINE Login in a browser.
 *
 *   mode "login" (default): sign in the login mapped to this LINE user, or
 *     create a new customer login for it. If the visitor is already signed in
 *     to a customer login WITHOUT LINE, ask first (status "choose").
 *   mode "link": attach this LINE user to the customer login that is signed
 *     in now (dashboard "เชื่อมบัญชี LINE"). Needs both proofs: the session and
 *     the LINE token.
 *
 * Staff sessions are never touched and staff logins are never mapped, so LINE
 * can't open the CRM. The secret key is used only for the Auth admin calls
 * that create or sign in the login, after LINE has verified the token, and
 * for the narrow server-only database functions.
 */

export const dynamic = "force-dynamic";

const LIMIT = { limit: 30, windowSeconds: 10 * 60 };

const bodySchema = z.object({
  idToken: z.string().min(10).max(4096),
  mode: z.enum(["login", "link"]).default("login"),
  /** After "choose": "link" = add LINE to the current login, "new" = use a separate LINE login. */
  choice: z.enum(["link", "new"]).optional(),
  /** Staff invitation link token (single-use), accepted after sign-in. */
  invite: z.string().regex(/^[0-9a-f]{48}$/).optional(),
});

type Reply = {
  status: "signed_in" | "linked" | "choose" | "staff" | "error";
  message?: string;
  next?: string;
  invite?: string;
  /** For "choose": the signed-in account, partly hidden. */
  account?: string;
};

const json = (status: number, body: Reply) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  // Same-site requests only (prevents signing a victim in to someone else's LINE account).
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!host || originHost !== host) return json(403, { status: "error", message: "คำขอไม่ถูกต้อง" });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json(415, { status: "error", message: "คำขอไม่ถูกต้อง" });
  }

  const backend = getBackendConfig();
  const line = getLineConfig();
  if (backend.mode !== "database" || !line) {
    return json(503, { status: "error", message: "ยังไม่ได้ตั้งค่าเข้าสู่ระบบด้วย LINE ใช้อีเมลเข้าสู่ระบบ หรือติดต่อทีมงาน" });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { status: "error", message: "คำขอไม่ถูกต้อง" });
  const input = parsed.data;

  const admin = getSupabaseAdmin(backend.supabaseUrl, backend.secretKey);
  const ip = clientIp(request.headers);
  const limit = await consumeRateLimit(admin, `line:${saltedHash(backend.hashSalt, `ip:${ip}`)}`, LIMIT).catch(() => null);
  if (limit && !limit.allowed) return json(429, { status: "error", message: "ลองเข้าสู่ระบบบ่อยเกินไป รอสักครู่แล้วลองใหม่" });

  // 1. Who LINE says this is (verified by LINE, for our channel).
  let identity: LineIdentity;
  try {
    identity = await verifyLineIdToken(input.idToken, line);
  } catch (e) {
    if (e instanceof LineVerifyError && e.reason === "unavailable") {
      return json(503, { status: "error", message: "เชื่อมต่อ LINE ไม่ได้ชั่วคราว ลองใหม่อีกครั้ง" });
    }
    return json(401, { status: "error", message: "LINE ยืนยันตัวตนไม่สำเร็จ หรือการเข้าสู่ระบบหมดอายุ ลองใหม่อีกครั้ง" });
  }

  // 2. Who is signed in to this browser now, if anyone.
  const db = await createUserClient();
  if (!db) return json(503, { status: "error", message: "ระบบยังไม่พร้อม" });
  const { data: current } = await db.auth.getUser();
  const currentUser = current.user;
  if (currentUser) {
    const { data: staffRow } = await db.from("staff_users").select("id").eq("id", currentUser.id).maybeSingle();
    if (staffRow) {
      return json(409, { status: "staff", message: "เบราว์เซอร์นี้เข้าสู่ระบบเจ้าหน้าที่อยู่ ออกจากระบบเจ้าหน้าที่ก่อน แล้วค่อยเข้าสู่ระบบด้วย LINE" });
    }
  }

  const { data: mappedUser, error: lookupError } = await admin.rpc("line_login_user", { p_line_user_id: identity.userId });
  if (lookupError) return serverError("lookup", lookupError.code);
  const mapped = (mappedUser as string | null) ?? null;

  // 3a. Attach LINE to the current login.
  const wantsLink = input.mode === "link" || input.choice === "link";
  if (wantsLink) {
    if (!currentUser) return json(401, { status: "error", message: "เข้าสู่ระบบด้วยอีเมลก่อน แล้วค่อยเชื่อมบัญชี LINE" });
    if (mapped && mapped !== currentUser.id) {
      return json(409, { status: "error", message: "บัญชี LINE นี้เชื่อมกับบัญชีเช็กคุ้มอื่นอยู่แล้ว ติดต่อทีมงานถ้าต้องการย้าย" });
    }
    const result = await link(admin, currentUser.id, identity);
    if (result === "user_has_other_line") {
      return json(409, { status: "error", message: "บัญชีนี้เชื่อมกับ LINE อื่นอยู่แล้ว" });
    }
    if (result !== "linked" && result !== "already") return serverError("link", result);
    return json(200, { status: "linked", next: "/customer?line=linked", invite: await acceptInvite(db, input.invite) });
  }

  // 3b. Signed in already as the right login: just refresh the LINE profile.
  if (currentUser && mapped === currentUser.id) {
    await link(admin, currentUser.id, identity);
    return json(200, { status: "signed_in", next: "/customer", invite: await acceptInvite(db, input.invite) });
  }

  // 3c. Signed in to a customer login without LINE, and this LINE user is new: ask.
  if (currentUser && !mapped && input.choice !== "new") {
    const { data: ownLine } = await db.from("customer_line_accounts").select("id").eq("user_id", currentUser.id).maybeSingle();
    if (!ownLine) return json(200, { status: "choose", account: maskEmail(currentUser.email) });
  }

  // 3d. Sign in the mapped login, or create one for this LINE user.
  let targetId = mapped;
  if (!targetId) {
    const created = await createLineLogin(admin, identity);
    if (!created) return serverError("create", null);
    targetId = created;
  } else {
    await link(admin, targetId, identity);
  }

  if (currentUser && currentUser.id !== targetId) await db.auth.signOut({ scope: "local" });
  const signedIn = await signInAs(admin, db, targetId);
  if (!signedIn) return serverError("sign_in", null);

  return json(200, { status: "signed_in", next: "/customer", invite: await acceptInvite(db, input.invite) });
}

async function link(admin: SupabaseClient, userId: string, identity: LineIdentity): Promise<string> {
  const { data, error } = await admin.rpc("link_line_account", {
    p_user: userId,
    p_line_user_id: identity.userId,
    p_display_name: identity.displayName,
    p_picture_url: identity.pictureUrl,
  });
  if (error) {
    console.error(`[line] link failed ${error.code ?? ""}`);
    return "error";
  }
  return data as string;
}

/** New customer login for a LINE user (no password; signs in only through LINE). */
async function createLineLogin(admin: SupabaseClient, identity: LineIdentity): Promise<string | null> {
  const email = lineLoginEmail(identity.userId);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { checkkhum_line: true },
    user_metadata: { full_name: identity.displayName ?? "ลูกค้า LINE" },
  });
  let userId = data.user?.id ?? null;
  if (error) {
    if (error.code !== "email_exists") {
      console.error(`[line] create login failed ${error.code ?? error.status}`);
      return null;
    }
    // A parallel request created it first: use that login.
    const { data: existing } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    userId = existing.user?.id ?? null;
  }
  if (!userId) return null;

  const result = await link(admin, userId, identity);
  if (result === "linked" || result === "already") return userId;
  if (result === "line_taken") {
    // Another request mapped this LINE user meanwhile: sign in to that login.
    const { data: mapped } = await admin.rpc("line_login_user", { p_line_user_id: identity.userId });
    return (mapped as string | null) ?? null;
  }
  return null;
}

/**
 * Start a session for `userId` in this browser: a one-time magic-link token
 * generated server-side (never emailed) is verified at once with the
 * visitor's cookie client, which stores the session cookies.
 */
async function signInAs(admin: SupabaseClient, db: SupabaseClient, userId: string): Promise<boolean> {
  const { data: target } = await admin.auth.admin.getUserById(userId);
  const email = target.user?.email;
  if (!email) return false;
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = linkData?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error(`[line] session link failed ${linkError?.code ?? ""}`);
    return false;
  }
  const { data, error } = await db.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (error || data.user?.id !== userId) {
    console.error(`[line] session verify failed ${error?.code ?? ""}`);
    return false;
  }
  return true;
}

async function acceptInvite(db: SupabaseClient, token: string | undefined): Promise<string | undefined> {
  if (!token) return undefined;
  const { data, error } = await db.rpc("accept_invitation_token", { p_token: token });
  if (error) return "error";
  return data as string;
}

function maskEmail(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, name.length - 2)))}@${domain}`;
}

function serverError(step: string, code: string | null | undefined) {
  console.error(`[line] ${step} failed ${code ?? ""}`);
  return json(500, { status: "error", message: "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ ลองใหม่อีกครั้ง หรือติดต่อทีมงานทาง LINE" });
}
