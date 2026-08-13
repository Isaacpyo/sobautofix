begin;

-- Phase 1 invoicing. This migration was verified as unapplied before it was
-- hardened, so the complete feature is installed atomically in one migration.

do $$
declare
  existing_kind "char";
  existing_labels text[];
begin
  select
    invoice_type.typtype,
    array_agg(enum_value.enumlabel::text order by enum_value.enumsortorder)
  into existing_kind, existing_labels
  from pg_catalog.pg_type invoice_type
  join pg_catalog.pg_namespace type_namespace on type_namespace.oid = invoice_type.typnamespace
  left join pg_catalog.pg_enum enum_value on enum_value.enumtypid = invoice_type.oid
  where type_namespace.nspname = 'public'
    and invoice_type.typname = 'invoice_status'
  group by invoice_type.typtype;

  if not found then
    create type public.invoice_status as enum ('draft', 'issued', 'paid', 'void');
  elsif existing_kind <> 'e' then
    raise exception 'INCOMPATIBLE_INVOICE_STATUS_TYPE: public.invoice_status exists but is not an enum';
  elsif existing_labels is distinct from array['draft', 'issued', 'paid', 'void']::text[] then
    raise exception 'INCOMPATIBLE_INVOICE_STATUS_ENUM: expected {draft,issued,paid,void}, found %', existing_labels;
  end if;
end
$$;

create table public.invoice_number_sequences (
  invoice_year integer primary key check (invoice_year between 2020 and 9999),
  last_value bigint not null check (last_value between 1 and 999999)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique,
  invoice_year integer check (invoice_year is null or invoice_year between 2020 and 9999),
  invoice_sequence bigint check (invoice_sequence is null or invoice_sequence between 1 and 999999),
  revision bigint not null default 1 check (revision > 0),
  replaces_invoice_id uuid references public.invoices(id),
  status public.invoice_status not null default 'draft',
  source_type text not null default 'manual' check (source_type in ('booking', 'enquiry', 'manual')),
  booking_id uuid references public.bookings(id),
  enquiry_id uuid references public.enquiries(id),
  customer_id uuid references public.customers(id),
  vehicle_id uuid references public.vehicles(id),
  currency text not null default 'GBP' check (currency = 'GBP'),
  customer_name text not null,
  customer_email text,
  customer_phone text,
  customer_address text,
  vehicle_registration text,
  vehicle_make text,
  vehicle_model text,
  service_name text,
  appointment_start timestamptz,
  issuer_legal_name text not null default 'SOB Autofix Limited',
  issuer_trading_name text not null default 'SOB Autofix',
  issuer_tagline text not null default 'Professional Diagnostics. Not Guesswork.',
  issuer_address text not null default E'Cumbrae\nStation Road\nNorton\nDoncaster\nDN6 9HF\nUnited Kingdom',
  issuer_email text not null default 'sobautofix@gmail.com',
  issuer_phone text not null default '07469273483',
  issuer_company_number text not null default '16182532',
  issue_date date,
  due_date date,
  subtotal_pence bigint not null default 0 check (subtotal_pence between 0 and 9007199254740991),
  discount_pence bigint not null default 0 check (discount_pence between 0 and 9007199254740991),
  tax_pence bigint not null default 0 check (tax_pence = 0),
  total_pence bigint not null default 0 check (total_pence between 0 and 9007199254740991),
  notes text,
  payment_terms text,
  issued_at timestamptz,
  paid_at timestamptz,
  payment_method text check (payment_method is null or payment_method in ('cash', 'card', 'bank_transfer', 'other')),
  payment_reference text,
  voided_at timestamptz,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_year, invoice_sequence),
  constraint invoices_replacement_not_self check (replaces_invoice_id is null or replaces_invoice_id <> id),
  constraint invoices_numbering_coherence check (
    (
      status = 'draft'
      and invoice_number is null
      and invoice_year is null
      and invoice_sequence is null
    )
    or
    (
      status <> 'draft'
      and invoice_number is not null
      and invoice_year is not null
      and invoice_sequence is not null
      and issue_date is not null
      and invoice_year = extract(year from issue_date)::integer
      and invoice_number = 'SOB-' || invoice_year::text || '-' || lpad(invoice_sequence::text, 6, '0')
    )
  ),
  constraint invoices_source_coherence check (
    (
      source_type = 'manual'
      and booking_id is null
      and enquiry_id is null
      and (vehicle_id is null or customer_id is not null)
    )
    or
    (
      source_type = 'booking'
      and booking_id is not null
      and enquiry_id is null
      and customer_id is not null
      and vehicle_id is not null
    )
    or
    (
      source_type = 'enquiry'
      and booking_id is null
      and enquiry_id is not null
      and customer_id is not null
    )
  ),
  constraint invoices_lifecycle_metadata check (
    (
      status = 'draft'
      and issued_at is null
      and paid_at is null
      and payment_method is null
      and payment_reference is null
      and voided_at is null
    )
    or
    (
      status = 'issued'
      and issued_at is not null
      and paid_at is null
      and payment_method is null
      and payment_reference is null
      and voided_at is null
    )
    or
    (
      status = 'paid'
      and issued_at is not null
      and paid_at is not null
      and payment_method is not null
      and voided_at is null
    )
    or
    (
      status = 'void'
      and issued_at is not null
      and paid_at is null
      and payment_method is null
      and payment_reference is null
      and voided_at is not null
    )
  ),
  constraint invoices_dates_coherent check (due_date is null or issue_date is null or due_date >= issue_date),
  constraint invoices_discount_valid check (discount_pence <= subtotal_pence),
  constraint invoices_total_coherent check (total_pence = subtotal_pence - discount_pence + tax_pence)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 500),
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price_pence bigint not null check (unit_price_pence between 0 and 9007199254740991),
  line_total_pence bigint not null check (line_total_pence between 0 and 9007199254740991),
  position integer not null default 0 check (position between 0 and 99),
  created_at timestamptz not null default now(),
  unique (invoice_id, position)
);

