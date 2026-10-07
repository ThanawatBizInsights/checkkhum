import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLineInviteLink,
  deletePolicyDocument,
  inviteCustomer,
  revokeInvitation,
  setDocumentVisibility,
  unlinkCustomerAccount,
  uploadPolicyDocument,
} from "@/app/staff/_actions/portal";
import { ActionForm } from "@/components/staff/action-form";
import { Empty, Field, Pill, Select, Sheet } from "@/components/staff/ui";
import { formatDate, formatDateTime } from "@/lib/crm-labels";
import type { Database } from "@/lib/database.types";
import { documentKindLabels } from "@/lib/portal";
import type { StaffContext } from "@/lib/server/staff-auth";

type Db = SupabaseClient<Database>;

/** Customer page: the customer's online account (invite, status, unlink). */
export async function CustomerPortalSheet({ staff, customerId, email }: { staff: StaffContext; customerId: string; email: string | null }) {
  const db: Db = staff.db;
  const [{ data: account }, { data: invitations }] = await Promise.all([
    db.from("customer_accounts").select("id, user_id, linked_at").eq("customer_id", customerId).maybeSingle(),
    db
      .from("customer_invitations")
      .select("id, email, created_at, expires_at, accepted_at, revoked_at, staff_users(full_name)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const now = new Date().toISOString();
  const open = invitations?.find((i) => !i.accepted_at && !i.revoked_at && i.expires_at > now);
  const { data: lineLink } = account
    ? await db.from("customer_line_accounts").select("display_name").eq("user_id", account.user_id).maybeSingle()
    : { data: null };

  return (
    <Sheet title="บัญชีลูกค้าออนไลน์" id="portal-title">
      {account ? (
        <>
          <p className="flex flex-wrap items-center gap-2">
            <Pill tone="good">เชื่อมบัญชีแล้ว</Pill>
            <span className="text-[0.9375rem] text-ink-soft">ตั้งแต่ {formatDateTime(account.linked_at)}</span>
            {lineLink && <Pill tone="good">LINE{lineLink.display_name ? `: ${lineLink.display_name}` : ""}</Pill>}
          </p>
          <p className="mt-2 text-[0.9375rem] text-ink-soft">
            ลูกค้าเห็นกรมธรรม์ ใบเสนอราคาที่ส่งแล้ว สถานะคำขอ รถ และเอกสารที่อนุมัติแล้ว ไม่เห็นหมายเหตุ งาน หรือประวัติการติดต่อภายใน
          </p>
          {staff.isAdmin && (
            <ActionForm action={unlinkCustomerAccount} submitLabel="ยกเลิกการเชื่อมบัญชี" variant="outline" confirmText="ยกเลิกการเชื่อมบัญชีนี้ ลูกค้าจะไม่เห็นข้อมูลอีก" className="mt-3 grid gap-2">
              <input type="hidden" name="id" value={account.id} />
              <input type="hidden" name="customer_id" value={customerId} />
            </ActionForm>
          )}
        </>
      ) : (
        <>
          {open ? (
            <p className="flex flex-wrap items-center gap-2">
              <Pill tone="warn">รอลูกค้ายืนยัน</Pill>
              <span className="text-[0.9375rem] text-ink-soft">
                {open.email ? `ส่งถึง ${open.email}` : "ลิงก์เชิญทาง LINE"} เมื่อ {formatDateTime(open.created_at)}, หมดอายุ {formatDate(open.expires_at)}
              </span>
            </p>
          ) : (
            <p className="text-[0.9375rem] text-ink-soft">ยังไม่มีบัญชีออนไลน์ ส่งคำเชิญเพื่อให้ลูกค้าดูกรมธรรม์ เอกสาร และวันต่ออายุเองได้</p>
          )}
          {staff.canWrite && (
            <>
              <ActionForm action={inviteCustomer} submitLabel={open ? "ส่งคำเชิญใหม่" : "ส่งคำเชิญ"} pendingLabel="กำลังส่ง" className="mt-3 grid gap-3">
                <input type="hidden" name="customer_id" value={customerId} />
                <Field label="อีเมลของลูกค้า" htmlFor="invite-email" hint="ใช้อีเมลที่ยืนยันกับลูกค้าแล้ว ลูกค้าต้องยืนยันอีเมลนี้ก่อน จึงจะเห็นข้อมูล">
                  <input id="invite-email" name="email" type="email" required defaultValue={open?.email ?? email ?? ""} className="field-input" />
                </Field>
              </ActionForm>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[0.9375rem] text-ink-soft">
                  ลูกค้าใช้ LINE ไม่มีอีเมล? สร้างลิงก์เชิญ แล้ววางในแชท LINE ของลูกค้ารายนี้ ลูกค้าเปิดลิงก์ในแอป LINE แล้วระบบจะเชื่อมข้อมูลให้
                </p>
                <ActionForm action={createLineInviteLink} submitLabel="สร้างลิงก์เชิญทาง LINE" pendingLabel="กำลังสร้าง" variant="outline" className="mt-2 grid gap-2 break-all">
                  <input type="hidden" name="customer_id" value={customerId} />
                </ActionForm>
              </div>
              {open && (
                <ActionForm action={revokeInvitation} submitLabel="ยกเลิกคำเชิญ" variant="quiet" className="mt-2 grid gap-2">
                  <input type="hidden" name="id" value={open.id} />
                  <input type="hidden" name="customer_id" value={customerId} />
                </ActionForm>
              )}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Policy page: documents, upload and customer approval. */
export async function PolicyDocumentsSheet({ staff, policyId }: { staff: StaffContext; policyId: string }) {
  const db: Db = staff.db;
  const { data: docs } = await db
    .from("policy_documents")
    .select("id, kind, title, content_type, size_bytes, visible_to_customer, approved_at, created_at")
    .eq("policy_id", policyId)
    .order("created_at", { ascending: false });

  return (
    <Sheet title="เอกสาร" id="docs-title">
      {docs?.length ? (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="grid gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a href={`/staff/documents/${d.id}`} className="font-semibold text-teal-ink underline underline-offset-4">
                  {documentKindLabels[d.kind]}: {d.title}
                </a>
                <Pill tone={d.visible_to_customer ? "good" : "neutral"}>{d.visible_to_customer ? "ลูกค้าเห็น" : "ยังไม่แสดงให้ลูกค้า"}</Pill>
              </div>
              <p className="text-[0.9375rem] text-ink-soft">
                {d.content_type === "application/pdf" ? "PDF" : "รูปภาพ"}, {Math.ceil(d.size_bytes / 1024)} KB, อัปโหลด {formatDateTime(d.created_at)}
                {d.approved_at ? `, อนุมัติ ${formatDateTime(d.approved_at)}` : ""}
              </p>
              {staff.canWrite && (
                <div className="flex flex-wrap gap-2">
                  <ActionForm action={setDocumentVisibility} submitLabel={d.visible_to_customer ? "ซ่อนจากลูกค้า" : "อนุมัติให้ลูกค้าเห็น"} variant={d.visible_to_customer ? "quiet" : "outline"} inline>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="policy_id" value={policyId} />
                    <input type="hidden" name="visible" value={String(!d.visible_to_customer)} />
                  </ActionForm>
                  <ActionForm action={deletePolicyDocument} submitLabel="ลบ" variant="quiet" confirmText="ลบเอกสารนี้ถาวร" inline>
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="policy_id" value={policyId} />
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>ยังไม่มีเอกสาร</Empty>
      )}

      {staff.canWrite && (
        <ActionForm action={uploadPolicyDocument} submitLabel="อัปโหลด" pendingLabel="กำลังอัปโหลด" resetOnSuccess className="mt-4 grid gap-3 border-t border-line pt-4">
          <input type="hidden" name="policy_id" value={policyId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ประเภท" htmlFor="doc-kind">
              <Select id="doc-kind" name="kind" required options={Object.entries(documentKindLabels).map(([value, label]) => ({ value, label }))} defaultValue="policy" />
            </Field>
            <Field label="ชื่อเอกสาร" htmlFor="doc-title">
              <input id="doc-title" name="title" required maxLength={120} className="field-input" placeholder="เช่น ตารางกรมธรรม์ 2569" />
            </Field>
          </div>
          <Field label="ไฟล์ (PDF, JPG หรือ PNG ไม่เกิน 10 MB)" htmlFor="doc-file">
            <input id="doc-file" name="file" type="file" required accept="application/pdf,image/jpeg,image/png" className="field-input" />
          </Field>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" name="visible_to_customer" className="size-5 accent-teal" />
            อนุมัติให้ลูกค้าเห็นทันที (ตรวจว่าเป็นเอกสารของลูกค้ารายนี้แล้ว)
          </label>
        </ActionForm>
      )}
    </Sheet>
  );
}

const profileSource: Record<string, string> = {
  self_registration: "สมัครเอง",
  invitation: "คำเชิญ",
  line: "LINE",
  other: "อื่น ๆ",
};

/** Customers page: newest online accounts, and whether each is linked to a CRM customer yet. */
export async function OnlineAccountsSheet({ staff }: { staff: StaffContext }) {
  const db: Db = staff.db;
  const [{ data: profiles }, { data: links }] = await Promise.all([
    db.from("customer_profiles").select("user_id, full_name, email, source, created_at").order("created_at", { ascending: false }).limit(15),
    db.from("customer_accounts").select("user_id, customer_id"),
  ]);
  const linkedTo = new Map((links ?? []).map((l) => [l.user_id, l.customer_id]));

  return (
    <Sheet title="บัญชีลูกค้าออนไลน์ล่าสุด" id="online-title">
      <p className="text-[0.9375rem] text-ink-soft">
        ลูกค้าที่สมัครเองหรือเข้าด้วย LINE เห็นเฉพาะคำขอที่ส่งตอนเข้าสู่ระบบ จะเห็นกรมธรรม์และเอกสารเมื่อทีมงานส่งคำเชิญจากหน้าข้อมูลลูกค้า
        (อีเมลที่ยืนยันกับลูกค้าแล้ว หรือลิงก์เชิญในแชท LINE ของลูกค้า)
      </p>
      {profiles?.length ? (
        <ul className="mt-3 divide-y divide-line">
          {profiles.map((p) => {
            const customerId = linkedTo.get(p.user_id);
            return (
              <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-semibold text-navy">{p.full_name}</p>
                  <p className="break-all text-[0.9375rem] text-ink-soft">
                    {p.email.endsWith("@line.checkkhum.invalid") ? "บัญชี LINE (ไม่มีอีเมล)" : p.email}, {profileSource[p.source] ?? p.source} {formatDate(p.created_at)}
                  </p>
                </div>
                {customerId ? (
                  <a href={`/staff/customers/${customerId}`} className="font-semibold text-teal-ink underline underline-offset-4">
                    เชื่อมแล้ว เปิดข้อมูลลูกค้า
                  </a>
                ) : (
                  <Pill tone="warn">ยังไม่เชื่อมข้อมูล</Pill>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>ยังไม่มีบัญชีออนไลน์</Empty>
      )}
    </Sheet>
  );
}
