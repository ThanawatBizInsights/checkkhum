-- Customer LINE contact details for the staff CRM.
--
-- Three different things, kept apart on purpose:
--   1. customers.line_display_name / line_id / line_url: contact details a
--      person typed (staff in the CRM, or the visitor in the quote form).
--      Reusable across all of that customer's enquiries. ALWAYS UNVERIFIED:
--      line_contact_source says who typed them ('staff_entry' or 'web_form').
--   2. enquiries.contact_line_id / contact_line_url: exactly what the visitor
--      typed with that enquiry. Kept as submitted, like contact_name and
--      contact_phone (staff cannot change these four columns).
--   3. customer_line_accounts.line_user_id: the only VERIFIED LINE identity,
--      written by link_line_account() after LINE has verified an ID token
--      (20261010090000_line_login.sql). Nothing here touches it.
-- Nothing is ever matched or linked from a LINE ID, display name, URL or
-- phone number, and no chat/profile URL is built from them.

-- Supported LINE links: https only, LINE's own hosts, the host followed by a
-- path (so "https://line.me.example.com" and "https://line.me@evil" fail),
-- no spaces or quotes, at most 300 characters.
create or replace function private.is_line_url(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(p_url) <= 300
     and p_url ~ '^https://(line\.me|www\.line\.me|page\.line\.me|lin\.ee)/[A-Za-z0-9._~%!$&()*+,;=:@/?#-]+$';
$$;
revoke all on function private.is_line_url(text) from public, anon;
grant execute on function private.is_line_url(text) to authenticated, service_role;

-- A LINE ID as people type it: optional "@" (Official Accounts), then letters,
-- digits, dot, dash or underscore.
create or replace function private.is_line_id(p_id text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_id ~ '^@?[A-Za-z0-9._-]{1,50}$';
$$;
revoke all on function private.is_line_id(text) from public, anon;
grant execute on function private.is_line_id(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Customers: reusable, unverified LINE contact details
-- ---------------------------------------------------------------------------
alter table public.customers
  add column line_display_name text
    check (line_display_name is null or (char_length(line_display_name) between 1 and 100 and line_display_name !~ '[[:cntrl:]]')),
  add column line_url text check (line_url is null or private.is_line_url(line_url)),
  add column line_contact_source text check (line_contact_source in ('staff_entry', 'web_form')),
  add column line_contact_updated_at timestamptz;

-- Existing values were typed by staff; the format check applies to new writes.
alter table public.customers
  add constraint customers_line_id_format check (line_id is null or private.is_line_id(line_id)) not valid;
update public.customers set line_contact_source = 'staff_entry', line_contact_updated_at = updated_at
 where line_id is not null and line_contact_source is null;

comment on column public.customers.line_display_name is 'Name shown in LINE, as typed by staff. Unverified.';
comment on column public.customers.line_id is 'LINE ID as typed by staff or the visitor (searchable). Unverified.';
comment on column public.customers.line_url is 'LINE profile/add-friend link the customer shared (https, LINE hosts only). Unverified; opened as-is, never constructed.';
comment on column public.customers.line_contact_source is 'Who typed the LINE details: staff_entry or web_form. These details are never verified; the verified LINE identity is customer_line_accounts.line_user_id.';
comment on column public.customers.line_contact_updated_at is 'When the LINE details last changed.';

-- Keep the bookkeeping honest: any change to the three fields stamps the time
-- and the source, and clearing all three clears both.
create or replace function private.stamp_customer_line_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.line_display_name is distinct from old.line_display_name
     or new.line_id is distinct from old.line_id
     or new.line_url is distinct from old.line_url then
    if coalesce(new.line_display_name, new.line_id, new.line_url) is null then
      new.line_contact_source := null;
      new.line_contact_updated_at := null;
    else
      -- Inserts say who typed them (submit_enquiry: 'web_form'); later changes
      -- only ever come from staff in the CRM.
      new.line_contact_source := case when tg_op = 'INSERT' then coalesce(new.line_contact_source, 'staff_entry') else 'staff_entry' end;
      new.line_contact_updated_at := now();
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.stamp_customer_line_contact() from public, anon, authenticated;

create trigger stamp_line_contact before insert or update on public.customers
  for each row execute function private.stamp_customer_line_contact();

-- ---------------------------------------------------------------------------
-- Enquiries: LINE details exactly as submitted with the enquiry
-- ---------------------------------------------------------------------------
alter table public.enquiries
  add column contact_line_id text check (contact_line_id is null or private.is_line_id(contact_line_id)),
  add column contact_line_url text check (contact_line_url is null or private.is_line_url(contact_line_url));
comment on column public.enquiries.contact_line_id is 'LINE ID the visitor typed with this enquiry. Kept as submitted; unverified.';
comment on column public.enquiries.contact_line_url is 'LINE link the visitor shared with this enquiry. Kept as submitted; unverified.';

-- The contact details an enquiry arrived with are a record of what was
-- submitted: signed-in users (staff) cannot change them. Corrections go on
-- the customer record instead.
create or replace function private.keep_enquiry_contact()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (
       new.contact_name is distinct from old.contact_name
    or new.contact_phone is distinct from old.contact_phone
    or new.contact_line_id is distinct from old.contact_line_id
    or new.contact_line_url is distinct from old.contact_line_url) then
    raise exception 'enquiry contact details are kept as submitted; update the customer instead'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.keep_enquiry_contact() from public, anon, authenticated;

create trigger keep_enquiry_contact before update on public.enquiries
  for each row execute function private.keep_enquiry_contact();

-- ---------------------------------------------------------------------------
-- Intake: same function as 20261011090000, now also storing LINE details.
-- ---------------------------------------------------------------------------
create or replace function public.submit_enquiry(p jsonb)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c_duplicate_window constant interval := interval '30 minutes';

  v_type public.enquiry_type := (p ->> 'type')::public.enquiry_type;
  v_product public.insurance_product := (p ->> 'product')::public.insurance_product;
  v_phone text := p ->> 'phone';
  v_make text := nullif(btrim(left(p ->> 'vehicle_make', 60)), '');
  v_model text := nullif(btrim(left(p ->> 'vehicle_model', 60)), '');
  v_vehicle text := coalesce(nullif(btrim(p ->> 'vehicle_description'), ''), nullif(concat_ws(' ', v_make, v_model), ''));
  v_renewal text := nullif(p ->> 'renewal_timing', '');
  v_details jsonb := case when jsonb_typeof(p -> 'details') = 'object' then p -> 'details' else '{}'::jsonb end;
  -- LINE details the visitor typed (optional, unverified). The website server
  -- validates them; the table checks enforce the same formats.
  v_line_id text := nullif(btrim(p ->> 'line_id'), '');
  v_line_url text := nullif(btrim(p ->> 'line_url'), '');
  v_model_year smallint := (p ->> 'model_year')::smallint;
  v_key uuid := (p ->> 'idempotency_key')::uuid;
  v_fingerprint text;
  v_existing record;
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_enquiry_id uuid;
  v_reference text;
  v_attempt integer := 0;
begin
  if v_key is null then
    raise exception 'idempotency_key is required' using errcode = '22023';
  end if;

  v_fingerprint := encode(sha256(convert_to(concat_ws('|',
    v_type, v_product, v_phone,
    lower(v_vehicle), v_model_year, v_renewal, v_details::text, lower(v_line_id), v_line_url,
    lower(btrim(p ->> 'travel_destination')), p ->> 'travel_days', p ->> 'travellers',
    lower(btrim(p ->> 'message'))
  ), 'UTF8')), 'hex');

  -- Serialise concurrent submissions of the same request.
  perform pg_advisory_xact_lock(hashtextextended(v_fingerprint, 0));

  -- 1. Same idempotency key: a retry of a request we already stored.
  select e.id, e.reference into v_existing
    from public.enquiries e where e.idempotency_key = v_key;
  if found then
    return jsonb_build_object('enquiry_id', v_existing.id, 'reference', v_existing.reference,
                              'duplicate', true, 'duplicate_reason', 'idempotency_key');
  end if;

  -- 2. Same request content recently.
  select e.id, e.reference into v_existing
    from public.enquiries e
   where e.fingerprint = v_fingerprint
     and e.created_at > now() - c_duplicate_window
   order by e.created_at desc
   limit 1;
  if found then
    return jsonb_build_object('enquiry_id', v_existing.id, 'reference', v_existing.reference,
                              'duplicate', true, 'duplicate_reason', 'recent_same_request');
  end if;

  -- 3. Customer, matched by phone. Existing details are left untouched: a
  -- public form must not be able to rename someone else's customer record or
  -- change their LINE details. A new customer starts with the LINE details
  -- from the form, marked as web-form entries (unverified).
  insert into public.customers (full_name, phone, preferred_channel, line_id, line_url, line_contact_source)
  values (btrim(p ->> 'name'), v_phone, (p ->> 'preferred_channel')::public.contact_channel,
          v_line_id, v_line_url, case when coalesce(v_line_id, v_line_url) is not null then 'web_form' end)
  on conflict (phone) do nothing
  returning id into v_customer_id;

  if v_customer_id is null then
    select c.id into v_customer_id from public.customers c where c.phone = v_phone;
  end if;

  -- 4. Vehicle, reused if this customer already has the same one.
  if v_vehicle is not null then
    select v.id into v_vehicle_id
      from public.vehicles v
     where v.customer_id = v_customer_id
       and lower(v.description) = lower(v_vehicle)
       and v.model_year is not distinct from v_model_year
     limit 1;

    if v_vehicle_id is null then
      insert into public.vehicles (customer_id, description, make, model, model_year, is_ev)
      values (v_customer_id, v_vehicle, v_make, v_model, v_model_year, v_product = 'ev')
      returning id into v_vehicle_id;
    end if;
  end if;

  -- 5. Enquiry with a unique reference such as CK-261005-7KQ2.
  loop
    v_attempt := v_attempt + 1;
    v_reference := 'CK-' || to_char(now() at time zone 'Asia/Bangkok', 'YYMMDD') || '-' ||
      (select string_agg(substr(c_alphabet, 1 + floor(random() * length(c_alphabet))::integer, 1), '')
         from generate_series(1, 4));
    begin
      insert into public.enquiries (
        reference, customer_id, vehicle_id, type, product, source,
        contact_name, contact_phone, preferred_channel,
        travel_destination, travel_days, travellers, message, renewal_timing, details,
        contact_line_id, contact_line_url,
        idempotency_key, fingerprint, client_ip_hash, user_agent
      ) values (
        v_reference, v_customer_id, v_vehicle_id, v_type, v_product,
        case v_type when 'quote' then 'web_quote_form' else 'web_contact_form' end::public.enquiry_source,
        btrim(p ->> 'name'), v_phone, (p ->> 'preferred_channel')::public.contact_channel,
        nullif(btrim(p ->> 'travel_destination'), ''), (p ->> 'travel_days')::smallint,
        (p ->> 'travellers')::smallint, nullif(btrim(p ->> 'message'), ''), v_renewal, v_details,
        v_line_id, v_line_url,
        v_key, v_fingerprint, p ->> 'client_ip_hash', left(p ->> 'user_agent', 300)
      )
      returning id into v_enquiry_id;
      exit;
    exception when unique_violation then
      -- A reference collision: try another. Anything else is re-raised.
      if v_attempt >= 5 or sqlerrm not like '%enquiries_reference_key%' then
        raise;
      end if;
    end;
  end loop;

  -- 6. Consent evidence.
  insert into public.consent_records (customer_id, enquiry_id, purpose, granted, notice_version, method, client_ip_hash, user_agent)
  values
    (v_customer_id, v_enquiry_id, 'quote_processing', true, p ->> 'notice_version', 'web_form',
     p ->> 'client_ip_hash', left(p ->> 'user_agent', 300)),
    (v_customer_id, v_enquiry_id, 'marketing', coalesce((p ->> 'marketing_consent')::boolean, false),
     p ->> 'notice_version', 'web_form', p ->> 'client_ip_hash', left(p ->> 'user_agent', 300));

  return jsonb_build_object('enquiry_id', v_enquiry_id, 'reference', v_reference,
                            'duplicate', false, 'duplicate_reason', null);
end;
$$;

revoke all on function public.submit_enquiry(jsonb) from public, anon, authenticated;
grant execute on function public.submit_enquiry(jsonb) to service_role;
