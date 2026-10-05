-- CheckKhum customer database: audit logging and renewal automation.

-- ---------------------------------------------------------------------------
-- Audit trigger. SECURITY DEFINER so it can write audit_logs, which no API
-- role may insert into directly. Lives in the non-exposed private schema.
-- ---------------------------------------------------------------------------
create or replace function private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  old_changed jsonb;
  new_changed jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, n.value), jsonb_object_agg(n.key, old_row -> n.key)
      into new_changed, old_changed
      from jsonb_each(new_row) as n
     where n.key <> 'updated_at'
       and (old_row -> n.key) is distinct from n.value;

    if new_changed is null then
      return new; -- nothing but updated_at changed
    end if;
  end if;

  insert into public.audit_logs (actor_id, actor_role, action, table_name, record_id, old_values, new_values)
  values (
    auth.uid(),
    coalesce(nullif(auth.role(), ''), current_user),
    lower(tg_op),
    tg_table_name,
    coalesce(new_row ->> 'id', old_row ->> 'id'),
    case tg_op when 'UPDATE' then old_changed when 'DELETE' then old_row end,
    case tg_op when 'UPDATE' then new_changed when 'INSERT' then new_row end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.write_audit_log() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'staff_users', 'customers', 'vehicles', 'insurers', 'enquiries', 'quotations',
    'policies', 'follow_up_activities', 'renewal_tasks', 'consent_records'
  ] loop
    execute format(
      'create trigger write_audit_log after insert or update or delete on public.%I for each row execute function private.write_audit_log()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Renewal tasks: when a policy becomes active, open a renewal task due 45 days
-- before it ends. Re-activating the same policy does not create a duplicate.
-- ---------------------------------------------------------------------------
create or replace function private.create_renewal_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    insert into public.renewal_tasks (policy_id, due_date)
    values (new.id, greatest(new.end_date - 45, current_date))
    on conflict (policy_id, due_date) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.create_renewal_task() from public, anon, authenticated;

create trigger create_renewal_task
  after insert or update of status on public.policies
  for each row execute function private.create_renewal_task();
