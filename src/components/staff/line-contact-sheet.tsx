import { updateCustomerLine } from "@/app/staff/_actions/crm";
import { formatDateTime } from "@/lib/crm-labels";
import { safeLineOaChatHref } from "@/lib/line-contact";
import { buttonClasses } from "../button";
import type { StaffContext } from "@/lib/server/staff-auth";
import { ActionForm } from "./action-form";
import { LineContactActions } from "./line-contact-actions";
import { LineOaChatInput } from "./line-oa-chat-input";
import { Empty, Field, KeyValue, Pill, Sheet } from "./ui";

type CustomerLine = {
  id: string;
  line_display_name: string | null;
  line_id: string | null;
  line_url: string | null;
  line_oa_chat_url: string | null;
  line_contact_source: string | null;
  line_contact_updated_at: string | null;
};

const sourceLabels: Record<string, string> = {
  staff_entry: "กรอกโดยเจ้าหน้าที่",
  web_form: "ลูกค้ากรอกในแบบฟอร์มขอใบเสนอราคา",
};

/**
 * "ข้อมูลติดต่อ LINE" for the customer page and the enquiry page. Shows:
 *  - the VERIFIED LINE account, only if the customer signed in with LINE
 *    (customer_line_accounts, written after LINE verified the ID token);
 *  - the customer's typed LINE details (shared by all their enquiries), always
 *    marked unverified, editable by agents and admins;
 *  - on an enquiry, what the visitor typed with that enquiry, read-only;
 *  - the LINE OA conversation link staff pasted (chat.line.biz). It opens the
 *    chat for staff signed in to LINE OA; it is not a LINE identity and never
 *    makes anything "verified".
 * Nothing here matches or links customers by LINE name, ID or phone.
 */
