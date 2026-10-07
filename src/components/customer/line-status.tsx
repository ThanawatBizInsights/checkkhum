import Link from "next/link";
import { buttonClasses } from "../button";
import { LineIcon } from "../icons";

export type LineLink = { display_name: string | null; picture_url: string | null } | null;

/**
 * Dashboard line about LINE: who is signed in through LINE, or (for an email
 * account) a button to connect LINE so the Rich Menu opens the account directly.
 */
export function LineStatus({
  line,
  lineEnabled,
  email,
  justLinked,
}: {
  line: LineLink;
  lineEnabled: boolean;
  /** The account's email, or null for a LINE-only account. */
  email: string | null;
  justLinked: boolean;
}) {
  return (
    <div className="mt-3 grid gap-2">
      {justLinked && (
        <p role="status" className="inline-block justify-self-start rounded-[var(--radius-control)] bg-mint px-3 py-1.5 text-[0.9375rem] text-teal-ink">
          เชื่อมบัญชี LINE แล้ว ครั้งต่อไปเปิดจากเมนูในแชท LINE ของเช็กคุ้มได้เลย
        </p>
      )}
      {line ? (
        <p className="flex items-center gap-2.5 text-ink-soft">
          {line.picture_url ? (
            // LINE profile images are served by LINE's CDN as-is.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={line.picture_url} alt="" width={36} height={36} className="size-9 rounded-full border border-line object-cover" referrerPolicy="no-referrer" />
          ) : (
            <LineIcon className="size-7 shrink-0 text-line-brand" />
          )}
          <span>
            เชื่อมกับ LINE {line.display_name ? <span className="font-semibold text-navy">{line.display_name}</span> : null}
            {email ? <span className="block text-[0.9375rem]">และอีเมล {email}</span> : null}
          </span>
        </p>
      ) : (
        <>
          {email && <p className="text-ink-soft">บัญชี {email}</p>}
          {lineEnabled && email && (
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/line?link=1" className={`${buttonClasses("outline", "sm")} gap-2`}>
                <LineIcon className="size-5 shrink-0 text-line-brand" />
                เชื่อมบัญชี LINE
              </Link>
              <span className="text-[0.9375rem] text-ink-soft">เปิดบัญชีจากแชท LINE ได้โดยไม่ต้องใส่รหัสผ่าน</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
