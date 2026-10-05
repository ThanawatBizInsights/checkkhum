-- CheckKhum CRM: scheduled renewal job and internal staff reminders.
--
-- Renewal tasks are no longer created by a trigger when a policy is
-- activated. A daily pg_cron job (private.run_renewal_job) does it, so
-- policies loaded in bulk, back-dated or edited later are all picked up the
-- same way. Every step is idempotent: running the job twice creates nothing new.
--
-- Reminders are internal (shown in the staff CRM). Customer messaging is a
-- separate integration and is not part of this job.

drop trigger if exists create_renewal_task on public.policies;
drop function if exists private.create_renewal_task();

-- One renewal task per policy term (a renewal is a new policy row).
alter table public.renewal_tasks drop constraint if exists renewal_tasks_one_per_due_date;
create unique index renewal_tasks_one_per_policy on public.renewal_tasks (policy_id);

-- ---------------------------------------------------------------------------
-- Staff reminders. recipient null = team queue (no assignee yet).
-- ---------------------------------------------------------------------------
create table public.staff_reminders (
  id                 uuid primary key default gen_random_uuid(),
  recipient_id       uuid references public.staff_users (id) on delete cascade,
  kind               text not null check (kind in ('renewal_task_created', 'task_due')),
  renewal_task_id    uuid references public.renewal_tasks (id) on delete cascade,
  follow_up_task_id  uuid references public.follow_up_tasks (id) on delete cascade,
  message            text not null check (char_length(message) <= 500),
  due_date           date,
  created_at         timestamptz not null default now(),
  read_at            timestamptz,
  constraint staff_reminders_one_task check (num_nonnulls(renewal_task_id, follow_up_task_id) = 1),
  -- The same reminder is never created twice for the same task.
  constraint staff_reminders_unique unique nulls not distinct (kind, renewal_task_id, follow_up_task_id)
);
create index staff_reminders_recipient_idx on public.staff_reminders (recipient_id, created_at desc) where read_at is null;
create index staff_reminders_renewal_task_idx on public.staff_reminders (renewal_task_id);
create index staff_reminders_follow_up_task_idx on public.staff_reminders (follow_up_task_id);

-- ---------------------------------------------------------------------------
-- Job run log (visible to admins).
-- ---------------------------------------------------------------------------
create table public.renewal_job_runs (
  id                   bigint generated always as identity primary key,
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  run_date             date not null,
  lead_days            integer not null,
  policies_checked     integer not null default 0,
  tasks_created        integer not null default 0,
  reminders_created    integer not null default 0,
  triggered_by         uuid references public.staff_users (id) on delete set null,
  trigger_source       text not null check (trigger_source in ('schedule', 'manual'))
);
create index renewal_job_runs_started_idx on public.renewal_job_runs (started_at desc);
create index renewal_job_runs_triggered_by_idx on public.renewal_job_runs (triggered_by);

-- Dates in reminder text use the Thai Buddhist year, like the rest of the CRM.
create or replace function private.thai_date(d date)
returns text
language sql
immutable
set search_path = ''
as $$
  select to_char(d, 'DD/MM/') || (extract(year from d)::integer + 543)::text
