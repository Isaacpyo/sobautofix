-- SOB Auto Exchange, part 2 of 2: vehicle buying and selling, the shared
-- Autofix Diary and staff roles.
--
-- Rollout safety:
-- * Additive only. No column, table or enum value is dropped or renamed, and
--   every existing row stays valid. The previous application release keeps
--   working against this schema, so it can be applied before the code ships.
-- * Every customer-facing read stays behind the existing public RLS on
--   sale_vehicles; all new private tables deny anon and require is_admin().
-- * Rollback: the application tolerates this migration being absent, so a
--   code rollback needs no schema rollback. To remove the feature data, drop
--   the new tables (see docs/exchange/OPERATIONS.md) after taking a dump.

begin;

-- ---------------------------------------------------------------------------
-- Staff roles. Existing administrators keep full access as owners.
-- ---------------------------------------------------------------------------

alter table public.admin_profiles add column if not exists staff_role text not null default 'owner';
alter table public.admin_profiles drop constraint if exists admin_profiles_staff_role_check;
alter table public.admin_profiles add constraint admin_profiles_staff_role_check
  check (staff_role in ('owner', 'manager', 'sales', 'workshop'));

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.staff_role
  from public.admin_profiles profile
  where profile.user_id = auth.uid()
    and public.is_admin();
$$;

create or replace function public.staff_can_view_finance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() in ('owner', 'manager'), false);
$$;

create or replace function public.staff_can_manage_exchange_settings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() = 'owner', false);
$$;

revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.staff_can_view_finance() from public, anon;
revoke all on function public.staff_can_manage_exchange_settings() from public, anon;
grant execute on function public.current_staff_role() to authenticated, service_role;
grant execute on function public.staff_can_view_finance() to authenticated, service_role;
grant execute on function public.staff_can_manage_exchange_settings() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Settings. Public values (business name, contact, policy copy) are readable
-- by visitors; notification recipients and operating thresholds are not.
-- Empty objects mean "use the code defaults in src/config/exchange.ts".
-- ---------------------------------------------------------------------------

create table if not exists public.exchange_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.exchange_private_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.exchange_settings (id) values (true) on conflict (id) do nothing;
insert into public.exchange_private_settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Stock: public disclosure fields on the existing sale_vehicles table.
-- Only information that may be shown to visitors belongs here, because the
-- existing public RLS policy exposes every column of a listed vehicle.
-- Private costs, notes and documents live in separate admin-only tables.
-- ---------------------------------------------------------------------------

create or replace function public.generate_stock_reference()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.sale_vehicles.stock_reference', 0));
  loop
    candidate := 'STK-' || lpad((floor(random() * 100000))::integer::text, 5, '0');
    exit when not exists (select 1 from public.sale_vehicles where stock_reference = candidate);
  end loop;
  return candidate;
end;
$$;

revoke all on function public.generate_stock_reference() from public, anon, authenticated;
grant execute on function public.generate_stock_reference() to service_role;

alter table public.sale_vehicles
  add column if not exists stock_reference text,
  add column if not exists listing_condition text not null default 'ready_to_drive',
  add column if not exists write_off_status text not null default 'not_confirmed',
  add column if not exists condition_summary text,
  add column if not exists known_faults text[] not null default '{}',
  add column if not exists work_completed text[] not null default '{}',
  add column if not exists inspection_date date,
  add column if not exists inspection_scope text,
  add column if not exists inspection_findings text,
  add column if not exists mot_expiry date,
  add column if not exists mot_notes text,
  add column if not exists service_history text not null default 'not_confirmed',
  add column if not exists service_history_notes text,
  add column if not exists previous_owners integer,
  add column if not exists keys_count integer,
  add column if not exists doors integer,
  add column if not exists seats integer,
  add column if not exists history_check_summary text,
  add column if not exists history_checked_on date,
  add column if not exists video_url text,
  add column if not exists collection_delivery text,
  add column if not exists after_sales text,
  add column if not exists listed_at timestamptz,
  add column if not exists reserved_at timestamptz;

update public.sale_vehicles
set stock_reference = public.generate_stock_reference()
where stock_reference is null;

update public.sale_vehicles
set listed_at = created_at
where listed_at is null and status in ('available', 'reserved', 'sold');

alter table public.sale_vehicles alter column stock_reference set default public.generate_stock_reference();
alter table public.sale_vehicles alter column stock_reference set not null;
create unique index if not exists sale_vehicles_stock_reference_key on public.sale_vehicles (stock_reference);

