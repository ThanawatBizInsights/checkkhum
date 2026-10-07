import { requestRenewal } from "@/app/(site)/customer/_actions/portal";
import { ActionForm } from "@/components/staff/action-form";
import { bangkokToday, daysBetween, formatBaht, formatDate, productLabels } from "@/lib/crm-labels";
import { RENEWAL_WINDOW_DAYS, documentKindLabels, type PortalPolicy } from "@/lib/portal";

export type PortalDocument = { id: string; policy_id: string; kind: string; title: string; content_type: string; created_at: string };

const statusText: Record<PortalPolicy["status"], string> = {
  pending: "รอเริ่มคุ้มครอง",
  active: "คุ้มครองอยู่",
  expired: "หมดอายุแล้ว",
  cancelled: "ยกเลิกแล้ว",
};

/**
 * One policy: what is insured, the coverage period as a timeline with the
 * renewal window marked, documents, and the renewal request button.
 */
export function PolicyCard({ policy: p, documents }: { policy: PortalPolicy; documents: PortalDocument[] }) {
  const today = bangkokToday();
  const total = Math.max(daysBetween(p.start_date, p.end_date), 1);
  const elapsed = Math.min(Math.max(daysBetween(p.start_date, today), 0), total);
  const left = daysBetween(today, p.end_date);
  const renewFrom = Math.max(0, 100 - (RENEWAL_WINDOW_DAYS / total) * 100);
  const inWindow = p.status === "active" && left <= RENEWAL_WINDOW_DAYS;
  const canRenew = p.status === "active" || p.status === "expired";
  const v = p.vehicle;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-panel)] border-2 border-navy bg-navy text-paper">
      <div className="px-5 pb-5 pt-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[1.25rem] text-paper">{productLabels[p.product]}</h3>
            <p className="text-[0.9375rem] text-paper/80">
              {p.insurer}, กรมธรรม์เลขที่ {p.policy_number}
            </p>
          </div>
          <span
            className={`inline-flex whitespace-nowrap rounded-full px-3 py-0.5 text-[0.9375rem] font-semibold ${
              p.status === "active" ? (inWindow ? "bg-warn-bg text-warn" : "bg-mint text-teal-ink") : "bg-paper/15 text-paper"
            }`}
          >
            {p.status === "active" ? (left >= 0 ? (inWindow ? `ต่ออายุภายใน ${left} วัน` : statusText.active) : "เลยวันหมดอายุ") : statusText[p.status]}
          </span>
        </div>

        {v && (
          <p className="mt-3">
            {v.description}
            {v.is_ev ? " (EV)" : ""}
            {v.model_year ? ` ปี ${v.model_year}` : ""}
            {v.registration_plate ? `, ทะเบียน ${v.registration_plate}${v.plate_province ? ` ${v.plate_province}` : ""}` : ""}
          </p>
        )}

        {/* Coverage timeline: start → today → end, renewal window shaded. */}
        <div className="mt-5" aria-hidden="true">
          <div className="relative h-2.5 rounded-full bg-paper/15">
            <div className="absolute inset-y-0 rounded-r-full bg-warn-bg/35" style={{ left: `${renewFrom}%`, right: 0 }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-teal" style={{ width: `${(elapsed / total) * 100}%` }} />
          </div>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 text-[0.9375rem]">
          <div>
            <dt className="text-paper/70">เริ่มคุ้มครอง</dt>
            <dd className="font-semibold">{formatDate(p.start_date)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-paper/70">ครบกำหนดต่ออายุ</dt>
            <dd className="font-semibold">{formatDate(p.end_date)}</dd>
          </div>
        </dl>
        <p className="sr-only">
          คุ้มครองตั้งแต่ {formatDate(p.start_date)} ถึง {formatDate(p.end_date)} {left >= 0 ? `เหลืออีก ${left} วัน` : "หมดอายุแล้ว"}
        </p>
        <p className="mt-3 text-[0.9375rem] text-paper/80">เบี้ยประกันปีนี้ {formatBaht(p.premium)}</p>
      </div>

      <div className="mt-auto grid gap-4 bg-paper px-5 py-4 text-ink md:px-6">
        <div>
          <h4 className="text-base text-navy">เอกสาร</h4>
          {documents.length ? (
            <ul className="mt-1 grid gap-1">
              {documents.map((d) => (
                <li key={d.id}>
                  <a
                    href={`/customer/documents/${d.id}`}
                    className="inline-flex min-h-11 items-center gap-2 font-semibold text-teal-ink underline underline-offset-4"
                  >
                    {documentKindLabels[d.kind] ?? d.kind}: {d.title}
                    <span className="text-[0.9375rem] font-normal text-ink-soft no-underline">
                      ({d.content_type === "application/pdf" ? "PDF" : "รูปภาพ"})
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[0.9375rem] text-ink-soft">ยังไม่มีเอกสาร ทีมงานจะอัปโหลดตารางกรมธรรม์และใบเสร็จเมื่อพร้อม</p>
          )}
        </div>

        {canRenew &&
          (p.open_renewal_reference ? (
            <p className="rounded-[var(--radius-control)] bg-mint px-3 py-2 text-[0.9375rem] text-teal-ink">
              ส่งคำขอต่ออายุแล้ว เลขอ้างอิง {p.open_renewal_reference} ทีมงานจะติดต่อกลับพร้อมใบเสนอราคา
            </p>
          ) : (
            <ActionForm action={requestRenewal} submitLabel="ขอใบเสนอราคาต่ออายุ" pendingLabel="กำลังส่งคำขอ" variant={inWindow ? "primary" : "outline"} className="grid gap-2">
              <input type="hidden" name="policy_id" value={p.id} />
            </ActionForm>
          ))}
      </div>
    </article>
  );
}
