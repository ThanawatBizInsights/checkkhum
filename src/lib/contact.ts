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
  /** Link target, or null when the detail is not configured yet: hide the channel. */
  href: string | null;
};

export const phoneChannel: ContactChannel = phoneDigits
  ? { display: formatThaiPhone(phoneDigits), href: `tel:${phoneDigits}` }
  : { display: placeholders.phone, href: null };

/** The LINE Official Account link from the config, or null if not set. */
export const lineUrl: string | null = contact.lineUrl || null;

export const lineChannel: ContactChannel = lineUrl
  ? { display: contact.lineId || lineUrl.replace(/^https?:\/\//, ""), href: lineUrl }
  : { display: placeholders.lineId, href: null };

export const emailChannel: ContactChannel = contact.email
  ? { display: contact.email, href: `mailto:${contact.email}` }
  : { display: placeholders.email, href: null };

/** Business hours, or null when not configured (then not shown). */
export const hoursText: string | null = contact.hours || null;

/** Public company identity, only when both name and broker licence are configured. */
export const companyIdentity: { name: string; licenceNo: string; address: string | null } | null =
  siteConfig.legal.companyName && siteConfig.legal.brokerLicenseNo
    ? { name: siteConfig.legal.companyName, licenceNo: siteConfig.legal.brokerLicenseNo, address: siteConfig.legal.address || null }
    : null;

export function legalValue(key: keyof typeof siteConfig.legal): string {
  return siteConfig.legal[key] || placeholders[key];
}
