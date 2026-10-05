import Link from "next/link";
import { assignTask, setTaskStatus } from "@/app/staff/_actions/crm";
import { bangkokToday, daysBetween, formatDate, taskStatusLabels } from "@/lib/crm-labels";
import type { TaskRow } from "@/lib/server/crm/queries";
import { ActionForm } from "./action-form";
import { Empty, Pill } from "./ui";

function dueTone(due: string, today: string) {
  const d = daysBetween(today, due);
  if (d < 0) return { tone: "bad" as const, text: `เลยกำหนด ${-d} วัน` };
  if (d === 0) return { tone: "warn" as const, text: "วันนี้" };
  if (d === 1) return { tone: "warn" as const, text: "พรุ่งนี้" };
  return { tone: "neutral" as const, text: formatDate(due) };
}

export function TaskList({
  tasks,
  canWrite,
  staffOptions,
  showAssign = false,
  empty = "ไม่มีงานค้าง",
}: {
  tasks: TaskRow[];
  canWrite: boolean;
  staffOptions?: { value: string; label: string }[];
  showAssign?: boolean;
  empty?: string;
}) {
  const today = bangkokToday();
  if (!tasks.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const due = dueTone(t.due_date, today);
        return (
          <li key={`${t.kind}-${t.id}`} className="grid gap-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" data-task={t.kind}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={due.tone}>{due.text}</Pill>
                <Pill>{t.kind === "renewal" ? "ต่ออายุ" : "ติดตาม"}</Pill>
                {t.status === "in_progress" && <Pill tone="good">{taskStatusLabels.in_progress}</Pill>}
              </div>
              <Link href={t.link} className="mt-1 block font-semibold text-navy hover:underline">
                {t.title}
              </Link>
              <p className="text-[0.9375rem] text-ink-soft">
                {t.customer_name ?? "-"}, {t.assignee ? `ผู้รับผิดชอบ ${t.assignee}` : "ยังไม่มีผู้รับผิดชอบ"}
              </p>
            </div>
            {canWrite && (
              <div className="flex flex-wrap items-start gap-2">
                {showAssign && staffOptions && (
                  <ActionForm action={assignTask} submitLabel="มอบหมาย" variant="outline" className="flex items-start gap-2">
                    <input type="hidden" name="kind" value={t.kind} />
                    <input type="hidden" name="id" value={t.id} />
                    <label className="sr-only" htmlFor={`assign-${t.id}`}>
                      ผู้รับผิดชอบ
                    </label>
                    <select id={`assign-${t.id}`} name="assigned_to" defaultValue={t.assigned_to ?? ""} className="field-input min-h-11 py-1.5">
                      <option value="">ไม่ระบุ</option>
                      {staffOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </ActionForm>
                )}
                {t.status === "open" && (
                  <ActionForm action={setTaskStatus} submitLabel="เริ่มทำ" variant="outline" inline>
                    <input type="hidden" name="kind" value={t.kind} />
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value="in_progress" />
                  </ActionForm>
                )}
                <ActionForm action={setTaskStatus} submitLabel="ทำเสร็จแล้ว" inline>
                  <input type="hidden" name="kind" value={t.kind} />
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="status" value="done" />
                </ActionForm>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
