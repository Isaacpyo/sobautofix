begin;

alter table public.enquiries add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.bookings add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.invoices add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.sale_vehicles add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.content_entries add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.media_assets add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.reviews add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;
alter table public.offers add column if not exists deleted_at timestamptz, add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create index if not exists enquiries_active_created_idx on public.enquiries (created_at desc) where deleted_at is null;
create index if not exists bookings_active_created_idx on public.bookings (created_at desc) where deleted_at is null;
create index if not exists invoices_active_created_idx on public.invoices (created_at desc) where deleted_at is null;
create index if not exists sale_vehicles_active_updated_idx on public.sale_vehicles (updated_at desc) where deleted_at is null;
create index if not exists content_entries_active_kind_updated_idx on public.content_entries (kind, updated_at desc) where deleted_at is null;
create index if not exists media_assets_active_created_idx on public.media_assets (created_at desc) where deleted_at is null;
create index if not exists reviews_active_fetched_idx on public.reviews (fetched_at desc) where deleted_at is null;
create index if not exists offers_active_updated_idx on public.offers (updated_at desc) where deleted_at is null;

drop policy if exists "published content is public" on public.content_entries;
create policy "published content is public" on public.content_entries for select to anon, authenticated
  using (public.is_admin() or (deleted_at is null and status = 'published'));
drop policy if exists "active offers are public" on public.offers;
create policy "active offers are public" on public.offers for select to anon, authenticated
  using (public.is_admin() or (deleted_at is null and active));
drop policy if exists "published media metadata is public" on public.media_assets;
create policy "published media metadata is public" on public.media_assets for select to anon, authenticated
  using (public.is_admin() or (deleted_at is null and published));
drop policy if exists "visible reviews are public" on public.reviews;
create policy "visible reviews are public" on public.reviews for select to anon, authenticated
  using (public.is_admin() or (deleted_at is null and visible));
drop policy if exists "public stock is readable" on public.sale_vehicles;
create policy "public stock is readable" on public.sale_vehicles for select to anon, authenticated
  using (public.is_admin() or (deleted_at is null and status in ('available', 'reserved')));
drop policy if exists "public stock images are readable" on public.sale_vehicle_images;
create policy "public stock images are readable" on public.sale_vehicle_images for select to anon, authenticated
  using (exists (
    select 1 from public.sale_vehicles vehicle
    where vehicle.id = sale_vehicle_id
      and (public.is_admin() or (vehicle.deleted_at is null and vehicle.status in ('available', 'reserved')))
  ));

create or replace function public.manage_admin_trash(
  p_entity text,
  p_ids uuid[],
  p_action text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_table text;
  entity_filter text := '';
  affected integer := 0;
  target_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 100 then
    raise exception 'INVALID_TRASH_SELECTION';
  end if;
  if p_action not in ('trash', 'restore', 'delete') then
    raise exception 'INVALID_TRASH_ACTION';
  end if;

  target_table := case p_entity
    when 'enquiries' then 'enquiries'
    when 'bookings' then 'bookings'
    when 'invoices' then 'invoices'
    when 'inventory' then 'sale_vehicles'
    when 'news' then 'content_entries'
    when 'media' then 'media_assets'
    when 'reviews' then 'reviews'
    when 'offers' then 'offers'
    else null
  end;
  if target_table is null then raise exception 'INVALID_TRASH_ENTITY'; end if;
  if p_entity = 'news' then entity_filter := ' and kind = ''article'''; end if;

  if p_action = 'trash' then
    execute format('update public.%I set deleted_at = statement_timestamp(), deleted_by = $1 where id = any($2) and deleted_at is null%s', target_table, entity_filter)
      using auth.uid(), p_ids;
    get diagnostics affected = row_count;
  elsif p_action = 'restore' then
    execute format('update public.%I set deleted_at = null, deleted_by = null where id = any($1) and deleted_at is not null%s', target_table, entity_filter)
      using p_ids;
    get diagnostics affected = row_count;
  elsif p_entity = 'invoices' then
    foreach target_id in array p_ids loop
      if exists (select 1 from public.invoices where id = target_id and deleted_at is not null and status = 'draft') then
        perform public.delete_invoice_draft(target_id);
        affected := affected + 1;
      end if;
    end loop;
  elsif p_entity = 'bookings' then
    delete from public.bookings booking
    where booking.id = any(p_ids)
      and booking.deleted_at is not null
      and not exists (select 1 from public.invoices invoice where invoice.booking_id = booking.id);
    get diagnostics affected = row_count;
  elsif p_entity = 'enquiries' then
    delete from public.enquiries enquiry
    where enquiry.id = any(p_ids)
      and enquiry.deleted_at is not null
      and not exists (select 1 from public.invoices invoice where invoice.enquiry_id = enquiry.id);
    get diagnostics affected = row_count;
  else
    execute format('delete from public.%I where id = any($1) and deleted_at is not null%s', target_table, entity_filter) using p_ids;
    get diagnostics affected = row_count;
  end if;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'trash.' || p_action,
    p_entity,
    coalesce(p_ids[1]::text, 'bulk'),
    jsonb_build_object('ids', to_jsonb(p_ids), 'affected', affected)
  );
  return affected;
