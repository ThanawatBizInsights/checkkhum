-- Customer self-registration.
--
-- Anyone may now create a login with Supabase Auth (email + password, email
-- confirmation required). What that login gets:
--   * a customer_profiles row (name, email, privacy acknowledgement) created
--     by a trigger on auth.users, with an idempotent fallback on first use;
--   * the enquiries it submits itself while signed in (status only);
--   * nothing else. Registration never creates staff_users rows, never grants
--     a staff role, and never links to an existing CRM customer. Linking stays
--     exactly as before: a staff invitation for a chosen customer, accepted by
--     a login whose email is VERIFIED and equal to the invitation's
--     (accept_customer_invitation). Typing an email or phone number links
--     nothing.

-- ---------------------------------------------------------------------------
-- Profiles: one per customer login
-- ---------------------------------------------------------------------------
create table public.customer_profiles (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null unique references auth.users (id) on delete cascade,
  full_name                text not null check (char_length(full_name) between 1 and 120),
  email                    text not null check (char_length(email) <= 254),
  source                   text not null check (source in ('self_registration', 'invitation', 'other')),
  privacy_notice_version   text check (char_length(privacy_notice_version) <= 40),
  privacy_acknowledged_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
comment on table public.customer_profiles is
  'Customer login profile (self-registered or invited). Grants nothing by itself; CRM records are linked only via customer_accounts.';

create trigger set_updated_at before update on public.customer_profiles
  for each row execute function private.set_updated_at();

alter table public.customer_profiles enable row level security;
revoke all on table public.customer_profiles from public, anon, authenticated;
revoke truncate on table public.customer_profiles from service_role;
create trigger write_audit_log after insert or update or delete on public.customer_profiles
  for each row execute function private.write_audit_log();

-- Customers read their own profile and may change only their display name;
-- rows are created only by the functions below (no insert grant).
grant select on public.customer_profiles to authenticated;
grant update (full_name) on public.customer_profiles to authenticated;

create policy "Customers view their own profile" on public.customer_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Customers rename themselves" on public.customer_profiles
  for update to authenticated
  using (user_id = (select auth.uid()) and not (select private.is_staff()))
  with check (user_id = (select auth.uid()));
create policy "Staff view profiles" on public.customer_profiles
  for select to authenticated using ((select private.is_staff()));

-- Profile values from a new auth user. The name and privacy version come from
-- the sign-up metadata (the person's own input), trimmed and length-checked.
create or replace function private.profile_values(u auth.users)
returns public.customer_profiles
language plpgsql
stable
set search_path = ''
as $$
declare
  r public.customer_profiles;
begin
  r.user_id := u.id;
  r.email := lower(coalesce(u.email, ''));
  r.full_name := coalesce(
    nullif(btrim(left(u.raw_user_meta_data ->> 'full_name', 120)), ''),
    nullif(left(split_part(coalesce(u.email, ''), '@', 1), 120), ''),
    'ลูกค้า'
  );
  r.source := case
    when u.invited_at is not null then 'invitation'
    when u.raw_user_meta_data ? 'privacy_notice_version' then 'self_registration'
    else 'other'
  end;
  r.privacy_notice_version := nullif(left(u.raw_user_meta_data ->> 'privacy_notice_version', 40), '');
  r.privacy_acknowledged_at := case when r.privacy_notice_version is not null then u.created_at end;
  return r;
end;
$$;
revoke all on function private.profile_values(auth.users) from public, anon, authenticated;

-- Runs inside the sign-up transaction. Staff logins (created by admins with
-- app_metadata.checkkhum_staff = true) get no profile. A failure here must
-- never block sign-up; ensure_customer_profile() repairs it on first use.
create or replace function private.create_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.customer_profiles;
begin
  if coalesce(new.raw_app_meta_data ->> 'checkkhum_staff', '') = 'true' or new.email is null then
    return new;
  end if;
  v := private.profile_values(new);
  begin
    insert into public.customer_profiles (user_id, full_name, email, source, privacy_notice_version, privacy_acknowledged_at)
    values (v.user_id, v.full_name, v.email, v.source, v.privacy_notice_version, v.privacy_acknowledged_at)
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'customer profile not created for new user (%)', sqlstate;
  end;
  return new;
end;
$$;
revoke all on function private.create_customer_profile() from public, anon, authenticated;

create trigger create_customer_profile
  after insert on auth.users
  for each row execute function private.create_customer_profile();

-- Idempotent: creates the caller's profile if it is missing (accounts made
-- before this migration, or if the trigger failed). Never for staff.
create or replace function private.ensure_customer_profile()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u auth.users;
  v public.customer_profiles;
begin
  if auth.uid() is null or private.is_staff()
     or exists (select 1 from public.staff_users s where s.id = auth.uid())
     or exists (select 1 from public.customer_profiles p where p.user_id = auth.uid()) then
    return;
  end if;
  select * into u from auth.users where id = auth.uid();
  if not found or u.email is null then
    return;
  end if;
  v := private.profile_values(u);
  insert into public.customer_profiles (user_id, full_name, email, source, privacy_notice_version, privacy_acknowledged_at)
  values (v.user_id, v.full_name, v.email, v.source, v.privacy_notice_version, v.privacy_acknowledged_at)
  on conflict (user_id) do nothing;
end;
$$;
revoke all on function private.ensure_customer_profile() from public, anon, authenticated;

-- Profiles for customer logins that already exist (invited before today).
insert into public.customer_profiles (user_id, full_name, email, source, privacy_notice_version, privacy_acknowledged_at)
select v.user_id, v.full_name, v.email, v.source, v.privacy_notice_version, v.privacy_acknowledged_at
  from auth.users u
  cross join lateral private.profile_values(u) v
 where u.email is not null
   and not exists (select 1 from public.staff_users s where s.id = u.id)
on conflict (user_id) do nothing;

-- A login that becomes staff stops being a customer profile (and the
-- existing rule still refuses staff for linked customer accounts).
create or replace function private.drop_profile_for_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.customer_profiles where user_id = new.id;
  return new;
end;
$$;
revoke all on function private.drop_profile_for_staff() from public, anon, authenticated;
create trigger drop_profile_for_staff
  after insert on public.staff_users
  for each row execute function private.drop_profile_for_staff();

-- ---------------------------------------------------------------------------
-- What the portal calls on every request: profile + invitation link
-- ---------------------------------------------------------------------------
create or replace function public.portal_session()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status text := public.accept_customer_invitation();
begin
  if v_status not in ('staff', 'signed_out') then
    perform private.ensure_customer_profile();
  end if;
  return v_status;
end;
$$;
revoke all on function public.portal_session() from public, anon;
grant execute on function public.portal_session() to authenticated;

-- ---------------------------------------------------------------------------
-- Enquiries a signed-in customer submits through the website form
-- ---------------------------------------------------------------------------
alter table public.enquiries
  add column submitted_by_user_id uuid references auth.users (id) on delete set null;
create index enquiries_submitted_by_idx on public.enquiries (submitted_by_user_id);

-- Called by the website server (secret key) right after submit_enquiry, with
-- the user id from the VERIFIED session cookie. Only fresh, unclaimed
-- enquiries; never for staff. This shows the customer their own request's
-- status. It does not link them to the CRM customer the enquiry was matched to.
create or replace function public.record_enquiry_submitter(p_reference text, p_user uuid)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_user is null or exists (select 1 from public.staff_users s where s.id = p_user) then
    return false;
  end if;
  update public.enquiries
     set submitted_by_user_id = p_user
   where reference = p_reference
     and submitted_by_user_id is null
     and created_at > now() - interval '10 minutes';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;
revoke all on function public.record_enquiry_submitter(text, uuid) from public, anon, authenticated;
grant execute on function public.record_enquiry_submitter(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Dashboard data, now also for registered customers without a CRM link:
-- their profile name and the enquiries they submitted. Quotations, policies,
-- vehicles and documents still come only through a linked customer record.
-- ---------------------------------------------------------------------------
create or replace function public.portal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer uuid := private.current_customer_id();
  v_profile_name text;
begin
  if v_uid is null or private.is_staff() then
    return null;
  end if;
  select p.full_name into v_profile_name from public.customer_profiles p where p.user_id = v_uid;
  if v_customer is null and v_profile_name is null then
    return null;
  end if;

  return jsonb_build_object(
    'linked', v_customer is not null,
    'customer', jsonb_build_object('full_name', coalesce(
      (select c.full_name from public.customers c where c.id = v_customer),
      v_profile_name
    )),
    'enquiries', coalesce((
      select jsonb_agg(jsonb_build_object(
               'reference', e.reference,
               'type', e.type,
               'product', e.product,
               'status', e.status,
               'created_at', e.created_at,
               'renewal_policy_id', e.renewal_policy_id
             ) order by e.created_at desc)
        from public.enquiries e
       where (e.customer_id = v_customer or e.submitted_by_user_id = v_uid)
         and e.status <> 'spam'
    ), '[]'::jsonb),
    'quotations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id,
               'enquiry_reference', e.reference,
               'insurer', i.name_th,
               'product', q.product,
               'premium', q.premium,
               'sum_insured', q.sum_insured,
               'deductible', q.deductible,
               'repair_type', q.repair_type,
               'valid_until', q.valid_until,
               'status', q.status,
               'created_at', q.created_at
             ) order by q.created_at desc)
        from public.quotations q
        join public.enquiries e on e.id = q.enquiry_id
        join public.insurers i on i.id = q.insurer_id
       where e.customer_id = v_customer and q.status <> 'draft'
    ), '[]'::jsonb),
    'policies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'policy_number', p.policy_number,
               'insurer', i.name_th,
               'product', p.product,
               'premium', p.premium,
               'start_date', p.start_date,
               'end_date', p.end_date,
               'status', p.status,
               'vehicle', case when v.id is null then null else jsonb_build_object(
                 'description', v.description,
                 'registration_plate', v.registration_plate,
                 'plate_province', v.plate_province,
                 'make', v.make,
                 'model', v.model,
                 'model_year', v.model_year,
                 'is_ev', v.is_ev
               ) end,
               'open_renewal_reference', (
                 select e.reference from public.enquiries e
                  where e.renewal_policy_id = p.id
                    and e.status in ('new', 'contacted', 'quoting', 'quoted')
                  order by e.created_at desc limit 1
               )
             ) order by p.end_date desc)
        from public.policies p
        join public.insurers i on i.id = p.insurer_id
        left join public.vehicles v on v.id = p.vehicle_id
       where p.customer_id = v_customer
    ), '[]'::jsonb),
    'vehicles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'description', v.description,
               'registration_plate', v.registration_plate,
               'plate_province', v.plate_province,
               'make', v.make,
               'model', v.model,
               'model_year', v.model_year,
               'is_ev', v.is_ev
             ) order by v.created_at)
        from public.vehicles v
       where v.customer_id = v_customer
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.portal_overview() from public, anon;
grant execute on function public.portal_overview() to authenticated;
