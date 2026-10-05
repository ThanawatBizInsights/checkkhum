import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageTitle, Pill, Sheet } from "@/components/staff/ui";
import { addDays, bangkokToday, daysBetween, formatBaht, formatDate, policyStatusLabels, productLabels, taskStatusLabels } from "@/lib/crm-labels";
import { expiringCounts, horizons } from "@/lib/server/crm/queries";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "กรมธรรม์" };

const views = ["30", "60", "90", "active", "expired"] as const;
type View = (typeof views)[number];

export default async function PoliciesPage({ searchParams }: { searchParams: Promise<{ within?: string }> }) {
  const staff = await requireStaff();
  const raw = (await searchParams).within;
  const view: View = views.includes(raw as View) ? (raw as View) : "30";
  const today = bangkokToday();

  let query = staff.db
    .from("policies")
    .select("id, policy_number, product, start_date, end_date, premium, status, customers(id, full_name), insurers(name_th), renewal_tasks(id, status, due_date, staff_users(full_name))")
    .limit(200);
  if (view === "expired") {
    query = query.or("status.eq.expired,end_date.lt." + today).order("end_date", { ascending: false });
  } else {
    query = query.eq("status", "active").gte("end_date", today).order("end_date");
    if (view !== "active") query = query.lte("end_date", addDays(today, Number(view)));
  }

  const [{ data: rows }, counts] = await Promise.all([query, expiringCounts(staff.db)]);
  const tabLabel: Record<View, string> = {
    "30": `ภายใน 30 วัน (${counts[30]})`,
    "60": `ภายใน 60 วัน (${counts[60]})`,
    "90": `ภายใน 90 วัน (${counts[90]})`,
    active: "คุ้มครองอยู่ทั้งหมด",
    expired: "หมดอายุแล้ว",
  };

  return (
    <>
      <PageTitle title="กรมธรรม์" sub="ติดตามกรมธรรม์ที่ใกล้หมดอายุ งานต่ออายุถูกสร้างอัตโนมัติทุกวันสำหรับกรมธรรม์ที่หมดภายใน 90 วัน" />
      <nav aria-label="ช่วงเวลา" className="mb-4 flex flex-wrap gap-2">
        {views.map((v) => (
          <Link
            key={v}
            href={`/staff/policies?within=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={`min-h-11 rounded-full px-4 py-2 font-semibold ${view === v ? "bg-navy text-paper" : "bg-paper text-navy hover:bg-mint"}`}
          >
            {tabLabel[v]}
          </Link>
        ))}
      </nav>
      <p className="sr-only">จำนวนกรมธรรม์ที่หมดอายุ: {horizons.map((h) => `${h} วัน ${counts[h]} ฉบับ`).join(", ")}</p>
      <Sheet>
        {rows?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left">
              <caption className="sr-only">กรมธรรม์ {tabLabel[view]}</caption>
              <thead className="border-b-2 border-navy text-[0.9375rem] text-ink-soft">
                <tr>
                  <th className="py-2 pr-3 font-semibold">กรมธรรม์</th>
                  <th className="py-2 pr-3 font-semibold">หมดอายุ</th>
                  <th className="py-2 pr-3 font-semibold">ลูกค้า</th>
                  <th className="py-2 pr-3 font-semibold">เบี้ย</th>
                  <th className="py-2 font-semibold">งานต่ออายุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => {
                  const left = daysBetween(today, p.end_date);
                  // One renewal task per policy (unique index); PostgREST may embed it as an object or a list.
                  const task = Array.isArray(p.renewal_tasks) ? p.renewal_tasks[0] : p.renewal_tasks;
                  return (
                    <tr key={p.id} data-policy={p.policy_number}>
                      <td className="py-2.5 pr-3">
                        <Link href={`/staff/policies/${p.id}`} className="font-semibold text-navy hover:underline">
                          {p.policy_number}
                        </Link>
                        <span className="block text-sm text-ink-soft">
                          {productLabels[p.product]}, {p.insurers?.name_th}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {formatDate(p.end_date)}
                        <span className="mt-0.5 block">
                          {p.status === "active" && left >= 0 ? (
                            <Pill tone={left <= 30 ? "bad" : left <= 60 ? "warn" : "neutral"}>เหลือ {left} วัน</Pill>
                          ) : (
                            <Pill>{policyStatusLabels[p.status]}</Pill>
                          )}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        {p.customers ? (
                          <Link href={`/staff/customers/${p.customers.id}`} className="hover:underline">
                            {p.customers.full_name}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{formatBaht(p.premium)}</td>
                      <td className="py-2.5 text-[0.9375rem]">
                        {task ? (
                          <>
                            {taskStatusLabels[task.status]}, ครบกำหนด {formatDate(task.due_date)}
                            <span className="block text-ink-soft">{task.staff_users?.full_name ?? "ยังไม่มีผู้รับผิดชอบ"}</span>
                          </>
                        ) : (
                          <span className="text-ink-soft">{left <= 90 && p.status === "active" ? "รอระบบสร้างในรอบถัดไป" : "-"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>ไม่มีกรมธรรม์ในช่วงนี้</Empty>
        )}
      </Sheet>
    </>
  );
}
