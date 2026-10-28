begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

update public.admin_mfa_policy set mandatory_mfa_enabled = false where singleton;

-- Schema and privileges -----------------------------------------------------

select has_column('public', 'sale_vehicles', 'stock_reference', 'stock has a reference');
select has_column('public', 'admin_profiles', 'staff_role', 'staff have a role');
select ok(has_function_privilege('service_role', 'public.create_vehicle_enquiry(jsonb)', 'execute'), 'server can create vehicle enquiries');
select ok(not has_function_privilege('anon', 'public.create_vehicle_enquiry(jsonb)', 'execute'), 'visitors cannot call the enquiry function directly');
select ok(not has_function_privilege('authenticated', 'public.create_seller_submission(jsonb)', 'execute'), 'signed-in users cannot call the seller function directly');
select ok(not has_function_privilege('anon', 'public.finalise_exchange_retention(uuid)', 'execute'), 'visitors cannot run retention');

-- Fixtures ------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data)
select '70000000-0000-4000-8000-000000000001', 'sobautofix@gmail.com', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'sobautofix@gmail.com');
insert into auth.users (id, email, raw_user_meta_data)
select '70000000-0000-4000-8000-000000000002', 'temitopeagbola@gmail.com', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'temitopeagbola@gmail.com');
insert into auth.users (id, email, raw_user_meta_data)
select '70000000-0000-4000-8000-000000000003', 'exchange-visitor@example.test', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'exchange-visitor@example.test');

create temporary table exchange_actor (label text primary key, id uuid not null) on commit drop;
grant select on exchange_actor to authenticated, anon;
insert into exchange_actor
select 'owner', id from auth.users where lower(email) = 'sobautofix@gmail.com'
union all select 'sales', id from auth.users where lower(email) = 'temitopeagbola@gmail.com'
union all select 'visitor', id from auth.users where lower(email) = 'exchange-visitor@example.test';

insert into public.admin_profiles (user_id, display_name, staff_role)
select id, 'pgTAP owner', 'owner' from exchange_actor where label = 'owner'
on conflict (user_id) do update set staff_role = 'owner';
insert into public.admin_profiles (user_id, display_name, staff_role)
select id, 'pgTAP sales', 'sales' from exchange_actor where label = 'sales'
on conflict (user_id) do update set staff_role = 'sales';

insert into public.sale_vehicles (id, slug, make, model, year, mileage, price, fuel_type, transmission, description, status)
values
  ('71000000-0000-4000-8000-000000000001', 'pgtap-available-car', 'Ford', 'Fiesta', 2018, 40000, 6995, 'Petrol', 'Manual', 'An available pgTAP fixture vehicle.', 'available'),
  ('71000000-0000-4000-8000-000000000002', 'pgtap-sold-car', 'Ford', 'Ka', 2015, 70000, 2995, 'Petrol', 'Manual', 'A sold pgTAP fixture vehicle for tests.', 'sold'),
  ('71000000-0000-4000-8000-000000000003', 'pgtap-draft-car', 'Ford', 'Puma', 2021, 10000, 15995, 'Petrol', 'Manual', 'A draft pgTAP fixture vehicle for tests.', 'draft');

insert into public.vehicle_costs (sale_vehicle_id, category, description, amount_pence, basis)
values ('71000000-0000-4000-8000-000000000001', 'purchase', 'pgTAP purchase', 400000, 'actual');

-- Submission functions (service role) ---------------------------------------

