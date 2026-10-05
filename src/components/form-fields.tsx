"use client";

import type { ComponentProps, ReactNode } from "react";

type TextFieldProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  narrow?: boolean;
};

export function TextField({ id, label, hint, error, narrow, className = "", ...input }: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`min-w-0 ${narrow ? "w-[7.5rem] shrink-0" : "flex-1"} ${className}`}>
      <label htmlFor={id} className="mb-1.5 block font-semibold text-navy">
        {label}
      </label>
      <input id={id} className="field-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.9375rem] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

type TextAreaFieldProps = Omit<ComponentProps<"textarea">, "id"> & { id: string; label: string; error?: string | null };

export function TextAreaField({ id, label, error, ...textarea }: TextAreaFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block font-semibold text-navy">
        {label}
      </label>
      <textarea
        id={id}
        className="field-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...textarea}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[0.9375rem] text-error">
          {error}
        </p>
      )}
    </div>
  );
}

type ChipOption<T extends string> = { value: T; label: ReactNode };

/** Radio group drawn as pill chips. */
export function ChipGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 font-semibold text-navy">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="relative">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
            />
            <span className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-line px-4 font-medium text-navy transition-colors peer-hover:border-teal peer-checked:border-teal peer-checked:bg-teal peer-checked:text-paper peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
