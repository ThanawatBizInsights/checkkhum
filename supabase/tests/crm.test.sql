-- CRM tests: enquiry workflow, tasks, reminders, renewal job, reporting.
-- Run with: npx supabase test db   (uses the fictional seed)
begin;
create extension if not exists pgtap with schema extensions;
select plan(62);

create or replace function pg_temp.act_as(p_role text, p_user uuid default null)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', p_role, 'sub', p_user)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

-- Fixed ids from supabase/seed.sql
-- admin  11111111-1111-4111-8111-111111111101
-- agent  11111111-1111-4111-8111-111111111102
-- viewer 11111111-1111-4111-8111-111111111103
-- former 11111111-1111-4111-8111-111111111104 (inactive)
-- outsider 11111111-1111-4111-8111-111111111105 (no staff row)

-- ===========================================================================
-- New tables: RLS on, nothing for anon
-- ===========================================================================
select is(
  (select count(*)::int from pg_tables where schemaname = 'public'
     and tablename in ('follow_up_tasks', 'enquiry_status_history', 'staff_reminders', 'renewal_job_runs') and rowsecurity),
  4, 'RLS enabled on the 4 new CRM tables');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'),
  0, 'anon still has no table privileges');

select pg_temp.act_as('anon');
select throws_ok('select * from public.follow_up_tasks', '42501', null, 'anon cannot read tasks');
select throws_ok('select * from public.staff_reminders', '42501', null, 'anon cannot read reminders');
select throws_ok($$select public.search_customers('สมมติ')$$, '42501', null, 'anon cannot search customers');
select throws_ok($$select public.crm_conversion_report(current_date - 30, current_date)$$, '42501', null, 'anon cannot run reports');
select throws_ok($$select public.run_renewal_job()$$, '42501', null, 'anon cannot run the renewal job');
select throws_ok($$select public.convert_quotation_to_policy(gen_random_uuid(), 'X', current_date, current_date + 1)$$, '42501', null, 'anon cannot convert quotations');
reset role;

-- ===========================================================================
-- Signed-in non-staff and deactivated staff see nothing
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111105');
select is((select count(*)::int from public.follow_up_tasks), 0, 'non-staff user sees no tasks');
select is((select count(*)::int from public.search_customers('สมมติ')), 0, 'non-staff search returns nothing');
select is((select (public.crm_conversion_report(current_date - 365, current_date) ->> 'enquiries')::int), 0, 'non-staff report is empty');
select throws_ok($$select public.run_renewal_job()$$, '42501', null, 'non-staff cannot run the renewal job');
reset role;
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111104');
select is((select count(*)::int from public.enquiries), 0, 'deactivated staff see no enquiries');
select is((select count(*)::int from public.staff_reminders), 0, 'deactivated staff see no reminders');
reset role;

-- ===========================================================================
-- Enquiry pipeline rules (as agent)
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');

select throws_ok(
  $$update public.enquiries set status = 'quoted' where id = '55555555-5555-4555-8555-555555555503'$$,
  'P0001', null, 'new → quoted is not allowed (must contact first)');
select lives_ok(
  $$update public.enquiries set status = 'contacted' where id = '55555555-5555-4555-8555-555555555503'$$,
  'new → contacted');
select throws_ok(
  $$update public.enquiries set status = 'quoted' where id = '55555555-5555-4555-8555-555555555503'$$,
  'P0001', null, 'contacted → quoted needs a sent quotation');
select lives_ok(
  $$insert into public.quotations (enquiry_id, insurer_id, product, premium, status)
    values ('55555555-5555-4555-8555-555555555503', '22222222-2222-4222-8222-222222222201', 'travel', 890, 'draft')$$,
  'agent adds a draft quotation');
select throws_ok(
  $$update public.enquiries set status = 'quoted' where id = '55555555-5555-4555-8555-555555555503'$$,
  'P0001', null, 'a draft quotation is not enough for "quoted"');
select lives_ok(
  $$insert into public.quotations (enquiry_id, insurer_id, product, premium, status, prepared_by)
    values ('55555555-5555-4555-8555-555555555503', '22222222-2222-4222-8222-222222222202', 'travel', 950, 'sent',
            '11111111-1111-4111-8111-111111111101')$$,
  'agent adds a second (sent) quotation, trying to credit the admin');
select is(
  (select count(*)::int from public.quotations where enquiry_id = '55555555-5555-4555-8555-555555555503'), 2,
  'multiple quotations per enquiry');
select is(
  (select prepared_by from public.quotations where enquiry_id = '55555555-5555-4555-8555-555555555503' and premium = 950),
  '11111111-1111-4111-8111-111111111102'::uuid, 'quotation is stamped with the real author, not the spoofed one');
