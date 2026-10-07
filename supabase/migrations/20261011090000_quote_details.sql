-- Quotation form, stage 1: structured details for each insurance type.
--
-- The website now asks, depending on the product:
--   car / EV:   vehicle brand and model (separately), year, renewal timing,
--               usage, preferred repair (ชั้น 1), home charger (EV);
--   พ.ร.บ.:      vehicle type, optional brand/model/year, renewal timing;
--   travel:     destination, start date, days, travellers.
-- Brand and model go to the existing vehicles.make / vehicles.model columns.
-- Renewal timing gets its own column (the CRM sorts and filters on it); the
-- remaining product-specific answers go to enquiries.details, a small JSON
-- object whose keys and values the website server whitelists.
-- Consent is unchanged: quote processing and the optional marketing choice
-- are still recorded separately in consent_records with the notice version.

alter table public.enquiries
  add column renewal_timing text
    check (renewal_timing in ('within_1_month', '1_3_months', 'over_3_months', 'no_current_policy', 'not_sure')),
  add column details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 2048);

comment on column public.enquiries.renewal_timing is 'When the customer needs cover: current policy ends within 1 month, 1-3 months, later, no current policy, or not sure.';
comment on column public.enquiries.details is 'Product-specific answers from the quote form (whitelisted by the server), e.g. usage, repair, ev_home_charger, vehicle_type, trip_start.';

-- Same intake function as before (duplicates, idempotency, customer matching,
-- consent), now also storing brand, model, renewal timing and details.
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
    lower(v_vehicle), v_model_year, v_renewal, v_details::text,
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
  -- public form must not be able to rename someone else's customer record.
  insert into public.customers (full_name, phone, preferred_channel)
  values (btrim(p ->> 'name'), v_phone, (p ->> 'preferred_channel')::public.contact_channel)
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
        idempotency_key, fingerprint, client_ip_hash, user_agent
      ) values (
        v_reference, v_customer_id, v_vehicle_id, v_type, v_product,
        case v_type when 'quote' then 'web_quote_form' else 'web_contact_form' end::public.enquiry_source,
        btrim(p ->> 'name'), v_phone, (p ->> 'preferred_channel')::public.contact_channel,
        nullif(btrim(p ->> 'travel_destination'), ''), (p ->> 'travel_days')::smallint,
        (p ->> 'travellers')::smallint, nullif(btrim(p ->> 'message'), ''), v_renewal, v_details,
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
