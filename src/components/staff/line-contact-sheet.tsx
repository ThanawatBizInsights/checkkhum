import { formatDateTime } from "@/lib/crm-labels";
import type { StaffContext } from "@/lib/server/staff-auth";
import { LineContactCard } from "./line-contact-card";

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
 * Loads what "ติดต่อผ่าน LINE" shows on the customer and enquiry pages and
 * hands it to LineContactCard. The verified LINE account comes only from
 * customer_line_accounts (written after LINE verified an ID token); everything
 * else is typed by people and shown as unverified. Reads go through the staff
 * member's own client, so RLS applies; edits go through updateCustomerLine
 * (agent and admin only).
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

  const source = customer.line_contact_source ? sourceLabels[customer.line_contact_source] : null;
  const updated = customer.line_contact_updated_at ? `อัปเดต ${formatDateTime(customer.line_contact_updated_at)}` : null;
  const sourceNote = [source, updated].filter(Boolean).join(", ") || null;

  // Show what the visitor typed with this enquiry only when it adds something.
  const enquiryHasLine = Boolean(enquiryLine && (enquiryLine.lineId || enquiryLine.lineUrl));
  const enquiryDiffers =
    enquiryHasLine && (enquiryLine!.lineId !== customer.line_id || enquiryLine!.lineUrl !== customer.line_url);

  return (
    <LineContactCard
      customer={{
        id: customer.id,
        line_display_name: customer.line_display_name,
        line_id: customer.line_id,
        line_url: customer.line_url,
        line_oa_chat_url: customer.line_oa_chat_url,
      }}
      sourceNote={sourceNote}
      verified={verified ? { displayName: verified.display_name, linkedNote: `เชื่อมบัญชีเมื่อ ${formatDateTime(verified.linked_at)}` } : null}
      enquiryLine={enquiryDiffers ? enquiryLine! : null}
      canWrite={staff.canWrite}
      backTo={backTo}
    />
  );
}
