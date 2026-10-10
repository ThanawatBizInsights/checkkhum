"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { LineIcon } from "./icons";
import { lineLinkProps } from "./line-links";
import { useAnyInView, useTypingFocus } from "./use-in-view";

const DISMISSED_KEY = "checkkhum:line-widget-dismissed";
const DISMISS_EVENT = "checkkhum:line-widget-dismissed";

// Dismissal lasts for this browsing session (sessionStorage). Storage can be
// blocked (private mode); then the widget simply stays closed after dismissal
// until the page reloads.
let dismissedInMemory = false;
function readDismissed(): boolean {
  try {
    return dismissedInMemory || window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return dismissedInMemory;
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onChange);
  return () => window.removeEventListener(DISMISS_EVENT, onChange);
}
function dismiss() {
  dismissedInMemory = true;
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    /* storage blocked: the in-memory flag still keeps it closed */
  }
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

/** Pages where an "add us on LINE" prompt makes no sense (the LIFF page already runs inside LINE). */
const HIDDEN_ON = ["/line"];

/**
 * One floating "add us on LINE" card for every public page. Bottom-right on
 * desktop; a compact card above the quote bar on phones. Unobtrusive by
 * design: no overlay, closable, stays closed for the session once dismissed,
 * and steps aside while any form (quote, contact, login, registration), the footer
 * or a focused field (on-screen keyboard) is in view, so it never covers form
 * fields or submit buttons.
 * Opens the LINE OA in a new tab; it never sends form details.
 */
export function LineFloatingWidget() {
  const pathname = usePathname();
  // The server snapshot says "dismissed" so nothing renders until the browser knows.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  const formInView = useAnyInView("[data-quote-form], main form");
  const footerInView = useAnyInView("[data-site-footer]", 0);
  const typing = useTypingFocus();

  if (dismissed || !lineLinkProps || HIDDEN_ON.includes(pathname)) return null;
  const hidden = formInView || footerInView || typing;
  // Phones: sit above the floating quote bar (52px + 12px gap), which every page but /quote shows.
  const mobileBottom = pathname === "/quote" ? "bottom-[calc(env(safe-area-inset-bottom)+12px)]" : "bottom-[calc(env(safe-area-inset-bottom)+76px)]";

  return (
    <aside
      aria-label="เพิ่มเพื่อน LINE"
      data-line-widget
      inert={hidden}
      className={`fixed inset-x-4 z-20 ${mobileBottom} transition-[opacity,transform] duration-200 motion-reduce:transition-none md:inset-x-auto md:bottom-6 md:right-6 md:w-[340px] ${
        hidden ? "pointer-events-none translate-y-3 opacity-0" : ""
      }`}
    >
      <div className="relative rounded-[var(--radius-panel)] border border-line bg-paper shadow-[0_16px_36px_-18px_rgba(4,24,63,.55)]">
        <a
          {...lineLinkProps}
          data-line-link
          className="flex items-start gap-3 rounded-[var(--radius-panel)] py-3 pl-3 pr-12 md:p-4 md:pr-12"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-line-brand text-paper">
            <LineIcon className="size-7" />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[1.0625rem] font-semibold leading-snug text-navy">แอดไลน์เพื่อเช็กเบี้ย</span>
            <span className="mt-0.5 block text-[0.9375rem] leading-normal text-ink-soft">
              ส่งคำขอเช็กเบี้ยประกันรถฟรีได้ <span className="whitespace-nowrap">24 ชม.</span>
            </span>
            {/* Desktop shows a button-styled label; on phones the whole card is the button. */}
            <span className="mt-3 hidden min-h-11 items-center rounded-full bg-teal px-5 font-display font-semibold text-paper md:inline-flex">
              เพิ่มเพื่อน LINE
            </span>
            <span className="sr-only">: เพิ่มเพื่อน LINE (เปิดในแท็บใหม่)</span>
          </span>
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="ปิดกล่องเพิ่มเพื่อน LINE"
          className="absolute right-1 top-1 grid size-11 place-items-center rounded-full text-ink-soft hover:bg-sky hover:text-navy"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