alter table public.sale_vehicles drop constraint if exists sale_vehicles_listing_condition_check;
alter table public.sale_vehicles add constraint sale_vehicles_listing_condition_check
  check (listing_condition in ('ready_to_drive', 'repair_project'));
alter table public.sale_vehicles drop constraint if exists sale_vehicles_write_off_status_check;
alter table public.sale_vehicles add constraint sale_vehicles_write_off_status_check
  check (write_off_status in ('not_confirmed', 'none_recorded', 'cat_s', 'cat_n', 'cat_c', 'cat_d', 'other_recorded'));
alter table public.sale_vehicles drop constraint if exists sale_vehicles_service_history_check;
alter table public.sale_vehicles add constraint sale_vehicles_service_history_check
  check (service_history in ('not_confirmed', 'full', 'partial', 'none'));
alter table public.sale_vehicles drop constraint if exists sale_vehicles_counts_check;
alter table public.sale_vehicles add constraint sale_vehicles_counts_check
  check (
    (previous_owners is null or previous_owners between 0 and 50)
    and (keys_count is null or keys_count between 0 and 10)
    and (doors is null or doors between 0 and 9)
    and (seats is null or seats between 0 and 99)
  );
alter table public.sale_vehicles drop constraint if exists sale_vehicles_video_url_check;
alter table public.sale_vehicles add constraint sale_vehicles_video_url_check
  check (video_url is null or video_url ~ '^https://');

create index if not exists sale_vehicles_public_listing_idx
  on public.sale_vehicles (status, listed_at desc)
  where deleted_at is null;

