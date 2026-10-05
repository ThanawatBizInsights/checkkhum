import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageTitle, PipelineStrip, Sheet, StatusBadge } from "@/components/staff/ui";
import { enquiryStatusLabels, formatDateTime, formatPhone, productLabels, sourceLabels } from "@/lib/crm-labels";
import { enquiryStatusCounts, likeEscape } from "@/lib/server/crm/queries";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "คำขอ" };

const statuses = ["new", "contacted", "quoted", "won", "lost", "spam", "all"] as const;
type StatusFilter = (typeof statuses)[number];

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; mine?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const status: StatusFilter = statuses.includes(sp.status as StatusFilter) ? (sp.status as StatusFilter) : "new";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const mine = sp.mine === "1";

  let query = staff.db
    .from("enquiries")
    .select("id, reference, contact_name, contact_phone, product, source, status, created_at, staff_users(full_name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);
  if (mine) query = query.eq("assigned_to", staff.userId);
  if (q) {
    const digits = q.replace(/\D/g, "");
    if (/^ck-/i.test(q)) query = query.ilike("reference", `%${likeEscape(q)}%`);
    else if (digits.length >= 3 && digits.length === q.replace(/[\s-]/g, "").length) query = query.like("contact_phone", `%${digits}%`);
    else query = query.ilike("contact_name", `%${likeEscape(q)}%`);
  }

  const [{ data: rows }, counts] = await Promise.all([query, enquiryStatusCounts(staff.db)]);
  const href = (s: string) => {
    const p = new URLSearchParams({ status: s });
    if (mine) p.set("mine", "1");
    return `/staff/enquiries?${p}`;
  };

  return (
    <>
      <PageTitle
        title="คำขอ"
        sub="คำขอจากเว็บไซต์ โทรศัพท์ และ LINE"
        actions={
          staff.canWrite ? (
            <Link href="/staff/customers" className="font-semibold text-teal-ink underline underline-offset-4">
              บันทึกคำขอจากโทรศัพท์/LINE
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-5">
        <PipelineStrip counts={counts} hrefFor={href} active={status} />

        <Sheet>
          <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
            <input type="hidden" name="status" value={status} />
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="q" className="mb-1 block text-[0.9375rem] font-semibold text-navy">
                ค้นหาเลขที่คำขอ เบอร์โทร หรือชื่อ
              </label>
              <input id="q" name="q" defaultValue={q} className="field-input" placeholder="เช่น CK-261005 หรือ 0812345678" />
            </div>
            <label className="flex min-h-11 items-center gap-2 font-medium">
              <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="size-5 accent-teal" />
              เฉพาะที่มอบหมายให้ฉัน
            </label>
            <button type="submit" className="min-h-11 rounded-full bg-navy px-5 font-display font-semibold text-paper">
              ค้นหา
            </button>
          </form>

          <div className="mb-3 flex flex-wrap gap-2 text-[0.9375rem]">
            {(["spam", "all"] as const).map((s) => (
              <Link
                key={s}
                href={href(s)}
                aria-current={status === s ? "page" : undefined}
                className={`rounded-full px-3 py-1 font-semibold ${status === s ? "bg-navy text-paper" : "bg-sky text-navy"}`}
              >
                {s === "all" ? "ทุกสถานะ" : enquiryStatusLabels.spam}
              </Link>
            ))}
          </div>

          {rows?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left">
                <caption className="sr-only">รายการคำขอ สถานะ {status === "all" ? "ทั้งหมด" : enquiryStatusLabels[status]}</caption>
                <thead className="border-b-2 border-navy text-[0.9375rem] text-ink-soft">
                  <tr>
                    <th className="py-2 pr-3 font-semibold">ลูกค้า</th>
                    <th className="py-2 pr-3 font-semibold">ประกัน</th>
                    <th className="py-2 pr-3 font-semibold">ช่องทาง</th>
                    <th className="py-2 pr-3 font-semibold">ผู้รับผิดชอบ</th>
                    <th className="py-2 pr-3 font-semibold">เข้ามาเมื่อ</th>
                    <th className="py-2 font-semibold">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td className="py-2.5 pr-3">
                        <Link href={`/staff/enquiries/${e.id}`} className="font-semibold text-navy hover:underline">
                          {e.contact_name}
                        </Link>
                        <span className="block text-sm text-ink-soft">
                          {e.reference}, {formatPhone(e.contact_phone)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">{e.product ? productLabels[e.product] : productLabels.contact}</td>
                      <td className="py-2.5 pr-3">{sourceLabels[e.source]}</td>
                      <td className="py-2.5 pr-3">{e.staff_users?.full_name ?? <span className="text-ink-soft">ยังไม่มี</span>}</td>
                      <td className="py-2.5 pr-3 text-[0.9375rem]">{formatDateTime(e.created_at)}</td>
                      <td className="py-2.5">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>{q ? "ไม่พบคำขอที่ตรงกับคำค้นหา" : "ไม่มีคำขอในสถานะนี้"}</Empty>
          )}
        </Sheet>
      </div>
    </>
  );
}
