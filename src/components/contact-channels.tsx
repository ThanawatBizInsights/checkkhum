import Image from "next/image";
import { siteConfig } from "@/config/site";
import { emailChannel, hoursText, lineChannel, phoneChannel, type ContactChannel } from "@/lib/contact";
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
export function ContactChannels({ tone = "dark", showEmail = false }: { tone?: "dark" | "light"; showEmail?: boolean }) {
  return (
    <div>
      <ul className="grid gap-3.5">
        <Channel icon={PhoneIcon} label="โทร" channel={phoneChannel} tone={tone} />
        <Channel icon={LineIcon} label="LINE" channel={lineChannel} tone={tone} />
        {showEmail && <Channel icon={MailIcon} label="อีเมล" channel={emailChannel} tone={tone} />}
      </ul>
      <p className={`mt-4 text-[0.9375rem] ${tone === "dark" ? "text-paper/80" : "text-ink-soft"}`}>เวลาทำการ: {hoursText}</p>
    </div>
  );
}

export function LineQr({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const src = siteConfig.contact.lineQrImage;
  return (
    <figure className="m-0">
      <div className={`grid size-40 place-items-center rounded-2xl bg-paper p-2.5 ${tone === "light" ? "border border-line" : ""}`}>
        {src ? (
          <Image src={src} width={140} height={140} alt="QR code สำหรับเพิ่มเพื่อนทาง LINE" className="size-full object-contain" />
        ) : (
          <span className="text-center text-sm text-ink-soft">พื้นที่สำหรับ QR LINE</span>
        )}
      </div>
      <figcaption className={`mt-2 text-[0.9375rem] ${tone === "dark" ? "text-paper/85" : "text-ink-soft"}`}>สแกนเพื่อเพิ่มเพื่อนทาง LINE</figcaption>
    </figure>
  );
}
