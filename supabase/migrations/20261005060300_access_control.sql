-- CheckKhum customer database: privileges and row level security.
--
-- Who can do what:
--   anon (public visitors, publishable key)  nothing on any table or function.
--                                            Enquiries arrive only through the
--                                            server endpoint, which uses the
--                                            secret key and public.submit_enquiry.
--   authenticated, not in staff_users        nothing (RLS returns no rows).
--   staff: viewer                            read customer data.
--   staff: agent                             read + create/update customer data.
--   staff: admin                             everything agents can, plus delete,
--                                            manage staff and insurers, read audit logs.
--   service_role (secret key, server only)   bypasses RLS; used by the enquiry endpoint.
--
-- Supabase grants ALL on new public tables to anon and authenticated by
-- default, so this migration revokes those grants explicitly before granting
-- only what each role needs.

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER, so policies can read staff_users without
-- recursing through its own RLS). Kept in the non-exposed private schema.
-- ---------------------------------------------------------------------------
create or replace function private.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role
    from public.staff_users s
   where s.id = (select auth.uid())
     and s.is_active
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_staff_role() is not null
$$;

create or replace function private.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_staff_role() in ('admin', 'agent'), false)
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_staff_role() = 'admin', false)
$$;

grant usage on schema private to authenticated;
revoke all on function private.current_staff_role(), private.is_staff(), private.can_write(), private.is_admin()
  from public, anon;
grant execute on function private.current_staff_role(), private.is_staff(), private.can_write(), private.is_admin()
  to authenticated;

-- ---------------------------------------------------------------------------
-- Table privileges
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  all_tables text[] := array[
    'staff_users', 'customers', 'vehicles', 'insurers', 'enquiries', 'quotations',
    'policies', 'follow_up_activities', 'renewal_tasks', 'consent_records', 'audit_logs'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    -- TRUNCATE skips row triggers (and so the audit log); nobody needs it.
    execute format('revoke truncate on table public.%I from service_role', t);
  end loop;
end;
$$;

grant select, insert, update, delete on
  public.staff_users, public.customers, public.vehicles, public.insurers, public.enquiries,
  public.quotations, public.policies, public.follow_up_activities, public.renewal_tasks
  to authenticated;
grant select, insert on public.consent_records to authenticated;   -- append-only
grant select on public.audit_logs to authenticated;                -- written by triggers only

revoke all on all sequences in schema public from anon, authenticated;

-- Future tables and functions in public are not granted to anon automatically.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------------------
-- Policies. All are `to authenticated`; anon has no policy and no grant.
-- ---------------------------------------------------------------------------

-- staff_users: staff can see colleagues (to assign work); only admins manage.
create policy "Staff can view staff" on public.staff_users
  for select to authenticated using ((select private.is_staff()));
create policy "Admins add staff" on public.staff_users
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update staff" on public.staff_users
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins remove staff" on public.staff_users
  for delete to authenticated using ((select private.is_admin()));

-- Customer data: read for all staff, write for agents and admins, delete for admins.
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers', 'vehicles', 'enquiries', 'quotations', 'policies', 'follow_up_activities', 'renewal_tasks'
  ] loop
    execute format(
      'create policy "Staff can view" on public.%I for select to authenticated using ((select private.is_staff()))', t);
    execute format(
      'create policy "Agents and admins can add" on public.%I for insert to authenticated with check ((select private.can_write()))', t);
    execute format(
      'create policy "Agents and admins can update" on public.%I for update to authenticated using ((select private.can_write())) with check ((select private.can_write()))', t);
    execute format(
      'create policy "Admins can delete" on public.%I for delete to authenticated using ((select private.is_admin()))', t);
  end loop;
end;
$$;

-- Insurers: reference data maintained by admins.
create policy "Staff can view insurers" on public.insurers
  for select to authenticated using ((select private.is_staff()));
create policy "Admins add insurers" on public.insurers
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update insurers" on public.insurers
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete insurers" on public.insurers
  for delete to authenticated using ((select private.is_admin()));

-- Consent records: staff read; agents/admins record consent captured by phone,
-- LINE or paper in their own name. No update or delete (also blocked by trigger).
create policy "Staff can view consent" on public.consent_records
  for select to authenticated using ((select private.is_staff()));
create policy "Agents and admins record consent" on public.consent_records
  for insert to authenticated
  with check ((select private.can_write()) and recorded_by = (select auth.uid()) and method <> 'web_form');

-- Audit logs: admins only, read-only.
create policy "Admins can view audit logs" on public.audit_logs
  for select to authenticated using ((select private.is_admin()));
