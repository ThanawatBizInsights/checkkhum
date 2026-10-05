/**
 * Staff session for the DEMO staff area.
 *
 * This is a placeholder until a real identity provider is connected: one
 * shared demo account from environment variables, and a signed, httpOnly
 * cookie. It uses Web Crypto only, so it runs in both `proxy.ts` and server
 * components.
 *
 * In development, missing variables fall back to the documented demo
 * defaults. In production, login is disabled unless all three are set.
 */

export const STAFF_COOKIE = "ck_staff_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const DEV_DEFAULTS = {
  email: "demo@checkkhum.local",
  password: "checkkhum-demo",
  secret: "dev-only-secret-change-me-dev-only-secret",
};

const isProduction = process.env.NODE_ENV === "production";

export type StaffAuthConfig =
  | { enabled: true; email: string; password: string; secret: string; usingDevDefaults: boolean }
  | { enabled: false; reason: string };

export function getStaffAuthConfig(): StaffAuthConfig {
  const email = process.env.STAFF_DEMO_EMAIL;
  const password = process.env.STAFF_DEMO_PASSWORD;
  const secret = process.env.STAFF_SESSION_SECRET;

  if (email && password && secret) {
    if (secret.length < 32) {
      return { enabled: false, reason: "STAFF_SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร" };
    }
    return { enabled: true, email, password, secret, usingDevDefaults: false };
  }
  if (isProduction) {
    return {
      enabled: false,
      reason: "ยังไม่ได้ตั้งค่า STAFF_DEMO_EMAIL, STAFF_DEMO_PASSWORD และ STAFF_SESSION_SECRET",
    };
  }
  return {
    enabled: true,
    email: email || DEV_DEFAULTS.email,
    password: password || DEV_DEFAULTS.password,
    secret: secret || DEV_DEFAULTS.secret,
    usingDevDefaults: true,
  };
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export type StaffSession = { email: string; exp: number };

export async function createSessionToken(email: string, secret: string): Promise<string> {
  const payload: StaffSession = { email, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(body)));
  return `${body}.${toBase64Url(sig)}`;
}

export async function verifySessionToken(token: string | undefined): Promise<StaffSession | null> {
  if (!token) return null;
  const config = getStaffAuthConfig();
  if (!config.enabled) return null;

  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const sigBytes = fromBase64Url(sig);
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(config.secret),
      sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer,
      encoder.encode(body),
    );
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as StaffSession;
    if (typeof session.exp !== "number" || session.exp < Date.now() / 1000) return null;
    if (session.email !== config.email) return null;
    return session;
  } catch {
    return null;
  }
}

/** Compare two strings in time that does not depend on where they differ. */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}
