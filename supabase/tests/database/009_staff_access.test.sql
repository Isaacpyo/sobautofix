begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

update public.admin_mfa_policy set mandatory_mfa_enabled = false where singleton;

-- Any email can now be staff: access comes from an active profile, not a list.
insert into auth.users (id, email, raw_user_meta_data) values
  ('90000000-0000-4000-8000-000000000001', 'pgtap-owner@example.test', '{}'::jsonb),
  ('90000000-0000-4000-8000-000000000002', 'pgtap-sales@example.test', '{}'::jsonb),
  ('90000000-0000-4000-8000-000000000003', 'pgtap-removed@example.test', '{}'::jsonb),
  ('90000000-0000-4000-8000-000000000004', 'pgtap-stranger@example.test', '{}'::jsonb);

insert into public.admin_profiles (user_id, display_name, staff_role, email, access_removed_at) values
  ('90000000-0000-4000-8000-000000000001', 'pgTAP owner', 'owner', 'pgtap-owner@example.test', null),
  ('90000000-0000-4000-8000-000000000002', 'pgTAP sales', 'sales', 'pgtap-sales@example.test', null),
  ('90000000-0000-4000-8000-000000000003', 'pgTAP removed', 'owner', 'pgtap-removed@example.test', now());

select has_column('public', 'admin_profiles', 'access_removed_at', 'profiles record removed access');
select throws_ok(
  $$insert into public.admin_profiles (user_id, display_name, email) values ('90000000-0000-4000-8000-000000000004', 'Upper', 'Mixed@Example.test')$$,
  '23514', null, 'staff emails are stored in lower case');
insert into public.admin_profiles (user_id, display_name) values ('90000000-0000-4000-8000-000000000004', 'No email given');
select results_eq($$select email from public.admin_profiles where user_id = '90000000-0000-4000-8000-000000000004'$$, array['pgtap-stranger@example.test'::text], 'a profile without an email takes it from the account');
delete from public.admin_profiles where user_id = '90000000-0000-4000-8000-000000000004';

create or replace function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
$$;

-- Active owner.
select pg_temp.act_as('90000000-0000-4000-8000-000000000001');
set local role authenticated;
select ok(public.is_admin(), 'an active profile is an administrator');
select results_eq($$select public.current_staff_role()$$, array['owner'::text], 'the owner has the owner role');
select lives_ok($$select count(*) from public.invoices$$, 'owners can read invoices');
select throws_ok(
  $$update public.admin_profiles set staff_role = 'manager' where user_id = '90000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'not even an owner can change profiles directly; the server does it');
reset role;

-- Active sales staff.
select pg_temp.act_as('90000000-0000-4000-8000-000000000002');
set local role authenticated;
select ok(public.is_admin(), 'active sales staff are administrators');
select results_eq($$select count(*) from public.invoices$$, array[0::bigint], 'sales staff see no invoices');
select throws_ok(
  $$update public.admin_profiles set staff_role = 'owner' where user_id = '90000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'staff cannot raise their own role');
select ok(not public.staff_can_view_finance(), 'sales staff are not a finance role');
reset role;

-- Removed access and strangers.
select pg_temp.act_as('90000000-0000-4000-8000-000000000003');
set local role authenticated;
select ok(not public.is_admin(), 'a removed profile is no longer an administrator');
reset role;

select pg_temp.act_as('90000000-0000-4000-8000-000000000004');
set local role authenticated;
select ok(not public.is_admin(), 'a user without a profile is not an administrator');
reset role;

select * from finish();
rollback;