-- Private, one row per stock vehicle: acquisition details and internal notes.
create table if not exists public.vehicle_internal_records (
  sale_vehicle_id uuid primary key references public.sale_vehicles(id) on delete cascade,
  acquired_on date,
  acquisition_source text check (acquisition_source is null or acquisition_source in ('customer_purchase', 'part_exchange', 'trade', 'auction', 'other')),
  seller_submission_id uuid,
  internal_notes text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicle_costs (
  id uuid primary key default gen_random_uuid(),
  sale_vehicle_id uuid not null references public.sale_vehicles(id) on delete cascade,
  category text not null check (category in ('purchase', 'transport', 'preparation', 'repair', 'parts', 'valeting', 'fees', 'other')),
  description text not null check (char_length(description) between 1 and 200),
  amount_pence integer not null check (amount_pence >= 0),
  basis text not null default 'actual' check (basis in ('estimated', 'actual')),
  incurred_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vehicle_costs_vehicle_idx on public.vehicle_costs (sale_vehicle_id);

create table if not exists public.vehicle_prep_items (
  id uuid primary key default gen_random_uuid(),
  sale_vehicle_id uuid not null references public.sale_vehicles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  category text not null default 'check' check (category in ('check', 'fault', 'repair', 'valet', 'photos', 'documents', 'other')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'not_required')),
  notes text,
  due_on date,
  assigned_to uuid references auth.users(id) on delete set null,
  position integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vehicle_prep_items_vehicle_idx on public.vehicle_prep_items (sale_vehicle_id, position);

-- ---------------------------------------------------------------------------
-- Buying: seller submissions (sell your car and part exchange).
-- ---------------------------------------------------------------------------

create or replace function public.generate_seller_reference()
returns text
language plpgsql
set search_path = public
as $$
declare
  candidate text;
begin
  perform pg_advisory_xact_lock(hashtextextended('public.seller_submissions.reference', 0));
  loop
    candidate := 'SELL-' || lpad((floor(random() * 1000000))::integer::text, 6, '0');
    exit when not exists (select 1 from public.seller_submissions where reference = candidate);
  end loop;
  return candidate;
end;
$$;

create table if not exists public.seller_submissions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  kind text not null default 'sell' check (kind in ('sell', 'part_exchange')),
  idempotency_key uuid unique,
  customer_id uuid not null references public.customers(id),
  enquiry_id uuid references public.enquiries(id) on delete set null,
  interested_vehicle_id uuid references public.sale_vehicles(id) on delete set null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'provisional_offer', 'inspection', 'final_offer', 'purchased', 'declined', 'closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  registration text check (registration is null or registration ~ '^[A-Z0-9]{2,8}$'),
  lookup_source text not null default 'manual' check (lookup_source in ('lookup', 'manual')),
  make text,
  model text,
  derivative text,
  year integer check (year is null or year between 1885 and 2100),
  mileage integer check (mileage is null or mileage between 0 and 2000000),
  fuel_type text,
  transmission text,
  colour text,
  running_status text not null default 'not_sure' check (running_status in ('runs_and_drives', 'runs_not_driveable', 'does_not_run', 'not_sure')),
  known_faults text,
  damage text,
  mot_status text not null default 'not_sure' check (mot_status in ('valid', 'expired', 'not_sure')),
  mot_expiry date,
  service_history text not null default 'not_sure' check (service_history in ('full', 'partial', 'none', 'not_sure')),
  outstanding_finance text not null default 'not_sure' check (outstanding_finance in ('yes', 'no', 'not_sure')),
  postcode text,
  preferred_contact text not null default 'phone' check (preferred_contact in ('phone', 'whatsapp', 'email')),
  marketing_consent boolean not null default false,
  provisional_offer_pence integer check (provisional_offer_pence is null or provisional_offer_pence >= 0),
  provisional_offer_expires_on date,
  final_offer_pence integer check (final_offer_pence is null or final_offer_pence >= 0),
  final_offer_expires_on date,
  offer_accepted_at timestamptz,
  purchase_price_pence integer check (purchase_price_pence is null or purchase_price_pence >= 0),
  purchased_vehicle_id uuid references public.sale_vehicles(id) on delete set null,
  decline_reason text,
  closed_at timestamptz,
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_submissions alter column reference set default public.generate_seller_reference();
create index if not exists seller_submissions_status_idx on public.seller_submissions (status, created_at desc);
create index if not exists seller_submissions_customer_idx on public.seller_submissions (customer_id);

alter table public.vehicle_internal_records drop constraint if exists vehicle_internal_records_seller_submission_fkey;
alter table public.vehicle_internal_records add constraint vehicle_internal_records_seller_submission_fkey
  foreign key (seller_submission_id) references public.seller_submissions(id) on delete set null;

create table if not exists public.seller_submission_photos (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.seller_submissions(id) on delete cascade,
  object_path text not null unique,
  file_name text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  category text not null default 'other' check (category in ('exterior', 'interior', 'dashboard', 'damage', 'other')),
  finalised boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists seller_submission_photos_submission_idx on public.seller_submission_photos (submission_id);

-- ---------------------------------------------------------------------------
-- Inspections and private documents (stock or seller submissions).
-- ---------------------------------------------------------------------------

create table if not exists public.vehicle_inspections (
  id uuid primary key default gen_random_uuid(),
  sale_vehicle_id uuid references public.sale_vehicles(id) on delete cascade,
  seller_submission_id uuid references public.seller_submissions(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'pre_sale')),
  inspected_on date not null,
  inspector_name text not null check (char_length(inspector_name) between 1 and 100),
  scope text not null check (char_length(scope) between 1 and 2000),
  findings text not null check (char_length(findings) between 1 and 6000),
  faults text[] not null default '{}',
  outcome text not null default 'recorded' check (outcome in ('recorded', 'satisfactory', 'advisories', 'not_satisfactory')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (sale_vehicle_id is not null or seller_submission_id is not null)
);
create index if not exists vehicle_inspections_vehicle_idx on public.vehicle_inspections (sale_vehicle_id, inspected_on desc);
create index if not exists vehicle_inspections_submission_idx on public.vehicle_inspections (seller_submission_id, inspected_on desc);

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  sale_vehicle_id uuid references public.sale_vehicles(id) on delete cascade,
  seller_submission_id uuid references public.seller_submissions(id) on delete cascade,
  kind text not null default 'other' check (kind in ('registration_document', 'service_record', 'mot_certificate', 'inspection_report', 'purchase_invoice', 'sale_invoice', 'history_check', 'other')),
  file_name text not null check (char_length(file_name) between 1 and 180),
  object_path text not null unique,
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 15728640),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (sale_vehicle_id is not null or seller_submission_id is not null)
);
create index if not exists vehicle_documents_vehicle_idx on public.vehicle_documents (sale_vehicle_id);
create index if not exists vehicle_documents_submission_idx on public.vehicle_documents (seller_submission_id);

-- ---------------------------------------------------------------------------
-- Sales enquiries reuse public.enquiries (and its email threads); these
-- columns link them to stock and track sales progress.
-- ---------------------------------------------------------------------------

alter table public.enquiries
  add column if not exists sale_vehicle_id uuid references public.sale_vehicles(id) on delete set null,
  add column if not exists sales_stage text,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists follow_up_at timestamptz,
  add column if not exists source text,
  add column if not exists idempotency_key uuid;

alter table public.enquiries drop constraint if exists enquiries_sales_stage_check;
alter table public.enquiries add constraint enquiries_sales_stage_check
  check (sales_stage is null or sales_stage in ('new', 'contacted', 'viewing_booked', 'negotiating', 'reserved', 'sold', 'lost'));
create unique index if not exists enquiries_idempotency_key_idx on public.enquiries (idempotency_key) where idempotency_key is not null;
create index if not exists enquiries_sale_vehicle_idx on public.enquiries (sale_vehicle_id) where sale_vehicle_id is not null;

-- Link existing vehicle-sales enquiries, which recorded the listing slug.
update public.enquiries enquiry
set sale_vehicle_id = vehicle.id,
    sales_stage = coalesce(enquiry.sales_stage, case when enquiry.status = 'closed' then 'lost' when enquiry.status = 'new' then 'new' else 'contacted' end)
from public.sale_vehicles vehicle
where enquiry.type = 'vehicle_sales'
  and enquiry.sale_vehicle_id is null
  and enquiry.service_slug = vehicle.slug;

-- ---------------------------------------------------------------------------
-- Sales and handover. One active sale per vehicle; stock status follows it.
-- ---------------------------------------------------------------------------

create table if not exists public.vehicle_sales (
  id uuid primary key default gen_random_uuid(),
  sale_vehicle_id uuid not null references public.sale_vehicles(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved', 'awaiting_payment', 'ready_for_handover', 'completed', 'cancelled')),
  agreed_price_pence integer not null check (agreed_price_pence >= 0),
  deposit_pence integer not null default 0 check (deposit_pence >= 0),
  amount_paid_pence integer not null default 0 check (amount_paid_pence >= 0),
  payment_status text not null default 'not_started' check (payment_status in ('not_started', 'deposit_received', 'part_paid', 'paid_in_full', 'refunded')),
  payment_method text,
  reserved_at timestamptz not null default now(),
  reservation_expires_at timestamptz,
  handover_method text not null default 'not_decided' check (handover_method in ('collection', 'delivery', 'not_decided')),
  handover_at timestamptz,
  handover_notes text,
  part_exchange_submission_id uuid references public.seller_submissions(id) on delete set null,
  part_exchange_allowance_pence integer check (part_exchange_allowance_pence is null or part_exchange_allowance_pence >= 0),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists vehicle_sales_one_active_idx on public.vehicle_sales (sale_vehicle_id) where status <> 'cancelled';
create index if not exists vehicle_sales_status_idx on public.vehicle_sales (status, updated_at desc);

create or replace function public.sync_stock_status_from_sale()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('reserved', 'awaiting_payment', 'ready_for_handover') then
    update public.sale_vehicles
    set status = 'reserved', reserved_at = coalesce(reserved_at, new.reserved_at), sold_at = null
    where id = new.sale_vehicle_id and status is distinct from 'reserved';
  elsif new.status = 'completed' then
    update public.sale_vehicles
    set status = 'sold', sold_at = coalesce(sold_at, new.completed_at, now())
    where id = new.sale_vehicle_id and status is distinct from 'sold';
  elsif new.status = 'cancelled' and (tg_op = 'UPDATE' and old.status is distinct from 'cancelled') then
    update public.sale_vehicles
    set status = 'available', reserved_at = null, sold_at = null
    where id = new.sale_vehicle_id and status in ('reserved', 'sold');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_stock_status_from_sale() from public, anon, authenticated;

drop trigger if exists vehicle_sales_sync_stock on public.vehicle_sales;
create trigger vehicle_sales_sync_stock
after insert or update of status on public.vehicle_sales
for each row execute function public.sync_stock_status_from_sale();

-- ---------------------------------------------------------------------------
-- Autofix Diary. Workshop bookings stay in public.bookings and are shown in
-- the diary directly; everything else is a diary appointment.
-- ---------------------------------------------------------------------------

alter table public.bookings add column if not exists assigned_to uuid references auth.users(id) on delete set null;

create table if not exists public.diary_appointments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('viewing', 'purchase_inspection', 'preparation', 'collection', 'handover', 'other')),
  status text not null default 'confirmed' check (status in ('requested', 'confirmed', 'completed', 'cancelled', 'no_show')),
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  assigned_to uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  sale_vehicle_id uuid references public.sale_vehicles(id) on delete set null,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  seller_submission_id uuid references public.seller_submissions(id) on delete set null,
  vehicle_sale_id uuid references public.vehicle_sales(id) on delete set null,
  notes text,
  customer_message text,
  alternative_start timestamptz,
  idempotency_key uuid unique,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists diary_appointments_starts_idx on public.diary_appointments (starts_at) where deleted_at is null;
create index if not exists diary_appointments_staff_idx on public.diary_appointments (assigned_to, starts_at) where deleted_at is null;
create index if not exists diary_appointments_vehicle_idx on public.diary_appointments (sale_vehicle_id) where sale_vehicle_id is not null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists vehicle_internal_records_updated on public.vehicle_internal_records;
create trigger vehicle_internal_records_updated before update on public.vehicle_internal_records for each row execute function public.set_updated_at();
drop trigger if exists vehicle_costs_updated on public.vehicle_costs;
create trigger vehicle_costs_updated before update on public.vehicle_costs for each row execute function public.set_updated_at();
drop trigger if exists vehicle_prep_items_updated on public.vehicle_prep_items;
create trigger vehicle_prep_items_updated before update on public.vehicle_prep_items for each row execute function public.set_updated_at();
drop trigger if exists seller_submissions_updated on public.seller_submissions;
create trigger seller_submissions_updated before update on public.seller_submissions for each row execute function public.set_updated_at();
drop trigger if exists vehicle_sales_updated on public.vehicle_sales;
create trigger vehicle_sales_updated before update on public.vehicle_sales for each row execute function public.set_updated_at();
drop trigger if exists diary_appointments_updated on public.diary_appointments;
create trigger diary_appointments_updated before update on public.diary_appointments for each row execute function public.set_updated_at();
drop trigger if exists exchange_settings_updated on public.exchange_settings;
create trigger exchange_settings_updated before update on public.exchange_settings for each row execute function public.set_updated_at();
drop trigger if exists exchange_private_settings_updated on public.exchange_private_settings;
create trigger exchange_private_settings_updated before update on public.exchange_private_settings for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Public submission functions. Called only by the server with the service
-- role after validation, rate limiting and bot checks. Each one saves every
-- record in one transaction and is idempotent on the client's key, so a
-- double submit or a retried request never creates a duplicate.
-- ---------------------------------------------------------------------------

create or replace function public.create_vehicle_enquiry(p_payload jsonb)
returns table (enquiry_id uuid, appointment_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key uuid := (p_payload ->> 'idempotencyKey')::uuid;
  v_intent text := p_payload ->> 'intent';
  v_vehicle public.sale_vehicles%rowtype;
  v_existing public.enquiries%rowtype;
  v_customer_id uuid;
  v_enquiry_id uuid;
  v_appointment_id uuid;
  v_start timestamptz;
  v_minutes integer := coalesce((p_payload ->> 'durationMinutes')::integer, 45);
begin
  if v_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22004'; end if;
  if v_intent not in ('viewing', 'question') then raise exception 'INVALID_INTENT' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));
  select * into v_existing from public.enquiries where idempotency_key = v_key;
  if found then
    return query
      select v_existing.id,
             (select appointment.id from public.diary_appointments appointment where appointment.enquiry_id = v_existing.id order by appointment.created_at limit 1),
             false;
    return;
  end if;

  -- Recheck availability under a row lock so a sale completing at the same
  -- moment cannot accept a viewing for a vehicle that is no longer for sale.
  select * into v_vehicle
  from public.sale_vehicles
  where id = (p_payload ->> 'vehicleId')::uuid and deleted_at is null
  for share;
  if not found then raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0002'; end if;
  if v_intent = 'viewing' and v_vehicle.status <> 'available' then
    raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0001';
  end if;
  if v_intent = 'question' and v_vehicle.status not in ('available', 'reserved') then
    raise exception 'VEHICLE_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.customers (name, email, phone, preferred_contact)
  values (
    trim(p_payload ->> 'name'),
    nullif(lower(trim(p_payload ->> 'email')), ''),
    trim(p_payload ->> 'phone'),
    p_payload ->> 'preferredContact'
  )
  returning id into v_customer_id;

  insert into public.enquiries (type, customer_id, service_slug, description, status, notification_status, sale_vehicle_id, sales_stage, source, idempotency_key)
  values ('vehicle_sales', v_customer_id, v_vehicle.slug, p_payload ->> 'description', 'new', 'pending', v_vehicle.id, 'new', 'exchange', v_key)
  returning id into v_enquiry_id;

  if v_intent = 'viewing' then
    v_start := (p_payload ->> 'preferredStart')::timestamptz;
    if v_start is null then raise exception 'PREFERRED_TIME_REQUIRED' using errcode = '22004'; end if;
    insert into public.diary_appointments (kind, status, title, starts_at, ends_at, customer_id, sale_vehicle_id, enquiry_id, customer_message, alternative_start, idempotency_key)
    values (
      'viewing',
      'requested',
      left('Viewing: ' || v_vehicle.year || ' ' || v_vehicle.make || ' ' || v_vehicle.model, 160),
      v_start,
      v_start + make_interval(mins => greatest(15, least(v_minutes, 240))),
      v_customer_id,
      v_vehicle.id,
      v_enquiry_id,
      nullif(trim(p_payload ->> 'message'), ''),
      (p_payload ->> 'alternativeStart')::timestamptz,
      v_key
    )
    returning id into v_appointment_id;
  end if;

  return query select v_enquiry_id, v_appointment_id, true;
end;
$$;

create or replace function public.create_seller_submission(p_payload jsonb)
returns table (submission_id uuid, reference text, enquiry_id uuid, created boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key uuid := (p_payload ->> 'idempotencyKey')::uuid;
  v_existing public.seller_submissions%rowtype;
  v_customer_id uuid;
  v_enquiry_id uuid;
  v_submission public.seller_submissions%rowtype;
  v_interested uuid := nullif(p_payload ->> 'interestedVehicleId', '')::uuid;
begin
  if v_key is null then raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = '22004'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key::text, 0));
  select * into v_existing from public.seller_submissions where idempotency_key = v_key;
  if found then
    return query select v_existing.id, v_existing.reference, v_existing.enquiry_id, false;
    return;
  end if;

  -- Only a vehicle that is publicly listed can be the part-exchange target.
  if v_interested is not null and not exists (
    select 1 from public.sale_vehicles
    where id = v_interested and deleted_at is null and status in ('available', 'reserved')
  ) then
    v_interested := null;
  end if;

  insert into public.customers (name, email, phone, preferred_contact)
  values (
    trim(p_payload ->> 'name'),
    nullif(lower(trim(p_payload ->> 'email')), ''),
    trim(p_payload ->> 'phone'),
    p_payload ->> 'preferredContact'
  )
  returning id into v_customer_id;

  insert into public.enquiries (type, customer_id, description, location_postcode, status, notification_status, sale_vehicle_id, source, idempotency_key)
  values ('vehicle_purchase', v_customer_id, p_payload ->> 'description', nullif(upper(trim(p_payload ->> 'postcode')), ''), 'new', 'pending', v_interested, 'exchange', v_key)
  returning id into v_enquiry_id;

  insert into public.seller_submissions (
    kind, idempotency_key, customer_id, enquiry_id, interested_vehicle_id,
    registration, lookup_source, make, model, derivative, year, mileage, fuel_type, transmission, colour,
    running_status, known_faults, damage, mot_status, mot_expiry, service_history, outstanding_finance,
    postcode, preferred_contact, marketing_consent
  )
  values (
    case when v_interested is not null or p_payload ->> 'kind' = 'part_exchange' then 'part_exchange' else 'sell' end,
    v_key,
    v_customer_id,
    v_enquiry_id,
    v_interested,
    nullif(upper(regexp_replace(coalesce(p_payload ->> 'registration', ''), '[^A-Za-z0-9]', '', 'g')), ''),
    coalesce(p_payload ->> 'lookupSource', 'manual'),
    nullif(trim(p_payload ->> 'make'), ''),
    nullif(trim(p_payload ->> 'model'), ''),
    nullif(trim(p_payload ->> 'derivative'), ''),
    (p_payload ->> 'year')::integer,
    (p_payload ->> 'mileage')::integer,
    nullif(trim(p_payload ->> 'fuelType'), ''),
    nullif(trim(p_payload ->> 'transmission'), ''),
    nullif(trim(p_payload ->> 'colour'), ''),
    coalesce(p_payload ->> 'runningStatus', 'not_sure'),
    nullif(trim(p_payload ->> 'knownFaults'), ''),
    nullif(trim(p_payload ->> 'damage'), ''),
    coalesce(p_payload ->> 'motStatus', 'not_sure'),
    nullif(p_payload ->> 'motExpiry', '')::date,
    coalesce(p_payload ->> 'serviceHistory', 'not_sure'),
    coalesce(p_payload ->> 'outstandingFinance', 'not_sure'),
    nullif(upper(trim(p_payload ->> 'postcode')), ''),
    p_payload ->> 'preferredContact',
    coalesce((p_payload ->> 'marketingConsent')::boolean, false)
  )
  returning * into v_submission;

  return query select v_submission.id, v_submission.reference, v_enquiry_id, true;
