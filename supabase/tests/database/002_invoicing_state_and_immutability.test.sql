begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

insert into auth.users (id, email, raw_user_meta_data)
select '11000000-0000-4000-8000-000000000001', 'sobautofix@gmail.com', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'sobautofix@gmail.com');

create temporary table invoice_test_actor (id uuid primary key) on commit drop;
insert into invoice_test_actor (id)
select id from auth.users where lower(email) = 'sobautofix@gmail.com' limit 1;

insert into public.admin_profiles (user_id, display_name)
select id, 'State Test Admin' from invoice_test_actor
on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.invoices (
  id, status, source_type, customer_name, customer_email, vehicle_registration,
  service_name, appointment_start, issue_date, due_date, created_by, updated_by
)
values
  (
    '21000000-0000-4000-8000-000000000001', 'draft', 'manual', 'Issued fixture',
    'issued@example.test', 'ST12ONE', 'Original service', '2080-03-01T09:00:00Z', '2080-03-01', '2080-03-08',
    (select id from invoice_test_actor), (select id from invoice_test_actor)
  ),
  (
    '21000000-0000-4000-8000-000000000002', 'draft', 'manual', 'Editable draft',
    'draft@example.test', 'ST12TWO', 'Draft service', '2080-03-02T09:00:00Z', '2080-03-02', '2080-03-09',
    (select id from invoice_test_actor), (select id from invoice_test_actor)
  ),
  (
    '21000000-0000-4000-8000-000000000003', 'draft', 'manual', 'Void fixture',
    'void@example.test', 'ST12THR', 'Void service', '2080-03-03T09:00:00Z', '2080-03-03', '2080-03-10',
    (select id from invoice_test_actor), (select id from invoice_test_actor)
  ),
  (
    '21000000-0000-4000-8000-000000000004', 'draft', 'manual', 'Empty invalid draft',
    'empty@example.test', 'ST12EMP', 'No lines', '2099-04-01T09:00:00Z', '2099-04-01', '2099-04-08',
    (select id from invoice_test_actor), (select id from invoice_test_actor)
  );

insert into public.invoice_items (id, invoice_id, description, quantity, unit_price_pence, line_total_pence)
values
  ('31000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 'Issued line', 1, 10000, 0),
  ('31000000-0000-4000-8000-000000000002', '21000000-0000-4000-8000-000000000002', 'Draft line', 1, 20000, 0),
  ('31000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000003', 'Void line', 1, 30000, 0);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from invoice_test_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$select public.issue_invoice('21000000-0000-4000-8000-000000000001')$$,
  'admin can issue a valid draft through the guarded RPC'
);
select is(
  (select status::text from public.invoices where id = '21000000-0000-4000-8000-000000000001'),
  'issued',
  'issue RPC changes draft to issued'
);
select matches(
  (select invoice_number from public.invoices where id = '21000000-0000-4000-8000-000000000001'),
  '^SOB-2080-[0-9]{6}$',
  'issue RPC allocates the required number format'
);
select throws_ok(
  $$select public.issue_invoice('21000000-0000-4000-8000-000000000004')$$,
  'P0001', 'INVOICE_ITEM_REQUIRED', 'an empty invalid draft is rejected before number allocation'
);

reset role;
select results_eq(
  $$select count(*) from public.invoice_number_sequences where invoice_year = 2099$$,
  array[0::bigint],
  'a rejected issue attempt does not consume or create a number sequence'
);

