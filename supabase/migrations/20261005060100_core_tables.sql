-- CheckKhum customer database: core tables.
-- See docs/database.md for the entity relationship diagram.
-- Row level security and grants are set in a later migration; every table
-- here gets RLS enabled there before any role can reach it.

-- ---------------------------------------------------------------------------
-- Staff users: one row per Supabase Auth user who works at CheckKhum.
-- Being in auth.users alone grants nothing; access needs an active row here.
-- ---------------------------------------------------------------------------
create table public.staff_users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text not null check (char_length(full_name) between 1 and 120),
  role        public.staff_role not null default 'agent',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.staff_users is 'CheckKhum staff. Linked 1:1 to auth.users; role controls database access.';

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null check (char_length(full_name) between 1 and 120),
  -- Thai phone number, digits only, e.g. 0812345678. One customer per number.
  phone              text unique check (phone ~ '^0[0-9]{8,9}$'),
  email              text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  line_id            text check (char_length(line_id) <= 60),
  preferred_channel  public.contact_channel not null default 'phone',
  notes              text check (char_length(notes) <= 4000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint customers_contactable check (phone is not null or email is not null or line_id is not null)
);
comment on table public.customers is 'People who asked for a quote or hold a policy. Personal data: staff access only.';

-- ---------------------------------------------------------------------------
-- Vehicles
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers (id) on delete cascade,
  -- Free text as the customer typed it, e.g. "Honda City". Staff can split it later.
  description         text not null check (char_length(description) between 1 and 120),
  make                text check (char_length(make) <= 60),
  model               text check (char_length(model) <= 60),
  model_year          smallint check (model_year between 1950 and 2100),
  is_ev               boolean not null default false,
  registration_plate  text check (char_length(registration_plate) <= 20),
  plate_province      text check (char_length(plate_province) <= 40),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index vehicles_customer_id_idx on public.vehicles (customer_id);

-- ---------------------------------------------------------------------------
-- Insurers (reference data)
-- ---------------------------------------------------------------------------
create table public.insurers (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9_]{2,20}$'),
  name_th     text not null,
  name_en     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Enquiries: every request from the website, phone or LINE.
