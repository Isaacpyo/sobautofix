begin;

-- The primary-key constraint names the conflict target without colliding with
-- the legacy identifier_hash parameter name.
create or replace function public.consume_rate_limit(
  identifier_hash text,
  limit_scope text,
  request_limit integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket public.rate_limit_buckets;
begin
  insert into public.rate_limit_buckets as buckets (identifier_hash, scope, request_count, window_started_at)
  values (consume_rate_limit.identifier_hash, limit_scope, 1, now())
  on conflict on constraint rate_limit_buckets_pkey do update
  set request_count = case
        when buckets.window_started_at < now() - make_interval(secs => window_seconds) then 1
        else buckets.request_count + 1
      end,
      window_started_at = case
        when buckets.window_started_at < now() - make_interval(secs => window_seconds) then now()
        else buckets.window_started_at
      end
  returning * into bucket;
  return bucket.request_count <= request_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;

-- Keep the caller-supplied display name as an integrity check against the
-- selected catalogue row instead of accepting and silently ignoring it.
create or replace function public.create_booking_intent(
  p_idempotency_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_registration text,
  p_vehicle_make text,
  p_vehicle_model text,
  p_vehicle_year integer,
  p_vehicle_colour text,
  p_vehicle_fuel_type text,
  p_vehicle_transmission text,
  p_service_type_id uuid,
  p_service_key text,
  p_service_name text,
  p_problem_description text,
  p_symptoms jsonb,
  p_conditional_answers jsonb,
  p_location_mode text,
  p_location text,
  p_service_address text,
  p_service_postcode text,
  p_appointment_start timestamptz,
  p_timezone text
)
returns table (booking_id uuid, booking_reference text, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_booking public.bookings%rowtype;
  new_customer_id uuid;
  new_vehicle_id uuid;
  new_booking public.bookings%rowtype;
begin
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22004';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into existing_booking from public.bookings where idempotency_key = p_idempotency_key;
  if found then
    return query select existing_booking.id, existing_booking.booking_reference, false;
    return;
  end if;

  insert into public.customers (name, email, phone, preferred_contact)
  values (trim(p_customer_name), lower(trim(p_customer_email)), trim(p_customer_phone), 'email')
  returning id into new_customer_id;

  insert into public.vehicles (customer_id, registration, make, model, year, colour, fuel_type, transmission)
  values (
    new_customer_id,
    upper(regexp_replace(p_registration, '[^A-Za-z0-9]', '', 'g')),
    nullif(trim(p_vehicle_make), ''),
    nullif(trim(p_vehicle_model), ''),
    p_vehicle_year,
    nullif(trim(p_vehicle_colour), ''),
    nullif(trim(p_vehicle_fuel_type), ''),
    nullif(trim(p_vehicle_transmission), '')
  )
  returning id into new_vehicle_id;

  insert into public.bookings (
    customer_id,
    vehicle_id,
    service_type_id,
    idempotency_key,
    provider,
    provider_event_type_id,
    provider_sync_state,
    status,
    service_key,
    service_name,
    problem_description,
    symptoms,
    conditional_answers,
    location_mode,
    location,
    service_address,
    service_postcode,
    appointment_start,
    original_appointment_start,
    timezone
  )
  select
    new_customer_id,
    new_vehicle_id,
    p_service_type_id,
    p_idempotency_key,
    service.provider,
    service.provider_event_type_id,
    'pending',
    'pending',
    service.service_key,
    service.display_name,
    p_problem_description,
    coalesce(p_symptoms, '[]'::jsonb),
    coalesce(p_conditional_answers, '{}'::jsonb),
    p_location_mode,
    p_location,
    nullif(trim(p_service_address), ''),
    nullif(trim(p_service_postcode), ''),
    p_appointment_start,
    p_appointment_start,
    p_timezone
  from public.booking_service_types service
  where service.id = p_service_type_id
    and service.service_key = p_service_key
    and service.display_name = p_service_name
    and service.online_booking_enabled
    and service.provider_event_type_id is not null
    and (service.location_mode = 'both' or service.location_mode = p_location_mode)
  returning * into new_booking;

  if new_booking.id is null then
    raise exception 'BOOKING_SERVICE_NOT_AVAILABLE';
  end if;

  insert into public.booking_audit_log (booking_id, action, actor_type, detail)
  values (new_booking.id, 'created', 'system', jsonb_build_object('state', 'intent'));

  return query select new_booking.id, new_booking.booking_reference, true;
exception
  when unique_violation then
    select * into existing_booking from public.bookings where idempotency_key = p_idempotency_key;
    if existing_booking.id is null then raise; end if;
    return query select existing_booking.id, existing_booking.booking_reference, false;
end;
$$;

revoke all on function public.create_booking_intent(uuid,text,text,text,text,text,text,integer,text,text,text,uuid,text,text,text,jsonb,jsonb,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.create_booking_intent(uuid,text,text,text,text,text,text,integer,text,text,text,uuid,text,text,text,jsonb,jsonb,text,text,text,text,timestamptz,text) to service_role;

-- Preserve the pre-payment dashboard implementation used by the wrapper while
-- expressing the authorization check as a deliberate side effect.
create or replace function public.get_invoice_dashboard_without_payments(
  p_query text,
  p_status text,
  p_date date,
  p_page integer,
  p_page_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_query text := lower(trim(coalesce(p_query, '')));
  normalized_registration text := upper(regexp_replace(coalesce(p_query, ''), '[^A-Za-z0-9]', '', 'g'));
  matching_count bigint;
  page_count integer;
  effective_page integer;
  page_rows jsonb;
  draft_count bigint;
  outstanding_count bigint;
  paid_count bigint;
  outstanding_total numeric;
begin
  perform public.require_invoice_actor();
  if length(normalized_query) > 200 then
    raise exception 'INVALID_INVOICE_SEARCH_QUERY';
  end if;
  if p_status is not null and p_status not in ('draft', 'issued', 'paid', 'void') then
    raise exception 'INVALID_INVOICE_STATUS';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 100 then
    raise exception 'INVALID_INVOICE_PAGE';
  end if;

  select count(*)
  into matching_count
  from public.invoices invoice
  where (p_status is null or invoice.status::text = p_status)
    and (
      p_date is null
      or invoice.issue_date = p_date
      or (invoice.created_at at time zone 'UTC')::date = p_date
    )
    and (
      normalized_query = ''
      or position(normalized_query in lower(concat_ws(
        ' ',
        invoice.invoice_number,
        invoice.customer_name,
        invoice.customer_email,
        invoice.customer_phone,
        invoice.vehicle_registration,
        invoice.vehicle_make,
        invoice.vehicle_model
      ))) > 0
      or (
        length(normalized_registration) >= 2
        and position(normalized_registration in coalesce(invoice.vehicle_registration, '')) > 0
      )
    );

  page_count := greatest(1, ceil(matching_count::numeric / p_page_size)::integer);
  effective_page := least(p_page, page_count);

  select coalesce(jsonb_agg(to_jsonb(invoice_page) order by invoice_page.created_at desc, invoice_page.id desc), '[]'::jsonb)
  into page_rows
  from (
    select
      invoice.id,
      invoice.invoice_number,
      invoice.status,
      invoice.source_type,
      invoice.customer_name,
      invoice.customer_email,
      invoice.customer_phone,
      invoice.vehicle_registration,
      invoice.vehicle_make,
      invoice.vehicle_model,
      invoice.issue_date,
      invoice.due_date,
      invoice.total_pence,
      invoice.created_at
    from public.invoices invoice
    where (p_status is null or invoice.status::text = p_status)
      and (
        p_date is null
        or invoice.issue_date = p_date
        or (invoice.created_at at time zone 'UTC')::date = p_date
      )
      and (
        normalized_query = ''
        or position(normalized_query in lower(concat_ws(
          ' ',
          invoice.invoice_number,
          invoice.customer_name,
          invoice.customer_email,
          invoice.customer_phone,
          invoice.vehicle_registration,
          invoice.vehicle_make,
          invoice.vehicle_model
        ))) > 0
        or (
          length(normalized_registration) >= 2
          and position(normalized_registration in coalesce(invoice.vehicle_registration, '')) > 0
        )
      )
    order by invoice.created_at desc, invoice.id desc
    offset (effective_page - 1) * p_page_size
    limit p_page_size
  ) invoice_page;

  select
    count(*) filter (where invoice.status = 'draft'),
    count(*) filter (where invoice.status = 'issued'),
    count(*) filter (where invoice.status = 'paid'),
    coalesce(sum(invoice.total_pence) filter (where invoice.status = 'issued'), 0)
  into draft_count, outstanding_count, paid_count, outstanding_total
  from public.invoices invoice;

  return jsonb_build_object(
    'invoices', page_rows,
    'matching_count', matching_count::text,
    'page', effective_page,
    'pages', page_count,
    'draft_count', draft_count::text,
    'outstanding_count', outstanding_count::text,
    'paid_count', paid_count::text,
    'outstanding_total_pence', outstanding_total::text
  );
end
$$;

commit;
