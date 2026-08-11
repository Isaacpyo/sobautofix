-- Conservative forward migration: the deployment history of 202608110002
-- cannot be verified for every remote project. This migration preserves any
-- legacy rows while making the live booking model provider-neutral.

do $$
begin
  create type public.booking_status as enum ('pending', 'confirmed', 'rescheduled', 'cancelled', 'completed');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.booking_service_types (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique check (service_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  display_name text not null,
  description text not null default '',
  provider text not null default 'calcom',
  provider_event_type_id bigint,
  online_booking_enabled boolean not null default false,
  location_mode text not null check (location_mode in ('workshop', 'mobile', 'both')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not online_booking_enabled or provider_event_type_id is not null)
);

update public.booking_service_types
set provider_event_type_id = null, online_booking_enabled = false
where provider_event_type_id is not null and provider_event_type_id <= 0;

update public.booking_service_types
set online_booking_enabled = false
where online_booking_enabled and provider <> 'calcom';

alter table public.booking_service_types drop constraint if exists booking_service_types_provider_event_type_id_check;
alter table public.booking_service_types add constraint booking_service_types_provider_event_type_id_check
  check (provider_event_type_id is null or provider_event_type_id > 0);
alter table public.booking_service_types drop constraint if exists booking_service_types_online_provider_check;
alter table public.booking_service_types add constraint booking_service_types_online_provider_check
  check (not online_booking_enabled or (provider = 'calcom' and provider_event_type_id is not null));

create or replace function public.generate_booking_reference()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  -- Serialize the short reference allocation window so the existence check and
  -- the following INSERT cannot race another generated booking reference.
  perform pg_advisory_xact_lock(hashtextextended('public.bookings.booking_reference', 0));

  loop
    candidate := 'SOB-' || lpad((floor(random() * 1000000))::integer::text, 6, '0');
    exit when not exists (select 1 from public.bookings where booking_reference = candidate);
  end loop;
  return candidate;
end;
$$;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null default public.generate_booking_reference() unique check (booking_reference ~ '^SOB-[0-9]{6}$'),
  customer_id uuid not null references public.customers(id),
  vehicle_id uuid not null references public.vehicles(id),
  service_type_id uuid references public.booking_service_types(id),
  idempotency_key uuid,
  provider text not null default 'calcom',
  provider_booking_uid text,
  provider_event_type_id bigint,
  provider_legacy_event_uri text,
  provider_legacy_attendee_uri text,
  provider_legacy_event_type_uri text,
  provider_legacy_cancel_url text,
  provider_legacy_reschedule_url text,
  provider_sync_state text not null default 'pending' check (provider_sync_state in ('pending', 'synced', 'failed')),
  provider_event_updated_at timestamptz,
  provider_error_code text,
  status public.booking_status not null default 'pending',
  service_key text,
  service_name text not null,
  problem_description text,
  symptoms jsonb not null default '[]'::jsonb,
  conditional_answers jsonb not null default '{}'::jsonb,
  location_mode text check (location_mode in ('workshop', 'mobile')),
  location text,
  service_address text,
  service_postcode text,
  appointment_start timestamptz not null,
  appointment_end timestamptz,
  original_appointment_start timestamptz not null,
  original_appointment_end timestamptz,
  timezone text not null default 'Europe/London',
  notes text,
  cancellation_reason text,
  cancelled_at timestamptz,
  last_modified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Transform the provider-specific schema from 202608110002 when it exists.
-- Disable its generic update trigger first so compatibility copies do not
-- rewrite the historical updated_at value on every legacy booking.
drop trigger if exists bookings_updated on public.bookings;

do $$
declare
  source_column text;
  target_column text;
  has_conflicting_values boolean;
begin
  for source_column, target_column in
    select * from (values
      ('calendly_event_uri', 'provider_legacy_event_uri'),
      ('calendly_invitee_uri', 'provider_legacy_attendee_uri'),
      ('calendly_event_type_uri', 'provider_legacy_event_type_uri'),
      ('calendly_cancel_url', 'provider_legacy_cancel_url'),
      ('calendly_reschedule_url', 'provider_legacy_reschedule_url')
    ) as mappings(source_column, target_column)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'bookings' and column_name = source_column
    ) then
      if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'bookings' and column_name = target_column
      ) then
        execute format(
          'select exists (select 1 from public.bookings where %1$I is not null and %2$I is not null and %1$I is distinct from %2$I)',
          target_column,
          source_column
        ) into has_conflicting_values;
        execute format(
          'update public.bookings set %1$I = coalesce(%1$I, %2$I)',
          target_column,
          source_column
        );
        -- In an uncertain partially-modernized database, retain both historical
        -- columns when their populated values disagree instead of losing data.
        if not has_conflicting_values then
          execute format('alter table public.bookings drop column %I', source_column);
        end if;
      else
        execute format(
          'alter table public.bookings rename column %I to %I',
          source_column,
          target_column
        );
      end if;
    end if;
  end loop;
