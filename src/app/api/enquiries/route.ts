import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import {
  MIN_FILL_MS,
  RATE_LIMITS,
  clientIp,
  consumeRateLimit,
  saltedHash,
  verifyTurnstile,
} from "@/lib/server/abuse";
import { countLinks, enquirySchema, fieldErrors, planToProduct } from "@/lib/server/enquiry-validation";
import { getBackendConfig, getTurnstileSecret } from "@/lib/server/env";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { createUserClient } from "@/lib/server/supabase-user";

/**
 * POST /api/enquiries: the only way a public visitor can create data.
 *
 * Order of checks: request shape → validation → spam signals → rate limits
 * → database (which handles duplicates). Responses never include customer
 * data, and logs never include names or phone numbers.
 */

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;

type ErrorCode =
  | "unsupported_media_type"
  | "payload_too_large"
  | "invalid_json"
  | "forbidden_origin"
  | "validation"
  | "rejected"
  | "rate_limited"
  | "server_error";

function fail(status: number, code: ErrorCode, message: string, extra: Record<string, unknown> = {}, headers?: HeadersInit) {
  return NextResponse.json({ ok: false, error: code, message, ...extra }, { status, headers });
}

const GENERIC_REJECTION = "ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง หรือติดต่อเราทาง LINE หรือโทรศัพท์";

export async function POST(request: NextRequest) {
  // --- Request shape -------------------------------------------------------
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return fail(415, "unsupported_media_type", "Content-Type must be application/json");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      /* invalid origin */
    }
    if (!host || originHost !== host) {
      return fail(403, "forbidden_origin", "Cross-site requests are not accepted");
    }
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return fail(413, "payload_too_large", "Request body is too large");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, "invalid_json", "Request body is not valid JSON");
  }

  // --- Validation ----------------------------------------------------------
  const parsed = enquirySchema.safeParse(json);
  if (!parsed.success) {
    return fail(400, "validation", "ข้อมูลบางช่องยังไม่ถูกต้อง", { fieldErrors: fieldErrors(parsed.error) });
  }
  const input = parsed.data;

  // --- Spam signals --------------------------------------------------------
  const ip = clientIp(request.headers);
  const elapsed = Date.now() - input.startedAt;
  const spamReason =
    input.website ? "honeypot" :
    elapsed < MIN_FILL_MS ? "too_fast" : // also catches future timestamps
    countLinks(input.message) >= 3 ? "links" :
    null;
  if (spamReason) {
    console.warn(`[enquiries] rejected: ${spamReason}`);
    return fail(400, "rejected", GENERIC_REJECTION);
  }

  const turnstileSecret = getTurnstileSecret();
  if (turnstileSecret && !(await verifyTurnstile(turnstileSecret, input.turnstileToken, ip))) {
    console.warn("[enquiries] rejected: turnstile");
    return fail(400, "rejected", "ยืนยันว่าไม่ใช่โปรแกรมอัตโนมัติไม่สำเร็จ ลองใหม่อีกครั้ง");
  }

  // --- Backend -------------------------------------------------------------
  const config = getBackendConfig();
  if (config.mode === "misconfigured") {
    console.error(`[enquiries] backend misconfigured: ${config.problem}`);
    return fail(500, "server_error", GENERIC_REJECTION);
  }
  if (config.mode === "demo") {
    // No database yet: the browser keeps the enquiry as clearly labelled demo data.
    return NextResponse.json({ ok: true, mode: "demo" }, { status: 200 });
  }

  const db = getSupabaseAdmin(config.supabaseUrl, config.secretKey);
  const ipHash = saltedHash(config.hashSalt, `ip:${ip}`);

  try {
    // --- Rate limits -------------------------------------------------------
    const byIp = await consumeRateLimit(db, `ip:${ipHash}`, RATE_LIMITS.ip);
    const byPhone = byIp.allowed
      ? await consumeRateLimit(db, `phone:${saltedHash(config.hashSalt, `phone:${input.phone}`)}`, RATE_LIMITS.phone)
      : byIp;
    if (!byIp.allowed || !byPhone.allowed) {
      const retryAfter = Math.max(byIp.retryAfterSeconds, byPhone.retryAfterSeconds);
      return fail(
        429,
        "rate_limited",
        `มีการส่งคำขอบ่อยเกินไป ลองใหม่ในอีก ${Math.ceil(retryAfter / 60)} นาที หรือติดต่อเราทาง LINE หรือโทรศัพท์`,
        { retryAfterSeconds: retryAfter },
        { "Retry-After": String(retryAfter) },
      );
    }

    // --- Store (duplicates handled in the database) -----------------------
    const { data, error } = await db.rpc("submit_enquiry", {
      p: {
        type: input.type,
        product: input.type === "quote" ? planToProduct[input.planId] : null,
        name: input.name,
        phone: input.phone,
        preferred_channel: input.preferredChannel,
        vehicle_description: input.type === "quote" && input.planId !== "travel" ? input.carModel ?? null : null,
        model_year: input.type === "quote" && input.planId !== "travel" ? input.carYear ?? null : null,
        travel_destination: input.type === "quote" && input.planId === "travel" ? input.destination ?? null : null,
        travel_days: input.type === "quote" && input.planId === "travel" ? input.tripDays ?? null : null,
        travellers: input.type === "quote" && input.planId === "travel" ? input.travellers ?? null : null,
        message: input.message ?? null,
        marketing_consent: input.marketingConsent,
        notice_version: siteConfig.privacyNoticeVersion,
        idempotency_key: input.idempotencyKey,
        client_ip_hash: ipHash,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
    if (error) throw new Error(`submit_enquiry failed: ${error.code ?? ""} ${error.message}`);

    const result = data as { reference: string; duplicate: boolean; duplicate_reason: string | null };

    // Signed-in customer: show this request in their account. The user id
    // comes from the verified session, never from the request body; the
    // database ignores staff and old or already-attributed enquiries.
    if (!result.duplicate) {
      const userId = await signedInUserId();
      if (userId) {
        const { error: attachError } = await db.rpc("record_enquiry_submitter", { p_reference: result.reference, p_user: userId });
        if (attachError) console.error(`[enquiries] could not attach ${result.reference} to its account: ${attachError.code ?? ""}`);
      }
    }
    console.info(`[enquiries] ${result.duplicate ? `duplicate (${result.duplicate_reason})` : "stored"} ${result.reference}`);
    return NextResponse.json(
      { ok: true, mode: "database", reference: result.reference, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (err) {
    console.error(`[enquiries] ${err instanceof Error ? err.message : "unknown error"}`);
    return fail(500, "server_error", GENERIC_REJECTION);
  }
}

/** The signed-in user's id (verified with Supabase Auth), or null for visitors. */
async function signedInUserId(): Promise<string | null> {
  const store = await cookies();
  if (!store.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"))) return null;
  const userDb = await createUserClient();
  if (!userDb) return null;
  const { data } = await userDb.auth.getUser();
  return data.user?.id ?? null;
}
