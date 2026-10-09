import { lineAddFriendImage, lineUrl } from "@/lib/contact";
import { buttonClasses } from "./button";
import { LineIcon } from "./icons";

/** Attributes every LINE link uses: our LINE OA, in a new tab. */
export const lineLinkProps = lineUrl
  ? ({ href: lineUrl, target: "_blank", rel: "noopener noreferrer" } as const)
  : null;

function NewTabHint() {
  return <span className="sr-only"> (เปิดในแท็บใหม่)</span>;
}

/**
 * A LINE contact button. Opens the LINE Official Account in a new tab; it
 * does not send any form details. Renders nothing if no LINE URL is configured.
 */
export function LineButton({
  children,
  size = "md",
  block = false,
  className = "",
}: {
  children: React.ReactNode;
  size?: "md" | "sm";
  block?: boolean;
  className?: string;
}) {
  if (!lineLinkProps) return null;
  return (
    <a {...lineLinkProps} data-line-link className={`${buttonClasses("outline", size, block)} gap-2 ${className}`}>
      <LineIcon className="size-6 shrink-0 text-line-brand" />
      <span>{children}</span>
      <NewTabHint />
    </a>
  );
}

/**
 * LINE's official "เพิ่มเพื่อน" (Add Friend) button, served from LINE's CDN as-is.
 * 36px tall; the width follows the artwork's own aspect ratio (a 116×36 box is
 * reserved until it loads, so nothing jumps).
 */
export function LineAddFriendButton({ className = "" }: { className?: string }) {
  if (!lineLinkProps || !lineAddFriendImage) return null;
  return (
    <a {...lineLinkProps} data-line-link className={`inline-flex shrink-0 rounded-md ${className}`}>
      {/* LINE's official button artwork must be used unmodified, so it is not re-encoded by next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={lineAddFriendImage}
        alt="เพิ่มเพื่อน LINE เช็กคุ้ม"
        height={36}
        decoding="async"
        className="block h-9 w-auto [aspect-ratio:auto_116/36]"
      />
      <NewTabHint />
    </a>
  );
}

/** Quiet text link to LINE, e.g. as an alternative beside a quotation form. */
export function LineTextLink({ children = "คุยกับเราผ่าน LINE", className = "" }: { children?: React.ReactNode; className?: string }) {
  if (!lineLinkProps) return null;
  return (
    <a {...lineLinkProps} data-line-link className={`inline-flex min-h-11 items-center gap-2 font-semibold text-teal-ink underline underline-offset-4 ${className}`}>
      <LineIcon className="size-6 shrink-0 text-line-brand" />
      {children}
      <NewTabHint />
    </a>
  );
}