export async function LineContactSheet({
  staff,
  customer,
  enquiryLine,
  backTo,
}: {
  staff: StaffContext;
  customer: CustomerLine;
  enquiryLine?: { lineId: string | null; lineUrl: string | null } | null;
  backTo: string;
}) {
  const { data: account } = await staff.db.from("customer_accounts").select("user_id").eq("customer_id", customer.id).maybeSingle();
  const { data: verified } = account
    ? await staff.db.from("customer_line_accounts").select("display_name, linked_at").eq("user_id", account.user_id).maybeSingle()
    : { data: null };

  const oaChatHref = safeLineOaChatHref(customer.line_oa_chat_url);
  const hasTyped = Boolean(customer.line_display_name || customer.line_id || customer.line_url);
  const enquiryHasLine = Boolean(enquiryLine && (enquiryLine.lineId || enquiryLine.lineUrl));
  const enquiryDiffers =
    enquiryHasLine && (enquiryLine!.lineId !== customer.line_id || enquiryLine!.lineUrl !== customer.line_url);

  return (
    <Sheet title="ข้อมูลติดต่อ LINE" id="line-contact-title">
      <div data-line-contact className="grid gap-4">
        {verified && (
          <div className="rounded-[var(--radius-control)] bg-mint px-4 py-3" data-line-verified>
            <Pill tone="good">ยืนยันแล้วผ่าน LINE Login</Pill>
            <p className="mt-2">
              ชื่อใน LINE: <span className="font-semibold">{verified.display_name ?? "ไม่ระบุ"}</span>
            </p>
            <p className="text-[0.9375rem] text-ink-soft">เชื่อมบัญชีเมื่อ {formatDateTime(verified.linked_at)} ข้อมูลนี้มาจาก LINE โดยตรง แก้ไขที่นี่ไม่ได้</p>
          </div>
        )}

        <div>
          {hasTyped ? (
            <>
              <KeyValue
                items={[
                  ["ชื่อใน LINE", customer.line_display_name ?? <span className="text-ink-soft">-</span>],
                  ["LINE ID", customer.line_id ? <span className="font-semibold" data-line-id>{customer.line_id}</span> : <span className="text-ink-soft">-</span>],
                  ["ลิงก์โปรไฟล์ LINE", customer.line_url ? <span className="break-all">{customer.line_url}</span> : <span className="text-ink-soft">-</span>],
                ]}
              />
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink-soft">
                <Pill tone="warn">ยังไม่ยืนยัน</Pill>
                {customer.line_contact_source ? sourceLabels[customer.line_contact_source] : null}
                {customer.line_contact_updated_at && `, อัปเดต ${formatDateTime(customer.line_contact_updated_at)}`}
              </p>
            </>
          ) : (
            <Empty>ยังไม่มีข้อมูล LINE</Empty>
          )}
          <LineContactActions lineId={customer.line_id} lineUrl={customer.line_url} />
        </div>

        <div className="rounded-[var(--radius-control)] border border-line px-4 py-3" data-line-oa-chat>
          <h3 className="text-base text-navy">แชทใน LINE OA</h3>
          {oaChatHref ? (
            <a
              href={oaChatHref}
              target="_blank"
              rel="noopener noreferrer"
              data-line-oa-open
              className={`${buttonClasses("outline", "sm")} mt-2`}
            >
              เปิดแชท LINE OA
              <span className="sr-only"> (เปิดในแท็บใหม่)</span>
            </a>
          ) : (
            <button type="button" disabled className={`${buttonClasses("outline", "sm")} mt-2 cursor-not-allowed opacity-50`}>
              เปิดแชท LINE OA
            </button>
          )}
          <p className="mt-2 text-[0.9375rem] text-ink-soft">
            {oaChatHref
              ? "ต้องเข้าสู่ระบบ LINE OA ด้วยบัญชีที่มีสิทธิ์เข้าถึงแชทนี้ก่อน จึงจะเห็นบทสนทนา"
              : "ยังไม่มีลิงก์แชท LINE OA ที่บันทึกไว้"}
          </p>
        </div>

        {enquiryHasLine && enquiryDiffers && (
          <div className="rounded-[var(--radius-control)] border border-line px-4 py-3" data-enquiry-line>
            <h3 className="text-base text-navy">LINE ที่ส่งมากับคำขอนี้</h3>
            <p className="text-[0.9375rem] text-ink-soft">ตามที่ลูกค้ากรอกตอนส่งคำขอ ยังไม่ยืนยัน ถ้าใช้ได้ บันทึกเป็นข้อมูลลูกค้าด้านล่าง</p>
            <KeyValue
              items={[
                ["LINE ID", enquiryLine!.lineId ?? "-"],
                ["ลิงก์โปรไฟล์ LINE", enquiryLine!.lineUrl ? <span className="break-all">{enquiryLine!.lineUrl}</span> : "-"],
              ]}
            />
            <LineContactActions lineId={enquiryLine!.lineId} lineUrl={enquiryLine!.lineUrl} label="จากคำขอนี้" />
          </div>
        )}

        {staff.canWrite && (
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-base text-navy">แก้ไขข้อมูล LINE</h3>
            <ActionForm action={updateCustomerLine} submitLabel="บันทึกข้อมูล LINE" variant="outline">
              <input type="hidden" name="id" value={customer.id} />
              <input type="hidden" name="back_to" value={backTo} />
              <Field label="ชื่อใน LINE" htmlFor="line-display-name">
                <input id="line-display-name" name="line_display_name" defaultValue={customer.line_display_name ?? ""} maxLength={100} className="field-input" />
              </Field>
              <Field label="LINE ID" htmlFor="line-id" hint="LINE ID ที่ลูกค้าแจ้ง ใช้ค้นหาในแอป LINE">
                <input id="line-id" name="line_id" defaultValue={customer.line_id ?? ""} maxLength={51} autoCapitalize="none" spellCheck={false} className="field-input" />
              </Field>
              <Field label="ลิงก์โปรไฟล์ LINE" htmlFor="line-url" hint="ลิงก์โปรไฟล์หรือเพิ่มเพื่อนที่ลูกค้าส่งมา (https://line.me/… หรือ https://lin.ee/…)">
                <input id="line-url" name="line_url" type="url" inputMode="url" defaultValue={customer.line_url ?? ""} maxLength={300} autoCapitalize="none" spellCheck={false} className="field-input" />
              </Field>
              <LineOaChatInput defaultValue={customer.line_oa_chat_url} />
            </ActionForm>
          </div>
        )}
      </div>
    </Sheet>
  );
}