-- A logical send represents one deliberate customer-facing send operation.
-- Physical attempts retain every retry while reusing the logical provider key.
create table public.invoice_email_sends (
  id uuid primary key,
  invoice_id uuid not null references public.invoices(id),
  recipient text not null,
  invoice_revision bigint not null check (invoice_revision > 0),
  document_status public.invoice_status not null check (document_status in ('issued', 'paid')),
  document_number text not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  provider_idempotency_key text not null unique,
  status text not null check (status in ('pending', 'sent', 'failed', 'ambiguous')),
  provider_id text,
  last_error_code text,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint invoice_email_sends_sent_state check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create table public.invoice_email_attempts (
  id bigint generated always as identity primary key,
  logical_send_id uuid not null references public.invoice_email_sends(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id),
  attempt_number integer not null check (attempt_number > 0),
  status text not null check (status in ('pending', 'sent', 'failed', 'ambiguous')),
  claim_token uuid not null unique,
  lease_expires_at timestamptz not null,
  provider_id text,
  error_code text,
  attempted_by uuid not null references auth.users(id),
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (logical_send_id, attempt_number)
);

create index invoices_created_at_idx on public.invoices (created_at desc);
create index invoices_status_due_idx on public.invoices (status, due_date);
create index invoices_booking_idx on public.invoices (booking_id) where booking_id is not null;
create index invoices_enquiry_idx on public.invoices (enquiry_id) where enquiry_id is not null;
create index invoices_replaces_idx on public.invoices (replaces_invoice_id) where replaces_invoice_id is not null;
create index invoices_registration_search_idx on public.invoices ((upper(regexp_replace(coalesce(vehicle_registration, ''), '[^A-Za-z0-9]', '', 'g'))));
create index invoice_items_invoice_position_idx on public.invoice_items (invoice_id, position);
create index invoice_email_sends_invoice_idx on public.invoice_email_sends (invoice_id, requested_at desc);
create index invoice_email_attempts_invoice_idx on public.invoice_email_attempts (invoice_id, attempted_at desc);
create index invoice_email_attempts_logical_idx on public.invoice_email_attempts (logical_send_id, attempt_number desc);

create function public.require_invoice_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if auth.role() is distinct from 'authenticated'
     or actor_id is null
     or not public.is_admin() then
    raise exception 'UNAUTHORISED' using errcode = '42501';
  end if;
  return actor_id;
end
$$;

create function public.invoice_line_total(p_quantity numeric, p_unit_price_pence bigint)
returns bigint
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  calculated numeric;
begin
  calculated := round(p_quantity * p_unit_price_pence);
  if calculated < 0 or calculated > 9007199254740991 then
    raise exception 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER' using errcode = '22003';
  end if;
  return calculated::bigint;
end
$$;

create function public.prepare_invoice_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_id uuid;
  parent_status public.invoice_status;
begin
  if tg_op = 'UPDATE' and new.invoice_id is distinct from old.invoice_id then
    raise exception 'INVOICE_ITEM_PARENT_IS_IMMUTABLE';
  end if;

  if tg_op = 'INSERT' then
    parent_id := new.invoice_id;
  else
    parent_id := old.invoice_id;
  end if;

  select invoice.status
  into parent_status
  from public.invoices invoice
  where invoice.id = parent_id
  for update;

  if not found then
    if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
      return old;
    end if;
    raise exception 'INVOICE_NOT_FOUND';
  end if;

  if parent_status <> 'draft'::public.invoice_status then
    raise exception 'INVOICE_ITEMS_ARE_IMMUTABLE';
  end if;

  if tg_op <> 'DELETE' then
    new.description := trim(new.description);
    if new.quantity <= 0 or new.quantity <> round(new.quantity, 3) then
      raise exception 'INVALID_ITEM_QUANTITY';
    end if;
    new.line_total_pence := public.invoice_line_total(new.quantity, new.unit_price_pence);
    return new;
  end if;

  return old;
end
$$;

create function public.refresh_invoice_totals()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_id uuid;
  calculated_subtotal numeric;
  current_discount bigint;
begin
  if tg_op = 'INSERT' then
    target_id := new.invoice_id;
  else
    target_id := old.invoice_id;
  end if;

  select coalesce(sum(item.line_total_pence), 0), invoice.discount_pence
  into calculated_subtotal, current_discount
  from public.invoices invoice
  left join public.invoice_items item on item.invoice_id = invoice.id
  where invoice.id = target_id
    and invoice.status = 'draft'
  group by invoice.discount_pence;

  if not found then
    return null;
  end if;
  if calculated_subtotal > 9007199254740991 then
    raise exception 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER' using errcode = '22003';
  end if;
  if current_discount > calculated_subtotal then
    raise exception 'INVALID_INVOICE_TOTAL';
  end if;

  update public.invoices
  set subtotal_pence = calculated_subtotal::bigint,
      total_pence = calculated_subtotal::bigint - current_discount
  where id = target_id
    and status = 'draft';
  return null;
end
$$;

create function public.protect_invoice_history()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  calculated_subtotal numeric;
  calculated_item_count integer;
  stored_lines_valid boolean;
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft'::public.invoice_status then
      raise exception 'ONLY_DRAFT_INVOICES_CAN_BE_DELETED';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft'::public.invoice_status
       or new.invoice_number is not null
       or new.invoice_year is not null
       or new.invoice_sequence is not null
       or new.issued_at is not null
       or new.paid_at is not null
       or new.payment_method is not null
       or new.payment_reference is not null
       or new.voided_at is not null
       or new.revision <> 1
       or new.subtotal_pence <> 0
       or new.discount_pence <> 0
       or new.tax_pence <> 0
       or new.total_pence <> 0 then
      raise exception 'VALID_DRAFT_INSERT_REQUIRED';
    end if;
    new.customer_name := trim(new.customer_name);
    new.customer_email := nullif(lower(trim(new.customer_email)), '');
    new.customer_phone := nullif(trim(new.customer_phone), '');
    new.customer_address := nullif(trim(new.customer_address), '');
    new.vehicle_registration := nullif(upper(regexp_replace(coalesce(new.vehicle_registration, ''), '[^A-Za-z0-9]', '', 'g')), '');
    new.vehicle_make := nullif(trim(new.vehicle_make), '');
    new.vehicle_model := nullif(trim(new.vehicle_model), '');
    new.service_name := nullif(trim(new.service_name), '');
    new.notes := nullif(trim(new.notes), '');
    new.payment_terms := nullif(trim(new.payment_terms), '');
    return new;
  end if;

  if new.id is distinct from old.id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at
     or new.replaces_invoice_id is distinct from old.replaces_invoice_id
     or new.issuer_legal_name is distinct from old.issuer_legal_name
     or new.issuer_trading_name is distinct from old.issuer_trading_name
     or new.issuer_tagline is distinct from old.issuer_tagline
     or new.issuer_address is distinct from old.issuer_address
     or new.issuer_email is distinct from old.issuer_email
     or new.issuer_phone is distinct from old.issuer_phone
     or new.issuer_company_number is distinct from old.issuer_company_number then
    raise exception 'INVOICE_IDENTITY_IS_IMMUTABLE';
  end if;
  if new.revision is distinct from old.revision then
    raise exception 'INVOICE_REVISION_IS_DATABASE_MANAGED';
  end if;

  if old.status <> new.status
     and not (
       (old.status = 'draft'::public.invoice_status and new.status = 'issued'::public.invoice_status)
       or (old.status = 'issued'::public.invoice_status and new.status in ('paid'::public.invoice_status, 'void'::public.invoice_status))
     ) then
    raise exception 'INVALID_INVOICE_STATUS_TRANSITION';
  end if;

  if old.status <> 'draft'::public.invoice_status then
    if old.status = new.status then
      raise exception 'ISSUED_INVOICE_IS_IMMUTABLE';
    end if;

    if (
      to_jsonb(old) - array['status', 'revision', 'updated_by', 'updated_at', 'paid_at', 'payment_method', 'payment_reference', 'voided_at']
    ) is distinct from (
      to_jsonb(new) - array['status', 'revision', 'updated_by', 'updated_at', 'paid_at', 'payment_method', 'payment_reference', 'voided_at']
    ) then
      raise exception 'ISSUED_INVOICE_IS_IMMUTABLE';
    end if;

    if new.status = 'paid'::public.invoice_status then
      if new.paid_at is null
         or new.payment_method is null
         or new.payment_method not in ('cash', 'card', 'bank_transfer', 'other')
         or new.voided_at is distinct from old.voided_at then
        raise exception 'INVALID_PAID_TRANSITION';
      end if;
    elsif new.status = 'void'::public.invoice_status then
      if new.voided_at is null
         or new.paid_at is distinct from old.paid_at
         or new.payment_method is distinct from old.payment_method
         or new.payment_reference is distinct from old.payment_reference then
        raise exception 'INVALID_VOID_TRANSITION';
      end if;
    end if;
  elsif new.status = 'issued'::public.invoice_status then
    if (
      to_jsonb(old) - array['status', 'revision', 'updated_by', 'updated_at', 'invoice_number', 'invoice_year', 'invoice_sequence', 'issue_date', 'due_date', 'subtotal_pence', 'tax_pence', 'total_pence', 'issued_at']
    ) is distinct from (
      to_jsonb(new) - array['status', 'revision', 'updated_by', 'updated_at', 'invoice_number', 'invoice_year', 'invoice_sequence', 'issue_date', 'due_date', 'subtotal_pence', 'tax_pence', 'total_pence', 'issued_at']
    ) then
      raise exception 'ISSUE_MAY_NOT_REWRITE_INVOICE_HISTORY';
    end if;

    select
      count(*)::integer,
      coalesce(sum(public.invoice_line_total(item.quantity, item.unit_price_pence)), 0),
      coalesce(bool_and(item.line_total_pence = public.invoice_line_total(item.quantity, item.unit_price_pence)), false)
    into calculated_item_count, calculated_subtotal, stored_lines_valid
    from public.invoice_items item
    where item.invoice_id = old.id;

    if calculated_item_count = 0
       or not stored_lines_valid
       or calculated_subtotal > 9007199254740991
       or new.subtotal_pence is distinct from calculated_subtotal::bigint
       or new.discount_pence < 0
       or new.discount_pence > calculated_subtotal
       or new.tax_pence <> 0
       or new.total_pence is distinct from calculated_subtotal::bigint - new.discount_pence then
      raise exception 'INVALID_INVOICE_TOTAL';
    end if;
  else
    new.customer_name := trim(new.customer_name);
    new.customer_email := nullif(lower(trim(new.customer_email)), '');
    new.customer_phone := nullif(trim(new.customer_phone), '');
    new.customer_address := nullif(trim(new.customer_address), '');
    new.vehicle_registration := nullif(upper(regexp_replace(coalesce(new.vehicle_registration, ''), '[^A-Za-z0-9]', '', 'g')), '');
    new.vehicle_make := nullif(trim(new.vehicle_make), '');
    new.vehicle_model := nullif(trim(new.vehicle_model), '');
    new.service_name := nullif(trim(new.service_name), '');
    new.notes := nullif(trim(new.notes), '');
    new.payment_terms := nullif(trim(new.payment_terms), '');
    if new.tax_pence <> 0 then
      raise exception 'VAT_NOT_CONFIGURED';
    end if;
    if new.discount_pence > new.subtotal_pence then
      raise exception 'INVALID_INVOICE_TOTAL';
    end if;
    new.total_pence := new.subtotal_pence - new.discount_pence;
  end if;

  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end
$$;

create trigger invoice_items_prepare
before insert or update or delete on public.invoice_items
for each row execute function public.prepare_invoice_item();

create trigger invoice_items_refresh_totals
after insert or update or delete on public.invoice_items
for each row execute function public.refresh_invoice_totals();

create trigger invoices_protect_history
before insert or update or delete on public.invoices
for each row execute function public.protect_invoice_history();

create function public.save_invoice_draft(
  p_invoice_id uuid,
  p_payload jsonb,
  p_confirm_duplicate_source boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  target_id uuid;
  existing_invoice public.invoices%rowtype;
  source_kind text := p_payload->>'source_type';
  selected_booking_id uuid;
  selected_enquiry_id uuid;
  selected_customer_id uuid;
  selected_vehicle_id uuid;
  snapshot_customer_name text;
  snapshot_customer_email text;
  snapshot_customer_phone text;
  snapshot_customer_address text := nullif(trim(p_payload->>'customer_address'), '');
  snapshot_registration text;
  snapshot_make text;
  snapshot_model text;
  snapshot_service text;
  snapshot_appointment timestamptz;
  requested_discount_numeric numeric;
  requested_discount bigint;
  requested_tax_numeric numeric;
  requested_issue_date date := nullif(p_payload->>'issue_date', '')::date;
  requested_due_date date := nullif(p_payload->>'due_date', '')::date;
  item jsonb;
  item_count integer := 0;
  item_quantity numeric;
  item_unit_numeric numeric;
  item_unit_price bigint;
  calculated_subtotal numeric;
  source_changed boolean := false;
  duplicate_exists boolean;
  payload_customer_id uuid := nullif(trim(coalesce(p_payload->>'customer_id', '')), '')::uuid;
  payload_vehicle_id uuid := nullif(trim(coalesce(p_payload->>'vehicle_id', '')), '')::uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_INVOICE_PAYLOAD';
  end if;
  if source_kind not in ('booking', 'enquiry', 'manual') then
    raise exception 'INVALID_SOURCE';
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array'
     or jsonb_array_length(p_payload->'items') = 0
     or jsonb_array_length(p_payload->'items') > 100 then
    raise exception 'INVOICE_ITEM_COUNT_INVALID';
  end if;

  requested_discount_numeric := coalesce(nullif(p_payload->>'discount_pence', ''), '0')::numeric;
  requested_tax_numeric := coalesce(nullif(p_payload->>'tax_pence', ''), '0')::numeric;
  if requested_discount_numeric <> trunc(requested_discount_numeric)
     or requested_discount_numeric < 0
     or requested_discount_numeric > 9007199254740991 then
    raise exception 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER' using errcode = '22003';
  end if;
  if requested_tax_numeric <> 0 then
    raise exception 'VAT_NOT_CONFIGURED';
  end if;
  requested_discount := requested_discount_numeric::bigint;

  if p_invoice_id is not null then
    select invoice.*
    into existing_invoice
    from public.invoices invoice
    where invoice.id = p_invoice_id
      and invoice.status = 'draft'
    for update;
    if not found then
      raise exception 'DRAFT_INVOICE_NOT_FOUND';
    end if;
    target_id := existing_invoice.id;
  end if;

  if source_kind = 'booking' then
    selected_booking_id := nullif(trim(coalesce(p_payload->>'booking_id', '')), '')::uuid;
    if selected_booking_id is null
       or nullif(trim(coalesce(p_payload->>'enquiry_id', '')), '') is not null then
      raise exception 'SOURCE_RELATIONSHIP_MISMATCH';
    end if;

    select
      booking.customer_id,
      booking.vehicle_id,
      customer.name,
      customer.email,
      customer.phone,
      vehicle.registration,
      vehicle.make,
      vehicle.model,
      booking.service_name,
      booking.appointment_start
    into
      selected_customer_id,
      selected_vehicle_id,
      snapshot_customer_name,
      snapshot_customer_email,
      snapshot_customer_phone,
      snapshot_registration,
      snapshot_make,
      snapshot_model,
      snapshot_service,
      snapshot_appointment
    from public.bookings booking
    join public.customers customer on customer.id = booking.customer_id
    join public.vehicles vehicle
      on vehicle.id = booking.vehicle_id
     and vehicle.customer_id = booking.customer_id
    where booking.id = selected_booking_id;

    if not found
       or (payload_customer_id is not null and payload_customer_id <> selected_customer_id)
       or (payload_vehicle_id is not null and payload_vehicle_id <> selected_vehicle_id) then
      raise exception 'SOURCE_RELATIONSHIP_MISMATCH';
    end if;
  elsif source_kind = 'enquiry' then
    selected_enquiry_id := nullif(trim(coalesce(p_payload->>'enquiry_id', '')), '')::uuid;
    if selected_enquiry_id is null
       or nullif(trim(coalesce(p_payload->>'booking_id', '')), '') is not null then
      raise exception 'SOURCE_RELATIONSHIP_MISMATCH';
    end if;

    select
      enquiry.customer_id,
      enquiry.vehicle_id,
      customer.name,
      customer.email,
      customer.phone,
      vehicle.registration,
      vehicle.make,
      vehicle.model,
      replace(coalesce(nullif(trim(enquiry.service_slug), ''), enquiry.type::text), '-', ' '),
      null::timestamptz
    into
      selected_customer_id,
      selected_vehicle_id,
      snapshot_customer_name,
      snapshot_customer_email,
      snapshot_customer_phone,
      snapshot_registration,
      snapshot_make,
      snapshot_model,
      snapshot_service,
      snapshot_appointment
    from public.enquiries enquiry
    join public.customers customer on customer.id = enquiry.customer_id
    left join public.vehicles vehicle
      on vehicle.id = enquiry.vehicle_id
     and vehicle.customer_id = enquiry.customer_id
    where enquiry.id = selected_enquiry_id
      and (enquiry.vehicle_id is null or vehicle.id is not null);

    if not found
       or (payload_customer_id is not null and payload_customer_id <> selected_customer_id)
       or (payload_vehicle_id is not null and payload_vehicle_id is distinct from selected_vehicle_id) then
      raise exception 'SOURCE_RELATIONSHIP_MISMATCH';
    end if;
  else
    if nullif(trim(coalesce(p_payload->>'booking_id', '')), '') is not null
       or nullif(trim(coalesce(p_payload->>'enquiry_id', '')), '') is not null then
      raise exception 'SOURCE_RELATIONSHIP_MISMATCH';
    end if;

    selected_customer_id := payload_customer_id;
    selected_vehicle_id := payload_vehicle_id;
    snapshot_customer_name := trim(p_payload->>'customer_name');
    snapshot_customer_email := nullif(lower(trim(p_payload->>'customer_email')), '');
    snapshot_customer_phone := nullif(trim(p_payload->>'customer_phone'), '');
    snapshot_registration := nullif(p_payload->>'vehicle_registration', '');
    snapshot_make := nullif(trim(p_payload->>'vehicle_make'), '');
    snapshot_model := nullif(trim(p_payload->>'vehicle_model'), '');
    snapshot_service := nullif(trim(p_payload->>'service_name'), '');
    snapshot_appointment := nullif(p_payload->>'appointment_start', '')::timestamptz;

    if selected_vehicle_id is not null then
      select vehicle.customer_id, vehicle.registration, vehicle.make, vehicle.model
      into selected_customer_id, snapshot_registration, snapshot_make, snapshot_model
      from public.vehicles vehicle
      where vehicle.id = selected_vehicle_id
        and vehicle.customer_id is not null
        and (payload_customer_id is null or vehicle.customer_id = payload_customer_id);
      if not found then
        raise exception 'SOURCE_RELATIONSHIP_MISMATCH';
      end if;
    end if;

    if selected_customer_id is not null then
      select customer.name, customer.email, customer.phone
      into snapshot_customer_name, snapshot_customer_email, snapshot_customer_phone
      from public.customers customer
      where customer.id = selected_customer_id;
      if not found then
        raise exception 'SOURCE_RELATIONSHIP_MISMATCH';
      end if;
    end if;
  end if;

  if length(trim(coalesce(snapshot_customer_name, ''))) < 2 then
    raise exception 'CUSTOMER_NAME_REQUIRED';
  end if;

  if p_invoice_id is null then
    source_changed := true;
  else
    source_changed := existing_invoice.source_type is distinct from source_kind
      or existing_invoice.booking_id is distinct from selected_booking_id
      or existing_invoice.enquiry_id is distinct from selected_enquiry_id;
  end if;

  if source_changed and source_kind in ('booking', 'enquiry') then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'public.invoices.source:' || source_kind || ':' || coalesce(selected_booking_id, selected_enquiry_id)::text,
        0
      )
    );
    select exists (
      select 1
      from public.invoices invoice
      where invoice.id is distinct from p_invoice_id
        and (
          (source_kind = 'booking' and invoice.booking_id = selected_booking_id)
          or (source_kind = 'enquiry' and invoice.enquiry_id = selected_enquiry_id)
        )
    ) into duplicate_exists;
    if duplicate_exists and coalesce(p_confirm_duplicate_source, false) is not true then
      raise exception 'DUPLICATE_SOURCE_CONFIRMATION_REQUIRED';
    end if;
  end if;

  if p_invoice_id is null then
    insert into public.invoices (
      source_type,
      booking_id,
      enquiry_id,
      customer_id,
      vehicle_id,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      vehicle_registration,
      vehicle_make,
      vehicle_model,
      service_name,
      appointment_start,
      issue_date,
      due_date,
      notes,
      payment_terms,
      created_by,
      updated_by
    ) values (
      source_kind,
      selected_booking_id,
      selected_enquiry_id,
      selected_customer_id,
      selected_vehicle_id,
      snapshot_customer_name,
      snapshot_customer_email,
      snapshot_customer_phone,
      snapshot_customer_address,
      snapshot_registration,
      snapshot_make,
      snapshot_model,
      snapshot_service,
      snapshot_appointment,
      requested_issue_date,
      requested_due_date,
      nullif(trim(p_payload->>'notes'), ''),
      nullif(trim(p_payload->>'payment_terms'), ''),
      actor_id,
      actor_id
    ) returning id into target_id;
  else
    update public.invoices
    set source_type = source_kind,
        booking_id = selected_booking_id,
        enquiry_id = selected_enquiry_id,
        customer_id = selected_customer_id,
        vehicle_id = selected_vehicle_id,
        customer_name = snapshot_customer_name,
        customer_email = snapshot_customer_email,
        customer_phone = snapshot_customer_phone,
        customer_address = snapshot_customer_address,
        vehicle_registration = snapshot_registration,
        vehicle_make = snapshot_make,
        vehicle_model = snapshot_model,
        service_name = snapshot_service,
        appointment_start = snapshot_appointment,
        issue_date = requested_issue_date,
        due_date = requested_due_date,
        discount_pence = 0,
        tax_pence = 0,
        notes = nullif(trim(p_payload->>'notes'), ''),
        payment_terms = nullif(trim(p_payload->>'payment_terms'), ''),
        updated_by = actor_id
    where id = target_id;

    delete from public.invoice_items where invoice_id = target_id;
  end if;

  for item in select value from jsonb_array_elements(p_payload->'items') loop
    item_count := item_count + 1;
    if length(trim(coalesce(item->>'description', ''))) = 0 then
      raise exception 'ITEM_DESCRIPTION_REQUIRED';
    end if;
    item_quantity := (item->>'quantity')::numeric;
    item_unit_numeric := (item->>'unit_price_pence')::numeric;
    if item_quantity <= 0
       or item_quantity > 999999999.999
       or item_quantity <> round(item_quantity, 3) then
      raise exception 'INVALID_ITEM_QUANTITY';
    end if;
    if item_unit_numeric <> trunc(item_unit_numeric)
       or item_unit_numeric < 0
       or item_unit_numeric > 9007199254740991 then
      raise exception 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER' using errcode = '22003';
    end if;
    item_unit_price := item_unit_numeric::bigint;
    perform public.invoice_line_total(item_quantity, item_unit_price);

    insert into public.invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price_pence,
      line_total_pence,
      position
    ) values (
      target_id,
      trim(item->>'description'),
      item_quantity,
      item_unit_price,
      0,
      item_count - 1
    );
  end loop;

  select coalesce(sum(item.line_total_pence), 0)
  into calculated_subtotal
  from public.invoice_items item
  where item.invoice_id = target_id;

  if calculated_subtotal > 9007199254740991 then
    raise exception 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER' using errcode = '22003';
  end if;
  if requested_discount > calculated_subtotal then
    raise exception 'INVALID_INVOICE_TOTAL';
  end if;

  update public.invoices
  set subtotal_pence = calculated_subtotal::bigint,
      discount_pence = requested_discount,
      tax_pence = 0,
      total_pence = calculated_subtotal::bigint - requested_discount,
      updated_by = actor_id
  where id = target_id;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    actor_id,
    case when p_invoice_id is null then 'invoice.created' else 'invoice.updated' end,
    'invoice',
    target_id::text,
    jsonb_build_object(
      'sourceType', source_kind,
      'itemCount', item_count,
      'duplicateSourceConfirmed',
        coalesce(duplicate_exists, false) and coalesce(p_confirm_duplicate_source, false)
    )
  );
  return target_id;
