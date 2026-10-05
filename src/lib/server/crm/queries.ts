import "server-only";
import { addDays, bangkokToday } from "@/lib/crm-labels";
import type { StaffContext } from "../staff-auth";

type Db = StaffContext["db"];

export async function staffOptions(db: Db) {
  const { data } = await db.from("staff_users").select("id, full_name, role").eq("is_active", true).order("full_name");
  return (data ?? []).map((s) => ({ value: s.id, label: s.full_name }));
}

export async function insurerOptions(db: Db) {
  const { data } = await db.from("insurers").select("id, name_th").eq("is_active", true).order("name_th");
  return (data ?? []).map((i) => ({ value: i.id, label: i.name_th }));
}

export type TaskRow = {
  kind: "follow_up" | "renewal";
  id: string;
  title: string;
  due_date: string;
  status: string;
  assigned_to: string | null;
  assignee: string | null;
  customer_id: string | null;
  customer_name: string | null;
  link: string;
};

/** Open follow-up and renewal tasks, merged and sorted by due date. */
export async function openTasks(
  db: Db,
  filter: { assignedTo?: string | null; dueBy?: string; enquiryId?: string; customerId?: string; policyId?: string } = {},
): Promise<TaskRow[]> {
  let fq = db
    .from("follow_up_tasks")
    .select("id, title, due_date, status, assigned_to, customer_id, enquiry_id, customers(full_name), staff_users!follow_up_tasks_assigned_to_fkey(full_name)")
    .in("status", ["open", "in_progress"])
    .order("due_date")
    .limit(200);
  let rq = db
    .from("renewal_tasks")
    .select("id, due_date, status, assigned_to, policy_id, policies!inner(policy_number, end_date, customer_id, customers(full_name)), staff_users(full_name)")
    .in("status", ["open", "in_progress"])
    .order("due_date")
    .limit(200);
  if (filter.assignedTo === null) {
    fq = fq.is("assigned_to", null);
    rq = rq.is("assigned_to", null);
  } else if (filter.assignedTo) {
    fq = fq.eq("assigned_to", filter.assignedTo);
    rq = rq.eq("assigned_to", filter.assignedTo);
  }
  if (filter.enquiryId) fq = fq.eq("enquiry_id", filter.enquiryId);
  if (filter.customerId) {
    fq = fq.eq("customer_id", filter.customerId);
    rq = rq.eq("policies.customer_id", filter.customerId);
  }
  if (filter.policyId) {
    fq = fq.eq("policy_id", filter.policyId);
    rq = rq.eq("policy_id", filter.policyId);
  }
  if (filter.dueBy) {
    fq = fq.lte("due_date", filter.dueBy);
    rq = rq.lte("due_date", filter.dueBy);
  }
  // Renewal tasks belong to policies, not enquiries.
  const [{ data: f }, { data: r }] = await Promise.all([fq, filter.enquiryId ? Promise.resolve({ data: [] as never[] }) : rq]);
  const rows: TaskRow[] = [
    ...(f ?? []).map((t) => ({
      kind: "follow_up" as const,
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      status: t.status,
      assigned_to: t.assigned_to,
      assignee: t.staff_users?.full_name ?? null,
      customer_id: t.customer_id,
      customer_name: t.customers?.full_name ?? null,
      link: t.enquiry_id ? `/staff/enquiries/${t.enquiry_id}` : `/staff/customers/${t.customer_id}`,
    })),
    ...(r ?? []).map((t) => ({
      kind: "renewal" as const,
      id: t.id,
      title: `ต่ออายุกรมธรรม์ ${t.policies?.policy_number ?? ""}`,
      due_date: t.due_date,
      status: t.status,
      assigned_to: t.assigned_to,
      assignee: t.staff_users?.full_name ?? null,
      customer_id: t.policies?.customer_id ?? null,
      customer_name: t.policies?.customers?.full_name ?? null,
      link: `/staff/policies/${t.policy_id}`,
    })),
  ];
  return rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export const horizons = [30, 60, 90] as const;

/** Count of active policies ending within each horizon (from today, Bangkok). */
export async function expiringCounts(db: Db): Promise<Record<number, number>> {
  const today = bangkokToday();
  const results = await Promise.all(
    horizons.map((d) =>
      db
        .from("policies")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gte("end_date", today)
        .lte("end_date", addDays(today, d)),
    ),
  );
  return Object.fromEntries(horizons.map((d, i) => [d, results[i].count ?? 0]));
}

export async function enquiryStatusCounts(db: Db): Promise<Record<string, number>> {
  const statuses = ["new", "contacted", "quoted", "won", "lost"] as const;
  const results = await Promise.all(
    statuses.map((s) => db.from("enquiries").select("id", { count: "exact", head: true }).eq("status", s)),
  );
  return Object.fromEntries(statuses.map((s, i) => [s, results[i].count ?? 0]));
}

/** Escape LIKE wildcards in user input. */
export function likeEscape(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}