$$;
revoke all on function private.thai_date(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The job. SECURITY DEFINER in the private schema; callable by the cron
-- scheduler (postgres) and, through public.run_renewal_job(), by admins only.
-- ---------------------------------------------------------------------------
create or replace function private.run_renewal_job(p_lead_days integer default 90, p_source text default 'schedule')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_run_id bigint;
  v_checked integer;
  v_tasks integer;
  v_reminders_new integer;
  v_reminders_due integer;
  v_reminders_follow integer;
begin
  if auth.uid() is not null and not private.is_admin() then
    raise exception 'only admins can run the renewal job' using errcode = '42501';
  end if;

  -- One run at a time; a second concurrent call waits, then finds nothing to do.
  perform pg_advisory_xact_lock(hashtextextended('checkkhum.renewal_job', 0));

  insert into public.renewal_job_runs (run_date, lead_days, triggered_by, trigger_source)
  values (v_today, p_lead_days, (select s.id from public.staff_users s where s.id = auth.uid()), p_source)
  returning id into v_run_id;

  select count(*) into v_checked
    from public.policies p
   where p.status = 'active' and p.end_date between v_today and v_today + p_lead_days;

  -- 1. Renewal tasks, due 30 days before expiry (or today if later), assigned
  --    to whoever handled the original enquiry. ON CONFLICT: never duplicates.
  with created as (
    insert into public.renewal_tasks (policy_id, assigned_to, due_date, notes)
    select p.id,
           (select e.assigned_to
              from public.quotations q
              join public.enquiries e on e.id = q.enquiry_id
             where q.id = p.quotation_id),
           greatest(p.end_date - 30, v_today),
           'สร้างโดยระบบเตือนต่ออายุ: กรมธรรม์หมดอายุ ' || private.thai_date(p.end_date)
      from public.policies p
     where p.status = 'active'
       and p.end_date between v_today and v_today + p_lead_days
    on conflict (policy_id) do nothing
    returning id
  )
  select count(*) into v_tasks from created;

  -- 2. "New renewal task" reminder for each task that has none yet.
  with created as (
    insert into public.staff_reminders (recipient_id, kind, renewal_task_id, message, due_date)
    select t.assigned_to, 'renewal_task_created', t.id,
           'งานต่ออายุใหม่: ' || c.full_name || ' กรมธรรม์ ' || p.policy_number ||
             ' หมดอายุ ' || private.thai_date(p.end_date),
           t.due_date
      from public.renewal_tasks t
      join public.policies p on p.id = t.policy_id
      join public.customers c on c.id = p.customer_id
     where t.status in ('open', 'in_progress')
    on conflict on constraint staff_reminders_unique do nothing
    returning id
  )
  select count(*) into v_reminders_new from created;

  -- 3. "Due" reminders for open renewal tasks due by tomorrow.
  with created as (
    insert into public.staff_reminders (recipient_id, kind, renewal_task_id, message, due_date)
    select t.assigned_to, 'task_due', t.id,
           'ถึงกำหนดติดต่อต่ออายุ: ' || c.full_name || ' กรมธรรม์ ' || p.policy_number,
           t.due_date
      from public.renewal_tasks t
      join public.policies p on p.id = t.policy_id
      join public.customers c on c.id = p.customer_id
     where t.status in ('open', 'in_progress') and t.due_date <= v_today + 1
    on conflict on constraint staff_reminders_unique do nothing
    returning id
  )
  select count(*) into v_reminders_due from created;

  -- 4. "Due" reminders for open follow-up tasks due by tomorrow.
  with created as (
    insert into public.staff_reminders (recipient_id, kind, follow_up_task_id, message, due_date)
    select t.assigned_to, 'task_due', t.id,
           'ถึงกำหนด: ' || t.title || ' (' || c.full_name || ')',
           t.due_date
      from public.follow_up_tasks t
      join public.customers c on c.id = t.customer_id
     where t.status in ('open', 'in_progress') and t.due_date <= v_today + 1
    on conflict on constraint staff_reminders_unique do nothing
    returning id
  )
  select count(*) into v_reminders_follow from created;

  update public.renewal_job_runs
     set finished_at = now(),
         policies_checked = v_checked,
         tasks_created = v_tasks,
         reminders_created = v_reminders_new + v_reminders_due + v_reminders_follow
   where id = v_run_id;

  return jsonb_build_object(
    'run_id', v_run_id, 'run_date', v_today, 'policies_checked', v_checked,
    'tasks_created', v_tasks, 'reminders_created', v_reminders_new + v_reminders_due + v_reminders_follow
  );
end;
$$;
revoke all on function private.run_renewal_job(integer, text) from public, anon, authenticated;
grant execute on function private.run_renewal_job(integer, text) to authenticated; -- checks is_admin() itself

-- API entry point for the admin "run now" button. SECURITY INVOKER: the
-- private function refuses anyone who is not an admin.
create or replace function public.run_renewal_job()
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.run_renewal_job(90, 'manual')
$$;
revoke all on function public.run_renewal_job() from public, anon;
grant execute on function public.run_renewal_job() to authenticated;

-- ---------------------------------------------------------------------------
-- Access control
-- ---------------------------------------------------------------------------
alter table public.staff_reminders enable row level security;
alter table public.renewal_job_runs enable row level security;
revoke all on public.staff_reminders, public.renewal_job_runs from public, anon, authenticated;
revoke truncate on public.staff_reminders, public.renewal_job_runs from service_role;

grant select on public.staff_reminders to authenticated;
grant update (read_at) on public.staff_reminders to authenticated;
grant select on public.renewal_job_runs to authenticated;

-- Your own reminders, plus the unassigned team queue.
create policy "Staff see their reminders and the team queue" on public.staff_reminders
  for select to authenticated
  using ((select private.is_staff()) and (recipient_id = (select auth.uid()) or recipient_id is null));
create policy "Staff mark their reminders read" on public.staff_reminders
  for update to authenticated
  using ((select private.is_staff()) and (recipient_id = (select auth.uid()) or recipient_id is null))
  with check ((select private.is_staff()) and (recipient_id = (select auth.uid()) or recipient_id is null));

create policy "Admins view job runs" on public.renewal_job_runs
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Schedule: daily at 06:05 Asia/Bangkok (23:05 UTC). pg_cron runs in UTC.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule(
  'checkkhum-renewal-job',
  '5 23 * * *',
  $$select private.run_renewal_job(90, 'schedule')$$
);
