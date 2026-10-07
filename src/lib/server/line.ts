import "server-only";

/**
 * LINE Login for customers (LIFF and LINE Login in a normal browser).
 *
 * The browser only ever hands us a LINE ID token. We never trust the profile
 * the LIFF SDK reports: the token is verified by LINE's own endpoint
 * (POST /oauth2/v2.1/verify) for OUR LINE Login channel, and only the claims
 * LINE returns (sub, name, picture) are used.
 */

export type LineConfig = { liffId: string; channelId: string };

/** LINE settings, or null when LINE Login isn't configured (the site then hides it). */
export function getLineConfig(): LineConfig | null {
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID?.trim();
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID?.trim();
  if (!liffId || !channelId) return null;
  // A LIFF ID is "<LINE Login channel ID>-<random>"; catch mismatched settings early.
  if (!/^\d{6,20}$/.test(channelId) || !/^\d{6,20}-[A-Za-z0-9]{4,32}$/.test(liffId) || !liffId.startsWith(`${channelId}-`)) {
    console.error("[line] NEXT_PUBLIC_LINE_LIFF_ID must start with LINE_LOGIN_CHANNEL_ID followed by '-'");
    return null;
  }
  return { liffId, channelId };
}

/**
 * LINE's API base. Tests may point it at a mock on THIS machine only
 * (http://localhost or http://127.0.0.1); anything else is ignored, so a
 * stray setting can never send tokens to a third party or skip verification.
 */
function lineApiBase(): string {
  const override = process.env.LINE_API_BASE_URL?.trim();
  if (override && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override)) return override;
  return "https://api.line.me";
}

export type LineIdentity = {
  /** LINE user ID for our provider, e.g. "U4af4980629…". */
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
};

export class LineVerifyError extends Error {
  constructor(public readonly reason: "invalid" | "unavailable") {
    super(reason);
  }
}

/** Verify a LINE ID token with LINE and return the identity it proves. */
export async function verifyLineIdToken(idToken: string, config: LineConfig): Promise<LineIdentity> {
  if (!idToken || idToken.length > 4096 || idToken.split(".").length !== 3) throw new LineVerifyError("invalid");

  let res: Response;
  try {
    res = await fetch(`${lineApiBase()}/oauth2/v2.1/verify`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: config.channelId }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    throw new LineVerifyError("unavailable");
  }
  if (res.status >= 500) throw new LineVerifyError("unavailable");
  if (!res.ok) throw new LineVerifyError("invalid"); // expired, wrong channel, tampered…

  const claims = (await res.json().catch(() => null)) as {
    iss?: string;
    sub?: string;
    aud?: string;
    exp?: number;
    name?: string;
    picture?: string;
  } | null;

  // LINE already checked these; check again so a misbehaving proxy can't slip one through.
  if (
    !claims ||
    claims.iss !== "https://access.line.me" ||
    claims.aud !== config.channelId ||
    typeof claims.exp !== "number" ||
    claims.exp * 1000 < Date.now() ||
    typeof claims.sub !== "string" ||
    !/^U[0-9a-f]{32}$/.test(claims.sub)
  ) {
    throw new LineVerifyError("invalid");
  }

  return {
    userId: claims.sub,
    displayName: typeof claims.name === "string" ? claims.name.trim().slice(0, 100) || null : null,
    pictureUrl: typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture.slice(0, 500) : null,
  };
}

/**
 * Login email for an account created by LINE Login. `.invalid` is reserved
 * (RFC 2606) so no email can ever be sent to it; customers never see it.
 */
export function lineLoginEmail(lineUserId: string): string {
  return `${lineUserId.toLowerCase()}@line.checkkhum.invalid`;
}

export function isLineLoginEmail(email: string | null | undefined): boolean {
  return !!email && email.endsWith("@line.checkkhum.invalid");
}
