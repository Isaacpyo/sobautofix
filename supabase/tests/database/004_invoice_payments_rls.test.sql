begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

select ok((select relrowsecurity from pg_class where oid = 'public.invoice_payments'::regclass), 'invoice_payments has RLS enabled');
select ok(not has_table_privilege('anon', 'public.invoice_payments', 'select'), 'anon cannot read invoice payments');
select ok(has_table_privilege('authenticated', 'public.invoice_payments', 'select'), 'authenticated reads are subject to admin RLS');
select ok(not has_table_privilege('authenticated', 'public.invoice_payments', 'insert'), 'authenticated cannot insert payments directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_payments', 'update'), 'authenticated cannot update payments directly');
select ok(not has_table_privilege('authenticated', 'public.invoice_payments', 'delete'), 'authenticated cannot delete payments directly');
select ok(has_table_privilege('service_role', 'public.invoice_payments', 'select'), 'service role can read payments for server rendering');
select ok(not has_table_privilege('service_role', 'public.invoice_payments', 'insert'), 'service role cannot insert payments directly');
select ok(not has_table_privilege('service_role', 'public.invoice_payments', 'update'), 'service role cannot update payments directly');
select ok(not has_table_privilege('service_role', 'public.invoice_payments', 'delete'), 'service role cannot delete payments directly');
select ok(has_function_privilege('authenticated', 'public.record_invoice_payment(uuid,bigint,timestamptz,text,text)', 'execute'), 'authenticated callers can enter the guarded payment RPC');
select ok(not has_function_privilege('anon', 'public.record_invoice_payment(uuid,bigint,timestamptz,text,text)', 'execute'), 'anonymous callers cannot record payments');
select ok(not has_function_privilege('service_role', 'public.record_invoice_payment(uuid,bigint,timestamptz,text,text)', 'execute'), 'service role cannot bypass the guarded payment RPC');
select ok(has_function_privilege('authenticated', 'public.create_invoice_correction(uuid)', 'execute'), 'authenticated callers can enter the guarded correction RPC');
select ok(not has_function_privilege('anon', 'public.create_invoice_correction(uuid)', 'execute'), 'anonymous callers cannot create corrections');
select ok(not has_function_privilege('service_role', 'public.create_invoice_correction(uuid)', 'execute'), 'service role cannot bypass the guarded correction RPC');

select * from finish();
rollback;
