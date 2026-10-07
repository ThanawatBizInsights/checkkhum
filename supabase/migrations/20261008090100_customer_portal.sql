-- Customer portal, part 2: account links, invitations, policy documents.
--
-- Who can do what (adds to 20261005060300_access_control.sql):
--   customer (authenticated, linked in customer_accounts, not staff)
--     - reads its own link row and its own APPROVED policy documents (RLS);
--     - reads its own enquiries, sent quotations, policies and vehicles only
--       through public.portal_overview(), which returns a fixed set of
--       customer-safe columns (no internal notes, staff names, tasks,
--       activities, consent or audit data);
--     - asks for a renewal through public.portal_request_renewal();
--     - downloads its own approved files from the private storage bucket.
--     Customers still have NO direct table access to customers, enquiries,
--     quotations, policies or any CRM table: every existing policy there
--     requires private.is_staff().
--   staff: viewer   reads invitations, account links and documents.
--   staff: agent    + invites customers, uploads and approves documents.
--   staff: admin    + unlinks accounts.
--
-- Linking an account to a customer record never trusts a typed email or
-- phone number: a staff member invites a chosen CRM customer at a chosen
-- address, and the link is made only for a signed-in user whose Supabase
-- Auth email is VERIFIED and equal to that pending, unexpired invitation.

-- ---------------------------------------------------------------------------
-- Invitations (staff-issued) and account links
-- ---------------------------------------------------------------------------
create table public.customer_invitations (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  email             text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  invited_by        uuid references public.staff_users (id) on delete set null,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '7 days',
  accepted_at       timestamptz,
  accepted_user_id  uuid references auth.users (id) on delete set null,
  revoked_at        timestamptz,
  constraint customer_invitations_accepted check ((accepted_at is null) = (accepted_user_id is null))
);
comment on table public.customer_invitations is
  'Staff invitations for a customer to use the portal. Accepting needs a verified login with the same email.';

-- One open invitation per customer; inviting again replaces the old one.
create unique index customer_invitations_one_open
  on public.customer_invitations (customer_id) where accepted_at is null and revoked_at is null;
create index customer_invitations_email_idx on public.customer_invitations (email) where accepted_at is null and revoked_at is null;
create index customer_invitations_invited_by_idx on public.customer_invitations (invited_by);
create index customer_invitations_accepted_user_idx on public.customer_invitations (accepted_user_id);

create table public.customer_accounts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null unique references auth.users (id) on delete cascade,
  customer_id    uuid not null unique references public.customers (id) on delete cascade,
  invitation_id  uuid references public.customer_invitations (id) on delete set null,
  linked_at      timestamptz not null default now()
);
comment on table public.customer_accounts is
  'Links one verified Supabase Auth login to one CRM customer. Written only by public.accept_customer_invitation().';
create index customer_accounts_invitation_idx on public.customer_accounts (invitation_id);

create trigger stamp_author
  before insert on public.customer_invitations
  for each row execute function private.stamp_author('invited_by');

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so policies can use them without recursion)
-- ---------------------------------------------------------------------------
create or replace function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  -- Staff never act as customers, even if a link row exists.
  select a.customer_id
    from public.customer_accounts a
   where a.user_id = (select auth.uid())
     and not exists (select 1 from public.staff_users s where s.id = a.user_id)
$$;

create or replace function private.customer_owns_policy(p_policy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.policies p
     where p.id = p_policy_id
       and p.customer_id = private.current_customer_id()
  )
$$;

revoke all on function private.current_customer_id(), private.customer_owns_policy(uuid) from public, anon;
grant execute on function private.current_customer_id(), private.customer_owns_policy(uuid) to authenticated;

