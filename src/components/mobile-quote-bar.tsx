"use client";

import { usePathname } from "next/navigation";
import { ButtonLink } from "./button";
import { useAnyInView, useTypingFocus } from "./use-in-view";

/**
 * Floating quote button on phones. LINE lives in the floating LINE widget
 * (`LineFloatingWidget`), which sits just above this bar. Hidden on the quote
 * page, while any form is on screen (quote, contact, login…) and while a field
 * has focus, so it never covers form fields, submit buttons or the keyboard.
 */
export function MobileQuoteBar() {
  const pathname = usePathname();
  const formVisible = useAnyInView("[data-quote-form], main form");
  const typing = useTypingFocus();

  if (pathname === "/quote") return null;
  const hidden = formVisible || typing;

  return (
    <div
      className={`fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-10 transition-[opacity,transform] duration-200 motion-reduce:transition-none md:hidden ${
        hidden ? "pointer-events-none translate-y-4 opacity-0" : ""
      }`}
      aria-hidden={hidden || undefined}
    >
      <ButtonLink href="/quote" block tabIndex={hidden ? -1 : undefined} className="shadow-[0_10px_24px_-8px_rgba(4,24,63,.5)]">
        ขอใบเสนอราคา
      </ButtonLink>
    </div>
  );
}
