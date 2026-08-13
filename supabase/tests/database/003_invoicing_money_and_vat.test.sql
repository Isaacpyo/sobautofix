begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

select col_type_is('public', 'invoice_items', 'unit_price_pence', 'bigint', 'unit prices are stored as integer pence');
select col_type_is('public', 'invoice_items', 'line_total_pence', 'bigint', 'line totals are stored as integer pence');
select col_type_is('public', 'invoices', 'subtotal_pence', 'bigint', 'subtotals are stored as integer pence');
select col_type_is('public', 'invoices', 'discount_pence', 'bigint', 'discounts are stored as integer pence');
select col_type_is('public', 'invoices', 'tax_pence', 'bigint', 'tax is stored as integer pence');
select col_type_is('public', 'invoices', 'total_pence', 'bigint', 'totals are stored as integer pence');

select is(public.invoice_line_total(1.250, 799), 999::bigint, 'fractional quantities use exact numeric pence arithmetic');
select is(public.invoice_line_total(1.500, 1), 2::bigint, 'half-penny values round deterministically');

insert into auth.users (id, email, raw_user_meta_data)
select '12000000-0000-4000-8000-000000000001', 'sobautofix@gmail.com', '{}'::jsonb
where not exists (select 1 from auth.users where lower(email) = 'sobautofix@gmail.com');

create temporary table invoice_test_actor (id uuid primary key) on commit drop;
insert into invoice_test_actor (id)
select id from auth.users where lower(email) = 'sobautofix@gmail.com' limit 1;

insert into public.admin_profiles (user_id, display_name)
select id, 'Money Test Admin' from invoice_test_actor
on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.invoices (id, status, source_type, customer_name, created_by, updated_by)
values (
  '22000000-0000-4000-8000-000000000001',
  'draft',
  'manual',
  'Money fixture',
  (select id from invoice_test_actor),
  (select id from invoice_test_actor)
);

select set_config(
  'request.jwt.claims',
  jsonb_build_object('sub', (select id::text from invoice_test_actor), 'role', 'authenticated')::text,
  true
);
set local role authenticated;

select lives_ok(
  $test$
    select public.save_invoice_draft(
      '22000000-0000-4000-8000-000000000001',
      jsonb_build_object(
        'source_type', 'manual',
        'booking_id', '',
        'enquiry_id', '',
        'customer_id', '',
        'vehicle_id', '',
        'customer_name', 'Money fixture',
        'customer_email', 'money@example.test',
        'customer_phone', '',
        'customer_address', '',
        'vehicle_registration', 'MN12TST',
        'vehicle_make', 'Test',
        'vehicle_model', 'Money',
        'service_name', 'Exact arithmetic',
        'appointment_start', '',
        'issue_date', '2081-01-01',
        'due_date', '2081-01-08',
        'discount_pence', '100',
        'tax_pence', '0',
        'subtotal_pence', '999999999',
        'total_pence', '999999999',
        'notes', '',
        'payment_terms', '',
        'items', jsonb_build_array(jsonb_build_object(
          'description', 'Fractional labour',
          'quantity', '1.250',
          'unit_price_pence', '799',
          'line_total_pence', '999999999'
        ))
      ),
      false
    )
  $test$,
  'guarded draft save accepts valid integer-pence inputs'
);

select is(
  (select line_total_pence from public.invoice_items where invoice_id = '22000000-0000-4000-8000-000000000001'),
  999::bigint,
  'browser-submitted line total cannot override database calculation'
);
select is(
  (select subtotal_pence from public.invoices where id = '22000000-0000-4000-8000-000000000001'),
  999::bigint,
  'browser-submitted subtotal cannot override item sum'
);
select is(
  (select discount_pence from public.invoices where id = '22000000-0000-4000-8000-000000000001'),
  100::bigint,
  'validated discount remains integer pence'
);
select is(
  (select tax_pence from public.invoices where id = '22000000-0000-4000-8000-000000000001'),
  0::bigint,
  'tax remains zero while VAT is not configured'
);
select is(
  (select total_pence from public.invoices where id = '22000000-0000-4000-8000-000000000001'),
  899::bigint,
  'authoritative total is subtotal minus discount plus tax'
);

select throws_ok(
  $test$
    select public.save_invoice_draft(
      null,
      '{"source_type":"manual","customer_name":"VAT attempt","discount_pence":"0","tax_pence":"1","items":[{"description":"Work","quantity":"1","unit_price_pence":"100"}]}'::jsonb,
      false
    )
  $test$,
  'P0001', 'VAT_NOT_CONFIGURED', 'nonzero tax is rejected by the database RPC'
);
select throws_ok(
  $test$
    select public.save_invoice_draft(
      null,
      '{"source_type":"manual","customer_name":"Discount attempt","discount_pence":"101","tax_pence":"0","items":[{"description":"Work","quantity":"1","unit_price_pence":"100"}]}'::jsonb,
      false
    )
  $test$,
  'P0001', 'INVALID_INVOICE_TOTAL', 'discount cannot exceed the authoritative subtotal'
);
select throws_ok(
  $test$
    select public.save_invoice_draft(
      null,
      '{"source_type":"manual","customer_name":"Unsafe amount","discount_pence":"0","tax_pence":"0","items":[{"description":"Work","quantity":"1","unit_price_pence":"9007199254740992"}]}'::jsonb,
      false
    )
  $test$,
  '22003', 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER', 'amounts beyond the JavaScript-safe pence range are rejected'
);

reset role;

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.invoices'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~ 'tax_pence = 0'
  ),
  'a database constraint keeps VAT tax at zero until configured'
);

select * from finish();
rollback;
