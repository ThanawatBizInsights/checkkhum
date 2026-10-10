"use client";

import { useId, useState } from "react";
import { LINE_OA_CHAT_URL_ERROR, isLineOaChatUrl } from "@/lib/line-contact";

/**
 * "ลิงก์แชท LINE OA" field. Checks the link with the same rule as the server
 * action and the database (isLineOaChatUrl) and blocks the submit while it is
 * wrong. Empty is fine: saving an empty field clears the link. The error shows
 * after leaving the field or trying to save, not while staff are still pasting.
 */
export function LineOaChatInput({ defaultValue }: { defaultValue: string | null }) {
  const hintId = useId();
  const errorId = useId();
  const [error, setError] = useState("");

  function validate(el: HTMLInputElement, show: boolean) {
    const value = el.value.trim();
    const message = value && !isLineOaChatUrl(value) ? LINE_OA_CHAT_URL_ERROR : "";
    el.setCustomValidity(message);
    if (show || !message) setError(message);
  }

  return (
    <div className="min-w-0">
      <label htmlFor="line-oa-chat-url" className="mb-1 block text-[0.9375rem] font-semibold text-navy">
        ลิงก์แชท LINE OA
      </label>
      <input
        id="line-oa-chat-url"
        name="line_oa_chat_url"
        type="url"
        inputMode="url"
        defaultValue={defaultValue ?? ""}
        maxLength={500}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        placeholder="https://chat.line.biz/…"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        onChange={(e) => validate(e.currentTarget, false)}
        onBlur={(e) => validate(e.currentTarget, true)}
        onInvalid={(e) => validate(e.currentTarget, true)}
        className="field-input"
      />
      {error && (
        <p id={errorId} className="mt-1 text-[0.9375rem] text-error" data-field-error>
          {error}
        </p>
      )}
      <p id={hintId} className="mt-1 text-[0.9375rem] text-ink-soft">
        เปิดแชทของลูกค้าใน LINE OA แล้วคัดลอก URL จากแถบที่อยู่ของเบราว์เซอร์
      </p>
    </div>
  );
}
