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

/** Radio group drawn as pill chips. `value` may be "" (nothing chosen yet). */
export function ChipGroup<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  legend: string;
  name: string;
  options: ChipOption<T>[];
  value: T | "";
  onChange: (value: T) => void;
  error?: string | null;
  hint?: string;
}) {
  const describedBy = [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset className="min-w-0" aria-describedby={describedBy}>
      <legend className="mb-1.5 font-semibold text-navy">{legend}</legend>
      {hint && (
        <p id={`${name}-hint`} className="-mt-0.5 mb-2 text-[0.9375rem] text-ink-soft">
          {hint}
        </p>
      )}
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
            <span
              className={`inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 font-medium text-navy transition-colors peer-hover:border-teal peer-checked:border-teal peer-checked:bg-teal peer-checked:text-paper peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal motion-reduce:transition-none ${
                error ? "border-error" : "border-line"
              }`}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-[0.9375rem] text-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

type SelectFieldProps = Omit<ComponentProps<"select">, "id"> & {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  error?: string | null;
  narrow?: boolean;
};

export function SelectField({ id, label, options, placeholder, hint, error, narrow, className = "", ...select }: SelectFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`min-w-0 ${narrow ? "w-[8.5rem] shrink-0" : "flex-1"} ${className}`}>
      <label htmlFor={id} className="mb-1.5 block font-semibold text-navy">
        {label}
      </label>
      <select id={id} className="field-input" aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...select}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
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