-- A login is either staff or a customer, never both.
create or replace function private.keep_staff_and_customers_apart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- (Nested IFs: NEW has different columns on the two tables.)
  if tg_table_name = 'customer_accounts' then
    if exists (select 1 from public.staff_users s where s.id = new.user_id) then
      raise exception 'บัญชีพนักงานเชื่อมกับข้อมูลลูกค้าไม่ได้' using errcode = 'P0001';
    end if;
  else
    if exists (select 1 from public.customer_accounts a where a.user_id = new.id) then
      raise exception 'บัญชีนี้เป็นบัญชีลูกค้า ใช้เป็นบัญชีพนักงานไม่ได้' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.keep_staff_and_customers_apart() from public, anon, authenticated;

create trigger keep_staff_and_customers_apart
  before insert or update of user_id on public.customer_accounts
  for each row execute function private.keep_staff_and_customers_apart();
create trigger keep_staff_and_customers_apart
  before insert or update of id on public.staff_users
  for each row execute function private.keep_staff_and_customers_apart();

-- ---------------------------------------------------------------------------
-- Policy documents (policy schedules, receipts, …) in a private bucket
-- ---------------------------------------------------------------------------
create type public.document_kind as enum ('policy', 'receipt', 'endorsement', 'other');

create table public.policy_documents (
  id                   uuid primary key default gen_random_uuid(),
  policy_id            uuid not null references public.policies (id) on delete cascade,
  kind                 public.document_kind not null,
  title                text not null check (char_length(title) between 1 and 120),
  storage_path         text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png)$'),
  content_type         text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  size_bytes           integer not null check (size_bytes between 1 and 10485760),
  visible_to_customer  boolean not null default false,
  approved_by          uuid references public.staff_users (id) on delete set null,
  approved_at          timestamptz,
  uploaded_by          uuid references public.staff_users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint policy_documents_path_matches_policy check (split_part(storage_path, '/', 1) = policy_id::text),
  constraint policy_documents_approval check (visible_to_customer = (approved_at is not null))
);
comment on table public.policy_documents is
  'Files for a policy. Customers see a file only after staff approve it (visible_to_customer).';
create index policy_documents_policy_idx on public.policy_documents (policy_id, created_at desc);
create index policy_documents_uploaded_by_idx on public.policy_documents (uploaded_by);
create index policy_documents_approved_by_idx on public.policy_documents (approved_by);

-- Approval is stamped by the database, not trusted from the form.
create or replace function private.stamp_document_approval()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.uploaded_by := auth.uid();
  else
    -- The file itself never changes; upload a new document instead.
    new.policy_id := old.policy_id;
    new.storage_path := old.storage_path;
    new.content_type := old.content_type;
    new.size_bytes := old.size_bytes;
    new.uploaded_by := old.uploaded_by;
  end if;
  if new.visible_to_customer and (tg_op = 'INSERT' or not old.visible_to_customer) then
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif not new.visible_to_customer then
    new.approved_by := null;
    new.approved_at := null;
  else
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_document_approval() from public, anon, authenticated;

create trigger stamp_document_approval
  before insert or update on public.policy_documents
  for each row execute function private.stamp_document_approval();
