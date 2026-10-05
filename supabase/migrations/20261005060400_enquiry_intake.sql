-- CheckKhum customer database: public enquiry intake.
--
-- Both functions are callable ONLY by service_role, i.e. by the Next.js
-- endpoint holding the secret key. Visitors cannot call them directly
-- through the Data API, so the endpoint's validation, spam checks and rate
-- limits cannot be bypassed.

grant usage on schema private to service_role;
grant select, insert, update, delete on private.rate_limit_buckets to service_role;

-- ---------------------------------------------------------------------------
-- Fixed-window rate limiter shared by every server instance.
-- Returns {"allowed": bool, "hits": int, "retry_after_seconds": int}.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_bucket_key is null or char_length(p_bucket_key) > 200 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limit_buckets as b (bucket_key, window_start, hits)
  values (p_bucket_key, v_window_start, 1)
  on conflict (bucket_key, window_start) do update set hits = b.hits + 1
  returning b.hits into v_hits;

  -- Opportunistic cleanup of old windows.
  if random() < 0.02 then
    delete from private.rate_limit_buckets where window_start < now() - interval '2 days';
  end if;

  return jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'hits', v_hits,
    'retry_after_seconds',
      greatest(1, ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - now())))::integer)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Submit an enquiry from the website.
--
-- Expects a payload already validated by the server endpoint; table
-- constraints validate it again. In one transaction it:
--   1. returns the existing enquiry if the idempotency key was seen before
--      (double-click, network retry);
--   2. returns the existing enquiry if the same request (same phone, product
--      and details) arrived in the last 30 minutes;
--   3. finds or creates the customer by phone (never overwrites their details);
--   4. finds or creates the vehicle;
--   5. creates the enquiry with a human-readable reference;
--   6. records consent: quote processing, and the marketing choice.
--
-- Returns {"enquiry_id", "reference", "duplicate": bool, "duplicate_reason"}.
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
  v_vehicle text := nullif(btrim(p ->> 'vehicle_description'), '');
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
    lower(v_vehicle), v_model_year,
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
      insert into public.vehicles (customer_id, description, model_year, is_ev)
      values (v_customer_id, v_vehicle, v_model_year, v_product = 'ev')
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
        travel_destination, travel_days, travellers, message,
        idempotency_key, fingerprint, client_ip_hash, user_agent
      ) values (
        v_reference, v_customer_id, v_vehicle_id, v_type, v_product,
        case v_type when 'quote' then 'web_quote_form' else 'web_contact_form' end::public.enquiry_source,
        btrim(p ->> 'name'), v_phone, (p ->> 'preferred_channel')::public.contact_channel,
        nullif(btrim(p ->> 'travel_destination'), ''), (p ->> 'travel_days')::smallint,
        (p ->> 'travellers')::smallint, nullif(btrim(p ->> 'message'), ''),
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

-- Lock both functions down to the server.
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.submit_enquiry(jsonb) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function public.submit_enquiry(jsonb) to service_role;
