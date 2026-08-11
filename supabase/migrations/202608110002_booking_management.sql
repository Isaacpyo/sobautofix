create type public.booking_status as enum ('pending', 'confirmed', 'rescheduled', 'cancelled', 'completed');

create or replace function public.generate_booking_reference()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := 'SOB-' || lpad((floor(random() * 1000000))::integer::text, 6, '0');
    exit when not exists (select 1 from public.bookings where booking_reference = candidate);
  end loop;
  return candidate;
end;
$$;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_reference text not null default public.generate_booking_reference() unique check (booking_reference ~ '^SOB-[0-9]{6}$'),
  customer_id uuid not null references public.customers(id),
  vehicle_id uuid not null references public.vehicles(id),
  status public.booking_status not null default 'confirmed',
  service_name text not null,
  appointment_start timestamptz not null,
  appointment_end timestamptz,
  original_appointment_start timestamptz not null,
  timezone text not null default 'Europe/London',
  location text,
  notes text,
  calendly_event_uri text not null,
  calendly_invitee_uri text not null unique,
  calendly_event_type_uri text,
  calendly_cancel_url text,
  calendly_reschedule_url text,
  cancellation_reason text,
  last_modified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_reference_lookup_idx on public.bookings (booking_reference);
create index bookings_calendly_event_idx on public.bookings (calendly_event_uri);
create index bookings_appointment_start_idx on public.bookings (appointment_start desc);

create table public.booking_audit_log (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  action text not null,
  actor_type text not null check (actor_type in ('customer', 'calendly', 'admin', 'system')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.calendly_webhook_events (
  event_key text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create trigger bookings_updated before update on public.bookings
for each row execute function public.set_updated_at();

alter table public.bookings enable row level security;
alter table public.booking_audit_log enable row level security;
alter table public.calendly_webhook_events enable row level security;

create policy "admins manage bookings" on public.bookings for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "admins read booking audit" on public.booking_audit_log for select to authenticated
using (public.is_admin());

revoke all on function public.generate_booking_reference() from public, anon, authenticated;
grant execute on function public.generate_booking_reference() to service_role;

