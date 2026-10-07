-- Customer portal tests: account linking, ownership, documents, staff separation.
-- Run with: npx supabase test db   (uses the fictional seed)
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

create or replace function pg_temp.act_as(p_role text, p_user uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

-- Fixed ids from supabase/seed.sql
-- agent       11111111-1111-4111-8111-111111111102   viewer 11111111-1111-4111-8111-111111111103
-- admin       11111111-1111-4111-8111-111111111101   outsider (not staff, not customer) …105
-- customer A  user …201 → customer 3333…301 (policy 7777…701)
-- customer B  user …202 → customer 3333…302 (policy 7777…706)

-- Documents to test with (one approved and one draft for each customer).
-- The approval trigger needs a staff uid, so insert as the agent.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
insert into public.policy_documents (id, policy_id, kind, title, storage_path, content_type, size_bytes, visible_to_customer) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd01', '77777777-7777-4777-8777-777777777701', 'policy', 'A approved',
   '77777777-7777-4777-8777-777777777701/dddddddd-dddd-4ddd-8ddd-dddddddddd01.pdf', 'application/pdf', 1000, true),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd02', '77777777-7777-4777-8777-777777777701', 'receipt', 'A draft',
   '77777777-7777-4777-8777-777777777701/dddddddd-dddd-4ddd-8ddd-dddddddddd02.pdf', 'application/pdf', 1000, false),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd03', '77777777-7777-4777-8777-777777777706', 'policy', 'B approved',
   '77777777-7777-4777-8777-777777777706/dddddddd-dddd-4ddd-8ddd-dddddddddd03.pdf', 'application/pdf', 1000, true);
reset role;
-- Storage rows for the same paths (metadata only; enough to test policies).
insert into storage.objects (bucket_id, name, owner_id) values
  ('policy-documents', '77777777-7777-4777-8777-777777777701/dddddddd-dddd-4ddd-8ddd-dddddddddd01.pdf', null),
  ('policy-documents', '77777777-7777-4777-8777-777777777701/dddddddd-dddd-4ddd-8ddd-dddddddddd02.pdf', null),
  ('policy-documents', '77777777-7777-4777-8777-777777777706/dddddddd-dddd-4ddd-8ddd-dddddddddd03.pdf', null);

-- ===========================================================================
-- Structure
-- ===========================================================================
select is(
  (select count(*)::int from pg_tables where schemaname = 'public'
     and tablename in ('customer_invitations', 'customer_accounts', 'policy_documents') and rowsecurity),
  3, 'RLS enabled on the 3 portal tables');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'),
  0, 'anon still has no table privileges');
