-- Access-control tests. Run with: npx supabase test db
-- Uses the fictional seed data (supabase/seed.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

-- Helper: act as a given API role / Supabase Auth user for the rest of the tx.
create or replace function pg_temp.act_as(p_role text, p_user uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', p_role, 'sub', p_user)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

-- ===========================================================================
-- Every customer table has RLS enabled
-- ===========================================================================
select is(
  (select count(*)::int from pg_tables
    where schemaname = 'public'
      and tablename in ('staff_users','customers','vehicles','insurers','enquiries','quotations','policies',
                        'follow_up_activities','renewal_tasks','consent_records','audit_logs')
      and rowsecurity),
  11, 'RLS is enabled on all 11 tables');

select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0, 'anon holds no privileges on any public table');

-- ===========================================================================
-- Public visitors (anon): no reads, no writes, no RPC
-- ===========================================================================
select pg_temp.act_as('anon');

select throws_ok('select * from public.customers', '42501', null, 'anon cannot read customers');
select throws_ok('select * from public.enquiries', '42501', null, 'anon cannot read enquiries');
select throws_ok('select * from public.consent_records', '42501', null, 'anon cannot read consent records');
select throws_ok('select * from public.audit_logs', '42501', null, 'anon cannot read audit logs');
select throws_ok('select * from public.staff_users', '42501', null, 'anon cannot read staff');
select throws_ok(
  $$insert into public.customers (full_name, phone) values ('x', '0811111111')$$,
  '42501', null, 'anon cannot insert customers directly');
select throws_ok(
  $$select public.submit_enquiry('{}'::jsonb)$$,
  '42501', null, 'anon cannot call submit_enquiry (must go through the server endpoint)');
select throws_ok(
  $$select public.consume_rate_limit('x', 1, 60)$$,
  '42501', null, 'anon cannot call consume_rate_limit');
select throws_ok('select private.is_staff()', '42501', null, 'anon cannot use the private schema');
reset role;

-- ===========================================================================
-- Signed-in user who is NOT staff: sees nothing, writes nothing
-- ===========================================================================
select pg_temp.act_as('authenticated', '99999999-9999-4999-8999-999999999999');
select is((select count(*)::int from public.customers), 0, 'non-staff user sees no customers');
select is((select count(*)::int from public.enquiries), 0, 'non-staff user sees no enquiries');
select is((select count(*)::int from public.staff_users), 0, 'non-staff user sees no staff');
select throws_ok(
  $$insert into public.customers (full_name, phone) values ('x', '0811111112')$$,
  '42501', null, 'non-staff user cannot insert customers');
select throws_ok(
  $$insert into public.staff_users (id, email, full_name, role)
    values ('99999999-9999-4999-8999-999999999999', 'x@example.com', 'x', 'admin')$$,
  '42501', null, 'non-staff user cannot make themselves staff');
select throws_ok($$select public.submit_enquiry('{}'::jsonb)$$, '42501', null, 'authenticated cannot call submit_enquiry');
reset role;

-- ===========================================================================
-- Viewer: read-only
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103');
select is((select count(*)::int from public.customers), 6, 'viewer reads customers');
select is((select count(*)::int from public.enquiries), 3, 'viewer reads enquiries');
select throws_ok(
  $$insert into public.customers (full_name, phone) values ('x', '0811111113')$$,
  '42501', null, 'viewer cannot insert customers');
select is_empty(
  $$update public.customers set notes = 'changed' where phone = '0800000101' returning id$$,
  'viewer update affects no rows');
select is((select count(*)::int from public.audit_logs), 0, 'viewer cannot read audit logs');
reset role;

-- ===========================================================================
-- Agent: read and write, no delete, no staff management
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select lives_ok(
  $$insert into public.customers (full_name, phone) values ('ลูกค้า สมมติใหม่', '0800000199')$$,
  'agent can add a customer');
select isnt_empty(
  $$update public.enquiries set status = 'contacted' where reference = 'CK-261004-DEM3' returning id$$,
  'agent can update an enquiry');
select is_empty(
  $$delete from public.customers where phone = '0800000199' returning id$$,
  'agent cannot delete customers');
select is_empty(
  $$update public.staff_users set role = 'admin' where id = '11111111-1111-4111-8111-111111111102' returning id$$,
  'agent cannot promote themselves (update matches no rows)');
select is(
  (select role::text from public.staff_users where id = '11111111-1111-4111-8111-111111111102'),
  'agent', 'agent role is unchanged');
select lives_ok(
  $$insert into public.consent_records (customer_id, purpose, granted, notice_version, method, recorded_by)
    values ('33333333-3333-4333-8333-333333333302', 'marketing', true, 'draft-2026-10', 'phone',
            '11111111-1111-4111-8111-111111111102')$$,
  'agent can record consent taken by phone');
select throws_ok(
  $$insert into public.consent_records (customer_id, purpose, granted, notice_version, method, recorded_by)
    values ('33333333-3333-4333-8333-333333333302', 'marketing', true, 'draft-2026-10', 'web_form',
            '11111111-1111-4111-8111-111111111102')$$,
  '42501', null, 'agent cannot forge a web-form consent record');
select throws_ok(
  $$update public.consent_records set granted = false where customer_id = '33333333-3333-4333-8333-333333333301'$$,
  '42501', null, 'consent records cannot be edited');
reset role;

-- ===========================================================================
-- Admin
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111101');
select ok((select count(*) from public.audit_logs) > 0, 'admin reads audit logs');
select isnt_empty($$delete from public.customers where phone = '0800000199' returning id$$, 'admin can delete a customer');
select throws_ok($$delete from public.audit_logs$$, '42501', null, 'even admins cannot delete audit logs');
reset role;

-- Deactivated staff lose access immediately.
update public.staff_users set is_active = false where id = '11111111-1111-4111-8111-111111111103';
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103');
select is((select count(*)::int from public.customers), 0, 'deactivated staff see nothing');
reset role;

-- ===========================================================================
-- Server path (service_role): submit_enquiry and duplicate handling
-- ===========================================================================
select pg_temp.act_as('service_role');

create temp table r1 as select public.submit_enquiry(jsonb_build_object(
  'type', 'quote', 'product', 'car_2plus', 'name', 'ทดสอบ ส่งฟอร์ม', 'phone', '0800000150',
  'preferred_channel', 'line', 'vehicle_description', 'Honda City', 'model_year', 2021,
  'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'notice_version', 'draft-2026-10',
  'marketing_consent', false)) as res;

select is((select res->>'duplicate' from r1), 'false', 'first submission creates an enquiry');
select matches((select res->>'reference' from r1), '^CK-[0-9]{6}-[A-Z0-9]{4}$', 'reference has the CK-YYMMDD-XXXX format');

select is(
  (select public.submit_enquiry(jsonb_build_object(
     'type', 'quote', 'product', 'car_2plus', 'name', 'ทดสอบ ส่งฟอร์ม', 'phone', '0800000150',
     'preferred_channel', 'line', 'vehicle_description', 'Honda City', 'model_year', 2021,
     'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'notice_version', 'draft-2026-10')) ->> 'duplicate_reason'),
  'idempotency_key', 'same idempotency key returns the existing enquiry');

select is(
  (select public.submit_enquiry(jsonb_build_object(
     'type', 'quote', 'product', 'car_2plus', 'name', 'ชื่อสะกดต่าง', 'phone', '0800000150',
     'preferred_channel', 'phone', 'vehicle_description', 'honda city', 'model_year', 2021,
     'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'notice_version', 'draft-2026-10')) ->> 'reference'),
  (select res->>'reference' from r1), 'same request within 30 minutes returns the same reference');

select is(
  (select count(*)::int from public.enquiries where contact_phone = '0800000150'), 1,
  'duplicates do not create extra enquiries');
select is(
  (select count(*)::int from public.consent_records c join public.enquiries e on e.id = c.enquiry_id
    where e.contact_phone = '0800000150'), 2,
  'submission records quote-processing and marketing consent');

-- Quote details (20261011090000): brand and model kept separately, renewal timing, product answers.
create temp table r2 as select public.submit_enquiry(jsonb_build_object(
  'type', 'quote', 'product', 'ev', 'name', 'ทดสอบ อีวี', 'phone', '0800000151',
  'preferred_channel', 'phone', 'vehicle_make', 'BYD', 'vehicle_model', 'Atto 3', 'model_year', 2024,
  'renewal_timing', 'within_1_month', 'details', jsonb_build_object('ev_home_charger', 'yes'),
  'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1', 'notice_version', 'draft-2026-10',
  'marketing_consent', true)) as res;
select is(
  (select v.make || '|' || v.model || '|' || v.description || '|' || v.is_ev
     from public.enquiries e join public.vehicles v on v.id = e.vehicle_id where e.reference = (select res->>'reference' from r2)),
  'BYD|Atto 3|BYD Atto 3|true', 'brand and model stored separately; description built from them');
select is(
  (select renewal_timing || '|' || (details ->> 'ev_home_charger') from public.enquiries where reference = (select res->>'reference' from r2)),
  'within_1_month|yes', 'renewal timing and product-specific details stored');
select is(
  (select string_agg(c.purpose || '=' || c.granted || '@' || c.notice_version, ',' order by c.purpose)
     from public.consent_records c join public.enquiries e on e.id = c.enquiry_id where e.reference = (select res->>'reference' from r2)),
  'quote_processing=true@draft-2026-10,marketing=true@draft-2026-10',
  'quote processing and optional marketing recorded as separate rows with the notice version');
select is(
  (select (public.submit_enquiry(jsonb_build_object(
     'type', 'quote', 'product', 'compulsory', 'name', 'ทดสอบ พรบ', 'phone', '0800000152',
     'preferred_channel', 'phone', 'details', '["not", "an", "object"]'::jsonb,
     'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab2', 'notice_version', 'draft-2026-10')) ->> 'duplicate')),
  'false', 'non-object details are ignored rather than stored');
select is((select details::text || '|' || (vehicle_id is null) from public.enquiries where contact_phone = '0800000152'), '{}|true',
  'no details and no empty vehicle row for a พ.ร.บ. request without a car');
select throws_ok(
  $$select public.submit_enquiry(jsonb_build_object(
     'type', 'quote', 'product', 'car_1', 'name', 'ทดสอบ', 'phone', '0800000153', 'preferred_channel', 'phone',
     'renewal_timing', 'someday', 'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab3', 'notice_version', 'draft-2026-10'))$$,
  '23514', null, 'unknown renewal timing is rejected by the table check');
select throws_ok(
  $$select public.submit_enquiry(jsonb_build_object(
     'type', 'quote', 'product', 'car_1', 'name', 'ทดสอบ', 'phone', '0800000154', 'preferred_channel', 'phone',
     'details', jsonb_build_object('note', repeat('x', 3000)),
     'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab4', 'notice_version', 'draft-2026-10'))$$,
  '23514', null, 'oversized details are rejected by the table check');

-- Existing customer details are not overwritten by the public form.
select public.submit_enquiry(jsonb_build_object(
  'type', 'contact', 'name', 'ชื่อปลอม', 'phone', '0800000101', 'preferred_channel', 'phone',
  'message', 'สอบถามการต่ออายุ', 'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'notice_version', 'draft-2026-10'));
select is((select full_name from public.customers where phone = '0800000101'), 'สมมติ ใจดี',
  'public submission does not rename an existing customer');
reset role;

-- The seed runs the renewal job once; the active policy expiring in 65 days has its task.
select is((select count(*)::int from public.renewal_tasks where policy_id = '77777777-7777-4777-8777-777777777701'), 1,
  'renewal job created a task for the policy expiring within 90 days');

select * from finish();
rollback;