end
$$;

alter table public.bookings
  add column if not exists service_type_id uuid references public.booking_service_types(id),
  add column if not exists idempotency_key uuid,
  add column if not exists provider text,
  add column if not exists provider_booking_uid text,
  add column if not exists provider_event_type_id bigint,
  add column if not exists provider_legacy_event_uri text,
  add column if not exists provider_legacy_attendee_uri text,
  add column if not exists provider_legacy_event_type_uri text,
  add column if not exists provider_legacy_cancel_url text,
  add column if not exists provider_legacy_reschedule_url text,
  add column if not exists provider_sync_state text,
  add column if not exists provider_event_updated_at timestamptz,
  add column if not exists provider_error_code text,
  add column if not exists service_key text,
  add column if not exists problem_description text,
  add column if not exists symptoms jsonb,
  add column if not exists conditional_answers jsonb,
  add column if not exists location_mode text,
  add column if not exists service_address text,
  add column if not exists service_postcode text,
  add column if not exists original_appointment_end timestamptz,
  add column if not exists cancelled_at timestamptz;

-- New lookup input is normalized before comparison. Normalize only customers
-- connected to bookings so equality stays case-insensitive without wildcard
-- matching through PostgREST ILIKE semantics.
update public.customers customer
set email = lower(trim(customer.email))
where customer.email is not null
  and customer.email is distinct from lower(trim(customer.email))
  and exists (
    select 1 from public.bookings booking where booking.customer_id = customer.id
  );

drop policy if exists "admins manage bookings" on public.bookings;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'provider_legacy_event_uri'
  ) then
    alter table public.bookings alter column provider_legacy_event_uri drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings' and column_name = 'provider_legacy_attendee_uri'
  ) then
    alter table public.bookings alter column provider_legacy_attendee_uri drop not null;
  end if;
end
$$;

update public.bookings
set
  provider = coalesce(provider, case when provider_legacy_event_uri is not null then 'legacy' else 'calcom' end),
  provider_sync_state = coalesce(provider_sync_state, case when provider_legacy_event_uri is not null then 'failed' else 'pending' end),
  provider_error_code = coalesce(provider_error_code, case when provider_legacy_event_uri is not null then 'legacy_provider_record' end),
  service_key = coalesce(service_key, 'legacy-service'),
  symptoms = coalesce(symptoms, '[]'::jsonb),
  conditional_answers = coalesce(conditional_answers, '{}'::jsonb)
where provider is null
   or provider_sync_state is null
   or service_key is null
   or symptoms is null
   or conditional_answers is null;

alter table public.bookings
  alter column status set default 'pending',
  alter column provider set default 'calcom',
  alter column provider set not null,
  alter column provider_sync_state set default 'pending',
  alter column provider_sync_state set not null,
  alter column symptoms set default '[]'::jsonb,
  alter column symptoms set not null,
  alter column conditional_answers set default '{}'::jsonb,
  alter column conditional_answers set not null;

alter table public.bookings drop constraint if exists bookings_provider_sync_state_check;
alter table public.bookings add constraint bookings_provider_sync_state_check
  check (provider_sync_state in ('pending', 'synced', 'failed'));
alter table public.bookings drop constraint if exists bookings_location_mode_check;
alter table public.bookings add constraint bookings_location_mode_check
  check (location_mode is null or location_mode in ('workshop', 'mobile'));
alter table public.bookings drop constraint if exists bookings_calendly_invitee_uri_key;

drop index if exists public.bookings_calendly_event_idx;
drop index if exists public.bookings_reference_lookup_idx;
create unique index if not exists bookings_idempotency_idx on public.bookings (idempotency_key) where idempotency_key is not null;
create unique index if not exists bookings_provider_uid_idx on public.bookings (provider, provider_booking_uid) where provider_booking_uid is not null;
create index if not exists bookings_sync_state_idx on public.bookings (provider_sync_state, appointment_start);
create index if not exists bookings_service_type_idx on public.bookings (service_type_id);
create index if not exists bookings_appointment_start_idx on public.bookings (appointment_start desc);

