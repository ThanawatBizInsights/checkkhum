-- FICTIONAL seed data for LOCAL DEVELOPMENT ONLY.
-- `supabase db reset` loads it locally. Never run it against production:
-- it creates staff logins and made-up customers.
-- All people, phone numbers, plates and insurers below are invented.

-- Logins (local only). Password for all: checkkhum-local-only
--   admin@  → admin        agent@  → agent (staff)      viewer@ → read-only staff
--   former@ → deactivated staff                         outsider@ → signed-in, not staff
create temporary table seed_users (id uuid, email text) on commit drop;
insert into seed_users values
  ('11111111-1111-4111-8111-111111111101', 'admin@checkkhum.example'),
  ('11111111-1111-4111-8111-111111111102', 'agent@checkkhum.example'),
  ('11111111-1111-4111-8111-111111111103', 'viewer@checkkhum.example'),
  ('11111111-1111-4111-8111-111111111104', 'former@checkkhum.example'),
  ('11111111-1111-4111-8111-111111111105', 'outsider@checkkhum.example');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change,
                        email_change_token_current, phone_change, phone_change_token, reauthentication_token)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('checkkhum-local-only', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(),
       '', '', '', '', '', '', '', ''
  from seed_users u;

-- Supabase Auth signs email users in through their identity row.
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
  from seed_users u;

insert into public.staff_users (id, email, full_name, role) values
  ('11111111-1111-4111-8111-111111111101', 'admin@checkkhum.example', 'ผู้ดูแลระบบ ทดสอบ', 'admin'),
  ('11111111-1111-4111-8111-111111111102', 'agent@checkkhum.example', 'เจ้าหน้าที่ ทดสอบ', 'agent'),
  ('11111111-1111-4111-8111-111111111103', 'viewer@checkkhum.example', 'ผู้ชม ทดสอบ', 'viewer');
insert into public.staff_users (id, email, full_name, role, is_active) values
  ('11111111-1111-4111-8111-111111111104', 'former@checkkhum.example', 'อดีตพนักงาน ทดสอบ', 'agent', false);

insert into public.insurers (id, code, name_th, name_en) values
  ('22222222-2222-4222-8222-222222222201', 'DEMO_A', 'ตัวอย่างประกันภัย จำกัด', 'Sample Assurance Co.'),
  ('22222222-2222-4222-8222-222222222202', 'DEMO_B', 'สมมติประกันภัย จำกัด', 'Placeholder Insurance Co.'),
  ('22222222-2222-4222-8222-222222222203', 'DEMO_C', 'ทดลองวินาศภัย จำกัด', 'Trial General Insurance Co.');

insert into public.customers (id, full_name, phone, line_id, preferred_channel, notes) values
  ('33333333-3333-4333-8333-333333333301', 'สมมติ ใจดี', '0800000101', 'sommut.demo', 'line', 'ลูกค้าสมมติสำหรับทดสอบ'),
  ('33333333-3333-4333-8333-333333333302', 'ตัวอย่าง รักษ์รถ', '0800000102', null, 'phone', null),
  ('33333333-3333-4333-8333-333333333303', 'ทดลอง เที่ยวไกล', '0800000103', null, 'phone', null);

insert into public.vehicles (id, customer_id, description, make, model, model_year, is_ev, registration_plate, plate_province) values
  ('44444444-4444-4444-8444-444444444401', '33333333-3333-4333-8333-333333333301', 'Toyota Yaris Ativ', 'Toyota', 'Yaris Ativ', 2022, false, '1กข 0000', 'กรุงเทพมหานคร'),
  ('44444444-4444-4444-8444-444444444402', '33333333-3333-4333-8333-333333333302', 'BYD Dolphin', 'BYD', 'Dolphin', 2024, true, null, null);

insert into public.enquiries (id, reference, customer_id, vehicle_id, type, product, status, source,
                              contact_name, contact_phone, preferred_channel, assigned_to, travel_destination, travel_days, travellers, message)
values
  ('55555555-5555-4555-8555-555555555501', 'CK-261001-DEM1', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401',
   'quote', 'car_1', 'won', 'web_quote_form', 'สมมติ ใจดี', '0800000101', 'line', '11111111-1111-4111-8111-111111111102', null, null, null, null),
  ('55555555-5555-4555-8555-555555555502', 'CK-261003-DEM2', '33333333-3333-4333-8333-333333333302', '44444444-4444-4444-8444-444444444402',
   'quote', 'ev', 'quoted', 'web_quote_form', 'ตัวอย่าง รักษ์รถ', '0800000102', 'phone', '11111111-1111-4111-8111-111111111102', null, null, null, 'ติดตั้งเครื่องชาร์จที่บ้าน'),
  ('55555555-5555-4555-8555-555555555503', 'CK-261004-DEM3', '33333333-3333-4333-8333-333333333303', null,
   'quote', 'travel', 'new', 'web_quote_form', 'ทดลอง เที่ยวไกล', '0800000103', 'phone', null, 'ญี่ปุ่น', 7, 2, null);

insert into public.quotations (id, enquiry_id, insurer_id, product, sum_insured, premium, deductible, repair_type, valid_until, status, prepared_by) values
  ('66666666-6666-4666-8666-666666666601', '55555555-5555-4555-8555-555555555501', '22222222-2222-4222-8222-222222222201',
   'car_1', 450000, 15900, 0, 'garage', current_date + 14, 'accepted', '11111111-1111-4111-8111-111111111102'),
  ('66666666-6666-4666-8666-666666666602', '55555555-5555-4555-8555-555555555501', '22222222-2222-4222-8222-222222222202',
   'car_1', 450000, 17200, 0, 'dealer', current_date + 14, 'declined', '11111111-1111-4111-8111-111111111102'),
  ('66666666-6666-4666-8666-666666666603', '55555555-5555-4555-8555-555555555502', '22222222-2222-4222-8222-222222222203',
   'ev', 900000, 28500, 3000, 'dealer', current_date + 14, 'sent', '11111111-1111-4111-8111-111111111102');

-- An active policy: the trigger creates its renewal task automatically.
insert into public.policies (id, customer_id, vehicle_id, insurer_id, quotation_id, product, policy_number, start_date, end_date, premium, status) values
  ('77777777-7777-4777-8777-777777777701', '33333333-3333-4333-8333-333333333301', '44444444-4444-4444-8444-444444444401',
   '22222222-2222-4222-8222-222222222201', '66666666-6666-4666-8666-666666666601', 'car_1', 'DEMO-POL-0001',
   current_date - 300, current_date + 65, 15900, 'active');

insert into public.follow_up_activities (customer_id, enquiry_id, staff_user_id, activity_type, summary, outcome, occurred_at, next_action_at) values
  ('33333333-3333-4333-8333-333333333302', '55555555-5555-4555-8555-555555555502', '11111111-1111-4111-8111-111111111102',
   'call', 'โทรแจ้งใบเสนอราคาประกัน EV ลูกค้าขอเวลาตัดสินใจ', 'รอตัดสินใจ', now() - interval '1 day', now() + interval '2 days'),
  ('33333333-3333-4333-8333-333333333301', '55555555-5555-4555-8555-555555555501', '11111111-1111-4111-8111-111111111102',
   'line', 'ส่งกรมธรรม์ทาง LINE แล้ว', 'เรียบร้อย', now() - interval '300 days', null);

insert into public.consent_records (customer_id, enquiry_id, purpose, granted, notice_version, method) values
  ('33333333-3333-4333-8333-333333333301', '55555555-5555-4555-8555-555555555501', 'quote_processing', true, 'draft-2026-10', 'web_form'),
  ('33333333-3333-4333-8333-333333333301', '55555555-5555-4555-8555-555555555501', 'marketing', true, 'draft-2026-10', 'web_form'),
  ('33333333-3333-4333-8333-333333333302', '55555555-5555-4555-8555-555555555502', 'quote_processing', true, 'draft-2026-10', 'web_form'),
  ('33333333-3333-4333-8333-333333333302', '55555555-5555-4555-8555-555555555502', 'marketing', false, 'draft-2026-10', 'web_form'),
  ('33333333-3333-4333-8333-333333333303', '55555555-5555-4555-8555-555555555503', 'quote_processing', true, 'draft-2026-10', 'web_form'),
  ('33333333-3333-4333-8333-333333333303', '55555555-5555-4555-8555-555555555503', 'marketing', false, 'draft-2026-10', 'web_form');

-- More fictional customers and policies expiring at different horizons,
-- for the 30/60/90-day views and the renewal job.
insert into public.customers (id, full_name, phone, preferred_channel) values
  ('33333333-3333-4333-8333-333333333304', 'จำลอง ขับดี', '0800000104', 'phone'),
  ('33333333-3333-4333-8333-333333333305', 'สาธิต ประหยัด', '0800000105', 'line'),
  ('33333333-3333-4333-8333-333333333306', 'ตัวอย่าง ไกลบ้าน', '0800000106', 'phone');

insert into public.vehicles (id, customer_id, description, make, model, model_year, registration_plate, plate_province) values
  ('44444444-4444-4444-8444-444444444404', '33333333-3333-4333-8333-333333333304', 'Honda City', 'Honda', 'City', 2019, '2กค 0000', 'นนทบุรี'),
  ('44444444-4444-4444-8444-444444444405', '33333333-3333-4333-8333-333333333305', 'Isuzu D-Max', 'Isuzu', 'D-Max', 2018, '3ขง 0000', 'ชลบุรี'),
  ('44444444-4444-4444-8444-444444444406', '33333333-3333-4333-8333-333333333306', 'Mazda 2', 'Mazda', '2', 2021, null, null);

insert into public.policies (id, customer_id, vehicle_id, insurer_id, product, policy_number, start_date, end_date, premium, status) values
  ('77777777-7777-4777-8777-777777777702', '33333333-3333-4333-8333-333333333304', '44444444-4444-4444-8444-444444444404',
   '22222222-2222-4222-8222-222222222202', 'car_2plus', 'DEMO-POL-0002', current_date - 345, current_date + 20, 8900, 'active'),
  ('77777777-7777-4777-8777-777777777703', '33333333-3333-4333-8333-333333333305', '44444444-4444-4444-8444-444444444405',
   '22222222-2222-4222-8222-222222222203', 'car_3plus', 'DEMO-POL-0003', current_date - 280, current_date + 85, 6500, 'active'),
  ('77777777-7777-4777-8777-777777777704', '33333333-3333-4333-8333-333333333306', '44444444-4444-4444-8444-444444444406',
   '22222222-2222-4222-8222-222222222201', 'car_1', 'DEMO-POL-0004', current_date - 100, current_date + 265, 14200, 'active'),
  ('77777777-7777-4777-8777-777777777705', '33333333-3333-4333-8333-333333333304', null,
   '22222222-2222-4222-8222-222222222201', 'compulsory', 'DEMO-POL-0005', current_date - 400, current_date - 35, 645, 'expired');

insert into public.follow_up_tasks (customer_id, enquiry_id, title, due_date, assigned_to) values
  ('33333333-3333-4333-8333-333333333302', '55555555-5555-4555-8555-555555555502', 'โทรถามผลตัดสินใจประกัน EV',
   current_date + 1, '11111111-1111-4111-8111-111111111102'),
  ('33333333-3333-4333-8333-333333333303', '55555555-5555-4555-8555-555555555503', 'ติดต่อกลับเรื่องประกันเดินทางญี่ปุ่น',
   current_date + 3, null);

-- Run the renewal job once so the CRM has renewal tasks and reminders to show.
select private.run_renewal_job(90, 'schedule');