select is((select public from storage.buckets where id = 'policy-documents'), false, 'document bucket is private');
select is((select approved_by from public.policy_documents where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01'),
  '11111111-1111-4111-8111-111111111102'::uuid, 'approval stamped with the approving staff member');
select is((select approved_at from public.policy_documents where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd02'),
  null, 'unapproved document has no approval stamp');

-- ===========================================================================
-- Anonymous visitors
-- ===========================================================================
select pg_temp.act_as('anon');
select throws_ok('select public.portal_overview()', '42501', null, 'anon cannot call portal_overview');
select throws_ok($$select public.portal_request_renewal('77777777-7777-4777-8777-777777777701')$$, '42501', null, 'anon cannot request renewals');
select throws_ok('select public.accept_customer_invitation()', '42501', null, 'anon cannot accept invitations');
select throws_ok('select * from public.policy_documents', '42501', null, 'anon cannot read documents');
select is((select count(*)::int from storage.objects where bucket_id = 'policy-documents'), 0, 'anon sees no stored files');
reset role;

-- ===========================================================================
-- Customer A
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111201');
select is(public.accept_customer_invitation(), 'linked', 'A is linked (idempotent)');
select is(public.portal_overview() -> 'customer' ->> 'full_name', 'สมมติ ใจดี', 'A sees own name');
select is(jsonb_array_length(public.portal_overview() -> 'policies'), 1, 'A sees exactly one policy');
select is(public.portal_overview() -> 'policies' -> 0 ->> 'policy_number', 'DEMO-POL-0001', 'A sees own policy only');
select is(public.portal_overview() -> 'policies' -> 0 -> 'vehicle' ->> 'description', 'Toyota Yaris Ativ', 'A sees insured vehicle');
select is((select count(*)::int from jsonb_array_elements(public.portal_overview() -> 'quotations') q where q ->> 'status' = 'draft'),
  0, 'drafts never shown to customers');
select ok(public.portal_overview()::text not like '%ลูกค้าสมมติสำหรับทดสอบ%', 'customer notes are not in the overview');
select ok(not (public.portal_overview() -> 'quotations' -> 0 ? 'notes'), 'quotation notes are not in the overview');
select ok(not (public.portal_overview() -> 'quotations' -> 0 ? 'prepared_by'), 'staff names are not in the overview');

-- Direct table access: none of the CRM tables return rows to a customer.
select is((select count(*)::int from public.customers), 0, 'A reads no customers rows directly');
select is((select count(*)::int from public.enquiries), 0, 'A reads no enquiries directly');
select is((select count(*)::int from public.quotations), 0, 'A reads no quotations directly');
select is((select count(*)::int from public.policies), 0, 'A reads no policies directly');
select is((select count(*)::int from public.vehicles), 0, 'A reads no vehicles directly');
select is((select count(*)::int from public.follow_up_activities), 0, 'A reads no notes');
select is((select count(*)::int from public.follow_up_tasks), 0, 'A reads no staff tasks');
select is((select count(*)::int from public.renewal_tasks), 0, 'A reads no renewal tasks');
select is((select count(*)::int from public.staff_users), 0, 'A reads no staff');
select is((select count(*)::int from public.customer_invitations), 0, 'A reads no invitations');
select is((select count(*)::int from public.customer_accounts), 1, 'A reads only its own account link');
select is((select count(*)::int from public.search_customers('สมมติ')), 0, 'A cannot search customers');

-- Documents: own approved only.
select results_eq('select id from public.policy_documents order by id',
  $$values ('dddddddd-dddd-4ddd-8ddd-dddddddddd01'::uuid)$$, 'A sees only its own approved document');
select results_eq($$select name from storage.objects where bucket_id = 'policy-documents' order by name$$,
  $$values ('77777777-7777-4777-8777-777777777701/dddddddd-dddd-4ddd-8ddd-dddddddddd01.pdf'::text)$$,
  'A can download only its own approved file');

-- Writes are refused.
select throws_ok($$insert into public.customer_accounts (user_id, customer_id) values ('11111111-1111-4111-8111-111111111201', '33333333-3333-4333-8333-333333333302')$$,
  '42501', null, 'A cannot link itself to another customer');
select throws_ok($$insert into public.policy_documents (policy_id, kind, title, storage_path, content_type, size_bytes)
                   values ('77777777-7777-4777-8777-777777777701', 'other', 'x', '77777777-7777-4777-8777-777777777701/dddddddd-dddd-4ddd-8ddd-dddddddddd09.pdf', 'application/pdf', 1)$$,
  '42501', null, 'A cannot add documents');
select is_empty($$update public.policy_documents set visible_to_customer = true where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd02' returning id$$,
  'A cannot approve its own draft document');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('policy-documents', '77777777-7777-4777-8777-777777777701/x.pdf')$$,
  '42501', null, 'A cannot upload files');

-- Renewal requests: own policy only, duplicates return the open one.
select is((public.portal_request_renewal('77777777-7777-4777-8777-777777777701', 'ขอราคาปีหน้า') ->> 'duplicate')::boolean, false, 'A opens a renewal enquiry');
select is((public.portal_request_renewal('77777777-7777-4777-8777-777777777701') ->> 'duplicate')::boolean, true, 'a second click returns the open enquiry');
select throws_ok($$select public.portal_request_renewal('77777777-7777-4777-8777-777777777706')$$, 'P0002', null, 'A cannot ask to renew B''s policy');
select is(public.portal_overview() -> 'policies' -> 0 ->> 'open_renewal_reference' is not null, true, 'overview shows the open renewal request');
reset role;

select is((select source::text || '/' || status::text || '/' || product::text from public.enquiries
            where renewal_policy_id = '77777777-7777-4777-8777-777777777701'),
  'customer_portal/new/car_1', 'renewal request reaches the CRM pipeline as a new enquiry');

-- ===========================================================================
-- Customer B never sees A's data
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111202');
select is(public.portal_overview() -> 'policies' -> 0 ->> 'policy_number', 'DEMO-POL-0006', 'B sees own policy');
select ok(public.portal_overview()::text not like '%DEMO-POL-0001%', 'B does not see A''s policy');
select results_eq('select id from public.policy_documents', $$values ('dddddddd-dddd-4ddd-8ddd-dddddddddd03'::uuid)$$, 'B sees only its own document');
select is((select count(*)::int from storage.objects where name like '77777777-7777-4777-8777-777777777701/%'), 0, 'B cannot download A''s files');
reset role;

-- ===========================================================================
-- Linking rules
-- ===========================================================================
-- Outsider (signed in, no invitation) gets nothing.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111105');
select is(public.accept_customer_invitation(), 'none', 'no invitation, no link');
select is(public.portal_overview() ->> 'linked', 'false', 'unlinked user: overview says not linked');
select is(jsonb_array_length(public.portal_overview() -> 'policies'), 0, 'unlinked user sees no policies');
reset role;

-- An invitation for the outsider's address links only after email is verified.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
insert into public.customer_invitations (customer_id, email) values ('33333333-3333-4333-8333-333333333303', 'outsider@checkkhum.example');
reset role;
update auth.users set email_confirmed_at = null where id = '11111111-1111-4111-8111-111111111105';
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111105');
select is(public.accept_customer_invitation(), 'unverified', 'unverified email is not linked');
reset role;
update auth.users set email_confirmed_at = now() where id = '11111111-1111-4111-8111-111111111105';
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111105');
select is(public.accept_customer_invitation(), 'linked', 'verified email with a pending invitation is linked');
select is(public.portal_overview() -> 'customer' ->> 'full_name', 'ทดลอง เที่ยวไกล', 'linked to the invited customer');
reset role;

-- Staff are never linked as customers, even when invited.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
insert into public.customer_invitations (customer_id, email) values ('33333333-3333-4333-8333-333333333304', 'viewer@checkkhum.example');
reset role;
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103');
select is(public.accept_customer_invitation(), 'staff', 'staff login is not linked to a customer');
select is(public.portal_overview(), null, 'staff get no portal overview');
reset role;

-- Viewers cannot invite; nobody can un-revoke.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103');
select throws_ok($$insert into public.customer_invitations (customer_id, email) values ('33333333-3333-4333-8333-333333333305', 'x@checkkhum.example')$$,
  '42501', null, 'viewer cannot invite customers');
reset role;
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select throws_ok($$update public.customer_invitations set email = 'other@checkkhum.example' where customer_id = '33333333-3333-4333-8333-333333333304'$$,
  '42501', null, 'invitations cannot be redirected to another email');
reset role;

-- A customer login can't be made staff.
select throws_ok($$insert into public.staff_users (id, email, full_name, role) values ('11111111-1111-4111-8111-111111111201', 'customer-a@checkkhum.example', 'x', 'agent')$$,
  'P0001', null, 'customer login cannot become staff');

select * from finish();
rollback;
