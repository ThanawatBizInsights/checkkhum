"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/**
 * Honeypot: a field people never see or reach by keyboard. Automated form
 * fillers usually complete it, and the server rejects any enquiry where it
 * is not empty.
 */
export function HoneypotField({ id, value, onChange }: { id: string; value: string; onChange: (e: { target: { value: string } }) => void }) {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
      <label htmlFor={id}>เว็บไซต์ของคุณ (ไม่ต้องกรอก)</label>
      <input id={id} name="website" type="text" tabIndex={-1} autoComplete="off" value={value} onChange={onChange} />
    </div>
  );
}

/** Cloudflare Turnstile widget, rendered only when a site key is configured. */
export function TurnstileWidget({ siteKey, onToken }: { siteKey: string; onToken: (token: string | undefined) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);

  useEffect(() => {
    if (!scriptReady || rendered.current || !ref.current || !window.turnstile) return;
    rendered.current = true;
    window.turnstile.render(ref.current, {
      sitekey: siteKey,
      language: "th",
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(undefined),
    });
  }, [scriptReady, siteKey, onToken]);

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={ref} className="min-h-[65px]" />
    </>
  );
}

export function MarketingConsent({ id, checked, onChange }: { id: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[0.9375rem] leading-relaxed">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-teal"
      />
      <span>รับข่าวสารและข้อเสนอประกันจากเช็กคุ้มทาง LINE หรือโทรศัพท์ (ไม่บังคับ ยกเลิกได้ทุกเมื่อ)</span>
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-control)] border border-error/30 bg-[#fdecea] px-4 py-3 text-[0.9375rem] text-error">
      {message}
    </p>
  );
}
