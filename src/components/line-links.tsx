import { lineUrl } from "@/lib/contact";
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

/** LINE's official "เพิ่มเพื่อน" (Add Friend) button, served from LINE's CDN as-is. */
export function LineAddFriendButton() {
  if (!lineLinkProps) return null;
  return (
    <a {...lineLinkProps} data-line-link className="inline-block rounded-md">
      {/* LINE's official button artwork must be used unmodified, so it is not re-encoded by next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://scdn.line-apps.com/n/line_add_friends/btn/th.png"
        alt="เพิ่มเพื่อน เช็กคุ้ม ผ่าน LINE"
        height={36}
        className="h-9 w-auto"
      />
      <NewTabHint />
    </a>
  );
}