end;
$$;

revoke all on function public.create_vehicle_enquiry(jsonb) from public, anon, authenticated;
revoke all on function public.create_seller_submission(jsonb) from public, anon, authenticated;
revoke all on function public.generate_seller_reference() from public, anon, authenticated;
grant execute on function public.create_vehicle_enquiry(jsonb) to service_role;
grant execute on function public.create_seller_submission(jsonb) to service_role;
grant execute on function public.generate_seller_reference() to service_role;

-- ---------------------------------------------------------------------------
-- Retention (docs/exchange/OPERATIONS.md). Supabase Storage rejects direct
-- deletes from storage.objects, so retention runs in three steps from the
-- signed cron route: list the expired files, delete them through the Storage
-- API, then finalise the database rows.
--
-- Seller submissions: closed or declined submissions lose their photos,
-- submission-only documents, registration and free-text condition notes after
-- the configured period. Purchased submissions are business records and are
-- kept; their customer details follow the enquiry retention below.
-- ---------------------------------------------------------------------------

create or replace function public.exchange_retention_candidates(p_months integer default 12)
returns table (submission_id uuid, photo_paths text[], document_paths text[])
language sql
stable
security definer
set search_path = public
as $$
  select
    submission.id,
    coalesce((select array_agg(photo.object_path) from public.seller_submission_photos photo where photo.submission_id = submission.id), '{}'),
    coalesce((select array_agg(document.object_path) from public.vehicle_documents document where document.seller_submission_id = submission.id and document.sale_vehicle_id is null), '{}')
  from public.seller_submissions submission
  where submission.status in ('declined', 'closed')
    and submission.anonymised_at is null
    and coalesce(submission.closed_at, submission.updated_at)
      < now() - make_interval(months => greatest(1, least(coalesce(p_months, 12), 120)));
