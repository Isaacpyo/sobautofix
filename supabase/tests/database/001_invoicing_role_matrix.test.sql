begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(64);

select ok((select relrowsecurity from pg_class where oid = 'public.invoices'::regclass), 'invoices has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.invoice_items'::regclass), 'invoice_items has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.invoice_email_sends'::regclass), 'invoice_email_sends has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.invoice_email_attempts'::regclass), 'invoice_email_attempts has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.invoice_number_sequences'::regclass), 'invoice_number_sequences has RLS enabled');

select ok(not has_table_privilege('anon', 'public.invoices', 'select'), 'anon cannot read invoices');
select ok(not has_table_privilege('anon', 'public.invoice_items', 'select'), 'anon cannot read invoice items');
select ok(not has_table_privilege('anon', 'public.invoice_email_sends', 'select'), 'anon cannot read email sends');
select ok(not has_table_privilege('anon', 'public.invoice_email_attempts', 'select'), 'anon cannot read email attempts');
select ok(not has_table_privilege('anon', 'public.invoice_number_sequences', 'select'), 'anon cannot read invoice sequences');

select ok(has_table_privilege('authenticated', 'public.invoices', 'select'), 'authenticated receives invoice read privilege subject to RLS');
select ok(has_table_privilege('authenticated', 'public.invoice_items', 'select'), 'authenticated receives item read privilege subject to RLS');
select ok(has_table_privilege('authenticated', 'public.invoice_email_sends', 'select'), 'authenticated receives email-send read privilege subject to RLS');
select ok(has_table_privilege('authenticated', 'public.invoice_email_attempts', 'select'), 'authenticated receives email-attempt read privilege subject to RLS');
select ok(not has_table_privilege('authenticated', 'public.invoice_number_sequences', 'select'), 'authenticated cannot inspect number sequences');

select ok(not has_table_privilege('authenticated', 'public.invoices', 'insert'), 'authenticated cannot insert invoices directly');
select ok(not has_table_privilege('authenticated', 'public.invoices', 'update'), 'authenticated cannot update invoices directly');
select ok(not has_table_privilege('authenticated', 'public.invoices', 'delete'), 'authenticated cannot delete invoices directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_items', 'insert'), 'authenticated cannot insert invoice items directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_items', 'update'), 'authenticated cannot update invoice items directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_items', 'delete'), 'authenticated cannot delete invoice items directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_email_sends', 'insert'), 'authenticated cannot insert email sends directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_email_sends', 'update'), 'authenticated cannot update email sends directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_email_sends', 'delete'), 'authenticated cannot delete email sends directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_email_attempts', 'insert'), 'authenticated cannot insert email attempts directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_email_attempts', 'update'), 'authenticated cannot update email attempts directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_email_attempts', 'delete'), 'authenticated cannot delete email attempts directly');

select ok(has_table_privilege('service_role', 'public.invoices', 'select'), 'service role can read invoices for server workflows');
select ok(has_table_privilege('service_role', 'public.invoice_items', 'select'), 'service role can read invoice items for server workflows');
select ok(has_table_privilege('service_role', 'public.invoice_email_sends', 'select'), 'service role can read email sends');
select ok(has_table_privilege('service_role', 'public.invoice_email_attempts', 'select'), 'service role can read email attempts');
select ok(not has_table_privilege('service_role', 'public.invoice_number_sequences', 'select'), 'service role cannot inspect number sequences');
select ok(not has_table_privilege('service_role', 'public.invoices', 'insert'), 'service role cannot insert invoices directly');
select ok(not has_table_privilege('service_role', 'public.invoices', 'update'), 'service role cannot update invoices directly');
select ok(not has_table_privilege('service_role', 'public.invoices', 'delete'), 'service role cannot delete invoices directly');
select ok(not has_table_privilege('service_role', 'public.invoice_items', 'insert'), 'service role cannot insert invoice items directly');
select ok(not has_table_privilege('service_role', 'public.invoice_items', 'update'), 'service role cannot update invoice items directly');
select ok(not has_table_privilege('service_role', 'public.invoice_items', 'delete'), 'service role cannot delete invoice items directly');
select ok(not has_table_privilege('service_role', 'public.invoice_email_sends', 'insert'), 'service role cannot insert email sends directly');
select ok(not has_table_privilege('service_role', 'public.invoice_email_sends', 'update'), 'service role cannot update email sends directly');
select ok(not has_table_privilege('service_role', 'public.invoice_email_sends', 'delete'), 'service role cannot delete email sends directly');
select ok(not has_table_privilege('service_role', 'public.invoice_email_attempts', 'insert'), 'service role cannot insert email attempts directly');
select ok(not has_table_privilege('service_role', 'public.invoice_email_attempts', 'update'), 'service role cannot update email attempts directly');
select ok(not has_table_privilege('service_role', 'public.invoice_email_attempts', 'delete'), 'service role cannot delete email attempts directly');
select ok(not has_sequence_privilege('anon', 'public.invoice_email_attempts_id_seq', 'usage'), 'anon cannot allocate email-attempt identities');
select ok(not has_sequence_privilege('authenticated', 'public.invoice_email_attempts_id_seq', 'usage'), 'authenticated cannot allocate email-attempt identities');
select ok(not has_sequence_privilege('service_role', 'public.invoice_email_attempts_id_seq', 'usage'), 'service role cannot allocate email-attempt identities directly');
select ok(has_table_privilege('authenticated', 'public.admin_audit_log', 'select'), 'authenticated admins can read audit evidence through RLS');
select ok(has_function_privilege('authenticated', 'public.save_invoice_draft(uuid,jsonb,boolean)', 'execute'), 'authenticated callers can enter the guarded draft RPC');
select ok(has_function_privilege('authenticated', 'public.get_invoice_dashboard(text,text,date,integer,integer)', 'execute'), 'authenticated callers can enter the guarded dashboard RPC');
select ok(not has_function_privilege('anon', 'public.get_invoice_dashboard(text,text,date,integer,integer)', 'execute'), 'anonymous callers cannot query the invoice dashboard RPC');
select ok(not has_function_privilege('service_role', 'public.get_invoice_dashboard(text,text,date,integer,integer)', 'execute'), 'service role cannot bypass the authenticated dashboard RPC');
select ok(not has_function_privilege('authenticated', 'public.finalize_invoice_email_send(bigint,uuid,text)', 'execute'), 'authenticated callers cannot finalize provider delivery');
select ok(not has_function_privilege('service_role', 'public.save_invoice_draft(uuid,jsonb,boolean)', 'execute'), 'service role cannot bypass the authenticated draft RPC');
select ok(has_function_privilege('service_role', 'public.finalize_invoice_email_send(bigint,uuid,text)', 'execute'), 'service role can finalize provider delivery');
select ok(has_function_privilege('service_role', 'public.fail_invoice_email_send(bigint,uuid,text,boolean,text)', 'execute'), 'service role can persist provider failure outcomes');

