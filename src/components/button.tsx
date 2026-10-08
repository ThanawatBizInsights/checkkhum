import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "quiet" | "outline" | "onDark";
type Size = "lg" | "md" | "sm";

const base =
  "inline-flex items-center justify-center rounded-full font-display font-semibold leading-tight no-underline transition-colors cursor-pointer disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary: "bg-teal text-paper hover:bg-teal-ink",
  quiet: "bg-sky text-navy hover:bg-line",
  outline: "border-[1.5px] border-line bg-paper text-navy hover:border-navy",
  onDark: "bg-paper text-navy hover:bg-mint",
};

const sizes: Record<Size, string> = {
  lg: "min-h-14 px-8 text-xl",
  md: "min-h-[52px] px-7 text-lg",
  sm: "min-h-11 px-5 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", block = false) {
  return [base, variants[variant], sizes[size], block ? "flex w-full" : ""].join(" ");
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean };

export function ButtonLink({ variant, size, block, className = "", ...props }: ButtonLinkProps) {
  return <Link className={`${buttonClasses(variant, size, block)} ${className}`} {...props} />;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; block?: boolean };

export function Button({ variant, size, block, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${buttonClasses(variant, size, block)} ${className}`} {...props} />;
}
