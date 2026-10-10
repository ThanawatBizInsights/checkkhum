-- Customer LINE contact details (20261012090000_customer_line_contact.sql) and the
-- LINE OA conversation link (20261013090000_customer_line_oa_chat.sql).
-- Uses the fictional seed data (supabase/seed.sql).
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

create or replace function pg_temp.act_as(p_role text, p_user uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', p_role, 'sub', p_user)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

-- ---------------------------------------------------------------------------
-- URL and ID formats
-- ---------------------------------------------------------------------------
select ok(private.is_line_url('https://line.me/ti/p/~somchai.demo'), 'line.me profile link accepted');
select ok(private.is_line_url('https://lin.ee/AbC123x'), 'lin.ee link accepted');
select ok(private.is_line_url('https://page.line.me/abc1234'), 'page.line.me accepted');
select ok(not private.is_line_url('http://line.me/ti/p/~x'), 'plain http refused');
select ok(not private.is_line_url('javascript:alert(1)'), 'javascript: refused');
select ok(not private.is_line_url('https://line.me.example.com/ti/p/x'), 'look-alike host refused');
select ok(not private.is_line_url('https://line.me@evil.example/x'), 'userinfo trick refused');
select ok(not private.is_line_url('https://evil.example/line.me'), 'other host refused');
select ok(not private.is_line_url('https://line.me/ti/p/x y'), 'spaces refused');
select ok(private.is_line_id('@checkkhum') and private.is_line_id('somchai_99.demo'), 'LINE IDs with @, dot, underscore accepted');
select ok(not private.is_line_id('somchai demo') and not private.is_line_id('<b>x</b>'), 'LINE IDs with spaces or markup refused');

-- ---------------------------------------------------------------------------
-- Staff edit the customer's LINE details; source and time are stamped
-- ---------------------------------------------------------------------------
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102'); -- agent
update public.customers
   set line_display_name = 'สมมติ', line_id = 'sommut.demo', line_url = 'https://line.me/ti/p/~sommut.demo'
 where id = '33333333-3333-4333-8333-333333333302';
select is((select line_contact_source || '/' || (line_contact_updated_at is not null)::text from public.customers where id = '33333333-3333-4333-8333-333333333302'),
  'staff_entry/true', 'agent edit is stored as an unverified staff entry with a timestamp');
select throws_ok(
  $$update public.customers set line_url = 'https://evil.example/x' where id = '33333333-3333-4333-8333-333333333302'$$,
  '23514', null, 'an unsupported link is refused by the table');
select throws_ok(
  $$update public.customers set line_url = 'javascript:alert(1)' where id = '33333333-3333-4333-8333-333333333302'$$,
  '23514', null, 'a javascript: link is refused by the table');
update public.customers set line_display_name = null, line_id = null, line_url = null where id = '33333333-3333-4333-8333-333333333302';
select is((select coalesce(line_contact_source, 'none') from public.customers where id = '33333333-3333-4333-8333-333333333302'), 'none',
  'clearing all three clears the source');
reset role;

select ok(exists (select 1 from public.audit_logs where table_name = 'customers' and record_id = '33333333-3333-4333-8333-333333333302'
                    and actor_id = '11111111-1111-4111-8111-111111111102' and new_values ? 'line_url'),
  'the edit is in the audit log with the agent as actor');

-- Viewers and outsiders cannot change LINE details.
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103'); -- viewer
update public.customers set line_id = 'hijack' where id = '33333333-3333-4333-8333-333333333301';
reset role;
select is((select line_id from public.customers where id = '33333333-3333-4333-8333-333333333301'), 'sommut.demo', 'viewer update changes nothing');
select pg_temp.act_as('anon');
select throws_ok($$select line_url from public.customers$$, '42501', null, 'anon cannot read customer LINE details');
reset role;

-- ---------------------------------------------------------------------------
-- Intake: LINE details saved with the enquiry; a new customer gets them as a
-- web-form entry; an existing customer is never changed by the public form.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('service_role');
create temp table r_line as select public.submit_enquiry(jsonb_build_object(
  'type', 'quote', 'product', 'car_1', 'name', 'ทดสอบ ไลน์', 'phone', '0800000160', 'preferred_channel', 'line',
  'line_id', '@newcustomer', 'line_url', 'https://lin.ee/Zz9Yy8x',
  'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac1', 'notice_version', 'draft-2026-10')) as res;
select is(
  (select e.contact_line_id || '|' || e.contact_line_url || '|' || c.line_id || '|' || c.line_url || '|' || c.line_contact_source
     from public.enquiries e join public.customers c on c.id = e.customer_id where e.reference = (select res->>'reference' from r_line)),
  '@newcustomer|https://lin.ee/Zz9Yy8x|@newcustomer|https://lin.ee/Zz9Yy8x|web_form',
  'new customer: LINE details on the enquiry and on the customer, marked web_form');

select public.submit_enquiry(jsonb_build_object(
  'type', 'quote', 'product', 'car_1', 'name', 'คนอื่น', 'phone', '0800000101', 'preferred_channel', 'line',
  'line_id', 'someone.else', 'line_url', 'https://line.me/ti/p/~someone.else',
  'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2', 'notice_version', 'draft-2026-10'));
select is((select line_id || '|' || coalesce(line_url, '-') from public.customers where phone = '0800000101'), 'sommut.demo|-',
  'existing customer: the public form does not change their LINE details');
select is((select contact_line_id from public.enquiries where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2'), 'someone.else',
  'existing customer: what the visitor typed is kept on that enquiry for staff to review');
select throws_ok(
  $$select public.submit_enquiry(jsonb_build_object(
     'type', 'quote', 'product', 'car_1', 'name', 'ทดสอบ', 'phone', '0800000161', 'preferred_channel', 'line',
     'line_url', 'https://evil.example/x', 'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac3', 'notice_version', 'draft-2026-10'))$$,
  '23514', null, 'intake refuses an unsupported LINE link');
reset role;

-- ---------------------------------------------------------------------------
-- Enquiry contact details stay as submitted
-- ---------------------------------------------------------------------------
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111101'); -- admin
select throws_ok(
  $$update public.enquiries set contact_line_id = 'changed' where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2'$$,
  '42501', null, 'staff cannot change the LINE ID an enquiry arrived with');
select throws_ok(
  $$update public.enquiries set contact_phone = '0899999999' where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2'$$,
  '42501', null, 'staff cannot change the phone number an enquiry arrived with');
select lives_ok(
  $$update public.enquiries set status = 'contacted' where idempotency_key = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac2'$$,
  'other enquiry fields can still be updated');
reset role;

-- The verified LINE identity is untouched by any of this.
select is((select count(*)::int from public.customer_line_accounts where display_name = 'สมมติ' or line_user_id like '%newcustomer%'), 0,
  'no verified LINE account is created from typed details');

-- ---------------------------------------------------------------------------
-- LINE OA conversation link (customers.line_oa_chat_url): staff only, separate
-- from the personal profile link, never a verified identity.
-- ---------------------------------------------------------------------------
select ok(private.is_line_oa_chat_url('https://chat.line.biz/U0123456789abcdef0123456789abcdef/chat/Uabcdef0123456789abcdef0123456789'),
  'chat.line.biz conversation link accepted');
select ok(not private.is_line_oa_chat_url('http://chat.line.biz/Uabc/chat/Udef'), 'OA chat: plain http refused');
select ok(not private.is_line_oa_chat_url('https://chat.line.biz.evil.example/Uabc'), 'OA chat: look-alike host refused');
select ok(not private.is_line_oa_chat_url('https://chat.line.biz@evil.example/Uabc')
      and not private.is_line_oa_chat_url('https://user:pw@chat.line.biz/Uabc'), 'OA chat: embedded credentials refused');
select ok(not private.is_line_oa_chat_url('https://chat.line.biz:8443/Uabc')
      and not private.is_line_oa_chat_url('https://chat.line.biz:443/Uabc'), 'OA chat: ports refused');
select ok(not private.is_line_oa_chat_url('https://chat.line.biz') and not private.is_line_oa_chat_url('https://chat.line.biz/'),
  'OA chat: a link without a conversation path refused');
select ok(not private.is_line_oa_chat_url('https://line.me/ti/p/~x') and not private.is_line_oa_chat_url('javascript:alert(1)')
      and not private.is_line_oa_chat_url('https://evilchat.line.biz/Uabc'), 'OA chat: other hosts and schemes refused');
select ok(not private.is_line_url('https://chat.line.biz/Uabc/chat/Udef'), 'the profile link field still refuses OA chat links');

select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102'); -- agent
update public.customers set line_oa_chat_url = 'https://chat.line.biz/Uoa0001/chat/Ucust0003'
 where id = '33333333-3333-4333-8333-333333333303';
select is((select line_oa_chat_url || '|' || coalesce(line_contact_source, 'none') from public.customers where id = '33333333-3333-4333-8333-333333333303'),
  'https://chat.line.biz/Uoa0001/chat/Ucust0003|none', 'agent saves the OA chat link; it is not recorded as typed LINE identity details');
update public.customers set line_oa_chat_url = 'https://chat.line.biz/Uoa0001/chat/Ucust0003b'
 where id = '33333333-3333-4333-8333-333333333303';
select is((select line_oa_chat_url from public.customers where id = '33333333-3333-4333-8333-333333333303'),
  'https://chat.line.biz/Uoa0001/chat/Ucust0003b', 'agent edits the OA chat link');
select throws_ok(
  $$update public.customers set line_oa_chat_url = 'https://chat.line.biz.evil.example/x' where id = '33333333-3333-4333-8333-333333333303'$$,
  '23514', null, 'an invalid OA chat link is refused by the table');
select throws_ok(
  $$update public.customers set line_oa_chat_url = 'https://line.me/ti/p/~x' where id = '33333333-3333-4333-8333-333333333303'$$,
  '23514', null, 'a profile link is refused in the OA chat field');
-- Saving it next to typed details leaves them (and their source) as they were.
update public.customers set line_url = 'https://line.me/ti/p/~sommut.demo' where id = '33333333-3333-4333-8333-333333333301';
update public.customers set line_oa_chat_url = 'https://chat.line.biz/Uoa0001/chat/Ucust0001' where id = '33333333-3333-4333-8333-333333333301';
select is((select line_id || '|' || line_url || '|' || line_contact_source || '|' || line_oa_chat_url from public.customers where id = '33333333-3333-4333-8333-333333333301'),
  'sommut.demo|https://line.me/ti/p/~sommut.demo|staff_entry|https://chat.line.biz/Uoa0001/chat/Ucust0001',
  'existing personal profile link and LINE ID are kept beside the OA chat link');
update public.customers set line_oa_chat_url = null where id = '33333333-3333-4333-8333-333333333303';
select is((select coalesce(line_oa_chat_url, 'cleared') from public.customers where id = '33333333-3333-4333-8333-333333333303'), 'cleared',
  'agent clears the OA chat link');
reset role;

select ok(exists (select 1 from public.audit_logs where table_name = 'customers' and record_id = '33333333-3333-4333-8333-333333333303'
                    and actor_id = '11111111-1111-4111-8111-111111111102'
                    and new_values->>'line_oa_chat_url' = 'https://chat.line.biz/Uoa0001/chat/Ucust0003'),
  'OA chat link changes are in the audit log with the agent as actor');

select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103'); -- viewer
select is((select line_oa_chat_url from public.customers where id = '33333333-3333-4333-8333-333333333301'),
  'https://chat.line.biz/Uoa0001/chat/Ucust0001', 'viewer can read the OA chat link');
update public.customers set line_oa_chat_url = 'https://chat.line.biz/Uhijack/chat/Ux' where id = '33333333-3333-4333-8333-333333333301';
reset role;
select is((select line_oa_chat_url from public.customers where id = '33333333-3333-4333-8333-333333333301'),
  'https://chat.line.biz/Uoa0001/chat/Ucust0001', 'viewer update of the OA chat link changes nothing');
select pg_temp.act_as('anon');
select throws_ok($$select line_oa_chat_url from public.customers$$, '42501', null, 'anon cannot read the OA chat link');
reset role;

-- The public intake ignores it, for new and existing customers.
select pg_temp.act_as('service_role');
create temp table r_oa as select public.submit_enquiry(jsonb_build_object(
  'type', 'quote', 'product', 'car_1', 'name', 'ทดสอบ โอเอ', 'phone', '0800000170', 'preferred_channel', 'line',
  'line_oa_chat_url', 'https://chat.line.biz/Uoa0001/chat/Uplanted',
  'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac4', 'notice_version', 'draft-2026-10')) as res;
select public.submit_enquiry(jsonb_build_object(
  'type', 'quote', 'product', 'car_1', 'name', 'คนอื่น', 'phone', '0800000101', 'preferred_channel', 'line',
  'line_oa_chat_url', 'https://chat.line.biz/Uoa0001/chat/Uplanted', 'message', 'oa test',
  'idempotency_key', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaac5', 'notice_version', 'draft-2026-10'));
reset role;
select is((select coalesce(c.line_oa_chat_url, 'none') || '|' || (select line_oa_chat_url from public.customers where phone = '0800000101')
             from public.enquiries e join public.customers c on c.id = e.customer_id where e.reference = (select res->>'reference' from r_oa)),
  'none|https://chat.line.biz/Uoa0001/chat/Ucust0001', 'public intake cannot set or change an OA chat link');
select is((select count(*)::int from public.customer_line_accounts where line_user_id like '%cust%' or display_name like '%โอเอ%'), 0,
  'saving an OA chat link creates no verified LINE account');

select * from finish();
rollback;