insert into auth.users (id, email, raw_user_meta_data)
select '10000000-0000-4000-8000-000000000001', 'sobautofix@gmail.com', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'sobautofix@gmail.com');

insert into auth.users (id, email, raw_user_meta_data)
select '10000000-0000-4000-8000-000000000002', 'ordinary-user@example.test', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'ordinary-user@example.test');

create temporary table invoice_test_actor (id uuid primary key) on commit drop;
insert into invoice_test_actor (id)
select id from auth.users where lower(email) = 'sobautofix@gmail.com' limit 1;

insert into public.admin_profiles (user_id, display_name)
select id, 'pgTAP Admin' from invoice_test_actor
on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.invoices (id, status, source_type, customer_name, created_by, updated_by)
values (
  '20000000-0000-4000-8000-000000000001',
  'draft',
  'manual',
  'RLS fixture',
  (select id from invoice_test_actor),
  (select id from invoice_test_actor)
);

insert into public.invoice_items (id, invoice_id, description, quantity, unit_price_pence, line_total_pence)
values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'RLS item', 1, 100, 0);

insert into public.invoice_email_sends (
  id, invoice_id, recipient, invoice_revision, document_status, document_number,
  payload_sha256, provider_idempotency_key, status, requested_by
)
values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'rls@example.test',
  2,
  'issued',
  'SOB-2080-000001',
  repeat('a', 64),
  'invoice-role-matrix-fixture',
  'pending',
  (select id from invoice_test_actor)
);

insert into public.invoice_email_attempts (
  logical_send_id, invoice_id, attempt_number, status, claim_token, lease_expires_at, attempted_by
)
values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  1,
  'pending',
  '50000000-0000-4000-8000-000000000001',
  now() + interval '15 minutes',
  (select id from invoice_test_actor)
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', '10000000-0000-4000-8000-000000000002', 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select results_eq('select count(*) from public.invoices', array[0::bigint], 'non-admin cannot see invoices');
select results_eq('select count(*) from public.invoice_items', array[0::bigint], 'non-admin cannot see invoice items');
select results_eq('select count(*) from public.invoice_email_sends', array[0::bigint], 'non-admin cannot see email sends');
select results_eq('select count(*) from public.invoice_email_attempts', array[0::bigint], 'non-admin cannot see email attempts');

reset role;
select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from invoice_test_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select results_eq(
  $$select count(*) from public.invoices where id = '20000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'admin can see the invoice fixture'
);
select results_eq(
  $$select count(*) from public.invoice_items where id = '30000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'admin can see the invoice-item fixture'
);
select results_eq(
  $$select count(*) from public.invoice_email_sends where id = '40000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'admin can see the email-send fixture'
);
select results_eq(
  $$select count(*) from public.invoice_email_attempts where logical_send_id = '40000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'admin can see the email-attempt fixture'
);

reset role;
select * from finish();
rollback;