create table if not exists public.booking_audit_log (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  action text not null,
  actor_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.booking_audit_log drop constraint if exists booking_audit_log_actor_type_check;
update public.booking_audit_log set actor_type = 'provider' where actor_type = 'calendly';
alter table public.booking_audit_log add constraint booking_audit_log_actor_type_check
  check (actor_type in ('customer', 'provider', 'admin', 'system'));

do $$
begin
  if to_regclass('public.calendly_webhook_events') is not null
     and to_regclass('public.provider_webhook_events') is null then
    alter table public.calendly_webhook_events rename to provider_webhook_events;
  end if;
end
$$;

create table if not exists public.provider_webhook_events (
  event_key text primary key,
  provider text not null default 'calcom',
  event_type text not null,
  provider_booking_uid text,
  occurred_at timestamptz,
  outcome text not null default 'processed',
  processed_at timestamptz not null default now()
);

alter table public.provider_webhook_events
  add column if not exists provider text,
  add column if not exists provider_booking_uid text,
  add column if not exists occurred_at timestamptz,
  add column if not exists outcome text;

update public.provider_webhook_events
set provider = coalesce(provider, 'legacy'), outcome = coalesce(outcome, 'processed')
where provider is null or outcome is null;

alter table public.provider_webhook_events
  alter column provider set default 'calcom',
  alter column provider set not null,
  alter column outcome set default 'processed',
  alter column outcome set not null;

do $$
declare
  has_conflicting_events boolean;
begin
  if to_regclass('public.calendly_webhook_events') is not null then
    select exists (
      select 1
      from public.calendly_webhook_events legacy
      join public.provider_webhook_events current using (event_key)
      where current.event_type is distinct from legacy.event_type
         or current.processed_at is distinct from legacy.processed_at
    ) into has_conflicting_events;

    insert into public.provider_webhook_events (
      event_key,
      provider,
      event_type,
      outcome,
      processed_at
    )
    select event_key, 'legacy', event_type, 'processed', processed_at
    from public.calendly_webhook_events
    on conflict (event_key) do nothing;

    if not has_conflicting_events then
      drop table public.calendly_webhook_events;
    end if;
  end if;
end
$$;

create table if not exists public.booking_notification_events (
  notification_key text primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  notification_type text not null check (notification_type in ('confirmed', 'rescheduled', 'cancelled')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  last_error_code text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

drop trigger if exists booking_service_types_updated on public.booking_service_types;
create trigger booking_service_types_updated before update on public.booking_service_types
for each row execute function public.set_updated_at();

drop trigger if exists bookings_updated on public.bookings;
create trigger bookings_updated before update on public.bookings
for each row execute function public.set_updated_at();

drop trigger if exists booking_notification_events_updated on public.booking_notification_events;
create trigger booking_notification_events_updated before update on public.booking_notification_events
for each row execute function public.set_updated_at();

alter table public.booking_service_types enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_audit_log enable row level security;
alter table public.provider_webhook_events enable row level security;
alter table public.booking_notification_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_service_types' and policyname = 'admins manage booking service types') then
    create policy "admins manage booking service types" on public.booking_service_types for all to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bookings' and policyname = 'admins read bookings') then
    create policy "admins read bookings" on public.bookings for select to authenticated
      using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'bookings' and policyname = 'admins update bookings') then
    create policy "admins update bookings" on public.bookings for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_audit_log' and policyname = 'admins read booking audit') then
    create policy "admins read booking audit" on public.booking_audit_log for select to authenticated
      using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'provider_webhook_events' and policyname = 'admins read provider webhook events') then
    create policy "admins read provider webhook events" on public.provider_webhook_events for select to authenticated
      using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'booking_notification_events' and policyname = 'admins read booking notification events') then
    create policy "admins read booking notification events" on public.booking_notification_events for select to authenticated
      using (public.is_admin());
  end if;
end
$$;

insert into public.booking_service_types (service_key, display_name, description, location_mode, sort_order)
values
  ('vehicle-diagnostics', 'Vehicle Diagnostics', 'Professional system scanning, testing and fault investigation.', 'workshop', 10),
  ('electrical-fault-finding', 'Electrical Fault Finding', 'Focused investigation of electrical, wiring and communication faults.', 'workshop', 20),
  ('vehicle-servicing', 'Vehicle Servicing', 'Scheduled servicing and vehicle health checks.', 'workshop', 30),
  ('engine-repair-assessment', 'Engine Repair Assessment', 'Evidence-led assessment before engine repair work is approved.', 'workshop', 40),
  ('brake-repair-assessment', 'Brake Repair Assessment', 'Brake inspection and assessment before repair or replacement.', 'workshop', 50),
  ('mobile-diagnostic-visit', 'Mobile Diagnostic Visit', 'A diagnostic visit at an eligible customer location.', 'mobile', 60),
  ('pre-purchase-inspection', 'Pre-Purchase Inspection', 'An independent inspection at the vehicle or seller location.', 'mobile', 70)
on conflict (service_key) do nothing;

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

revoke all on function public.generate_booking_reference() from public, anon, authenticated;
grant execute on function public.generate_booking_reference() to service_role;
revoke all on function public.create_booking_intent(uuid,text,text,text,text,text,text,integer,text,text,text,uuid,text,text,text,jsonb,jsonb,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.create_booking_intent(uuid,text,text,text,text,text,text,integer,text,text,text,uuid,text,text,text,jsonb,jsonb,text,text,text,text,timestamptz,text) to service_role;
