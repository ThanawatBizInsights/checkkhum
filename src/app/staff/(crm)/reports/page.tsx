import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageTitle, Sheet } from "@/components/staff/ui";
import { addDays, bangkokToday, formatBaht, formatDate, productLabels, sourceLabels } from "@/lib/crm-labels";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "รายงาน" };

type Breakdown = { key: string; enquiries: number; won: number };
type Report = {
  enquiries: number;
  contacted: number;
  quoted: number;
  won: number;
  lost: number;
  open: number;
  quotations_sent: number;
  policies: number;
  premium_won: number;
  avg_hours_to_quote: number | null;
  by_product: Breakdown[];
  by_source: Breakdown[];
};

const isDate = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "-");

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const today = bangkokToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const from = isDate(sp.from) ? sp.from : addDays(today, -89);
  const to = isDate(sp.to) && sp.to >= from ? sp.to : today;

  const { data, error } = await staff.db.rpc("crm_conversion_report", { p_from: from, p_to: to });
  const r = data as unknown as Report | null;

  const presets = [
    { label: "เดือนนี้", from: monthStart, to: today },
    { label: "30 วันล่าสุด", from: addDays(today, -29), to: today },
    { label: "90 วันล่าสุด", from: addDays(today, -89), to: today },
    { label: "ปีนี้", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];

  // Funnel: each stage as a share of all enquiries in the period.
  const funnel = r
    ? [
        { label: "คำขอทั้งหมด", n: r.enquiries },
        { label: "ติดต่อแล้ว", n: r.contacted },
        { label: "เสนอราคาแล้ว", n: r.quoted },
        { label: "ปิดการขาย", n: r.won },
      ]
    : [];

  return (
    <>
      <PageTitle title="รายงานคำขอและยอดขาย" sub={`คำขอที่เข้ามาระหว่าง ${formatDate(from)} ถึง ${formatDate(to)} (ไม่รวมสแปม)`} />

      <Sheet>
        <div className="flex flex-wrap items-end gap-3">
          {presets.map((p) => (
            <Link
              key={p.label}
              href={`/staff/reports?from=${p.from}&to=${p.to}`}
              aria-current={p.from === from && p.to === to ? "page" : undefined}
              className={`min-h-11 rounded-full px-4 py-2 font-semibold ${p.from === from && p.to === to ? "bg-navy text-paper" : "bg-sky text-navy hover:bg-mint"}`}
            >
              {p.label}
            </Link>
          ))}
          <form className="flex flex-wrap items-end gap-2">
            <label className="text-[0.9375rem] font-semibold text-navy">
              ตั้งแต่
              <input type="date" name="from" defaultValue={from} className="field-input mt-1" />
            </label>
            <label className="text-[0.9375rem] font-semibold text-navy">
              ถึง
              <input type="date" name="to" defaultValue={to} className="field-input mt-1" />
            </label>
            <button type="submit" className="min-h-11 rounded-full bg-navy px-5 font-display font-semibold text-paper">
              ดูรายงาน
            </button>
          </form>
        </div>
      </Sheet>

      {error || !r ? (
        <p role="alert" className="mt-5 text-error">
          โหลดรายงานไม่สำเร็จ
        </p>
      ) : r.enquiries === 0 ? (
        <div className="mt-5">
          <Empty>ไม่มีคำขอในช่วงเวลานี้ ลองเลือกช่วงที่ยาวขึ้น</Empty>
        </div>
      ) : (
        <div className="mt-5 grid gap-5">
          <Sheet title="ขั้นตอนการขาย" id="funnel-title">
            <ol className="grid gap-3" data-report="funnel">
              {funnel.map((s) => (
                <li key={s.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_auto] items-center gap-3">
                  <span className="font-semibold text-navy">{s.label}</span>
                  {/* Single series: one hue; value is printed beside the bar, so identity never relies on colour. */}
                  <span className="h-6 bg-sky" aria-hidden="true" title={`${s.label}: ${s.n} (${pct(s.n, r.enquiries)})`}>
                    <span
                      className="block h-full rounded-r-[4px] bg-navy"
                      style={{ width: `${Math.max((s.n / r.enquiries) * 100, s.n ? 2 : 0)}%` }}
                    />
                  </span>
                  <span className="min-w-[5.5rem] text-right font-display text-lg font-semibold text-navy" data-stage={s.label}>
                    {s.n} <span className="text-[0.9375rem] font-normal text-ink-soft">({pct(s.n, r.enquiries)})</span>
                  </span>
                </li>
              ))}
            </ol>
            <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-[0.9375rem] text-ink-soft">อัตราปิดการขาย (จากคำขอที่ปิดแล้ว)</dt>
                <dd className="font-display text-2xl font-semibold text-navy" data-metric="win-rate">{pct(r.won, r.won + r.lost)}</dd>
              </div>
              <div>
                <dt className="text-[0.9375rem] text-ink-soft">ยังเปิดอยู่</dt>
                <dd className="font-display text-2xl font-semibold text-navy">{r.open}</dd>
              </div>
              <div>
                <dt className="text-[0.9375rem] text-ink-soft">เบี้ยจากการขายที่ปิดได้</dt>
                <dd className="font-display text-2xl font-semibold text-navy">{formatBaht(r.premium_won)}</dd>
              </div>
              <div>
                <dt className="text-[0.9375rem] text-ink-soft">เวลาเฉลี่ยจนเสนอราคา</dt>
                <dd className="font-display text-2xl font-semibold text-navy">{r.avg_hours_to_quote != null ? `${r.avg_hours_to_quote} ชม.` : "-"}</dd>
              </div>
            </dl>
          </Sheet>

          <div className="grid gap-5 xl:grid-cols-2">
            {[
              { title: "แยกตามประเภทประกัน", rows: r.by_product, labels: productLabels, id: "by-product" },
              { title: "แยกตามช่องทาง", rows: r.by_source, labels: sourceLabels, id: "by-source" },
            ].map((t) => (
              <Sheet key={t.id} title={t.title} id={t.id}>
                <table className="w-full text-left">
                  <thead className="border-b-2 border-navy text-[0.9375rem] text-ink-soft">
                    <tr>
                      <th className="py-2 font-semibold">{t.id === "by-product" ? "ประเภท" : "ช่องทาง"}</th>
                      <th className="py-2 text-right font-semibold">คำขอ</th>
                      <th className="py-2 text-right font-semibold">ปิดการขาย</th>
                      <th className="py-2 text-right font-semibold">อัตรา</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {t.rows.map((row) => (
                      <tr key={row.key}>
                        <td className="py-2">{t.labels[row.key] ?? row.key}</td>
                        <td className="py-2 text-right">{row.enquiries}</td>
                        <td className="py-2 text-right">{row.won}</td>
                        <td className="py-2 text-right">{pct(row.won, row.enquiries)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Sheet>
            ))}
          </div>
          <p className="text-[0.9375rem] text-ink-soft">
            ใบเสนอราคาที่ส่งในช่วงนี้ {r.quotations_sent} รายการ, ออกกรมธรรม์ {r.policies} ฉบับ
          </p>
        </div>
      )}
    </>
  );
}
