import { activityTypeLabels, addDays, bangkokToday, formatDateTime } from "@/lib/crm-labels";
import { ActionForm, type ActionResult } from "./action-form";
import { Empty, Field, Select } from "./ui";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

type Activity = {
  id: string;
  activity_type: string;
  summary: string;
  outcome: string | null;
  occurred_at: string;
  staff_users: { full_name: string } | null;
};

export function ActivityList({ activities }: { activities: Activity[] }) {
  if (!activities.length) return <Empty>ยังไม่มีบันทึก</Empty>;
  return (
    <ol className="mt-4 grid gap-4 border-l-2 border-line pl-4">
      {activities.map((a) => (
        <li key={a.id} className="relative">
          <span aria-hidden="true" className="absolute -left-[1.4rem] top-2 size-2.5 rounded-full bg-teal" />
          <p className="text-[0.9375rem] text-ink-soft">
            {formatDateTime(a.occurred_at)}, {activityTypeLabels[a.activity_type]}, {a.staff_users?.full_name ?? "ระบบ"}
          </p>
          <p className="whitespace-pre-line">{a.summary}</p>
          {a.outcome && <p className="text-[0.9375rem] font-semibold text-teal-ink">ผล: {a.outcome}</p>}
        </li>
      ))}
    </ol>
  );
}

const activityOptions = Object.entries(activityTypeLabels).map(([value, label]) => ({ value, label }));

export function ActivityForm({
  action,
  customerId,
  enquiryId,
  policyId,
  backTo,
}: {
  action: Action;
  customerId: string;
  enquiryId?: string;
  policyId?: string;
  backTo: string;
}) {
  const p = policyId ?? enquiryId ?? customerId;
  return (
    <ActionForm action={action} submitLabel="บันทึก" resetOnSuccess className="grid gap-3 rounded-[var(--radius-control)] bg-sky p-3">
      <input type="hidden" name="customer_id" value={customerId} />
      {enquiryId && <input type="hidden" name="enquiry_id" value={enquiryId} />}
      {policyId && <input type="hidden" name="policy_id" value={policyId} />}
      <input type="hidden" name="back_to" value={backTo} />
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="ช่องทาง" htmlFor={`at-${p}`}>
          <Select id={`at-${p}`} name="activity_type" options={activityOptions} defaultValue="call" />
        </Field>
        <Field label="ผลการติดต่อ (ไม่บังคับ)" htmlFor={`ao-${p}`}>
          <input id={`ao-${p}`} name="outcome" maxLength={200} className="field-input" placeholder="เช่น ขอเวลาคิด, ไม่รับสาย" />
        </Field>
      </div>
      <Field label="บันทึก" htmlFor={`as-${p}`}>
        <textarea id={`as-${p}`} name="summary" required maxLength={2000} rows={3} className="field-input" />
      </Field>
    </ActionForm>
  );
}

export function TaskForm({
  action,
  customerId,
  enquiryId,
  policyId,
  staffOptions,
  defaultAssignee,
  backTo,
}: {
  action: Action;
  customerId: string;
  enquiryId?: string;
  policyId?: string;
  staffOptions: { value: string; label: string }[];
  defaultAssignee?: string;
  backTo: string;
}) {
  const p = policyId ?? enquiryId ?? customerId;
  return (
    <details className="mt-4 rounded-[var(--radius-control)] border border-line px-3 py-2">
      <summary className="cursor-pointer font-semibold text-navy">เพิ่มงานติดตาม</summary>
      <ActionForm action={action} submitLabel="เพิ่มงาน" resetOnSuccess className="mt-3 grid gap-3">
        <input type="hidden" name="customer_id" value={customerId} />
        {enquiryId && <input type="hidden" name="enquiry_id" value={enquiryId} />}
        {policyId && <input type="hidden" name="policy_id" value={policyId} />}
        <input type="hidden" name="back_to" value={backTo} />
        <Field label="สิ่งที่ต้องทำ" htmlFor={`tt-${p}`}>
          <input id={`tt-${p}`} name="title" required maxLength={200} className="field-input" placeholder="เช่น โทรถามผลการตัดสินใจ" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ครบกำหนด" htmlFor={`td-${p}`}>
            <input id={`td-${p}`} name="due_date" type="date" required defaultValue={addDays(bangkokToday(), 2)} className="field-input" />
          </Field>
          <Field label="ผู้รับผิดชอบ" htmlFor={`ta-${p}`}>
            <Select id={`ta-${p}`} name="assigned_to" options={staffOptions} defaultValue={defaultAssignee} placeholder="ไม่ระบุ" />
          </Field>
        </div>
      </ActionForm>
    </details>
  );
}
