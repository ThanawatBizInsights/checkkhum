-- CheckKhum CRM: enquiry workflow, follow-up tasks, search and reporting.

-- ---------------------------------------------------------------------------
-- Stamp the acting staff user on rows they create, so nobody can log a note
-- or task in a colleague's name. Server/system writes (no auth.uid()) keep
-- whatever value they supplied.
-- ---------------------------------------------------------------------------
create or replace function private.stamp_author()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_column text := tg_argv[0];
begin
  if auth.uid() is not null then
    new := jsonb_populate_record(new, jsonb_build_object(v_column, auth.uid()));
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_author() from public, anon, authenticated;

create trigger stamp_author
  before insert on public.follow_up_activities
  for each row execute function private.stamp_author('staff_user_id');

-- ---------------------------------------------------------------------------
-- Enquiry pipeline: new → contacted → quoted → won / lost
--   new        → contacted, lost, spam
--   contacted  → quoted, lost
--   quoting    → contacted, quoted, lost   (legacy value; not offered in the UI)
--   quoted     → won, lost
--   lost       → contacted                 (re-open)
--   spam       → new                       (admins only)
--   won        → (final)
-- Moving to "quoted" needs at least one quotation that was sent; "won" needs
-- an accepted quotation.
-- ---------------------------------------------------------------------------
create or replace function private.enforce_enquiry_status()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed public.enquiry_status[];
begin
  if new.status = old.status then
    return new;
  end if;

  allowed := case old.status
    when 'new' then array['contacted', 'lost', 'spam']
    when 'contacted' then array['quoted', 'lost']
    when 'quoting' then array['contacted', 'quoted', 'lost']
    when 'quoted' then array['won', 'lost']
    when 'lost' then array['contacted']
    when 'spam' then array['new']
    else array[]::text[]
  end::public.enquiry_status[];

  if not (new.status = any (allowed)) then
    raise exception 'เปลี่ยนสถานะจาก % เป็น % ไม่ได้', old.status, new.status
      using errcode = 'P0001', hint = 'invalid_status_transition';
  end if;

  if old.status = 'spam' and auth.uid() is not null and not private.is_admin() then
    raise exception 'เฉพาะผู้ดูแลระบบที่นำคำขอออกจากสแปมได้'
      using errcode = '42501';
  end if;

  if new.status = 'quoted' and not exists (
    select 1 from public.quotations q where q.enquiry_id = new.id and q.status <> 'draft'
  ) then
    raise exception 'ต้องส่งใบเสนอราคาอย่างน้อย 1 รายการก่อนเปลี่ยนเป็น "เสนอราคาแล้ว"'
      using errcode = 'P0001', hint = 'needs_sent_quotation';
  end if;

  if new.status = 'won' and not exists (
    select 1 from public.quotations q where q.enquiry_id = new.id and q.status = 'accepted'
  ) then
    raise exception 'ต้องมีใบเสนอราคาที่ลูกค้าตอบรับก่อนปิดการขาย'
      using errcode = 'P0001', hint = 'needs_accepted_quotation';
  end if;

  return new;
end;
$$;
revoke all on function private.enforce_enquiry_status() from public, anon, authenticated;

create trigger enforce_enquiry_status
  before update of status on public.enquiries
  for each row execute function private.enforce_enquiry_status();

-- Status history: append-only, written by trigger, used for reporting.
create table public.enquiry_status_history (
  id           bigint generated always as identity primary key,
  enquiry_id   uuid not null references public.enquiries (id) on delete cascade,
  from_status  public.enquiry_status,
  to_status    public.enquiry_status not null,
  changed_by   uuid references public.staff_users (id) on delete set null,
  changed_at   timestamptz not null default now()
);
create index enquiry_status_history_enquiry_idx on public.enquiry_status_history (enquiry_id, changed_at);
create index enquiry_status_history_to_status_idx on public.enquiry_status_history (to_status, changed_at);
create index enquiry_status_history_changed_by_idx on public.enquiry_status_history (changed_by);

create trigger enquiry_status_history_append_only
  before update or delete on public.enquiry_status_history
  for each row execute function private.prevent_modification();

create or replace function private.record_enquiry_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.enquiry_status_history (enquiry_id, from_status, to_status, changed_by, changed_at)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      (select s.id from public.staff_users s where s.id = auth.uid()),
      case when tg_op = 'INSERT' then new.created_at else now() end
    );
  end if;
  return new;
end;
$$;
revoke all on function private.record_enquiry_status() from public, anon, authenticated;

create trigger record_enquiry_status
  after insert or update of status on public.enquiries
  for each row execute function private.record_enquiry_status();

-- Backfill history for enquiries that already exist.
insert into public.enquiry_status_history (enquiry_id, from_status, to_status, changed_at)
select e.id, null, e.status, e.created_at from public.enquiries e;