end
$$;

create function public.issue_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  current_invoice public.invoices%rowtype;
  allocated_sequence bigint;
  allocated_year integer;
  effective_issue_date date;
  calculated_subtotal numeric;
  calculated_item_count integer;
begin
  select invoice.*
  into current_invoice
  from public.invoices invoice
  where invoice.id = p_invoice_id
  for update;
  if not found or current_invoice.status <> 'draft'::public.invoice_status then
    raise exception 'DRAFT_INVOICE_NOT_FOUND';
  end if;

  if current_invoice.source_type = 'booking' and not exists (
    select 1
    from public.bookings booking
    join public.vehicles vehicle
      on vehicle.id = booking.vehicle_id
     and vehicle.customer_id = booking.customer_id
    where booking.id = current_invoice.booking_id
      and booking.customer_id = current_invoice.customer_id
      and booking.vehicle_id = current_invoice.vehicle_id
  ) then
    raise exception 'SOURCE_RELATIONSHIP_CHANGED';
  elsif current_invoice.source_type = 'enquiry' and not exists (
    select 1
    from public.enquiries enquiry
    left join public.vehicles vehicle
      on vehicle.id = enquiry.vehicle_id
     and vehicle.customer_id = enquiry.customer_id
    where enquiry.id = current_invoice.enquiry_id
      and enquiry.customer_id = current_invoice.customer_id
      and enquiry.vehicle_id is not distinct from current_invoice.vehicle_id
      and (enquiry.vehicle_id is null or vehicle.id is not null)
  ) then
    raise exception 'SOURCE_RELATIONSHIP_CHANGED';
  elsif current_invoice.source_type = 'manual'
        and current_invoice.vehicle_id is not null
        and not exists (
          select 1
          from public.vehicles vehicle
          where vehicle.id = current_invoice.vehicle_id
            and vehicle.customer_id = current_invoice.customer_id
        ) then
    raise exception 'SOURCE_RELATIONSHIP_CHANGED';
  end if;

  perform 1
  from public.invoice_items item
  where item.invoice_id = p_invoice_id
  order by item.id
  for update;

  update public.invoice_items item
  set line_total_pence = public.invoice_line_total(item.quantity, item.unit_price_pence)
  where item.invoice_id = p_invoice_id;

  select count(*)::integer, coalesce(sum(item.line_total_pence), 0)
  into calculated_item_count, calculated_subtotal
  from public.invoice_items item
  where item.invoice_id = p_invoice_id;

  if calculated_item_count = 0 then
    raise exception 'INVOICE_ITEM_REQUIRED';
  end if;
  if calculated_subtotal > 9007199254740991 then
    raise exception 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER' using errcode = '22003';
  end if;

  select invoice.*
  into current_invoice
  from public.invoices invoice
  where invoice.id = p_invoice_id;

  if current_invoice.tax_pence <> 0 then
    raise exception 'VAT_NOT_CONFIGURED';
  end if;
  if current_invoice.discount_pence < 0 or current_invoice.discount_pence > calculated_subtotal then
    raise exception 'INVALID_INVOICE_TOTAL';
  end if;

  effective_issue_date := coalesce(
    current_invoice.issue_date,
    (clock_timestamp() at time zone 'Europe/London')::date
  );
  allocated_year := extract(year from effective_issue_date)::integer;
  if allocated_year not between 2020 and 9999 then
    raise exception 'INVALID_INVOICE_YEAR';
  end if;

  insert into public.invoice_number_sequences (invoice_year, last_value)
  values (allocated_year, 1)
  on conflict (invoice_year) do update
    set last_value = public.invoice_number_sequences.last_value + 1
    where public.invoice_number_sequences.last_value < 999999
  returning last_value into allocated_sequence;

  if allocated_sequence is null then
    raise exception 'INVOICE_YEAR_SEQUENCE_EXHAUSTED';
  end if;

  update public.invoices
  set invoice_year = allocated_year,
      invoice_sequence = allocated_sequence,
      invoice_number = 'SOB-' || allocated_year::text || '-' || lpad(allocated_sequence::text, 6, '0'),
      status = 'issued',
      issue_date = effective_issue_date,
      due_date = coalesce(due_date, effective_issue_date + 7),
      subtotal_pence = calculated_subtotal::bigint,
      tax_pence = 0,
      total_pence = calculated_subtotal::bigint - current_invoice.discount_pence,
      issued_at = now(),
      updated_by = actor_id
  where id = p_invoice_id
  returning * into current_invoice;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    actor_id,
    'invoice.issued',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object(
      'invoiceNumber', current_invoice.invoice_number,
      'revision', current_invoice.revision
    )
  );
  return current_invoice;
