-- LINE Login tests: one-to-one LINE mapping, server-only writes, staff kept
-- out, LINE invitation links, isolation.
-- Run with: npx supabase test db   (uses the fictional seed)
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

create or replace function pg_temp.act_as(p_role text, p_user uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

-- What the server's Auth admin call creates for a new LINE user.
create or replace function pg_temp.line_user(p_id uuid, p_sub text, p_name text)
returns void language sql as $$
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change,
                          email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', lower(p_sub) || '@line.checkkhum.invalid', '', now(),
          '{"provider":"email","providers":["email"],"checkkhum_line":true}', jsonb_build_object('full_name', p_name),
          now(), now(), '', '', '', '', '', '', '', '');
$$;

-- LINE user ids (format U + 32 hex)
-- L1 Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1   L2 Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2
select pg_temp.line_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', 'ไลน์ หนึ่ง');
select pg_temp.line_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2', 'ไลน์ สอง');

-- ===========================================================================
-- Structure and grants
-- ===========================================================================
select is((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'customer_line_accounts'), true, 'RLS on customer_line_accounts');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'), 0, 'anon still has no table privileges');
select is(has_function_privilege('authenticated', 'public.link_line_account(uuid,text,text,text)', 'EXECUTE'), false, 'customers cannot call link_line_account');
select is(has_function_privilege('authenticated', 'public.line_login_user(text)', 'EXECUTE'), false, 'customers cannot call line_login_user');
select is(has_function_privilege('anon', 'public.accept_invitation_token(text)', 'EXECUTE'), false, 'anon cannot accept invitation links');
select is((select source from public.customer_profiles where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'), 'line', 'LINE login gets a profile marked line');
select is((select full_name from public.customer_profiles where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'), 'ไลน์ หนึ่ง', 'profile uses the LINE display name');

-- ===========================================================================
-- Mapping (as the website server)
-- ===========================================================================
select pg_temp.act_as('service_role');
select is(public.link_line_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', 'ไลน์ หนึ่ง', 'https://profile.line-scdn.net/x'), 'linked', 'new LINE user mapped');
select is(public.link_line_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1', 'ชื่อใหม่', null), 'already', 'same pair: refreshed');
select is(public.line_login_user('Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01'::uuid, 'lookup finds the mapped login');
select is(public.line_login_user('Uccccccccccccccccccccccccccccccc3'), null, 'unknown LINE user: no login');
select is(public.link_line_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'), 'line_taken', 'a LINE user cannot be mapped to a second login');
select is(public.link_line_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2'), 'user_has_other_line', 'a login cannot get a second LINE user');
select is(public.link_line_account('11111111-1111-4111-8111-111111111102', 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2'), 'staff', 'staff logins are never mapped');
select is(public.link_line_account('00000000-0000-4000-8000-000000000000', 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2'), 'no_user', 'unknown login refused');
select throws_ok($$select public.link_line_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02', 'not-a-line-id')$$, '23514', null, 'malformed LINE user id rejected');
-- Existing email customer A (seed) links LINE L2 explicitly.
select is(public.link_line_account('11111111-1111-4111-8111-111111111201', 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2', 'เอ ใน LINE'), 'linked', 'existing email login can link a LINE user');
reset role;
select is((select display_name from public.customer_line_accounts where line_user_id = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'), 'ชื่อใหม่', 'display name refreshed on login');
select is((select picture_url from public.customer_line_accounts where line_user_id = 'Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'), null, 'picture cleared when LINE has none');

-- Staff can't be created for a LINE-mapped login.
select throws_ok($$insert into public.staff_users (id, email, full_name, role) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'x@checkkhum.example', 'x', 'agent')$$,
  'P0001', null, 'a LINE login cannot become staff');

-- ===========================================================================
-- Customers: own row only, no writes
-- ===========================================================================
select pg_temp.act_as('authenticated', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01');
select results_eq('select line_user_id from public.customer_line_accounts', $$values ('Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1'::text)$$, 'LINE customer sees only its own LINE link');
select throws_ok($$insert into public.customer_line_accounts (user_id, line_user_id) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'Ucccccccccccccccccccccccccccccccc3')$$,
  '42501', null, 'customers cannot insert LINE links');
select throws_ok($$update public.customer_line_accounts set line_user_id = 'Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2'$$, '42501', null, 'customers cannot change LINE links');
select is_empty($$delete from public.customer_line_accounts returning id$$, 'customers cannot delete LINE links');
select throws_ok($$select public.link_line_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'Ucccccccccccccccccccccccccccccccc3')$$, '42501', null, 'customers cannot map LINE users');
select is(public.portal_overview() ->> 'linked', 'false', 'new LINE login: not linked to any CRM customer');
select is(jsonb_array_length(public.portal_overview() -> 'policies'), 0, 'and sees no policies');
select is((select count(*)::int from public.customers), 0, 'and no customers rows');
reset role;

select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111101');
select is((select count(*)::int from public.customer_line_accounts), 2, 'staff see LINE links');
reset role;

-- ===========================================================================
-- LINE invitation links
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103');
select throws_ok($$select public.create_line_invitation('33333333-3333-4333-8333-333333333304')$$, '42501', null, 'viewers cannot create invitation links');
reset role;
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select throws_ok($$select public.create_line_invitation('33333333-3333-4333-8333-333333333301')$$, 'P0001', null, 'no link for an already linked customer');
create temp table t_token on commit drop as select public.create_line_invitation('33333333-3333-4333-8333-333333333304') as token;
reset role;
grant select on t_token to authenticated;
select is((select token_hash from public.customer_invitations where customer_id = '33333333-3333-4333-8333-333333333304' and revoked_at is null),
  (select encode(extensions.digest(token, 'sha256'), 'hex') from t_token), 'only the hash of the token is stored');

select pg_temp.act_as('authenticated', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02');
select is(public.accept_invitation_token('0123456789abcdef0123456789abcdef0123456789abcdef'), 'invalid', 'a guessed token links nothing');
select is(public.accept_invitation_token((select token from t_token)), 'linked', 'the invited LINE login is linked to the customer');
select is(public.portal_overview() -> 'policies' -> 0 ->> 'policy_number', 'DEMO-POL-0002', 'and now sees that customer''s policy');
reset role;
select pg_temp.act_as('authenticated', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01');
select is(public.accept_invitation_token((select token from t_token)), 'invalid', 'the link works only once');
select is((public.portal_overview() -> 'policies')::text, '[]', 'the other LINE login still sees nothing');
reset role;
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select is(public.accept_invitation_token((select token from t_token)), 'staff', 'staff cannot accept invitation links');
reset role;

select * from finish();
rollback;
