import { emailChannel, hoursText, lineChannel, lineQrImage, phoneChannel, type ContactChannel } from "@/lib/contact";
import { LineIcon, MailIcon, PhoneIcon } from "./icons";

function Channel({
  icon: Icon,
  label,
  channel,
  tone,
}: {
  icon: typeof PhoneIcon;
  label: string;
  channel: ContactChannel;
  tone: "dark" | "light";
}) {
  const dark = tone === "dark";
  return (
    <li className="flex flex-wrap items-center gap-3">
      <span className={`grid size-11 place-items-center rounded-full ${dark ? "bg-paper text-navy" : "bg-mint text-teal-ink"}`}>
        <Icon className="size-6" />
      </span>
      <span className={`font-display text-xl font-semibold ${dark ? "text-paper" : "text-navy"}`}>{label}</span>
      {channel.href ? (
        <a
          href={channel.href}
          className={`text-xl underline underline-offset-[5px] ${dark ? "text-paper focus-visible:outline-[#5fd3bd]" : "text-ink"}`}
          {...(channel.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer", "data-line-link": "" } : {})}
        >
          {channel.display}
          {channel.href.startsWith("http") && <span className="sr-only"> (เปิดในแท็บใหม่)</span>}
        </a>
      ) : (
        <span className={`text-xl ${dark ? "text-paper/80" : "text-ink-soft"}`}>{channel.display}</span>
      )}
    </li>
  );
}

/** Phone, LINE (and optionally email + hours) from the central config. */
export function ContactChannels({
  tone = "dark",
  showEmail = false,
  showLine = true,
}: {
  tone?: "dark" | "light";
  showEmail?: boolean;
  /** Off where a fuller LINE block (QR + official button) sits next to the list. */
  showLine?: boolean;
}) {
  return (
    <div>
      {/* Only configured channels are shown; nothing placeholder-like reaches the public. */}
      <ul className="grid gap-3.5">
        {phoneChannel.href && <Channel icon={PhoneIcon} label="โทร" channel={phoneChannel} tone={tone} />}
        {showLine && lineChannel.href && <Channel icon={LineIcon} label="LINE" channel={lineChannel} tone={tone} />}
        {showEmail && emailChannel.href && <Channel icon={MailIcon} label="อีเมล" channel={emailChannel} tone={tone} />}
      </ul>
      {hoursText && (
        <p className={`mt-4 text-[0.9375rem] ${tone === "dark" ? "text-paper/80" : "text-ink-soft"}`}>เวลาทำการ: {hoursText}</p>
      )}
    </div>
  );
}

/**
 * LINE OA QR code: square, uncropped, on white with a quiet zone so phones can
 * scan it. Plain <img> so LINE's image is shown exactly as issued (not
 * re-encoded). Renders nothing until a QR image is configured.
 */
export function LineQr({ tone = "dark" }: { tone?: "dark" | "light" }) {
  if (!lineQrImage) return null;
  return (
    <figure className="m-0 w-fit">
      <div className={`rounded-2xl bg-paper p-4 ${tone === "light" ? "border border-line" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lineQrImage}
          width={180}
          height={180}
          alt="คิวอาร์โค้ดสำหรับเพิ่มเพื่อน LINE เช็กคุ้ม"
          loading="lazy"
          decoding="async"
          className="block size-[180px]"
        />
      </div>
      <figcaption className={`mt-2 text-center text-[0.9375rem] font-semibold ${tone === "dark" ? "text-paper" : "text-navy"}`}>
        สแกนเพื่อเพิ่มเพื่อน LINE
      </figcaption>
    </figure>
  );
}