end
$$;

revoke all on function public.manage_admin_trash(text,uuid[],text) from public, anon, authenticated, service_role;
grant execute on function public.manage_admin_trash(text,uuid[],text) to authenticated;

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
  if length(normalized_query) > 200 then raise exception 'INVALID_INVOICE_SEARCH_QUERY'; end if;
  if p_status is not null and p_status not in ('draft', 'issued', 'paid', 'void') then raise exception 'INVALID_INVOICE_STATUS'; end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 100 then raise exception 'INVALID_INVOICE_PAGE'; end if;

  select count(*) into matching_count
  from public.invoices invoice
  where invoice.deleted_at is null
    and (p_status is null or invoice.status::text = p_status)
    and (p_date is null or invoice.issue_date = p_date or (invoice.created_at at time zone 'UTC')::date = p_date)
    and (
      normalized_query = ''
      or position(normalized_query in lower(concat_ws(' ', invoice.invoice_number, invoice.customer_name, invoice.customer_email, invoice.customer_phone, invoice.vehicle_registration, invoice.vehicle_make, invoice.vehicle_model))) > 0
      or (length(normalized_registration) >= 2 and position(normalized_registration in coalesce(invoice.vehicle_registration, '')) > 0)
    );

  page_count := greatest(1, ceil(matching_count::numeric / p_page_size)::integer);
  effective_page := least(p_page, page_count);
  select coalesce(jsonb_agg(to_jsonb(invoice_page) order by invoice_page.created_at desc, invoice_page.id desc), '[]'::jsonb)
  into page_rows
  from (
    select invoice.id, invoice.invoice_number, invoice.status, invoice.source_type, invoice.customer_name, invoice.customer_email, invoice.customer_phone, invoice.vehicle_registration, invoice.vehicle_make, invoice.vehicle_model, invoice.issue_date, invoice.due_date, invoice.total_pence, invoice.created_at
    from public.invoices invoice
    where invoice.deleted_at is null
      and (p_status is null or invoice.status::text = p_status)
      and (p_date is null or invoice.issue_date = p_date or (invoice.created_at at time zone 'UTC')::date = p_date)
      and (
        normalized_query = ''
        or position(normalized_query in lower(concat_ws(' ', invoice.invoice_number, invoice.customer_name, invoice.customer_email, invoice.customer_phone, invoice.vehicle_registration, invoice.vehicle_make, invoice.vehicle_model))) > 0
        or (length(normalized_registration) >= 2 and position(normalized_registration in coalesce(invoice.vehicle_registration, '')) > 0)
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
  from public.invoices invoice
  where invoice.deleted_at is null;

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

create or replace function public.get_invoice_dashboard(
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
  result jsonb;
  outstanding_total numeric;
  current_week_paid_total numeric;
  week_start timestamptz := date_trunc('week', timezone('Europe/London', statement_timestamp())) at time zone 'Europe/London';
  week_end timestamptz := (date_trunc('week', timezone('Europe/London', statement_timestamp())) + interval '1 week') at time zone 'Europe/London';
begin
  perform public.require_invoice_actor();
  result := public.get_invoice_dashboard_without_payments(p_query, p_status, p_date, p_page, p_page_size);
  select coalesce(sum(invoice.total_pence - coalesce(payment.amount_paid_pence, 0)), 0)
  into outstanding_total
  from public.invoices invoice
  left join lateral (select sum(invoice_payment.amount_pence) as amount_paid_pence from public.invoice_payments invoice_payment where invoice_payment.invoice_id = invoice.id) payment on true
  where invoice.status = 'issued' and invoice.deleted_at is null;

  select
    coalesce((select sum(payment.amount_pence) from public.invoice_payments payment join public.invoices invoice on invoice.id = payment.invoice_id where invoice.deleted_at is null and payment.paid_at >= week_start and payment.paid_at < week_end), 0)
    + coalesce((select sum(invoice.total_pence) from public.invoices invoice where invoice.deleted_at is null and invoice.status = 'paid' and invoice.paid_at >= week_start and invoice.paid_at < week_end and not exists (select 1 from public.invoice_payments payment where payment.invoice_id = invoice.id)), 0)
  into current_week_paid_total;

  return result || jsonb_build_object('outstanding_total_pence', outstanding_total::text, 'current_week_paid_total_pence', current_week_paid_total::text);
end
$$;

revoke all on function public.get_invoice_dashboard_without_payments(text,text,date,integer,integer) from public, anon, authenticated, service_role;
revoke all on function public.get_invoice_dashboard(text,text,date,integer,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_invoice_dashboard(text,text,date,integer,integer) to authenticated;

commit;