-- Contact details are snapshotted as submitted, even if the customer record
-- is later corrected.
-- ---------------------------------------------------------------------------
create table public.enquiries (
  id                 uuid primary key default gen_random_uuid(),
  reference          text not null unique check (reference ~ '^CK-[0-9]{6}-[A-Z0-9]{4}$'),
  customer_id        uuid not null references public.customers (id) on delete restrict,
  vehicle_id         uuid references public.vehicles (id) on delete set null,
  type               public.enquiry_type not null,
  product            public.insurance_product,
  status             public.enquiry_status not null default 'new',
  source             public.enquiry_source not null,
  contact_name       text not null check (char_length(contact_name) between 1 and 120),
  contact_phone      text not null check (contact_phone ~ '^0[0-9]{8,9}$'),
  preferred_channel  public.contact_channel not null default 'phone',
  travel_destination text check (char_length(travel_destination) <= 100),
  travel_days        smallint check (travel_days between 1 and 365),
  travellers         smallint check (travellers between 1 and 20),
  message            text check (char_length(message) <= 1000),
  assigned_to        uuid references public.staff_users (id) on delete set null,
  -- Duplicate-submission handling (see public.submit_enquiry)
  idempotency_key    uuid unique,
  fingerprint        text check (char_length(fingerprint) = 64),
  -- Abuse investigation only: salted hash, never the raw IP address.
  client_ip_hash     text check (char_length(client_ip_hash) = 64),
  user_agent         text check (char_length(user_agent) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint enquiries_quote_has_product check (type <> 'quote' or product is not null)
);
create index enquiries_customer_id_idx on public.enquiries (customer_id);
create index enquiries_vehicle_id_idx on public.enquiries (vehicle_id);
create index enquiries_assigned_to_idx on public.enquiries (assigned_to);
create index enquiries_status_created_idx on public.enquiries (status, created_at desc);
create index enquiries_fingerprint_created_idx on public.enquiries (fingerprint, created_at desc);

-- ---------------------------------------------------------------------------
-- Quotations: one per insurer offer on an enquiry.
-- ---------------------------------------------------------------------------
create table public.quotations (
  id            uuid primary key default gen_random_uuid(),
  enquiry_id    uuid not null references public.enquiries (id) on delete cascade,
  insurer_id    uuid not null references public.insurers (id) on delete restrict,
  product       public.insurance_product not null,
  sum_insured   numeric(12, 2) check (sum_insured >= 0),
  premium       numeric(12, 2) not null check (premium >= 0),
  deductible    numeric(12, 2) check (deductible >= 0),
  repair_type   text check (repair_type in ('dealer', 'garage')),
  valid_until   date,
  status        public.quotation_status not null default 'draft',
  notes         text check (char_length(notes) <= 2000),
  prepared_by   uuid references public.staff_users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index quotations_enquiry_id_idx on public.quotations (enquiry_id);
create index quotations_insurer_id_idx on public.quotations (insurer_id);
create index quotations_prepared_by_idx on public.quotations (prepared_by);

-- ---------------------------------------------------------------------------
-- Policies: what the customer actually bought.
-- ---------------------------------------------------------------------------
create table public.policies (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers (id) on delete restrict,
  vehicle_id     uuid references public.vehicles (id) on delete set null,
  insurer_id     uuid not null references public.insurers (id) on delete restrict,
  quotation_id   uuid unique references public.quotations (id) on delete set null,
  product        public.insurance_product not null,
  policy_number  text not null check (char_length(policy_number) between 1 and 60),
  start_date     date not null,
  end_date       date not null,
  premium        numeric(12, 2) not null check (premium >= 0),
  status         public.policy_status not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint policies_dates check (end_date > start_date),
  constraint policies_number_per_insurer unique (insurer_id, policy_number)
);
create index policies_customer_id_idx on public.policies (customer_id);
create index policies_vehicle_id_idx on public.policies (vehicle_id);
create index policies_end_date_idx on public.policies (end_date) where status = 'active';

-- ---------------------------------------------------------------------------
-- Follow-up activities: calls, LINE chats and notes staff log against a customer.
-- ---------------------------------------------------------------------------
create table public.follow_up_activities (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete restrict,
  enquiry_id      uuid references public.enquiries (id) on delete set null,
  policy_id       uuid references public.policies (id) on delete set null,
  staff_user_id   uuid references public.staff_users (id) on delete set null default auth.uid(),
  activity_type   public.activity_type not null,
  summary         text not null check (char_length(summary) between 1 and 2000),
  outcome         text check (char_length(outcome) <= 200),
  occurred_at     timestamptz not null default now(),
  next_action_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index follow_up_activities_customer_id_idx on public.follow_up_activities (customer_id);
create index follow_up_activities_enquiry_id_idx on public.follow_up_activities (enquiry_id);
create index follow_up_activities_policy_id_idx on public.follow_up_activities (policy_id);
create index follow_up_activities_staff_user_id_idx on public.follow_up_activities (staff_user_id);

-- ---------------------------------------------------------------------------
-- Renewal tasks: created automatically when a policy becomes active.
-- ---------------------------------------------------------------------------
create table public.renewal_tasks (
  id            uuid primary key default gen_random_uuid(),
  policy_id     uuid not null references public.policies (id) on delete cascade,
  assigned_to   uuid references public.staff_users (id) on delete set null,
  due_date      date not null,
  status        public.task_status not null default 'open',
  notes         text check (char_length(notes) <= 2000),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint renewal_tasks_one_per_due_date unique (policy_id, due_date),
  constraint renewal_tasks_completed check ((status = 'done') = (completed_at is not null))
);
create index renewal_tasks_assigned_to_idx on public.renewal_tasks (assigned_to);
create index renewal_tasks_open_due_idx on public.renewal_tasks (due_date) where status in ('open', 'in_progress');

-- ---------------------------------------------------------------------------
-- Consent records: append-only evidence of what the customer agreed to and
-- when. A withdrawal is a new row with granted = false.
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.customers (id) on delete restrict,
  enquiry_id      uuid references public.enquiries (id) on delete restrict,
  purpose         public.consent_purpose not null,
  granted         boolean not null,
  -- Which privacy notice text the customer saw, e.g. "draft-2026-10".
  notice_version  text not null check (char_length(notice_version) between 1 and 40),
  method          public.consent_method not null,
  recorded_by     uuid references public.staff_users (id) on delete set null,
  client_ip_hash  text check (char_length(client_ip_hash) = 64),
  user_agent      text check (char_length(user_agent) <= 300),
  captured_at     timestamptz not null default now()
);
create index consent_records_customer_purpose_idx on public.consent_records (customer_id, purpose, captured_at desc);
create index consent_records_enquiry_id_idx on public.consent_records (enquiry_id);
create index consent_records_recorded_by_idx on public.consent_records (recorded_by);

-- ---------------------------------------------------------------------------
-- Audit logs: written only by triggers (next migration). Append-only.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor_id     uuid,              -- auth.uid() of the staff user, null for server/system
  actor_role   text not null,     -- database role: authenticated, service_role, postgres
  action       text not null check (action in ('insert', 'update', 'delete')),
  table_name   text not null,
  record_id    text not null,
  -- For updates, only the columns that changed; for insert/delete, the row.
  old_values   jsonb,
  new_values   jsonb
);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id, occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Rate limiting for the public enquiry endpoint. Private schema: not exposed.
-- ---------------------------------------------------------------------------
create table private.rate_limit_buckets (
  bucket_key    text not null,         -- e.g. "ip:<sha256>" or "phone:<sha256>"
  window_start  timestamptz not null,
  hits          integer not null default 0,
  primary key (bucket_key, window_start)
);
create index rate_limit_buckets_window_idx on private.rate_limit_buckets (window_start);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'staff_users', 'customers', 'vehicles', 'insurers', 'enquiries', 'quotations',
    'policies', 'follow_up_activities', 'renewal_tasks'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- Append-only tables
create trigger consent_records_append_only
  before update or delete on public.consent_records
  for each row execute function private.prevent_modification();

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_modification();
