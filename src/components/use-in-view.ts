"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * True while any element matching `selector` is on screen. Re-checks after
 * each navigation. Used by the floating controls so they step aside for the
 * quote form (`[data-quote-form]`) and the footer.
 */
export function useAnyInView(selector: string, threshold = 0.15): boolean {
  const pathname = usePathname();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const targets = document.querySelectorAll(selector);
    if (!targets.length || !("IntersectionObserver" in window)) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target)));
        setInView(visible.size > 0);
      },
      { threshold },
    );
    targets.forEach((t) => observer.observe(t));
    return () => {
      observer.disconnect();
      setInView(false);
    };
  }, [pathname, selector, threshold]);

  return inView;
}

/** True while a text field, select or textarea has focus (on phones: the keyboard is likely open). */
export function useTypingFocus(): boolean {
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.matches("input:not([type=checkbox]):not([type=radio]), textarea, select") || t.isContentEditable);
    const onIn = (e: FocusEvent) => setTyping(isField(e.target));
    const onOut = (e: FocusEvent) => setTyping(isField(e.relatedTarget));
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  return typing;
}
