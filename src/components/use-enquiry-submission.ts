"use client";

import { useEffect, useRef, useState } from "react";
import { newUuid, submitEnquiry, summarizeEnquiry, type EnquiryInput } from "@/lib/submissions";

export type EnquiryResultState =
  | { kind: "stored"; summary: string; reference: string; duplicate: boolean }
  | { kind: "demo"; summary: string; storedLocally: boolean };

/**
 * Submission state shared by the quote and contact forms.
 *
 * - One idempotency key per enquiry: a double-click or a retry after a
 *   network error reuses it, so the server stores the enquiry once. A new
 *   key is issued only after a successful submission.
 * - `startedAt` lets the server reject forms filled faster than a person can.
 * - `honeypot` is bound to a field hidden from people; bots tend to fill it.
 */
export function useEnquirySubmission() {
  const idempotencyKey = useRef("");
  const startedAt = useRef(0);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<EnquiryResultState | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    idempotencyKey.current = newUuid();
    startedAt.current = Date.now();
  }, []);

  /** Returns server field errors (if any) so the form can show them. */
  async function submit(input: EnquiryInput): Promise<Record<string, string> | null> {
    if (inFlight.current) return null; // ignore double submits while one is running
    inFlight.current = true;
    setPending(true);
    setFormError(null);
    try {
      const outcome = await submitEnquiry(input, {
        idempotencyKey: idempotencyKey.current,
        startedAt: startedAt.current,
        website: honeypot,
        turnstileToken,
      });
      const summary = summarizeEnquiry(input);
      switch (outcome.kind) {
        case "stored":
          setResult({ kind: "stored", summary, reference: outcome.reference, duplicate: outcome.duplicate });
          idempotencyKey.current = newUuid();
          return null;
        case "demo":
          setResult({ kind: "demo", summary, storedLocally: outcome.storedLocally });
          idempotencyKey.current = newUuid();
          return null;
        case "invalid":
          setFormError(outcome.message);
          return outcome.fieldErrors;
        case "error":
          setFormError(outcome.message);
          return null;
      }
      return null;
    } finally {
      inFlight.current = false;
      setPending(false);
      // Turnstile tokens are single-use.
      setTurnstileToken(undefined);
      window.turnstile?.reset();
    }
  }

  return {
    submit,
    pending,
    formError,
    result,
    clearResult: () => setResult(null),
    honeypot: { value: honeypot, onChange: (e: { target: { value: string } }) => setHoneypot(e.target.value) },
    onTurnstileToken: setTurnstileToken,
  };
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback"?: () => void; language?: string }) => string;
      reset: (id?: string) => void;
    };
  }
}
