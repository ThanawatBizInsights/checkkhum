-- Customer self-registration tests: profiles, no staff rights, no claiming of
-- existing CRM records, submitted-enquiry visibility, A/B isolation.
-- Run with: npx supabase test db   (uses the fictional seed)
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

create or replace function pg_temp.act_as(p_role text, p_user uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

-- What Supabase Auth inserts for a public sign-up (email not yet confirmed).
create or replace function pg_temp.sign_up(p_id uuid, p_email text, p_name text)
returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt('x', extensions.gen_salt('bf')),
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', p_name, 'privacy_notice_version', 'draft-2026-10'),
          now(), now(), '', '', '', '', '', '', '', '');
$$;

-- Self-registered R1 uses the email of an EXISTING CRM customer that has no
-- login (customer 3333…304 gets that email), and the phone-like name of another.
update public.customers set email = 'existing-crm@checkkhum.example' where id = '33333333-3333-4333-8333-333333333304';
select pg_temp.sign_up('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'existing-crm@checkkhum.example', 'คนสมัครเอง หนึ่ง');
select pg_temp.sign_up('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'self-two@checkkhum.example', '  คนสมัครเอง สอง  ');
select pg_temp.sign_up('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03', 'self-three@checkkhum.example', '');

-- ===========================================================================
-- Profile creation
-- ===========================================================================
select is((select count(*)::int from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'), 1, 'sign-up creates one profile');
select is((select source from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'), 'self_registration', 'profile marked self-registered');
select is((select full_name from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'), 'คนสมัครเอง สอง', 'name is trimmed');
select is((select full_name from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'), 'self-three', 'blank name falls back to the email name');
select isnt((select privacy_acknowledged_at from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'), null, 'privacy acknowledgement recorded');
select is((select count(*)::int from public.customer_profiles p join public.staff_users s on s.id = p.user_id), 0, 'no staff login has a customer profile');

-- Duplicates: the trigger and the fallback both insert "on conflict do nothing".
select throws_ok($$insert into public.customer_profiles (user_id, full_name, email, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'x', 'x', 'other')$$,
  '23505', null, 'a second profile for the same login is refused');
select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01');
select lives_ok('select public.portal_session()', 'portal_session runs for a new customer');
select lives_ok('select public.portal_session()', 'and again (idempotent)');
reset role;
select is((select count(*)::int from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'), 1, 'still exactly one profile');

-- Fallback repairs a missing profile.
delete from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02');
select is(public.portal_session(), 'unverified', 'unverified sign-up is reported as unverified');
reset role;
select is((select count(*)::int from public.customer_profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'), 1, 'missing profile re-created on first use');

-- Staff never get one, even through the fallback.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select is(public.portal_session(), 'staff', 'staff are reported as staff');
reset role;
select is((select count(*)::int from public.customer_profiles where user_id = '11111111-1111-4111-8111-111111111102'), 0, 'staff still have no profile');

-- ===========================================================================
-- Registration grants nothing and claims nothing
-- ===========================================================================
-- Confirm R1's email (as Supabase does after the verification link).
update auth.users set email_confirmed_at = now()
 where id in ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03');

select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01');
select is(public.portal_session(), 'none', 'verified email of an existing CRM customer does NOT link without an invitation');
select is(private.is_staff(), false, 'self-registered user is not staff');
select is(private.current_customer_id(), null, 'no CRM customer attached');
select is(public.portal_overview() ->> 'linked', 'false', 'overview: not linked');
select is(public.portal_overview() -> 'customer' ->> 'full_name', 'คนสมัครเอง หนึ่ง', 'overview greets with the profile name');
select is(jsonb_array_length(public.portal_overview() -> 'policies'), 0, 'no policies of the matching CRM customer');
select is((select count(*)::int from public.customers), 0, 'no customers rows');
select is((select count(*)::int from public.policies), 0, 'no policies rows');
select is((select count(*)::int from public.policy_documents), 0, 'no documents');
select is((select count(*)::int from storage.objects where bucket_id = 'policy-documents'), 0, 'no stored files');
select is((select count(*)::int from public.staff_users), 0, 'cannot see staff');
select throws_ok($$insert into public.staff_users (id, email, full_name, role) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'existing-crm@checkkhum.example', 'x', 'admin')$$,
  '42501', null, 'cannot make itself staff');
select throws_ok($$insert into public.customer_accounts (user_id, customer_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '33333333-3333-4333-8333-333333333304')$$,
  '42501', null, 'cannot link itself to the CRM customer');
select throws_ok($$insert into public.customer_profiles (user_id, full_name, email, source) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', 'x', 'x', 'other')$$,
  '42501', null, 'cannot insert profiles directly');
select throws_ok($$update public.customer_profiles set source = 'invitation'$$, '42501', null, 'cannot change anything but the name');
select isnt_empty($$update public.customer_profiles set full_name = 'ชื่อใหม่' returning user_id$$, 'can rename itself');
select throws_ok($$select public.record_enquiry_submitter('CK-261001-DEM1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01')$$,
  '42501', null, 'cannot attach enquiries to itself');
select throws_ok($$select public.portal_request_renewal('77777777-7777-4777-8777-777777777702')$$, '42501', null, 'cannot request renewal of the CRM customer''s policy');
reset role;
select is((select count(*)::int from public.customer_accounts where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01'), 0, 'still not linked');

-- A staff invitation is still the only way in, and it works for a self-registered login.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
insert into public.customer_invitations (customer_id, email) values ('33333333-3333-4333-8333-333333333304', 'existing-crm@checkkhum.example');
reset role;
select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01');
select is(public.portal_session(), 'linked', 'after a staff invitation the verified login is linked');
select is(public.portal_overview() ->> 'linked', 'true', 'overview: linked');
reset role;

-- ===========================================================================
-- Enquiries submitted while signed in: own only
-- ===========================================================================
-- Fresh web enquiry (as the website server would store it), then attributed.
insert into public.enquiries (id, customer_id, type, product, source, contact_name, contact_phone, reference)
values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01', '33333333-3333-4333-8333-333333333305', 'quote', 'car_1', 'web_quote_form', 'คนสมัครเอง สอง', '0800000105', 'CK-261009-SELF');
select is(public.record_enquiry_submitter('CK-261009-SELF', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02'), true, 'server attributes the enquiry to the signed-in user');
select is(public.record_enquiry_submitter('CK-261009-SELF', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'), false, 'an attributed enquiry cannot be re-attributed');
update public.enquiries set created_at = now() - interval '1 day' where reference = 'CK-261001-DEM1';
select is(public.record_enquiry_submitter('CK-261001-DEM1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03'), false, 'old enquiries cannot be claimed');

select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02');
select is(public.portal_overview() -> 'enquiries' -> 0 ->> 'reference', 'CK-261009-SELF', 'R2 sees its own submitted enquiry');
select ok(public.portal_overview()::text not like '%DEMO-POL-0003%', 'but none of the matched CRM customer''s policies');
reset role;
select pg_temp.act_as('authenticated', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03');
select is(jsonb_array_length(public.portal_overview() -> 'enquiries'), 0, 'R3 does not see R2''s enquiry');
reset role;

select * from finish();
rollback;
