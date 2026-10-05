-- FICTIONAL seed data for LOCAL DEVELOPMENT ONLY.
-- `supabase db reset` loads it locally. Never run it against production:
-- it creates staff logins and made-up customers.
-- All people, phone numbers, plates and insurers below are invented.

-- Staff logins (local only). Password for all three: checkkhum-local-only
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111101', 'authenticated', 'authenticated',
   'admin@checkkhum.example', extensions.crypt('checkkhum-local-only', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111102', 'authenticated', 'authenticated',
   'agent@checkkhum.example', extensions.crypt('checkkhum-local-only', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111103', 'authenticated', 'authenticated',
   'viewer@checkkhum.example', extensions.crypt('checkkhum-local-only', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.staff_users (id, email, full_name, role) values
  ('11111111-1111-4111-8111-111111111101', 'admin@checkkhum.example', 'ผู้ดูแลระบบ ทดสอบ', 'admin'),
  ('11111111-1111-4111-8111-111111111102', 'agent@checkkhum.example', 'เจ้าหน้าที่ ทดสอบ', 'agent'),
  ('11111111-1111-4111-8111-111111111103', 'viewer@checkkhum.example', 'ผู้ชม ทดสอบ', 'viewer');

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
