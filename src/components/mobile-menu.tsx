"use client";

import { useEffect, useId, useState } from "react";
import { MobileAccountLinks } from "./account-menu";
import { NavLinks } from "./nav-links";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-line px-4 font-semibold text-navy"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        เมนู
      </button>
      <nav
        id={panelId}
        aria-label="เมนูหลัก"
        hidden={!open}
        className="absolute inset-x-0 top-full z-20 border-b border-line bg-paper shadow-[0_18px_30px_-20px_rgba(10,34,89,.45)]"
      >
        <NavLinks
          className="wrap grid py-2"
          linkClassName="block border-b border-line py-3 text-lg font-semibold text-navy"
          onNavigate={() => setOpen(false)}
        />
        <MobileAccountLinks onNavigate={() => setOpen(false)} />
      </nav>
    </div>
  );
}