end
$$;

create function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_paid_at timestamptz,
  p_method text,
  p_reference text
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  result public.invoices%rowtype;
  normalized_method text;
begin
  if p_paid_at is null then
    raise exception 'PAYMENT_DATE_REQUIRED';
  end if;
  normalized_method := lower(trim(p_method));
  if p_method is null or normalized_method not in ('cash', 'card', 'bank_transfer', 'other') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select invoice.*
  into result
  from public.invoices invoice
  where invoice.id = p_invoice_id
    and invoice.status = 'issued'
  for update;
  if not found then
    raise exception 'ISSUED_INVOICE_NOT_FOUND';
  end if;
  if exists (
    select 1
    from public.invoice_email_sends email_send
    where email_send.invoice_id = p_invoice_id
      and email_send.status = 'pending'
  ) then
    raise exception 'INVOICE_EMAIL_SEND_IN_PROGRESS';
  end if;

  update public.invoices
  set status = 'paid',
      paid_at = p_paid_at,
      payment_method = normalized_method,
      payment_reference = nullif(trim(p_reference), ''),
      updated_by = actor_id
  where id = p_invoice_id
    and status = 'issued'
  returning * into result;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    actor_id,
    'invoice.marked_paid',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object('method', normalized_method, 'paidAt', p_paid_at, 'revision', result.revision)
  );
  return result;
