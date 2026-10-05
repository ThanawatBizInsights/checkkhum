-- CheckKhum customer database: base schema objects.
-- Enum types, the non-exposed `private` schema, and shared trigger helpers.

-- Objects in `private` are never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

create type public.staff_role as enum ('admin', 'agent', 'viewer');

create type public.contact_channel as enum ('phone', 'line', 'email');

create type public.insurance_product as enum (
  'car_1',        -- ประกันรถยนต์ ชั้น 1
  'car_2plus',    -- ชั้น 2+
  'car_3plus',    -- ชั้น 3+
  'ev',           -- ประกันรถยนต์ EV
  'compulsory',   -- พ.ร.บ.
  'travel'        -- ประกันเดินทาง
);

create type public.enquiry_type as enum ('quote', 'contact');

create type public.enquiry_source as enum ('web_quote_form', 'web_contact_form', 'phone', 'line', 'walk_in', 'referral');

create type public.enquiry_status as enum ('new', 'contacted', 'quoting', 'quoted', 'won', 'lost', 'spam');

create type public.quotation_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');

create type public.policy_status as enum ('pending', 'active', 'expired', 'cancelled');

create type public.activity_type as enum ('call', 'line', 'email', 'meeting', 'note');

create type public.task_status as enum ('open', 'in_progress', 'done', 'cancelled');

create type public.consent_purpose as enum (
  'quote_processing',   -- use details to prepare and send quotations
  'marketing',          -- offers and news
  'sensitive_data'      -- e.g. health data some travel plans require
);

create type public.consent_method as enum ('web_form', 'phone', 'line', 'paper');

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- For append-only tables (consent records, audit logs): block UPDATE/DELETE
-- for every role, including the service role, which bypasses RLS.
create or replace function private.prevent_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; % is not allowed', tg_table_name, lower(tg_op)
    using errcode = '42501';
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
