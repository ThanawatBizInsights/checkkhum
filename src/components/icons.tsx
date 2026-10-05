import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const navy = "var(--color-navy)";
const teal = "var(--color-teal)";

function ShieldCheck({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path fill={teal} d="M9 0l9 3.5v6.2c0 6-3.9 10-9 12.3C3.9 19.7 0 15.7 0 9.7V3.5z" />
      <path d="M5.3 10.4l2.6 2.6 5-5.2" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

export function CarShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <path
        fill={navy}
        d="M14 26l4.5-10.5A5 5 0 0 1 23.1 12.5h17.8a5 5 0 0 1 4.6 3L50 26h2a4 4 0 0 1 4 4v6a2 2 0 0 1-2 2h-2v4a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3v-4H21v4a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3v-4h-2a2 2 0 0 1-2-2v-6a4 4 0 0 1 4-4zm6 0h24l-3.3-8.2a1 1 0 0 0-.9-.6H24.2a1 1 0 0 0-.9.6zM16 33a2.5 2.5 0 1 0 0 .1zm32 0a2.5 2.5 0 1 0 0 .1z"
      />
      <ShieldCheck x={38} y={36} />
    </svg>
  );
}

export function EvIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <path fill={navy} d="M12 12a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v42h2v4H10v-4h2zm5 2v12h14V14z" />
      <path fill="#fff" d="M25 33l-4 7h4l-2 6 6-8h-4l2-5z" />
      <path
        fill="none"
        stroke={navy}
        strokeWidth="3"
        strokeLinecap="round"
        d="M36 30h4a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0 5 0V30M45 22v6M51 22v6M44 28h8v2a4 4 0 0 1-8 0z"
      />
      <path fill={teal} d="M60 36c-7 0-10 4-10 9 0 1.5.4 2.8 1.2 3.9 2.3-3.9 4.7-5.8 7.3-7-2.3 1.8-4.3 4.4-5.7 7.8 5.1.9 8-3.9 7.2-13.7z" />
    </svg>
  );
}

export function DocShieldIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <path fill={navy} d="M14 8h26l10 10v16h-4V20h-8V12H18v40h18v4H14z" />
      <path fill={navy} d="M23 26h18v4H23zm0 8h14v4H23zm0 8h10v4H23z" />
      <ShieldCheck x={40} y={36} />
    </svg>
  );
}

export function TravelIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" {...props}>
      <circle cx="28" cy="36" r="17" fill="none" stroke={navy} strokeWidth="4" />
      <path d="M11 36h34M28 19c-6 5-6 29 0 34M28 19c6 5 6 29 0 34" fill="none" stroke={navy} strokeWidth="3" />
      <path fill={teal} d="M38 20l20-10c2-1 4 1 3 3L51 31l-4-1 2-8-6 2-2 4-3-1 1-5z" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />
    </svg>
  );
}

export function LineIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.07.8.2.9.5.1.3.07.7.03 1l-.14.86c-.04.26-.2 1 .88.55 1.1-.46 5.8-3.4 7.9-5.9C21.3 14.3 22 12.7 22 11c0-4.4-4.5-8-10-8z" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...props}>
      <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.4V17h16V7.4l-8 5.3zM5.6 7l6.4 4.2L18.4 7z" />
    </svg>
  );
}

export function CheckMark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Dash(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}>
      <path d="M7 12h10" />
    </svg>
  );
}

export const productIcons = {
  car: CarShieldIcon,
  ev: EvIcon,
  compulsory: DocShieldIcon,
  travel: TravelIcon,
} as const;
