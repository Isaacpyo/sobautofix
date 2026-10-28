begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(6);

update public.admin_mfa_policy set mandatory_mfa_enabled = false where singleton;

insert into auth.users (id, email, raw_user_meta_data)
select '80000000-0000-4000-8000-000000000001', 'sobautofix@gmail.com', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'sobautofix@gmail.com');
insert into auth.users (id, email, raw_user_meta_data)
select '80000000-0000-4000-8000-000000000002', 'temitopeagbola@gmail.com', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'temitopeagbola@gmail.com');

create temporary table role_actor (label text primary key, id uuid not null) on commit drop;
grant select on role_actor to authenticated;
insert into role_actor
select 'owner', id from auth.users where lower(email) = 'sobautofix@gmail.com'
union all select 'staff', id from auth.users where lower(email) = 'temitopeagbola@gmail.com';

insert into public.admin_profiles (user_id, display_name, staff_role)
select id, 'pgTAP owner', 'owner' from role_actor where label = 'owner'
on conflict (user_id) do update set staff_role = 'owner';
insert into public.admin_profiles (user_id, display_name, staff_role)
select id, 'pgTAP workshop', 'workshop' from role_actor where label = 'staff'
on conflict (user_id) do update set staff_role = 'workshop';

insert into public.customers (id, name, email, phone, preferred_contact)
values ('81000000-0000-4000-8000-000000000001', 'Role Policy Customer', 'role-policy@example.test', '07000000000', 'phone');
insert into public.sale_vehicles (id, slug, make, model, year, mileage, price, fuel_type, transmission, description, status)
values ('81000000-0000-4000-8000-000000000002', 'pgtap-role-car', 'Ford', 'Fiesta', 2018, 40000, 6995, 'Petrol', 'Manual', 'A role policy pgTAP fixture vehicle.', 'draft');
insert into public.vehicle_documents (sale_vehicle_id, kind, file_name, object_path, content_type, size_bytes)
values
  ('81000000-0000-4000-8000-000000000002', 'purchase_invoice', 'invoice.pdf', 'pgtap/invoice.pdf', 'application/pdf', 100),
  ('81000000-0000-4000-8000-000000000002', 'service_record', 'service.pdf', 'pgtap/service.pdf', 'application/pdf', 100);

select set_config('request.jwt.claims', jsonb_build_object('sub', (select id::text from role_actor where label = 'staff'), 'role', 'authenticated')::text, true);
set local role authenticated;
select results_eq($$select count(*) from public.customers where id = '81000000-0000-4000-8000-000000000001'$$, array[0::bigint], 'workshop staff cannot read customer contacts');
select results_eq($$select count(*) from public.vehicle_documents where object_path = 'pgtap/invoice.pdf'$$, array[0::bigint], 'workshop staff cannot see purchase invoices');
select results_eq($$select count(*) from public.vehicle_documents where object_path = 'pgtap/service.pdf'$$, array[1::bigint], 'workshop staff can see service records');
reset role;

select set_config('request.jwt.claims', jsonb_build_object('sub', (select id::text from role_actor where label = 'owner'), 'role', 'authenticated')::text, true);
set local role authenticated;
select results_eq($$select count(*) from public.customers where id = '81000000-0000-4000-8000-000000000001'$$, array[1::bigint], 'owners read customer contacts');
select results_eq($$select count(*) from public.vehicle_documents where sale_vehicle_id = '81000000-0000-4000-8000-000000000002'$$, array[2::bigint], 'owners see every document');
reset role;

select ok(not has_function_privilege('anon', 'public.staff_can_view_customers()', 'execute'), 'visitors cannot call the role helper');

select * from finish();
rollback;
