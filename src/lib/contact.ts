import { placeholders, siteConfig } from "@/config/site";

const { contact } = siteConfig;

export const phoneDigits = contact.phone.replace(/\D/g, "");

export function formatThaiPhone(digits: string): string {
  if (digits.length === 10) return digits.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  if (digits.length === 9) return digits.replace(/(\d{2})(\d{3})(\d{4})/, "$1-$2-$3");
  return digits;
}

export type ContactChannel = {
  /** Text to show: the real value, or the placeholder when not configured. */
  display: string;
  /** Link target, or null when the detail is not configured yet. */
  href: string | null;
};

export const phoneChannel: ContactChannel = phoneDigits
  ? { display: formatThaiPhone(phoneDigits), href: `tel:${phoneDigits}` }
  : { display: placeholders.phone, href: null };

export const lineChannel: ContactChannel = contact.lineId
  ? { display: contact.lineId, href: `https://line.me/R/ti/p/${encodeURIComponent(contact.lineId)}` }
  : { display: placeholders.lineId, href: null };

export const emailChannel: ContactChannel = contact.email
  ? { display: contact.email, href: `mailto:${contact.email}` }
  : { display: placeholders.email, href: null };

export const hoursText = contact.hours || placeholders.hours;

/** LINE deep link that opens a chat with the message pre-filled, or null. */
export function lineMessageUrl(text: string): string | null {
  if (!contact.lineId) return null;
  return `https://line.me/R/oaMessage/${encodeURIComponent(contact.lineId)}/?${encodeURIComponent(text)}`;
}

export function legalValue(key: keyof typeof siteConfig.legal): string {
  return siteConfig.legal[key] || placeholders[key];
}
