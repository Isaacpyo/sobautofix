begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select ok(
  has_function_privilege('service_role', 'public.consume_rate_limit(text,text,integer,integer)', 'execute'),
  'service role can consume rate limits'
);
select ok(
  not has_function_privilege('anon', 'public.consume_rate_limit(text,text,integer,integer)', 'execute'),
  'anonymous callers cannot consume rate limits directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.consume_rate_limit(text,text,integer,integer)', 'execute'),
  'authenticated callers cannot consume rate limits directly'
);

select is(public.consume_rate_limit('pgtap-lint-repair', 'pgtap', 2, 60), true, 'first request is allowed');
select is(public.consume_rate_limit('pgtap-lint-repair', 'pgtap', 2, 60), true, 'request at the limit is allowed');
select is(public.consume_rate_limit('pgtap-lint-repair', 'pgtap', 2, 60), false, 'request above the limit is rejected');

select matches(
  pg_get_functiondef('public.create_booking_intent(uuid,text,text,text,text,text,text,integer,text,text,text,uuid,text,text,text,jsonb,jsonb,text,text,text,text,timestamptz,text)'::regprocedure),
  'service\.display_name = p_service_name',
  'booking intent validates the caller-supplied service name'
);
select matches(
  pg_get_functiondef('public.get_invoice_dashboard_without_payments(text,text,date,integer,integer)'::regprocedure),
  'perform public\.require_invoice_actor\(\)',
  'dashboard authorization is retained as an explicit check'
);

select * from finish();
rollback;