create trigger set_updated_at before update on public.policy_documents
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit, privileges and RLS for the new tables
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['customer_invitations', 'customer_accounts', 'policy_documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('revoke truncate on table public.%I from service_role', t);
    execute format(
      'create trigger write_audit_log after insert or update or delete on public.%I for each row execute function private.write_audit_log()',
      t
    );
  end loop;
end;
$$;

grant select, insert on public.customer_invitations to authenticated;
grant update (revoked_at) on public.customer_invitations to authenticated;
grant select, delete on public.customer_accounts to authenticated;   -- inserts only via accept_customer_invitation()
grant select, insert, update, delete on public.policy_documents to authenticated;

create policy "Staff view invitations" on public.customer_invitations
  for select to authenticated using ((select private.is_staff()));
create policy "Agents create invitations" on public.customer_invitations
  for insert to authenticated
  with check ((select private.can_write()) and accepted_at is null and accepted_user_id is null and revoked_at is null);
create policy "Agents revoke invitations" on public.customer_invitations
  for update to authenticated using ((select private.can_write())) with check ((select private.can_write()));

create policy "Staff view account links" on public.customer_accounts
  for select to authenticated using ((select private.is_staff()));
create policy "Customers view their own link" on public.customer_accounts
  for select to authenticated using (user_id = (select auth.uid()) and not (select private.is_staff()));
create policy "Admins unlink accounts" on public.customer_accounts
  for delete to authenticated using ((select private.is_admin()));

create policy "Staff view documents" on public.policy_documents
  for select to authenticated using ((select private.is_staff()));
create policy "Customers view their approved documents" on public.policy_documents
  for select to authenticated using (visible_to_customer and private.customer_owns_policy(policy_id));
create policy "Agents add documents" on public.policy_documents
  for insert to authenticated with check ((select private.can_write()));
create policy "Agents update documents" on public.policy_documents
  for update to authenticated using ((select private.can_write())) with check ((select private.can_write()));
create policy "Agents remove documents" on public.policy_documents
  for delete to authenticated using ((select private.can_write()));

-- Staff can only revoke an invitation (column grant), never un-revoke it.
-- accept_customer_invitation() runs as the table owner and is not limited.
create or replace function private.limit_invitation_updates()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'คำเชิญนี้ถูกยกเลิกแล้ว' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_invitation_updates() from public, anon, authenticated;
create trigger limit_invitation_updates
  before update on public.customer_invitations
  for each row execute function private.limit_invitation_updates();

-- ---------------------------------------------------------------------------
-- Portal enquiries: renewal requests carry the policy they renew. A customer
-- without a phone number on file can still ask (staff reply by email/LINE).
-- ---------------------------------------------------------------------------
alter table public.enquiries
  add column renewal_policy_id uuid references public.policies (id) on delete set null;
create index enquiries_renewal_policy_idx on public.enquiries (renewal_policy_id);

alter table public.enquiries alter column contact_phone drop not null;
alter table public.enquiries
  add constraint enquiries_phone_required
  check (contact_phone is not null or source = 'customer_portal');

-- ---------------------------------------------------------------------------
-- Functions the portal calls (as the signed-in customer)
-- ---------------------------------------------------------------------------

-- Link the signed-in, email-verified user to the customer they were invited
-- as. Safe to call on every sign-in; returns what happened.
create or replace function public.accept_customer_invitation()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_inv public.customer_invitations;
begin
  if v_uid is null then
    return 'signed_out';
  end if;
  if exists (select 1 from public.staff_users s where s.id = v_uid) then
    return 'staff';
  end if;
  if exists (select 1 from public.customer_accounts a where a.user_id = v_uid) then
    return 'linked';
  end if;

  select lower(u.email), u.email_confirmed_at into v_email, v_confirmed
    from auth.users u where u.id = v_uid;
  if v_email is null or v_confirmed is null then
    return 'unverified';
  end if;

  select * into v_inv
    from public.customer_invitations i
   where i.email = v_email
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > now()
   order by i.created_at desc
   limit 1
   for update;
  if not found then
    return 'none';
  end if;

  if exists (select 1 from public.customer_accounts a where a.customer_id = v_inv.customer_id) then
    update public.customer_invitations set revoked_at = now() where id = v_inv.id;
    return 'customer_taken';
  end if;

  insert into public.customer_accounts (user_id, customer_id, invitation_id)
  values (v_uid, v_inv.customer_id, v_inv.id);
  update public.customer_invitations
     set accepted_at = now(), accepted_user_id = v_uid
   where id = v_inv.id;
  return 'linked';
end;
$$;

-- Everything the customer dashboard shows, limited to the caller's own
-- customer record and to customer-safe columns. NULL when the caller is not
-- a linked customer.
create or replace function public.portal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer uuid := private.current_customer_id();
begin
  if v_customer is null then
    return null;
  end if;

  return jsonb_build_object(
    'customer', (
      select jsonb_build_object('full_name', c.full_name)
        from public.customers c where c.id = v_customer
    ),
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
       where e.customer_id = v_customer and e.status <> 'spam'
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

-- "ขอต่ออายุ": opens a renewal enquiry for one of the caller's own policies.
-- Asking twice while one is still open returns the existing reference.
create or replace function public.portal_request_renewal(p_policy_id uuid, p_message text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_customer uuid := private.current_customer_id();
  v_policy public.policies;
  v_cust public.customers;
  v_existing text;
  v_reference text;
begin
  if v_customer is null then
    raise exception 'ต้องเข้าสู่ระบบด้วยบัญชีลูกค้า' using errcode = '42501';
  end if;

  select * into v_policy from public.policies p
   where p.id = p_policy_id and p.customer_id = v_customer;
  if not found then
    raise exception 'ไม่พบกรมธรรม์นี้' using errcode = 'P0002';
  end if;

  if p_message is not null and char_length(p_message) > 1000 then
    raise exception 'ข้อความยาวเกิน 1000 ตัวอักษร' using errcode = 'P0001';
  end if;

  -- Serialise requests per policy so a double click can't open two.
  perform pg_advisory_xact_lock(hashtextextended('portal_renewal:' || p_policy_id::text, 0));

  select e.reference into v_existing from public.enquiries e
   where e.renewal_policy_id = p_policy_id
     and e.status in ('new', 'contacted', 'quoting', 'quoted')
   order by e.created_at desc limit 1;
  if v_existing is not null then
    return jsonb_build_object('reference', v_existing, 'duplicate', true);
  end if;

  if (select count(*) from public.enquiries e
       where e.customer_id = v_customer and e.source = 'customer_portal'
         and e.created_at > now() - interval '1 day') >= 5 then
    raise exception 'ส่งคำขอบ่อยเกินไป ลองใหม่พรุ่งนี้ หรือติดต่อทาง LINE' using errcode = 'P0001';
  end if;

  select * into v_cust from public.customers c where c.id = v_customer;

  insert into public.enquiries (
    customer_id, vehicle_id, type, product, source, contact_name, contact_phone,
    preferred_channel, message, renewal_policy_id
  ) values (
    v_customer, v_policy.vehicle_id, 'quote', v_policy.product, 'customer_portal', v_cust.full_name, v_cust.phone,
    v_cust.preferred_channel,
    left(concat_ws(E'\n', 'ขอต่ออายุกรมธรรม์ ' || v_policy.policy_number, nullif(btrim(p_message), '')), 1000),
    p_policy_id
  )
  returning reference into v_reference;

  return jsonb_build_object('reference', v_reference, 'duplicate', false);
end;
$$;

revoke all on function public.accept_customer_invitation(), public.portal_overview(), public.portal_request_renewal(uuid, text)
  from public, anon;
grant execute on function public.accept_customer_invitation(), public.portal_overview(), public.portal_request_renewal(uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Private storage bucket. Files are served only through short-lived signed
-- URLs created with the requesting user's own session, so these policies
-- decide who can download what.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('policy-documents', 'policy-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.customer_can_read_document(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.policy_documents d
      join public.policies p on p.id = d.policy_id
     where d.storage_path = p_path
       and d.visible_to_customer
       and p.customer_id = private.current_customer_id()
  )
$$;
revoke all on function private.customer_can_read_document(text) from public, anon;
grant execute on function private.customer_can_read_document(text) to authenticated;

create policy "Staff read policy documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'policy-documents' and (select private.is_staff()));
create policy "Agents upload policy documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'policy-documents' and (select private.can_write()));
create policy "Agents delete policy documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'policy-documents' and (select private.can_write()));
create policy "Customers read their approved documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'policy-documents' and private.customer_can_read_document(name));