select throws_ok(
  $$update public.invoices set status = 'paid' where id = '21000000-0000-4000-8000-000000000002'$$,
  'P0001', 'INVALID_INVOICE_STATUS_TRANSITION', 'draft cannot transition directly to paid'
);
select throws_ok(
  $$insert into public.invoices (status, invoice_number, invoice_year, invoice_sequence, source_type, customer_name, created_by, updated_by) values ('paid', 'SOB-2080-999999', 2080, 999999, 'manual', 'Invalid paid insert', (select id from invoice_test_actor), (select id from invoice_test_actor))$$,
  'P0001', 'VALID_DRAFT_INSERT_REQUIRED', 'a non-draft invoice cannot be inserted directly'
);
select throws_ok(
  $$update public.invoices set invoice_number = 'SOB-2080-999998' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ISSUED_INVOICE_IS_IMMUTABLE', 'issued invoice number is immutable'
);
select throws_ok(
  $$update public.invoices set total_pence = 1 where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ISSUED_INVOICE_IS_IMMUTABLE', 'issued invoice total is immutable'
);
select throws_ok(
  $$update public.invoices set tax_pence = 1 where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ISSUED_INVOICE_IS_IMMUTABLE', 'issued invoice tax is immutable'
);
select throws_ok(
  $$update public.invoices set issuer_legal_name = 'Rewritten issuer' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVOICE_IDENTITY_IS_IMMUTABLE', 'issued legal issuer snapshot is immutable'
);
select throws_ok(
  $$update public.invoices set customer_name = 'Rewritten customer' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ISSUED_INVOICE_IS_IMMUTABLE', 'issued customer snapshot is immutable'
);
select throws_ok(
  $$update public.invoices set service_name = 'Rewritten service' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ISSUED_INVOICE_IS_IMMUTABLE', 'issued service snapshot is immutable'
);
select throws_ok(
  $$update public.invoices set appointment_start = '2080-04-01T09:00:00Z' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ISSUED_INVOICE_IS_IMMUTABLE', 'issued appointment snapshot is immutable'
);
select throws_ok(
  $$update public.invoices set issue_date = '2080-04-01' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ISSUED_INVOICE_IS_IMMUTABLE', 'issued date is immutable'
);
select throws_ok(
  $$update public.invoice_items set quantity = 2 where id = '31000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVOICE_ITEMS_ARE_IMMUTABLE', 'issued item quantity is immutable'
);
select throws_ok(
  $$update public.invoice_items set invoice_id = '21000000-0000-4000-8000-000000000002' where id = '31000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVOICE_ITEM_PARENT_IS_IMMUTABLE', 'issued item cannot be re-parented to a draft'
);
select throws_ok(
  $$delete from public.invoice_items where id = '31000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVOICE_ITEMS_ARE_IMMUTABLE', 'issued item cannot be deleted'
);
select throws_ok(
  $$delete from public.invoices where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'ONLY_DRAFT_INVOICES_CAN_BE_DELETED', 'issued invoice cannot be deleted'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from invoice_test_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  $$select public.mark_invoice_paid('21000000-0000-4000-8000-000000000001', '2080-03-05T12:00:00Z', 'card', 'LOCAL-TEST')$$,
  'issued invoice can transition to paid through the guarded RPC'
);

reset role;
select throws_ok(
  $$update public.invoices set status = 'draft' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVALID_INVOICE_STATUS_TRANSITION', 'paid invoice cannot return to draft'
);
select throws_ok(
  $$update public.invoices set status = 'issued' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVALID_INVOICE_STATUS_TRANSITION', 'paid invoice cannot return to issued'
);
select throws_ok(
  $$update public.invoices set status = 'void' where id = '21000000-0000-4000-8000-000000000001'$$,
  'P0001', 'INVALID_INVOICE_STATUS_TRANSITION', 'paid invoice cannot transition to void'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from invoice_test_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select lives_ok(
  $$select public.issue_invoice('21000000-0000-4000-8000-000000000003')$$,
  'second valid draft can be issued'
);
select lives_ok(
  $$select public.void_invoice('21000000-0000-4000-8000-000000000003')$$,
  'issued invoice can transition to void through the guarded RPC'
);

reset role;
select throws_ok(
  $$update public.invoices set status = 'paid' where id = '21000000-0000-4000-8000-000000000003'$$,
  'P0001', 'INVALID_INVOICE_STATUS_TRANSITION', 'void invoice cannot transition to paid'
);
select throws_ok(
  $$update public.invoices set status = 'draft' where id = '21000000-0000-4000-8000-000000000003'$$,
  'P0001', 'INVALID_INVOICE_STATUS_TRANSITION', 'void invoice cannot return to draft'
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from invoice_test_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;
select lives_ok(
  $$select public.duplicate_invoice_to_draft('21000000-0000-4000-8000-000000000001')$$,
  'paid invoice can be duplicated into a correction draft'
);
select results_eq(
  $$select count(*) from public.invoices where replaces_invoice_id = '21000000-0000-4000-8000-000000000001' and status = 'draft'$$,
  array[1::bigint],
  'correction workflow creates one linked draft'
);

reset role;
select lives_ok(
  $$delete from public.invoices where id = '21000000-0000-4000-8000-000000000002'$$,
  'draft invoice can be deleted'
);
select results_eq(
  $$select count(*) from public.invoices where id = '21000000-0000-4000-8000-000000000002'$$,
  array[0::bigint],
  'deleted draft is removed'
);

select * from finish();
rollback;