select lives_ok(
  $$update public.enquiries set status = 'quoted' where id = '55555555-5555-4555-8555-555555555503'$$,
  'contacted → quoted once a quotation was sent');
select throws_ok(
  $$update public.enquiries set status = 'won' where id = '55555555-5555-4555-8555-555555555503'$$,
  'P0001', null, 'quoted → won needs an accepted quotation');

-- Convert the sent quotation to a policy: accepts it, creates the policy, marks the enquiry won.
create temp table conv as
  select public.convert_quotation_to_policy(
    (select id from public.quotations where enquiry_id = '55555555-5555-4555-8555-555555555503' and premium = 950),
    'TEST-POL-9001', current_date, current_date + 365) as policy_id;
select is((select status::text from public.enquiries where id = '55555555-5555-4555-8555-555555555503'), 'won',
  'converting the quotation closes the enquiry as won');
select is((select status::text from public.quotations where enquiry_id = '55555555-5555-4555-8555-555555555503' and premium = 950), 'accepted',
  'converted quotation is accepted');
select is((select premium from public.policies where id = (select policy_id from conv)), 950.00::numeric,
  'policy takes the quotation premium');
select throws_ok(
  $$select public.convert_quotation_to_policy(
      (select id from public.quotations where enquiry_id = '55555555-5555-4555-8555-555555555503' and premium = 950),
      'TEST-POL-9002', current_date, current_date + 365)$$,
  'P0001', null, 'the same quotation cannot become two policies');
select throws_ok(
  $$update public.enquiries set status = 'lost' where id = '55555555-5555-4555-8555-555555555503'$$,
  'P0001', null, 'won is final');
select is(
  (select array_agg(to_status::text order by id) from public.enquiry_status_history where enquiry_id = '55555555-5555-4555-8555-555555555503'),
  array['new', 'contacted', 'quoted', 'won'], 'status history records every step');
select is(
  (select count(*)::int from public.enquiry_status_history where enquiry_id = '55555555-5555-4555-8555-555555555503'
     and from_status is not null and changed_by = '11111111-1111-4111-8111-111111111102'),
  3, 'history records who made each change');
select throws_ok($$delete from public.enquiry_status_history$$, '42501', null, 'staff cannot delete status history');

-- Spam can only be undone by an admin.
reset role;
-- (set up a spam enquiry as the server would)
insert into public.enquiries (reference, customer_id, type, product, status, source, contact_name, contact_phone)
values ('CK-261005-SPM1', '33333333-3333-4333-8333-333333333304', 'quote', 'car_1', 'new', 'web_quote_form', 'ทดสอบ สแปม', '0800000104');
update public.enquiries set status = 'spam' where reference = 'CK-261005-SPM1';
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select throws_ok($$update public.enquiries set status = 'new' where reference = 'CK-261005-SPM1'$$, '42501', null,
  'agents cannot take an enquiry out of spam');
reset role;
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111101');
select lives_ok($$update public.enquiries set status = 'new' where reference = 'CK-261005-SPM1'$$, 'admins can');
reset role;

-- ===========================================================================
-- Notes and follow-up tasks
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
insert into public.follow_up_activities (customer_id, activity_type, summary, staff_user_id)
values ('33333333-3333-4333-8333-333333333301', 'call', 'ทดสอบบันทึก', '11111111-1111-4111-8111-111111111101');
select is((select staff_user_id from public.follow_up_activities where summary = 'ทดสอบบันทึก'),
  '11111111-1111-4111-8111-111111111102'::uuid, 'a note cannot be logged in a colleague''s name');
select lives_ok(
  $$insert into public.follow_up_tasks (customer_id, title, due_date, assigned_to)
    values ('33333333-3333-4333-8333-333333333301', 'ทดสอบงาน', current_date, '11111111-1111-4111-8111-111111111103')$$,
  'agent creates and assigns a task');
select is((select created_by from public.follow_up_tasks where title = 'ทดสอบงาน'), '11111111-1111-4111-8111-111111111102'::uuid,
  'task records its creator');
update public.follow_up_tasks set status = 'done' where title = 'ทดสอบงาน';
select isnt((select completed_at from public.follow_up_tasks where title = 'ทดสอบงาน'), null, 'completing a task stamps completed_at');
select is_empty($$delete from public.follow_up_tasks where title = 'ทดสอบงาน' returning id$$, 'agents cannot delete tasks');
reset role;

select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103');
select throws_ok(
  $$insert into public.follow_up_tasks (customer_id, title, due_date) values ('33333333-3333-4333-8333-333333333301', 'x', current_date)$$,
  '42501', null, 'viewers cannot create tasks');