-- ---------------------------------------------------------------------------
-- Follow-up tasks: "call this customer back on Friday", assigned to a person.
-- (Renewal tasks are separate and created by the scheduled renewal job.)
-- ---------------------------------------------------------------------------
create table public.follow_up_tasks (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete restrict,
  enquiry_id    uuid references public.enquiries (id) on delete set null,
  policy_id     uuid references public.policies (id) on delete set null,
  title         text not null check (char_length(title) between 1 and 200),
  notes         text check (char_length(notes) <= 2000),
  due_date      date not null,
  assigned_to   uuid references public.staff_users (id) on delete set null,
  status        public.task_status not null default 'open',
  completed_at  timestamptz,
  created_by    uuid references public.staff_users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint follow_up_tasks_completed check ((status = 'done') = (completed_at is not null))
);
create index follow_up_tasks_customer_idx on public.follow_up_tasks (customer_id);
create index follow_up_tasks_enquiry_idx on public.follow_up_tasks (enquiry_id);
create index follow_up_tasks_policy_idx on public.follow_up_tasks (policy_id);
create index follow_up_tasks_assigned_idx on public.follow_up_tasks (assigned_to);
create index follow_up_tasks_created_by_idx on public.follow_up_tasks (created_by);
create index follow_up_tasks_open_due_idx on public.follow_up_tasks (due_date) where status in ('open', 'in_progress');

create trigger set_updated_at before update on public.follow_up_tasks
  for each row execute function private.set_updated_at();
create trigger write_audit_log after insert or update or delete on public.follow_up_tasks
  for each row execute function private.write_audit_log();
create trigger stamp_author before insert on public.follow_up_tasks
  for each row execute function private.stamp_author('created_by');

-- Keep completed_at in step with status for both task tables.
create or replace function private.sync_task_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and new.completed_at is null then
    new.completed_at := now();
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_task_completion() from public, anon, authenticated;

create trigger sync_task_completion before insert or update of status on public.follow_up_tasks
  for each row execute function private.sync_task_completion();
create trigger sync_task_completion before insert or update of status on public.renewal_tasks
  for each row execute function private.sync_task_completion();

-- ---------------------------------------------------------------------------
-- Access control for the new tables (same model as the core tables).
-- ---------------------------------------------------------------------------
alter table public.follow_up_tasks enable row level security;
alter table public.enquiry_status_history enable row level security;
revoke all on public.follow_up_tasks, public.enquiry_status_history from public, anon, authenticated;
revoke truncate on public.follow_up_tasks, public.enquiry_status_history from service_role;

grant select, insert, update, delete on public.follow_up_tasks to authenticated;
grant select on public.enquiry_status_history to authenticated;

create policy "Staff can view" on public.follow_up_tasks
  for select to authenticated using ((select private.is_staff()));
create policy "Agents and admins can add" on public.follow_up_tasks
  for insert to authenticated with check ((select private.can_write()));
create policy "Agents and admins can update" on public.follow_up_tasks
  for update to authenticated using ((select private.can_write())) with check ((select private.can_write()));
create policy "Admins can delete" on public.follow_up_tasks
  for delete to authenticated using ((select private.is_admin()));

create policy "Staff can view" on public.enquiry_status_history
  for select to authenticated using ((select private.is_staff()));

-- ---------------------------------------------------------------------------
-- Customer search: name, phone digits, LINE ID, plate or enquiry reference.
-- SECURITY INVOKER, so row level security applies to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.search_customers(p_query text, p_limit integer default 30)
returns setof public.customers
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select btrim(p_query) as raw,
           regexp_replace(p_query, '\D', '', 'g') as digits
  )
  select c.*
    from public.customers c, q
   where char_length(q.raw) >= 2
     and (
       c.full_name ilike '%' || q.raw || '%'
       or (char_length(q.digits) >= 3 and c.phone like '%' || q.digits || '%')
       or c.line_id ilike '%' || q.raw || '%'
       or exists (select 1 from public.vehicles v
                   where v.customer_id = c.id
                     and (v.registration_plate ilike '%' || q.raw || '%' or v.description ilike '%' || q.raw || '%'))
       or exists (select 1 from public.enquiries e
                   where e.customer_id = c.id and e.reference ilike '%' || q.raw || '%')
     )
   order by c.updated_at desc
   limit least(greatest(p_limit, 1), 100)
$$;