end
$$;

create function public.void_invoice(p_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  result public.invoices%rowtype;
begin
  select invoice.*
  into result
  from public.invoices invoice
  where invoice.id = p_invoice_id
    and invoice.status = 'issued'
  for update;
  if not found then
    raise exception 'ISSUED_INVOICE_NOT_FOUND';
  end if;
  if exists (
    select 1
    from public.invoice_email_sends email_send
    where email_send.invoice_id = p_invoice_id
      and email_send.status = 'pending'
  ) then
    raise exception 'INVOICE_EMAIL_SEND_IN_PROGRESS';
  end if;

  update public.invoices
  set status = 'void',
      voided_at = now(),
      updated_by = actor_id
  where id = p_invoice_id
    and status = 'issued'
  returning * into result;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    actor_id,
    'invoice.voided',
    'invoice',
    p_invoice_id::text,
    jsonb_build_object('revision', result.revision)
  );
  return result;
end
$$;

create function public.delete_invoice_draft(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  deleted_id uuid;
begin
  delete from public.invoices
  where id = p_invoice_id
    and status = 'draft'
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'DRAFT_INVOICE_NOT_FOUND';
  end if;
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (actor_id, 'invoice.deleted_draft', 'invoice', p_invoice_id::text, '{}'::jsonb);
  return deleted_id;
end
$$;

create function public.duplicate_invoice_to_draft(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  source_invoice public.invoices%rowtype;
  target_id uuid;
  calculated_subtotal numeric;
  business_date date := (clock_timestamp() at time zone 'Europe/London')::date;
begin
  select invoice.*
  into source_invoice
  from public.invoices invoice
  where invoice.id = p_invoice_id
  for share;

  if not found then
    raise exception 'INVOICE_NOT_FOUND';
  end if;
  if source_invoice.status not in ('paid'::public.invoice_status, 'void'::public.invoice_status) then
    raise exception 'INVOICE_MUST_BE_PAID_OR_VOID_TO_DUPLICATE';
  end if;

  insert into public.invoices (
    replaces_invoice_id,
    source_type,
    customer_id,
    vehicle_id,
    customer_name,
    customer_email,
    customer_phone,
    customer_address,
    vehicle_registration,
    vehicle_make,
    vehicle_model,
    service_name,
    appointment_start,
    issue_date,
    due_date,
    notes,
    payment_terms,
    created_by,
    updated_by
  ) values (
    source_invoice.id,
    'manual',
    source_invoice.customer_id,
    source_invoice.vehicle_id,
    source_invoice.customer_name,
    source_invoice.customer_email,
    source_invoice.customer_phone,
    source_invoice.customer_address,
    source_invoice.vehicle_registration,
    source_invoice.vehicle_make,
    source_invoice.vehicle_model,
    source_invoice.service_name,
    source_invoice.appointment_start,
    business_date,
    business_date + 7,
    source_invoice.notes,
    source_invoice.payment_terms,
    actor_id,
    actor_id
  ) returning id into target_id;

  insert into public.invoice_items (
    invoice_id,
    description,
    quantity,
    unit_price_pence,
    line_total_pence,
    position
  )
  select
    target_id,
    item.description,
    item.quantity,
    item.unit_price_pence,
    0,
    item.position
  from public.invoice_items item
  where item.invoice_id = source_invoice.id
  order by item.position;

  select coalesce(sum(item.line_total_pence), 0)
  into calculated_subtotal
  from public.invoice_items item
  where item.invoice_id = target_id;

  if calculated_subtotal > 9007199254740991 then
    raise exception 'INVOICE_AMOUNT_EXCEEDS_SAFE_INTEGER' using errcode = '22003';
  end if;
  if source_invoice.discount_pence > calculated_subtotal then
    raise exception 'INVALID_INVOICE_TOTAL';
  end if;

  update public.invoices
  set subtotal_pence = calculated_subtotal::bigint,
      discount_pence = source_invoice.discount_pence,
      tax_pence = 0,
      total_pence = calculated_subtotal::bigint - source_invoice.discount_pence,
      updated_by = actor_id
  where id = target_id;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    actor_id,
    'invoice.created',
    'invoice',
    target_id::text,
    jsonb_build_object('replacesInvoiceId', source_invoice.id, 'sourceInvoiceNumber', source_invoice.invoice_number)
  );
  return target_id;
end
$$;

create function public.claim_invoice_email_send(
  p_invoice_id uuid,
  p_recipient text,
  p_logical_send_id uuid,
  p_invoice_revision bigint,
  p_payload_sha256 text
)
returns table (
  logical_send_id uuid,
  attempt_id bigint,
  provider_idempotency_key text,
  claim_token uuid,
  disposition text,
  should_send boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  invoice_record public.invoices%rowtype;
  send_record public.invoice_email_sends%rowtype;
  attempt_record public.invoice_email_attempts%rowtype;
  normalized_recipient text := lower(trim(p_recipient));
  normalized_hash text := lower(trim(p_payload_sha256));
  generated_key text;
  generated_claim uuid;
  next_attempt integer;
  result_disposition text;
begin
  if p_logical_send_id is null then
    raise exception 'LOGICAL_SEND_ID_REQUIRED';
  end if;
  if p_invoice_revision is null or p_invoice_revision <= 0 then
    raise exception 'INVOICE_REVISION_REQUIRED';
  end if;
  if normalized_recipient is null
     or length(normalized_recipient) > 320
     or normalized_recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'INVALID_EMAIL_RECIPIENT';
  end if;
  if normalized_hash is null or normalized_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_EMAIL_PAYLOAD_HASH';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('public.invoice_email_sends:' || p_logical_send_id::text, 0)
  );

  select invoice.*
  into invoice_record
  from public.invoices invoice
  where invoice.id = p_invoice_id
  for share;

  if not found or invoice_record.status not in ('issued'::public.invoice_status, 'paid'::public.invoice_status) then
    raise exception 'ONLY_ISSUED_INVOICES_CAN_BE_EMAILED';
  end if;
  if invoice_record.revision <> p_invoice_revision then
    raise exception 'INVOICE_REVISION_MISMATCH';
  end if;

  select email_send.*
  into send_record
  from public.invoice_email_sends email_send
  where email_send.id = p_logical_send_id
  for update;

  if found then
    if send_record.invoice_id <> p_invoice_id
       or send_record.recipient <> normalized_recipient
       or send_record.invoice_revision <> p_invoice_revision
       or send_record.payload_sha256 <> normalized_hash
       or send_record.document_status <> invoice_record.status
       or send_record.document_number <> invoice_record.invoice_number then
      raise exception 'LOGICAL_SEND_REUSE_MISMATCH';
    end if;

    select attempt.*
    into attempt_record
    from public.invoice_email_attempts attempt
    where attempt.logical_send_id = send_record.id
    order by attempt.attempt_number desc
    limit 1
    for update;

    if send_record.status = 'sent' then
      return query select send_record.id, attempt_record.id, send_record.provider_idempotency_key,
        null::uuid, 'already_sent'::text, false;
      return;
    end if;

    if attempt_record.status = 'pending' and attempt_record.lease_expires_at > now() then
      return query select send_record.id, attempt_record.id, send_record.provider_idempotency_key,
        null::uuid, 'in_progress'::text, false;
      return;
    end if;

    if attempt_record.status = 'pending' then
      update public.invoice_email_attempts
      set status = 'ambiguous',
          error_code = 'claim_expired',
          completed_at = now()
      where id = attempt_record.id;
      update public.invoice_email_sends
      set status = 'ambiguous',
          last_error_code = 'claim_expired',
          updated_at = now()
      where id = send_record.id;
      return query select send_record.id, attempt_record.id, send_record.provider_idempotency_key,
        null::uuid, 'reconciliation_required'::text, false;
      return;
    end if;

    if send_record.status = 'ambiguous' then
      return query select send_record.id, attempt_record.id, send_record.provider_idempotency_key,
        null::uuid, 'reconciliation_required'::text, false;
      return;
    end if;

    result_disposition := 'failed_retry';

    select coalesce(max(attempt.attempt_number), 0) + 1
    into next_attempt
    from public.invoice_email_attempts attempt
    where attempt.logical_send_id = send_record.id;

    generated_claim := gen_random_uuid();
    insert into public.invoice_email_attempts (
      logical_send_id,
      invoice_id,
      attempt_number,
      status,
      claim_token,
      lease_expires_at,
      attempted_by
    ) values (
      send_record.id,
      p_invoice_id,
      next_attempt,
      'pending',
      generated_claim,
      now() + interval '15 minutes',
      actor_id
    ) returning * into attempt_record;

    update public.invoice_email_sends
    set status = 'pending',
        last_error_code = null,
        updated_at = now()
    where id = send_record.id;

    return query select send_record.id, attempt_record.id, send_record.provider_idempotency_key,
      generated_claim, result_disposition, true;
    return;
  end if;

  generated_key := 'invoice-' || md5(
    p_invoice_id::text || ':' || p_invoice_revision::text || ':' || normalized_recipient || ':' || normalized_hash || ':' || p_logical_send_id::text
  );
  insert into public.invoice_email_sends (
    id,
    invoice_id,
    recipient,
    invoice_revision,
    document_status,
    document_number,
    payload_sha256,
    provider_idempotency_key,
    status,
    requested_by
  ) values (
    p_logical_send_id,
    p_invoice_id,
    normalized_recipient,
    p_invoice_revision,
    invoice_record.status,
    invoice_record.invoice_number,
    normalized_hash,
    generated_key,
    'pending',
    actor_id
  ) returning * into send_record;

  generated_claim := gen_random_uuid();
  insert into public.invoice_email_attempts (
    logical_send_id,
    invoice_id,
    attempt_number,
    status,
    claim_token,
    lease_expires_at,
    attempted_by
  ) values (
    send_record.id,
    p_invoice_id,
    1,
    'pending',
    generated_claim,
    now() + interval '15 minutes',
    actor_id
  ) returning * into attempt_record;

  return query select send_record.id, attempt_record.id, send_record.provider_idempotency_key,
    generated_claim, 'should_send'::text, true;
end
$$;

create function public.finalize_invoice_email_send(
  p_attempt_id bigint,
  p_claim_token uuid,
  p_provider_id text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  logical_id uuid;
  send_record public.invoice_email_sends%rowtype;
  attempt_record public.invoice_email_attempts%rowtype;
  normalized_provider_id text := nullif(trim(p_provider_id), '');
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'UNAUTHORISED' using errcode = '42501';
  end if;
  if p_claim_token is null
     or normalized_provider_id is null
     or length(normalized_provider_id) > 255 then
    raise exception 'EMAIL_PROVIDER_CONFIRMATION_REQUIRED';
  end if;

  select attempt.logical_send_id
  into logical_id
  from public.invoice_email_attempts attempt
  where attempt.id = p_attempt_id;
  if logical_id is null then
    raise exception 'EMAIL_ATTEMPT_NOT_FOUND';
  end if;

  select email_send.*
  into send_record
  from public.invoice_email_sends email_send
  where email_send.id = logical_id
  for update;

  select attempt.*
  into attempt_record
  from public.invoice_email_attempts attempt
  where attempt.id = p_attempt_id
  for update;

  if attempt_record.claim_token <> p_claim_token then
    raise exception 'EMAIL_CLAIM_TOKEN_MISMATCH';
  end if;
  if send_record.status = 'sent' then
    if send_record.provider_id is distinct from normalized_provider_id then
      raise exception 'EMAIL_PROVIDER_CONFIRMATION_MISMATCH';
    end if;
    return p_attempt_id;
  end if;
  if attempt_record.status not in ('pending', 'ambiguous') then
    raise exception 'EMAIL_ATTEMPT_NOT_FINALISABLE';
  end if;
  if (attempt_record.provider_id is not null and attempt_record.provider_id <> normalized_provider_id)
     or (send_record.provider_id is not null and send_record.provider_id <> normalized_provider_id) then
    raise exception 'EMAIL_PROVIDER_CONFIRMATION_MISMATCH';
  end if;

  update public.invoice_email_attempts
  set status = 'sent',
      provider_id = normalized_provider_id,
      error_code = null,
      completed_at = now()
  where id = p_attempt_id;

  update public.invoice_email_attempts
  set status = 'ambiguous',
      error_code = 'superseded_by_sent_attempt',
      completed_at = now()
  where logical_send_id = logical_id
    and id <> p_attempt_id
    and status = 'pending';

  update public.invoice_email_sends
  set status = 'sent',
      provider_id = normalized_provider_id,
      last_error_code = null,
      sent_at = now(),
      updated_at = now()
  where id = logical_id;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    attempt_record.attempted_by,
    'invoice.sent',
    'invoice',
    send_record.invoice_id::text,
    jsonb_build_object(
      'logicalSendId', logical_id,
      'attemptId', p_attempt_id,
      'invoiceRevision', send_record.invoice_revision
    )
  );
  return p_attempt_id;
end
$$;

create function public.fail_invoice_email_send(
  p_attempt_id bigint,
  p_claim_token uuid,
  p_error_code text,
  p_ambiguous boolean,
  p_provider_id text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  logical_id uuid;
  send_record public.invoice_email_sends%rowtype;
  attempt_record public.invoice_email_attempts%rowtype;
  normalized_error text := lower(trim(p_error_code));
  normalized_provider_id text := nullif(trim(p_provider_id), '');
  target_status text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'UNAUTHORISED' using errcode = '42501';
  end if;
  if p_claim_token is null or p_ambiguous is null then
    raise exception 'INVALID_EMAIL_FAILURE_STATE';
  end if;
  if normalized_error is null
     or length(normalized_error) > 100
     or normalized_error !~ '^[a-z0-9_.-]+$' then
    raise exception 'INVALID_EMAIL_ERROR_CODE';
  end if;
  if normalized_provider_id is not null and length(normalized_provider_id) > 255 then
    raise exception 'INVALID_EMAIL_PROVIDER_ID';
  end if;
  if not p_ambiguous and normalized_provider_id is not null then
    raise exception 'EMAIL_PROVIDER_ID_NOT_ALLOWED_FOR_FAILED_ATTEMPT';
  end if;
  target_status := case when p_ambiguous then 'ambiguous' else 'failed' end;

  select attempt.logical_send_id
  into logical_id
  from public.invoice_email_attempts attempt
  where attempt.id = p_attempt_id;
  if logical_id is null then
    raise exception 'EMAIL_ATTEMPT_NOT_FOUND';
  end if;

  select email_send.*
  into send_record
  from public.invoice_email_sends email_send
  where email_send.id = logical_id
  for update;

  select attempt.*
  into attempt_record
  from public.invoice_email_attempts attempt
  where attempt.id = p_attempt_id
  for update;

  if attempt_record.claim_token <> p_claim_token then
    raise exception 'EMAIL_CLAIM_TOKEN_MISMATCH';
  end if;
  if send_record.status = 'sent' then
    return p_attempt_id;
  end if;
  if attempt_record.status = target_status
     and attempt_record.error_code = normalized_error
     and attempt_record.provider_id is not distinct from normalized_provider_id then
    return p_attempt_id;
  end if;
  if attempt_record.status <> 'pending' then
    raise exception 'EMAIL_ATTEMPT_NOT_FAILABLE';
  end if;

  update public.invoice_email_attempts
  set status = target_status,
      provider_id = case when p_ambiguous then normalized_provider_id else null end,
      error_code = normalized_error,
      completed_at = now()
  where id = p_attempt_id;

  update public.invoice_email_sends
  set status = target_status,
      provider_id = case when p_ambiguous then normalized_provider_id else null end,
      last_error_code = normalized_error,
      updated_at = now()
  where id = logical_id;
  return p_attempt_id;
end
$$;

alter table public.invoice_number_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_email_sends enable row level security;
alter table public.invoice_email_attempts enable row level security;

create policy "admins read invoices"
on public.invoices for select to authenticated
using (public.is_admin());

create policy "admins read invoice items"
on public.invoice_items for select to authenticated
using (public.is_admin());

create policy "admins read invoice email sends"
on public.invoice_email_sends for select to authenticated
using (public.is_admin());

create policy "admins read invoice email attempts"
on public.invoice_email_attempts for select to authenticated
using (public.is_admin());

revoke all on table public.invoice_number_sequences from public, anon, authenticated, service_role;
revoke all on table public.invoices from public, anon, authenticated, service_role;
revoke all on table public.invoice_items from public, anon, authenticated, service_role;
revoke all on table public.invoice_email_sends from public, anon, authenticated, service_role;
revoke all on table public.invoice_email_attempts from public, anon, authenticated, service_role;
revoke all on sequence public.invoice_email_attempts_id_seq from public, anon, authenticated, service_role;

grant select on table public.invoices to authenticated, service_role;
grant select on table public.invoice_items to authenticated, service_role;
grant select on table public.invoice_email_sends to authenticated, service_role;
grant select on table public.invoice_email_attempts to authenticated, service_role;
grant select on table public.admin_profiles to authenticated;
grant select on table public.admin_audit_log to authenticated;

revoke all on function public.require_invoice_actor() from public, anon, authenticated, service_role;
revoke all on function public.invoice_line_total(numeric,bigint) from public, anon, authenticated, service_role;
revoke all on function public.prepare_invoice_item() from public, anon, authenticated, service_role;
revoke all on function public.refresh_invoice_totals() from public, anon, authenticated, service_role;
revoke all on function public.protect_invoice_history() from public, anon, authenticated, service_role;
revoke all on function public.save_invoice_draft(uuid,jsonb,boolean) from public, anon, authenticated, service_role;
revoke all on function public.issue_invoice(uuid) from public, anon, authenticated, service_role;
revoke all on function public.mark_invoice_paid(uuid,timestamptz,text,text) from public, anon, authenticated, service_role;
revoke all on function public.void_invoice(uuid) from public, anon, authenticated, service_role;
revoke all on function public.delete_invoice_draft(uuid) from public, anon, authenticated, service_role;
revoke all on function public.duplicate_invoice_to_draft(uuid) from public, anon, authenticated, service_role;
revoke all on function public.claim_invoice_email_send(uuid,text,uuid,bigint,text) from public, anon, authenticated, service_role;
revoke all on function public.finalize_invoice_email_send(bigint,uuid,text) from public, anon, authenticated, service_role;
revoke all on function public.fail_invoice_email_send(bigint,uuid,text,boolean,text) from public, anon, authenticated, service_role;

grant execute on function public.save_invoice_draft(uuid,jsonb,boolean) to authenticated;
grant execute on function public.issue_invoice(uuid) to authenticated;
grant execute on function public.mark_invoice_paid(uuid,timestamptz,text,text) to authenticated;
grant execute on function public.void_invoice(uuid) to authenticated;
grant execute on function public.delete_invoice_draft(uuid) to authenticated;
grant execute on function public.duplicate_invoice_to_draft(uuid) to authenticated;
grant execute on function public.claim_invoice_email_send(uuid,text,uuid,bigint,text) to authenticated;
grant execute on function public.finalize_invoice_email_send(bigint,uuid,text) to service_role;
grant execute on function public.fail_invoice_email_send(bigint,uuid,text,boolean,text) to service_role;

commit;
