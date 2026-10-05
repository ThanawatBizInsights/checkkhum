"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ButtonLink } from "./button";

/**
 * Floating quote button on phones. Hidden on the quote page and while any
 * quote form (`[data-quote-form]`) is on screen, so it never covers the form.
 */
export function MobileQuoteBar() {
  const pathname = usePathname();
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const targets = document.querySelectorAll("[data-quote-form]");
    if (!targets.length || !("IntersectionObserver" in window)) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
        setFormVisible(visible.size > 0);
      },
      { threshold: 0.15 },
    );
    targets.forEach((t) => observer.observe(t));
    return () => {
      observer.disconnect();
      setFormVisible(false);
    };
  }, [pathname]);

  if (pathname === "/quote") return null;
  const hidden = formVisible;

  return (
    <div
      className={`fixed inset-x-4 bottom-3 z-10 transition-[opacity,transform] duration-200 md:hidden ${
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
