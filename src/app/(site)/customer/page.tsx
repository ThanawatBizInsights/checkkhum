import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/button";
import { PolicyCard, type PortalDocument } from "@/components/customer/policy-card";
import { LineButton } from "@/components/line-links";
import { formatBaht, formatDate, productLabels } from "@/lib/crm-labels";
import { customerEnquiryStatus, customerQuotationStatus, type PortalOverview } from "@/lib/portal";
import { LineStatus, type LineLink } from "@/components/customer/line-status";
import { requireCustomer } from "@/lib/server/customer-auth";
import { getLineConfig, isLineLoginEmail } from "@/lib/server/line";

export const metadata: Metadata = { title: "บัญชีของฉัน", robots: { index: false, follow: false } };

export default async function CustomerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; verified?: string; line?: string }>;
}) {
  const customer = await requireCustomer();
  const { welcome, verified, line: lineParam } = await searchParams;

  const [{ data: overviewData }, { data: docs }, { data: lineRow }] = await Promise.all([
    customer.db.rpc("portal_overview"),
    // RLS returns only this customer's approved documents.
    customer.db.from("policy_documents").select("id, policy_id, kind, title, content_type, created_at").order("created_at", { ascending: false }),
    // RLS: only this login's own LINE link.
    customer.db.from("customer_line_accounts").select("display_name, picture_url").maybeSingle(),
  ]);
  const overview = overviewData as PortalOverview | null;
  const lineStatus = (
    <LineStatus
      line={(lineRow as LineLink) ?? null}
      lineEnabled={!!getLineConfig()}
      email={isLineLoginEmail(customer.email) ? null : customer.email}
      justLinked={lineParam === "linked"}
    />
  );

  if (!customer.linked || !overview?.linked) {
    return <NewCustomer overview={overview} lineStatus={lineStatus} verified={!!verified} />;
  }

  const docsByPolicy = new Map<string, PortalDocument[]>();
  for (const d of docs ?? []) docsByPolicy.set(d.policy_id, [...(docsByPolicy.get(d.policy_id) ?? []), d]);
  const openRequests = overview.enquiries.filter((e) => !["won", "lost"].includes(e.status));

  return (
    <>
      <section className="border-b border-line bg-sky py-8 md:py-12">
        <div className="wrap flex flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="text-[clamp(1.75rem,1.4rem+1.4vw,2.4rem)] leading-tight">สวัสดี คุณ{overview.customer.full_name}</h1>
            <p className="mt-2 max-w-[38em] text-ink-soft">
              {overview.policies.length > 0
                ? `คุณมีกรมธรรม์ ${overview.policies.length} ฉบับ${openRequests.length ? ` และคำขอที่กำลังดำเนินการ ${openRequests.length} รายการ` : ""}`
                : "ยังไม่มีกรมธรรม์ในบัญชีนี้"}
            </p>
            {lineStatus}
            {welcome && (
              <p role="status" className="mt-3 inline-block rounded-[var(--radius-control)] bg-mint px-3 py-1.5 text-[0.9375rem] text-teal-ink">
                ตั้งรหัสผ่านแล้ว ครั้งต่อไปเข้าสู่ระบบด้วยอีเมลและรหัสผ่านนี้
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <LineButton size="sm">คุยกับทีมงานผ่าน LINE</LineButton>
            <ButtonLink href="/quote" size="sm">
              ขอใบเสนอราคาใหม่
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="wrap grid gap-10 py-10">
        <section aria-labelledby="policies-title">
          <h2 id="policies-title" className="text-[1.5rem]">
            กรมธรรม์ของฉัน
          </h2>
          {overview.policies.length ? (
            <ul className="mt-4 grid gap-5 xl:grid-cols-2">
              {overview.policies.map((p) => (
                <li key={p.id} className="min-w-0">
                  <PolicyCard policy={p} documents={docsByPolicy.get(p.id) ?? []} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              เมื่อทำประกันกับเช็กคุ้มแล้ว กรมธรรม์ วันคุ้มครอง และเอกสารจะแสดงที่นี่
            </Empty>
          )}
        </section>

        <section aria-labelledby="requests-title">
          <h2 id="requests-title" className="text-[1.5rem]">
            คำขอของฉัน
          </h2>
          <EnquiryList enquiries={overview.enquiries} />
        </section>

        <section aria-labelledby="quotes-title">
          <h2 id="quotes-title" className="text-[1.5rem]">
            ใบเสนอราคา
          </h2>
          {overview.quotations.length ? (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {overview.quotations.map((q) => (
                <li key={q.id} className="min-w-0 rounded-[var(--radius-panel)] border-[1.5px] border-line bg-paper px-4 py-4 md:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-semibold text-navy">
                      {q.insurer}, {productLabels[q.product]}
                    </p>
                    <StatusChip done={q.status === "accepted"} closed={q.status === "declined" || q.status === "expired"}>
                      {customerQuotationStatus[q.status]}
                    </StatusChip>
                  </div>
                  <p className="mt-2 font-display text-2xl font-semibold text-navy">{formatBaht(q.premium)}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[0.9375rem]">
                    {q.sum_insured != null && (
                      <>
                        <dt className="text-ink-soft">ทุนประกัน</dt>
                        <dd>{formatBaht(q.sum_insured)}</dd>
                      </>
                    )}
                    {q.deductible != null && (
                      <>
                        <dt className="text-ink-soft">ค่าเสียหายส่วนแรก</dt>
                        <dd>{q.deductible > 0 ? formatBaht(q.deductible) : "ไม่มี"}</dd>
                      </>
                    )}
                    {q.repair_type && (
                      <>
                        <dt className="text-ink-soft">ซ่อม</dt>
                        <dd>{q.repair_type === "dealer" ? "ศูนย์บริการ" : "อู่ในเครือ"}</dd>
                      </>
                    )}
                    {q.valid_until && (
                      <>
                        <dt className="text-ink-soft">ราคานี้ใช้ได้ถึง</dt>
                        <dd>{formatDate(q.valid_until)}</dd>
                      </>
                    )}
                    <dt className="text-ink-soft">คำขอ</dt>
                    <dd>{q.enquiry_reference}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>ใบเสนอราคาที่ทีมงานส่งให้คุณจะแสดงที่นี่</Empty>
          )}
          {overview.quotations.some((q) => q.status === "sent") && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-ink-soft">ตกลงเลือกแผนไหน หรืออยากถามเพิ่ม แจ้งทีมงานได้เลย</p>
              <LineButton size="sm">ตอบทีมงานผ่าน LINE</LineButton>
            </div>
          )}
        </section>

        <section aria-labelledby="cars-title">
          <h2 id="cars-title" className="text-[1.5rem]">
            รถของฉัน
          </h2>
          {overview.vehicles.length ? (
            <ul className="mt-4 divide-y divide-line rounded-[var(--radius-panel)] border-[1.5px] border-line bg-paper">
              {overview.vehicles.map((v, i) => (
                <li key={i} className="px-4 py-3 md:px-5">
                  <p className="font-semibold text-navy">
                    {v.description}
                    {v.is_ev ? " (EV)" : ""}
                  </p>
                  <p className="text-[0.9375rem] text-ink-soft">
                    {[v.model_year ? `ปี ${v.model_year}` : null, v.registration_plate ? `ทะเบียน ${v.registration_plate}${v.plate_province ? ` ${v.plate_province}` : ""}` : null]
                      .filter(Boolean)
                      .join(", ") || "ยังไม่มีข้อมูลทะเบียน"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>ยังไม่มีข้อมูลรถในบัญชีนี้</Empty>
          )}
          <p className="mt-3 text-[0.9375rem] text-ink-soft">ข้อมูลรถไม่ถูกต้อง แจ้งทีมงานทาง LINE เพื่อแก้ไข</p>
        </section>
      </div>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-[var(--radius-panel)] bg-sky px-5 py-6 text-ink-soft">{children}</p>;
}

function StatusChip({ children, done, closed }: { children: React.ReactNode; done?: boolean; closed?: boolean }) {
  const tone = done ? "bg-teal text-paper" : closed ? "bg-line text-ink-soft" : "bg-mint text-teal-ink";
  return <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-0.5 text-[0.9375rem] font-semibold ${tone}`}>{children}</span>;
}

function EnquiryList({ enquiries }: { enquiries: PortalOverview["enquiries"] }) {
  return (
    <>
    {enquiries.length ? (
      <ul className="mt-4 divide-y divide-line rounded-[var(--radius-panel)] border-[1.5px] border-line bg-paper">
        {enquiries.map((e) => (
          <li key={e.reference} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 md:px-5">
            <div className="min-w-0">
              <p className="font-semibold text-navy">
                {e.renewal_policy_id ? "ขอต่ออายุ" : e.type === "quote" ? "ขอใบเสนอราคา" : "ติดต่อสอบถาม"}
                {e.product ? `, ${productLabels[e.product]}` : ""}
              </p>
              <p className="text-[0.9375rem] text-ink-soft">
                เลขอ้างอิง {e.reference}, ส่งเมื่อ {formatDate(e.created_at)}
              </p>
            </div>
            <StatusChip done={e.status === "won"} closed={e.status === "lost"}>
              {customerEnquiryStatus[e.status]}
            </StatusChip>
          </li>
        ))}
      </ul>
    ) : (
      <Empty>
        ยังไม่มีคำขอ <Link href="/quote" className="font-semibold text-teal-ink underline underline-offset-4">ขอใบเสนอราคา</Link> ได้ตลอดเวลา
      </Empty>
    )}
    </>
  );
}

/**
 * A login without a linked CRM customer: usually someone who just registered.
 * Shows their own requests and the way forward; never anyone's policies.
 */
function NewCustomer({ overview, lineStatus, verified }: { overview: PortalOverview | null; lineStatus: React.ReactNode; verified: boolean }) {
  const name = overview?.customer.full_name;
  const enquiries = overview?.enquiries ?? [];
  return (
    <>
      <section className="border-b border-line bg-sky py-8 md:py-12">
        <div className="wrap">
          <h1 className="text-[clamp(1.75rem,1.4rem+1.4vw,2.4rem)] leading-tight">{name ? `ยินดีต้อนรับ คุณ${name}` : "บัญชีของฉัน"}</h1>
          {lineStatus}
          {verified && (
            <p role="status" className="mt-3 inline-block rounded-[var(--radius-control)] bg-mint px-3 py-1.5 text-[0.9375rem] text-teal-ink">
              ยืนยันอีเมลแล้ว ครั้งต่อไปเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ตั้งไว้
            </p>
          )}
        </div>
      </section>

      <div className="wrap grid gap-10 py-10">
        <section aria-labelledby="start-title" className="rounded-[var(--radius-panel)] border-2 border-navy bg-paper px-5 py-7 md:p-8">
          <h2 id="start-title" className="text-[1.5rem]">
            {enquiries.length ? "ขอใบเสนอราคาเพิ่ม" : "เริ่มจากขอใบเสนอราคา"}
          </h2>
          <p className="mt-2 max-w-[38em]">
            บอกรุ่นรถหรือแผนเดินทาง เราจะเทียบแผนจากหลายบริษัทให้ ไม่มีค่าใช้จ่าย คำขอที่ส่งตอนเข้าสู่ระบบอยู่จะแสดงสถานะที่หน้านี้
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLink href="/quote">ขอใบเสนอราคา</ButtonLink>
            <LineButton>คุยกับทีมงานผ่าน LINE</LineButton>
          </div>
        </section>

        <section aria-labelledby="requests-title">
          <h2 id="requests-title" className="text-[1.5rem]">
            คำขอของฉัน
          </h2>
          <EnquiryList enquiries={enquiries} />
        </section>

        <section aria-labelledby="existing-title">
          <h2 id="existing-title" className="text-[1.5rem]">
            กรมธรรม์ของฉัน
          </h2>
          <Empty>
            ยังไม่มีกรมธรรม์ในบัญชีนี้ เคยทำประกันกับเช็กคุ้มแล้ว? แจ้งชื่อและเบอร์โทรทาง LINE ทีมงานจะตรวจสอบ แล้วส่งลิงก์เชิญ
            (ในแชท LINE หรือทางอีเมล) เพื่อเชื่อมกรมธรรม์ เอกสาร และวันต่ออายุเข้ากับบัญชีของคุณ
          </Empty>
        </section>
      </div>
    </>
  );
}
