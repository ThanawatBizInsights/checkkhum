"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutToHome } from "@/app/(site)/customer/_actions/auth";
import { buttonClasses } from "./button";

export type AccountState = "loading" | "signed_out" | "customer" | "staff";

let pending: Promise<AccountState> | null = null;

/**
 * Signed-in state for the public header. Pages stay static, so the header
 * asks /api/account (kind of account only) once per page load.
 */
export function useAccountState(): AccountState {
  const [state, setState] = useState<AccountState>("loading");
  useEffect(() => {
    pending ??= fetch("/api/account", { cache: "no-store", credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { state: "signed_out" }))
      .then((j: { state?: string }) => (j.state === "customer" || j.state === "staff" ? j.state : "signed_out"))
      .catch(() => "signed_out" as const);
    let live = true;
    pending.then((s) => live && setState(s));
    return () => {
      live = false;
      // Re-check on the next mount (e.g. after signing in or out).
      pending = null;
    };
  }, []);
  return state;
}

const accountHref = (s: AccountState) => (s === "staff" ? "/staff" : "/customer");

/** Desktop: "เข้าสู่ระบบ" (ลูกค้า / เจ้าหน้าที่) or "บัญชีของฉัน" + ออกจากระบบ. */
export function AccountMenu() {
  const state = useAccountState();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const signedIn = state === "customer" || state === "staff";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const item = "flex min-h-11 items-center rounded-lg px-3 font-semibold text-navy hover:bg-sky";

  return (
    <div ref={root} className="relative hidden lg:block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        // Hidden (but holding its space) until we know whether someone is signed in.
        className={`${buttonClasses("outline", "sm")} gap-2 ${state === "loading" ? "invisible" : ""}`}
      >
        <PersonIcon />
        {signedIn ? "บัญชีของฉัน" : "เข้าสู่ระบบ"}
        <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute right-0 top-full z-30 mt-2 w-64 rounded-[var(--radius-control)] border-[1.5px] border-line bg-paper p-2 shadow-[0_18px_30px_-20px_rgba(10,34,89,.45)]"
      >
        {signedIn ? (
          <ul className="grid gap-1">
            <li>
              <Link href={accountHref(state)} className={item} onClick={() => setOpen(false)}>
                {state === "staff" ? "ระบบเจ้าหน้าที่" : "บัญชีของฉัน"}
              </Link>
            </li>
            <li>
              <form action={signOutToHome}>
                <button type="submit" className={`${item} w-full text-left`}>
                  ออกจากระบบ
                </button>
              </form>
            </li>
          </ul>
        ) : (
          <>
            <p className="px-3 pb-1 pt-1 text-[0.9375rem] text-ink-soft">เข้าสู่ระบบในฐานะ</p>
            <ul className="grid gap-1">
              <li>
                <Link href="/customer/login" className={item} onClick={() => setOpen(false)}>
                  ลูกค้า
                </Link>
              </li>
              <li>
                <Link href="/staff/login" className={item} onClick={() => setOpen(false)}>
                  เจ้าหน้าที่
                </Link>
              </li>
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Mobile menu section with the same choices, always expanded. */
export function MobileAccountLinks({ onNavigate }: { onNavigate?: () => void }) {
  const state = useAccountState();
  const signedIn = state === "customer" || state === "staff";
  return (
    <div className={`wrap border-t-2 border-line py-4 ${state === "loading" ? "invisible" : ""}`}>
      {signedIn ? (
        <div className="grid grid-cols-2 gap-3">
          <Link href={accountHref(state)} onClick={onNavigate} className={buttonClasses("quiet", "sm", true)}>
            {state === "staff" ? "ระบบเจ้าหน้าที่" : "บัญชีของฉัน"}
          </Link>
          <form action={signOutToHome}>
            <button type="submit" className={buttonClasses("outline", "sm", true)}>
              ออกจากระบบ
            </button>
          </form>
        </div>
      ) : (
        <>
          <p className="font-display text-lg font-semibold text-navy">เข้าสู่ระบบ</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Link href="/customer/login" onClick={onNavigate} className={buttonClasses("quiet", "sm", true)}>
              ลูกค้า
            </Link>
            <Link href="/staff/login" onClick={onNavigate} className={buttonClasses("outline", "sm", true)}>
              เจ้าหน้าที่
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