$$;

create or replace function public.finalise_exchange_retention(p_submission_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_enquiry_id uuid;
begin
  delete from public.seller_submission_photos where submission_id = p_submission_id;
  delete from public.vehicle_documents where seller_submission_id = p_submission_id and sale_vehicle_id is null;
  update public.seller_submissions
  set registration = null, known_faults = null, damage = null, postcode = null, anonymised_at = now()
  where id = p_submission_id and anonymised_at is null and status in ('declined', 'closed')
  returning enquiry_id into v_enquiry_id;
  if not found then return false; end if;
  update public.enquiries
  set status = 'closed', closed_at = coalesce(closed_at, now())
  where id = v_enquiry_id and status <> 'closed';
  return true;
end;
$$;

-- Enquiry attachments: same three-step pattern. The original
-- apply_enquiry_retention() deleted from storage.objects directly, which
-- current Supabase Storage refuses, so the whole job failed. This version
-- expects the cron route to have removed the files first.
create or replace function public.enquiry_retention_attachment_paths()
returns table (object_path text)
language sql
stable
security definer
set search_path = public
as $$
  select attachment.object_path
  from public.enquiry_attachments attachment
  join public.enquiries enquiry on enquiry.id = attachment.enquiry_id
  where enquiry.status = 'closed' and enquiry.closed_at < now() - interval '12 months';
$$;

create or replace function public.apply_enquiry_retention()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  delete from public.enquiry_attachments
  where enquiry_id in (
    select id from public.enquiries
    where status = 'closed' and closed_at < now() - interval '12 months'
  );

  -- Only customers who came in through an enquiry are covered by the
  -- documented 12-month policy. Customers with workshop bookings, vehicle
  -- sales, purchased cars or recent diary appointments are business records
  -- outside this job and are never anonymised here.
  update public.customers c
  set name = 'Anonymised', email = null, phone = 'REDACTED', anonymised_at = now()
  where anonymised_at is null
    and exists (select 1 from public.enquiries e where e.customer_id = c.id)
    and not exists (
      select 1 from public.enquiries e
      where e.customer_id = c.id
        and (e.status <> 'closed' or e.closed_at >= now() - interval '12 months')
    )
    and not exists (select 1 from public.bookings b where b.customer_id = c.id)
    and not exists (select 1 from public.vehicle_sales s where s.customer_id = c.id and s.status <> 'cancelled')
    and not exists (select 1 from public.seller_submissions s where s.customer_id = c.id and s.status = 'purchased')
    and not exists (
      select 1 from public.diary_appointments d
      where d.customer_id = c.id and d.deleted_at is null and d.starts_at >= now() - interval '12 months'
    );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.exchange_retention_candidates(integer) from public, anon, authenticated;
revoke all on function public.finalise_exchange_retention(uuid) from public, anon, authenticated;
revoke all on function public.enquiry_retention_attachment_paths() from public, anon, authenticated;
revoke all on function public.apply_enquiry_retention() from public, anon, authenticated;
grant execute on function public.exchange_retention_candidates(integer) to service_role;
grant execute on function public.finalise_exchange_retention(uuid) to service_role;
grant execute on function public.enquiry_retention_attachment_paths() to service_role;
grant execute on function public.apply_enquiry_retention() to service_role;

-- ---------------------------------------------------------------------------
-- Row-level security. Staff data is admin-only; finance is owner/manager;
-- settings changes are owner-only. Visitors read nothing new except the
-- public settings row.
-- ---------------------------------------------------------------------------

alter table public.exchange_settings enable row level security;
alter table public.exchange_private_settings enable row level security;
alter table public.vehicle_internal_records enable row level security;
alter table public.vehicle_costs enable row level security;
alter table public.vehicle_prep_items enable row level security;
alter table public.seller_submissions enable row level security;
alter table public.seller_submission_photos enable row level security;
alter table public.vehicle_inspections enable row level security;
alter table public.vehicle_documents enable row level security;
alter table public.vehicle_sales enable row level security;
alter table public.diary_appointments enable row level security;

revoke all on table
  public.exchange_private_settings,
  public.vehicle_internal_records,
  public.vehicle_costs,
  public.vehicle_prep_items,
  public.seller_submissions,
  public.seller_submission_photos,
  public.vehicle_inspections,
  public.vehicle_documents,
  public.vehicle_sales,
  public.diary_appointments
from anon;
revoke insert, update, delete on table public.exchange_settings from anon;

drop policy if exists "public exchange settings are readable" on public.exchange_settings;
create policy "public exchange settings are readable" on public.exchange_settings for select to anon, authenticated using (true);
drop policy if exists "owners manage exchange settings" on public.exchange_settings;
create policy "owners manage exchange settings" on public.exchange_settings for all to authenticated
  using (public.staff_can_manage_exchange_settings()) with check (public.staff_can_manage_exchange_settings());

drop policy if exists "managers read private exchange settings" on public.exchange_private_settings;
create policy "managers read private exchange settings" on public.exchange_private_settings for select to authenticated
  using (public.staff_can_view_finance());
drop policy if exists "owners manage private exchange settings" on public.exchange_private_settings;
create policy "owners manage private exchange settings" on public.exchange_private_settings for all to authenticated
  using (public.staff_can_manage_exchange_settings()) with check (public.staff_can_manage_exchange_settings());

drop policy if exists "finance staff manage internal vehicle records" on public.vehicle_internal_records;
create policy "finance staff manage internal vehicle records" on public.vehicle_internal_records for all to authenticated
  using (public.staff_can_view_finance()) with check (public.staff_can_view_finance());
drop policy if exists "finance staff manage vehicle costs" on public.vehicle_costs;
create policy "finance staff manage vehicle costs" on public.vehicle_costs for all to authenticated
  using (public.staff_can_view_finance()) with check (public.staff_can_view_finance());

drop policy if exists "admins manage prep items" on public.vehicle_prep_items;
create policy "admins manage prep items" on public.vehicle_prep_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage seller submissions" on public.seller_submissions;
create policy "admins manage seller submissions" on public.seller_submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage seller photos" on public.seller_submission_photos;
create policy "admins manage seller photos" on public.seller_submission_photos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage inspections" on public.vehicle_inspections;
create policy "admins manage inspections" on public.vehicle_inspections for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage vehicle documents" on public.vehicle_documents;
create policy "admins manage vehicle documents" on public.vehicle_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage vehicle sales" on public.vehicle_sales;
create policy "admins manage vehicle sales" on public.vehicle_sales for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage diary appointments" on public.diary_appointments;
create policy "admins manage diary appointments" on public.diary_appointments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Private storage. Visitors upload seller photos only through short-lived
-- signed upload URLs issued by the server; nobody but staff can read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('seller-submission-photos', 'seller-submission-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('vehicle-documents', 'vehicle-documents', false, 15728640, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "admins read exchange private files" on storage.objects;
create policy "admins read exchange private files" on storage.objects for select to authenticated
  using (bucket_id in ('seller-submission-photos', 'vehicle-documents') and public.is_admin());
drop policy if exists "admins write vehicle documents" on storage.objects;
create policy "admins write vehicle documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'vehicle-documents' and public.is_admin());
drop policy if exists "admins delete exchange private files" on storage.objects;
create policy "admins delete exchange private files" on storage.objects for delete to authenticated
  using (bucket_id in ('seller-submission-photos', 'vehicle-documents') and public.is_admin());

commit;
