import type { Metadata } from "next";
import Link from "next/link";
import { createCustomer } from "@/app/staff/_actions/crm";
import { ActionForm } from "@/components/staff/action-form";
import { OnlineAccountsSheet } from "@/components/staff/portal-sheets";
import { Empty, Field, PageTitle, Select, Sheet } from "@/components/staff/ui";
import { channelLabels, formatDate, formatPhone } from "@/lib/crm-labels";
import { requireStaff } from "@/lib/server/staff-auth";

export const metadata: Metadata = { title: "ลูกค้า" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const staff = await requireStaff();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);

  const { data: rows } = q
    ? await staff.db.rpc("search_customers", { p_query: q, p_limit: 50 })
    : await staff.db.from("customers").select("*").order("updated_at", { ascending: false }).limit(30);

  return (
    <>
      <PageTitle title="ลูกค้า" sub="ค้นหาด้วยชื่อ เบอร์โทร LINE ID ทะเบียนรถ หรือเลขที่คำขอ" />
      <div className="grid gap-5">
        <Sheet>
          <form role="search" className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[14rem] flex-1">
              <label htmlFor="q" className="mb-1 block text-[0.9375rem] font-semibold text-navy">
                ค้นหาลูกค้า
              </label>
              <input id="q" name="q" defaultValue={q} minLength={2} className="field-input" placeholder="เช่น สมมติ, 0812345678, 1กข 1234" />
            </div>
            <button type="submit" className="min-h-11 rounded-full bg-navy px-5 font-display font-semibold text-paper">
              ค้นหา
            </button>
          </form>
          <h2 className="mb-2 text-lg">{q ? `ผลการค้นหา "${q}"` : "ลูกค้าที่อัปเดตล่าสุด"}</h2>
          {rows?.length ? (
            <ul className="divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <Link href={`/staff/customers/${c.id}`} className="font-semibold text-navy hover:underline">
                    {c.full_name}
                  </Link>
                  <span className="text-[0.9375rem] text-ink-soft">
                    {formatPhone(c.phone)}
                    {c.line_id ? `, LINE ${c.line_id}` : ""}, ติดต่อทาง{channelLabels[c.preferred_channel]}, อัปเดต {formatDate(c.updated_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>{q ? "ไม่พบลูกค้า ลองค้นด้วยเบอร์โทรหรือทะเบียนรถ" : "ยังไม่มีลูกค้า"}</Empty>
          )}
        </Sheet>

        {staff.canWrite && (
          <Sheet title="เพิ่มลูกค้าที่ติดต่อทางโทรศัพท์หรือ LINE" id="new-customer-title">
            <p className="mb-3 text-[0.9375rem] text-ink-soft">ค้นหาก่อนเพื่อไม่ให้ซ้ำ ลูกค้าจากเว็บไซต์ถูกสร้างให้อัตโนมัติ</p>
            <ActionForm action={createCustomer} submitLabel="เพิ่มลูกค้า" className="grid gap-3 md:grid-cols-2">
              <Field label="ชื่อ-นามสกุล" htmlFor="full_name">
                <input id="full_name" name="full_name" required maxLength={120} className="field-input" />
              </Field>
              <Field label="เบอร์โทร" htmlFor="phone">
                <input id="phone" name="phone" type="tel" required className="field-input" />
              </Field>
              <Field label="LINE ID (ไม่บังคับ)" htmlFor="line_id">
                <input id="line_id" name="line_id" maxLength={60} className="field-input" />
              </Field>
              <Field label="อีเมล (ไม่บังคับ)" htmlFor="email">
                <input id="email" name="email" type="email" className="field-input" />
              </Field>
              <Field label="ติดต่อทาง" htmlFor="preferred_channel">
                <Select id="preferred_channel" name="preferred_channel" options={Object.entries(channelLabels).map(([value, label]) => ({ value, label }))} defaultValue="phone" />
              </Field>
            </ActionForm>
          </Sheet>
        )}
        <OnlineAccountsSheet staff={staff} />
      </div>
    </>
  );
}
