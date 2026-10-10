/**
 * LINE contact details typed by people (staff in the CRM, or visitors in the
 * quote form). Mirrors the database checks private.is_line_url / is_line_id
 * (supabase/migrations/20261012090000_customer_line_contact.sql) so errors
 * show on the field before the database refuses them.
 *
 * These details are never verified. The only verified LINE identity is the
 * LINE Login link in customer_line_accounts. Never build a chat or profile URL
 * from a phone number, display name, LINE ID or LINE user id: links are only
 * ever opened exactly as the customer shared them.
 */

/** https only; LINE's own hosts; the host followed by a path; no spaces or quotes. */
const LINE_URL = /^https:\/\/(line\.me|www\.line\.me|page\.line\.me|lin\.ee)\/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]+$/;
/** Optional "@" (Official Accounts), then letters, digits, dot, dash or underscore. */
const LINE_ID = /^@?[A-Za-z0-9._-]{1,50}$/;

export const LINE_URL_ERROR = "ลิงก์ LINE ต้องขึ้นต้นด้วย https://line.me หรือ https://lin.ee";
export const LINE_ID_ERROR = "LINE ID ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และ . _ - (ขึ้นต้นด้วย @ ได้)";

export function isLineUrl(value: string): boolean {
  return value.length <= 300 && LINE_URL.test(value);
}

/**
 * LINE OA Manager conversation link, e.g. https://chat.line.biz/<account>/chat/<user>.
 * Same character rule as the database (private.is_line_oa_chat_url); on top of
 * that the URL is parsed, and must be https, exactly the host chat.line.biz, with
 * no user name, password or port, and already in canonical form (so
 * "https://chat.line.biz:443/…", "HTTPS://CHAT.LINE.BIZ/…" and backslash tricks fail).
 */
const LINE_OA_CHAT_URL = /^https:\/\/chat\.line\.biz\/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]+$/;

export const LINE_OA_CHAT_URL_ERROR = "ลิงก์แชท LINE OA ต้องเป็นลิงก์ https://chat.line.biz/… ที่คัดลอกจากแถบที่อยู่ของเบราว์เซอร์";

export function isLineOaChatUrl(value: string): boolean {
  if (value.length > 500 || !LINE_OA_CHAT_URL.test(value)) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.hostname === "chat.line.biz" &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    url.pathname.length > 1 &&
    url.href === value
  );
}

/** A saved LINE OA chat link that may be opened, or null. */
export function safeLineOaChatHref(value: string | null | undefined): string | null {
  return value && isLineOaChatUrl(value) ? value : null;
}

export function isLineId(value: string): boolean {
  return LINE_ID.test(value);
}

/** A saved link that may be opened, or null (never a constructed one). */
export function safeLineHref(value: string | null | undefined): string | null {
  return value && isLineUrl(value) ? value : null;
}

/**
 * The quote form's single optional "LINE ID หรือลิงก์ LINE" field: a link if it
 * starts with http(s), otherwise a LINE ID.
 */
export function parseLineContact(raw: string | undefined | null):
  | { ok: true; lineId?: string; lineUrl?: string }
  | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: true };
  // Anything with a scheme or a slash is meant as a link ("line.me/ti/p/…" without https too).
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.includes("/")) {
    return isLineUrl(value) ? { ok: true, lineUrl: value } : { ok: false, error: LINE_URL_ERROR };
  }
  return isLineId(value) ? { ok: true, lineId: value } : { ok: false, error: LINE_ID_ERROR };
}