select results_eq(
  $$select created from public.create_vehicle_enquiry('{"idempotencyKey":"72000000-0000-4000-8000-000000000001","intent":"viewing","vehicleId":"71000000-0000-4000-8000-000000000001","name":"pgTAP Buyer","phone":"07000000000","preferredContact":"phone","description":"Viewing request","preferredStart":"2026-11-02T10:00:00Z"}'::jsonb)$$,
  array[true],
  'a viewing request is saved'
);
select results_eq(
  $$select created from public.create_vehicle_enquiry('{"idempotencyKey":"72000000-0000-4000-8000-000000000001","intent":"viewing","vehicleId":"71000000-0000-4000-8000-000000000001","name":"pgTAP Buyer","phone":"07000000000","preferredContact":"phone","description":"Viewing request","preferredStart":"2026-11-02T10:00:00Z"}'::jsonb)$$,
  array[false],
  'a repeated submission does not create a duplicate'
);
select results_eq(
  $$select count(*) from public.diary_appointments where sale_vehicle_id = '71000000-0000-4000-8000-000000000001' and status = 'requested'$$,
  array[1::bigint],
  'the viewing appears in the diary as requested'
);
select throws_ok(
  $$select * from public.create_vehicle_enquiry('{"idempotencyKey":"72000000-0000-4000-8000-000000000002","intent":"question","vehicleId":"71000000-0000-4000-8000-000000000002","name":"pgTAP Buyer","phone":"07000000000","preferredContact":"phone","description":"Is it available?"}'::jsonb)$$,
  'P0001',
  'VEHICLE_UNAVAILABLE',
  'a sold vehicle cannot receive new enquiries'
);
select throws_ok(
  $$select * from public.create_vehicle_enquiry('{"idempotencyKey":"72000000-0000-4000-8000-000000000003","intent":"viewing","vehicleId":"71000000-0000-4000-8000-000000000003","name":"pgTAP Buyer","phone":"07000000000","preferredContact":"phone","description":"Viewing","preferredStart":"2026-11-02T10:00:00Z"}'::jsonb)$$,
  'P0001',
  'VEHICLE_UNAVAILABLE',
  'an unpublished vehicle cannot be viewed'
);
select lives_ok(
  $$select * from public.create_seller_submission('{"idempotencyKey":"72000000-0000-4000-8000-000000000004","name":"pgTAP Seller","phone":"07000000001","preferredContact":"email","registration":"ab12 cde","interestedVehicleId":"71000000-0000-4000-8000-000000000001","description":"Part exchange"}'::jsonb)$$,
  'a seller submission is saved'
);
select results_eq(
  $$select kind from public.seller_submissions where idempotency_key = '72000000-0000-4000-8000-000000000004'$$,
  array['part_exchange'],
  'a seller linked to a listed car becomes a part exchange'
);
select results_eq(
  $$select registration from public.seller_submissions where idempotency_key = '72000000-0000-4000-8000-000000000004'$$,
  array['AB12CDE'],
  'registrations are normalised'
);

-- Stock status follows the sale --------------------------------------------

insert into public.vehicle_sales (id, sale_vehicle_id, agreed_price_pence)
values ('73000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 690000);
select results_eq($$select status::text from public.sale_vehicles where id = '71000000-0000-4000-8000-000000000001'$$, array['reserved'], 'a reservation reserves the stock');
update public.vehicle_sales set status = 'cancelled' where id = '73000000-0000-4000-8000-000000000001';
select results_eq($$select status::text from public.sale_vehicles where id = '71000000-0000-4000-8000-000000000001'$$, array['available'], 'cancelling returns the stock to sale');

-- Visitors -------------------------------------------------------------------

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select results_eq($$select count(*) from public.exchange_settings$$, array[1::bigint], 'visitors read public exchange settings');
select results_eq($$select count(*) from public.sale_vehicles where slug like 'pgtap-%'$$, array[1::bigint], 'visitors see only the listed fixture vehicle');
select throws_ok($$select count(*) from public.seller_submissions$$, '42501', null, 'visitors cannot read seller submissions');
select throws_ok($$select count(*) from public.vehicle_costs$$, '42501', null, 'visitors cannot read costs');
select throws_ok($$select count(*) from public.diary_appointments$$, '42501', null, 'visitors cannot read the diary');
select throws_ok($$select count(*) from public.exchange_private_settings$$, '42501', null, 'visitors cannot read private settings');
reset role;

-- Signed-in non-staff ------------------------------------------------------

select set_config('request.jwt.claims', jsonb_build_object('sub', (select id::text from exchange_actor where label = 'visitor'), 'role', 'authenticated')::text, true);
set local role authenticated;
select results_eq($$select count(*) from public.seller_submissions$$, array[0::bigint], 'a non-staff user sees no seller submissions');
reset role;

-- Sales role: works enquiries, no finance, no settings ---------------------

select set_config('request.jwt.claims', jsonb_build_object('sub', (select id::text from exchange_actor where label = 'sales'), 'role', 'authenticated')::text, true);
set local role authenticated;
select ok((select count(*) from public.seller_submissions) >= 1, 'sales staff see seller submissions');
select results_eq($$select count(*) from public.vehicle_costs where sale_vehicle_id = '71000000-0000-4000-8000-000000000001'$$, array[0::bigint], 'sales staff cannot see costs');
select results_eq($$with changed as (update public.exchange_settings set value = '{"name":"x"}' returning 1) select count(*) from changed$$, array[0::bigint], 'sales staff cannot change settings');
reset role;

-- Owner: full access -------------------------------------------------------

select set_config('request.jwt.claims', jsonb_build_object('sub', (select id::text from exchange_actor where label = 'owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select results_eq($$select count(*) from public.vehicle_costs where sale_vehicle_id = '71000000-0000-4000-8000-000000000001'$$, array[1::bigint], 'owners see costs');
reset role;

select * from finish();
rollback;