-- ---------------------------------------------------------------------------
-- Conversion report for enquiries created between p_from and p_to
-- (inclusive, Bangkok dates). SECURITY INVOKER: non-staff get zeros.
-- ---------------------------------------------------------------------------
create or replace function public.crm_conversion_report(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with e as (
    select en.*
      from public.enquiries en
     where (en.created_at at time zone 'Asia/Bangkok')::date between p_from and p_to
       and en.status <> 'spam'
  ),
  reached as (
    select e.id,
           e.product,
           e.source,
           e.status,
           coalesce(bool_or(h.to_status in ('contacted', 'quoting', 'quoted', 'won') and h.from_status is not null), false)
             or e.status in ('contacted', 'quoted', 'won') as contacted,
           coalesce(bool_or(h.to_status in ('quoted', 'won')), false) or e.status in ('quoted', 'won') as quoted,
           e.status = 'won' as won,
           e.status = 'lost' as lost,
           min(h.changed_at) filter (where h.to_status = 'quoted' and h.from_status is not null) - e.created_at as time_to_quote
      from e
      left join public.enquiry_status_history h on h.enquiry_id = e.id
     group by e.id, e.product, e.source, e.status, e.created_at
  ),
  sales as (
    select count(*) as policies, coalesce(sum(p.premium), 0) as premium
      from public.policies p
      join public.quotations q on q.id = p.quotation_id
      join e on e.id = q.enquiry_id
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'enquiries', (select count(*) from reached),
    'contacted', (select count(*) from reached where contacted),
    'quoted', (select count(*) from reached where quoted),
    'won', (select count(*) from reached where won),
    'lost', (select count(*) from reached where lost),
    'open', (select count(*) from reached where not won and not lost),
    'quotations_sent', (select count(*) from public.quotations q join e on e.id = q.enquiry_id where q.status <> 'draft'),
    'policies', (select policies from sales),
    'premium_won', (select premium from sales),
    'avg_hours_to_quote', (select round((extract(epoch from avg(time_to_quote)) / 3600)::numeric, 1) from reached where time_to_quote is not null),
    'by_status', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from reached group by status) s), '{}'::jsonb),
    'by_product', coalesce((select jsonb_agg(jsonb_build_object('key', product, 'enquiries', n, 'won', w) order by n desc)
                              from (select coalesce(product::text, 'contact') product, count(*) n, count(*) filter (where won) w
                                      from reached group by 1) s), '[]'::jsonb),
    'by_source', coalesce((select jsonb_agg(jsonb_build_object('key', source, 'enquiries', n, 'won', w) order by n desc)
                             from (select source::text source, count(*) n, count(*) filter (where won) w
                                     from reached group by 1) s), '[]'::jsonb)
  )
$$;

revoke all on function public.search_customers(text, integer) from public, anon;
revoke all on function public.crm_conversion_report(date, date) from public, anon;
grant execute on function public.search_customers(text, integer) to authenticated;
grant execute on function public.crm_conversion_report(date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Quotations are always recorded in the name of the staff member who adds them.
-- ---------------------------------------------------------------------------
create trigger stamp_author before insert on public.quotations
  for each row execute function private.stamp_author('prepared_by');

-- ---------------------------------------------------------------------------
-- Enquiry references for enquiries staff log by hand (phone, LINE, walk-in).
-- Web enquiries get theirs from public.submit_enquiry.
-- ---------------------------------------------------------------------------
create or replace function private.generate_enquiry_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'CK-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMMDD') || '-' ||
         (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::integer, 1), '')
            from generate_series(1, 4))
$$;
revoke all on function private.generate_enquiry_reference() from public, anon;
grant execute on function private.generate_enquiry_reference() to authenticated, service_role;

alter table public.enquiries alter column reference set default private.generate_enquiry_reference();

-- ---------------------------------------------------------------------------
-- Turn an accepted quotation into a policy in one transaction:
-- accept the quotation, create the policy, and mark the enquiry won if it
-- was "quoted". SECURITY INVOKER: RLS applies, so viewers cannot use it.
-- ---------------------------------------------------------------------------
create or replace function public.convert_quotation_to_policy(
  p_quotation_id uuid,
  p_policy_number text,
  p_start_date date,
  p_end_date date
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_quote public.quotations%rowtype;
  v_enquiry public.enquiries%rowtype;
  v_policy_id uuid;
begin
  if not (select private.can_write()) then
    raise exception 'บัญชีนี้ดูข้อมูลได้อย่างเดียว' using errcode = '42501';
  end if;

  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'ไม่พบใบเสนอราคา' using errcode = 'P0002';
  end if;
  select * into v_enquiry from public.enquiries where id = v_quote.enquiry_id for update;

  if exists (select 1 from public.policies p where p.quotation_id = v_quote.id) then
    raise exception 'ใบเสนอราคานี้ออกกรมธรรม์ไปแล้ว' using errcode = 'P0001';
  end if;

  if v_quote.status <> 'accepted' then
    update public.quotations set status = 'accepted' where id = v_quote.id;
  end if;

  insert into public.policies (customer_id, vehicle_id, insurer_id, quotation_id, product,
                               policy_number, start_date, end_date, premium, status)
  values (v_enquiry.customer_id, v_enquiry.vehicle_id, v_quote.insurer_id, v_quote.id, v_quote.product,
          btrim(p_policy_number), p_start_date, p_end_date, v_quote.premium, 'active')
  returning id into v_policy_id;

  if v_enquiry.status = 'quoted' then
    update public.enquiries set status = 'won' where id = v_enquiry.id;
  end if;

  return v_policy_id;
end;
$$;
revoke all on function public.convert_quotation_to_policy(uuid, text, date, date) from public, anon;
grant execute on function public.convert_quotation_to_policy(uuid, text, date, date) to authenticated;
