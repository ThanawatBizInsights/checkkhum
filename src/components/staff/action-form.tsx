"use client";

import { startTransition, useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { buttonClasses } from "../button";

export type ActionResult = { ok: boolean; message: string | null; fieldErrors?: Record<string, string> };
type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const initial: ActionResult = { ok: false, message: null };

/**
 * A form bound to a server action. Shows the action's result message, marks
 * fields with server errors, and optionally resets after success.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel,
  variant = "primary",
  size = "sm",
  resetOnSuccess = false,
  confirmText,
  className = "grid gap-3",
  inline = false,
  onSuccess,
  secondaryActions,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "quiet" | "outline";
  size?: "sm" | "md";
  resetOnSuccess?: boolean;
  confirmText?: string;
  className?: string;
  inline?: boolean;
  /** Called once per successful result (e.g. to collapse an inline editor). */
  onSuccess?: (message: string | null) => void;
  /** Extra buttons beside the submit button, such as "ยกเลิก". */
  secondaryActions?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const ref = useRef<HTMLFormElement>(null);
  const messageId = useId();

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  useEffect(() => {
    if (state.ok) onSuccessRef.current?.(state.message);
  }, [state]);

  useEffect(() => {
    // Point assistive tech and focus at the first field the server rejected.
    const form = ref.current;
    if (!form || !state.fieldErrors) return;
    form.querySelectorAll("[aria-invalid]").forEach((el) => {
      el.removeAttribute("aria-invalid");
      if (el.getAttribute("aria-describedby") === messageId) el.removeAttribute("aria-describedby");
    });
    let first: HTMLElement | null = null;
    for (const name of Object.keys(state.fieldErrors)) {
      const el = form.elements.namedItem(name);
      if (el instanceof HTMLElement) {
        el.setAttribute("aria-invalid", "true");
        // Tie the error text to the field (unless it already has a hint).
        if (!el.hasAttribute("aria-describedby")) el.setAttribute("aria-describedby", messageId);
        first ??= el;
      }
    }
    first?.focus();
  }, [state, messageId]);

  const fieldErrorList = state.fieldErrors ? Object.values(state.fieldErrors) : [];

  return (
    <form
      ref={ref}
      action={formAction}
      className={inline ? "inline" : className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        // Submit through a transition instead of the form's action attribute:
        // React resets an action-bound form after every submission, which would
        // wipe what staff typed when the server rejects it. Clearing after a
        // success stays opt-in (resetOnSuccess). Without JavaScript the action
        // attribute still submits the form.
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const data = new FormData(e.currentTarget, submitter instanceof HTMLElement ? submitter : undefined);
        startTransition(() => formAction(data));
      }}
    >
      {children}
      <div className={inline ? "inline" : secondaryActions ? "flex flex-wrap gap-2" : ""}>
        <button type="submit" disabled={pending} className={`${buttonClasses(variant, size)} disabled:opacity-60`}>
          {pending ? (pendingLabel ?? "กำลังบันทึก") : submitLabel}
        </button>
        {secondaryActions}
      </div>
      {state.message && (
        <div id={messageId} role={state.ok ? "status" : "alert"} className={`text-[0.9375rem] ${state.ok ? "text-teal-ink" : "text-error"}`}>
          <p>{state.message}</p>
          {!state.ok && fieldErrorList.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {fieldErrorList.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