select is_empty($$update public.renewal_tasks set status = 'done' returning id$$, 'viewers cannot complete renewal tasks');
select throws_ok($$select public.convert_quotation_to_policy('66666666-6666-4666-8666-666666666603', 'X', current_date, current_date + 1)$$,
  '42501', null, 'viewers cannot convert quotations');
reset role;

-- ===========================================================================
-- Reminders: own + team queue only; only read_at can change
-- ===========================================================================
insert into public.staff_reminders (recipient_id, kind, follow_up_task_id, message)
select '11111111-1111-4111-8111-111111111103', 'task_due', id, 'สำหรับผู้ชมเท่านั้น' from public.follow_up_tasks where title = 'ทดสอบงาน';
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select is((select count(*)::int from public.staff_reminders where message = 'สำหรับผู้ชมเท่านั้น'), 0, 'staff cannot see a colleague''s reminders');
select ok((select count(*) from public.staff_reminders where recipient_id is null) > 0, 'staff see the unassigned team queue');
select throws_ok($$update public.staff_reminders set message = 'แก้ข้อความ'$$, '42501', null, 'reminder text cannot be edited');
select isnt_empty($$update public.staff_reminders set read_at = now() where recipient_id is null returning id$$, 'staff can mark queue reminders read');
reset role;

-- ===========================================================================
-- Renewal job
-- ===========================================================================
select is((select count(*)::int from cron.job where jobname = 'checkkhum-renewal-job' and schedule = '5 23 * * *' and active), 1,
  'renewal job is scheduled daily (06:05 Bangkok)');
select is((select count(*)::int from public.renewal_tasks), 4, 'seed run: 4 tasks for the 4 policies ending within 90 days');
select is((select count(*)::int from public.renewal_tasks t join public.policies p on p.id = t.policy_id
            where p.end_date > current_date + 90 or p.status <> 'active'), 0,
  'no tasks for policies beyond 90 days or not active');
select is((select assigned_to from public.renewal_tasks where policy_id = '77777777-7777-4777-8777-777777777701'),
  '11111111-1111-4111-8111-111111111102'::uuid, 'renewal task goes to the agent who handled the original enquiry');

select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111102');
select throws_ok($$select public.run_renewal_job()$$, '42501', null, 'agents cannot run the job');
select is((select count(*)::int from public.renewal_job_runs), 0, 'agents cannot see job runs');
reset role;

select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111101');
select is((public.run_renewal_job() ->> 'tasks_created')::int, 0, 'running again creates no duplicate tasks');
select is((select count(*)::int from public.renewal_job_runs where trigger_source = 'manual'
            and triggered_by = '11111111-1111-4111-8111-111111111101'), 1, 'manual run is logged with the admin');
reset role;

-- A new policy ending in 40 days is picked up exactly once.
insert into public.policies (customer_id, insurer_id, product, policy_number, start_date, end_date, premium, status)
values ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222202', 'compulsory', 'TEST-POL-9100',
        current_date - 325, current_date + 40, 645, 'active');
select is((private.run_renewal_job(90, 'schedule') ->> 'tasks_created')::int, 1, 'scheduled run picks up the new policy');
select is((private.run_renewal_job(90, 'schedule') ->> 'tasks_created')::int, 0, 'and does not duplicate it on the next run');
select is((select due_date from public.renewal_tasks t join public.policies p on p.id = t.policy_id where p.policy_number = 'TEST-POL-9100'),
  current_date + 10, 'task is due 30 days before expiry');
select is((select count(*)::int from public.staff_reminders r join public.renewal_tasks t on t.id = r.renewal_task_id
            join public.policies p on p.id = t.policy_id where p.policy_number = 'TEST-POL-9100' and r.kind = 'renewal_task_created'), 1,
  'one "new renewal task" reminder, not repeated');
select throws_ok(
  $$insert into public.renewal_tasks (policy_id, due_date) select id, current_date from public.policies where policy_number = 'TEST-POL-9100'$$,
  '23505', null, 'database refuses a second renewal task for the same policy');

-- ===========================================================================
-- Reporting and search for staff
-- ===========================================================================
select pg_temp.act_as('authenticated', '11111111-1111-4111-8111-111111111103');
select ok((public.crm_conversion_report(current_date - 30, current_date) ->> 'won')::int >= 2, 'viewer sees conversion report');
select is((select full_name from public.search_customers('2กค 0000')), 'จำลอง ขับดี', 'search by registration plate');
select is((select full_name from public.search_customers('080-000-0105')), 'สาธิต ประหยัด', 'search by phone with dashes');
reset role;

select * from finish();
rollback;
