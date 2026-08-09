create extension if not exists pgcrypto;

create type public.content_kind as enum ('core_page', 'service', 'diagnostic', 'area', 'article', 'faq');
create type public.publication_status as enum ('draft', 'scheduled', 'published', 'archived');
create type public.enquiry_type as enum ('repair', 'diagnostic', 'mobile', 'inspection', 'fleet', 'recovery', 'vehicle_sales', 'general');
create type public.enquiry_status as enum ('new', 'contacted', 'booked', 'closed');
create type public.notification_status as enum ('pending', 'sent', 'failed');
create type public.sale_vehicle_status as enum ('available', 'reserved', 'sold');

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.site_settings (
  id boolean primary key default true check (id),
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.content_entries (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  excerpt text not null,
  sections jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  seo_title text not null,
  seo_description text not null,
  status public.publication_status not null default 'draft',
  published_at timestamptz,
  author_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, slug)
);

create table public.content_revisions (
  id bigint generated always as identity primary key,
  content_entry_id uuid not null references public.content_entries(id) on delete cascade,
  snapshot jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.navigation_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  href text not null,
  parent_id uuid references public.navigation_items(id) on delete cascade,
  position integer not null default 0,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.service_prices (
  service_slug text primary key check (service_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  minimum integer check (minimum is null or minimum >= 0),
  maximum integer check (maximum is null or maximum >= minimum),
  label text,
  notes text,
  published boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'public-media',
  object_path text not null unique,
  alt_text text not null,
  caption text,
  category text,
  published boolean not null default false,
  width integer,
  height integer,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google',
  provider_review_id text unique,
  author_name text not null,
  author_uri text,
  rating smallint not null check (rating between 1 and 5),
  text text not null,
  published_at timestamptz,
  source_uri text not null,
  visible boolean not null default false,
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text not null,
  preferred_contact text not null check (preferred_contact in ('phone', 'whatsapp', 'email')),
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  registration text,
  make text,
  model text,
  derivative text,
  year integer,
  colour text,
  fuel_type text,
  transmission text,
  engine_capacity_cc integer,
  body_type text,
  created_at timestamptz not null default now()
);

create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  type public.enquiry_type not null,
  customer_id uuid not null references public.customers(id),
  vehicle_id uuid references public.vehicles(id),
  service_slug text,
  description text,
  location_postcode text,
  driveable boolean,
  status public.enquiry_status not null default 'new',
  notification_status public.notification_status not null default 'pending',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enquiry_attachments (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  object_path text not null unique,
  file_name text not null,
  content_type text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  finalised boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.sale_vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  make text not null,
  model text not null,
  derivative text,
  year integer not null,
  mileage integer not null check (mileage >= 0),
  price integer not null check (price >= 0),
  fuel_type text not null,
  transmission text not null,
  engine_size text,
  colour text,
  description text not null,
  features text[] not null default '{}',
  warranty jsonb,
  finance_available boolean not null default false,
  status public.sale_vehicle_status not null default 'available',
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sale_vehicle_images (
  id uuid primary key default gen_random_uuid(),
  sale_vehicle_id uuid not null references public.sale_vehicles(id) on delete cascade,
  object_path text not null unique,
  alt_text text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.notification_attempts (
  id bigint generated always as identity primary key,
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('business', 'customer')),
  status public.notification_status not null default 'pending',
  provider_id text,
  error_code text,
  attempted_at timestamptz not null default now()
);

create table public.rate_limit_buckets (
  identifier_hash text not null,
  scope text not null,
  request_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  primary key (identifier_hash, scope)
);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_profiles where user_id = auth.uid());
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_entries_updated before update on public.content_entries for each row execute function public.set_updated_at();
create trigger customers_updated before update on public.customers for each row execute function public.set_updated_at();
create trigger enquiries_updated before update on public.enquiries for each row execute function public.set_updated_at();
create trigger reviews_updated before update on public.reviews for each row execute function public.set_updated_at();
create trigger sale_vehicles_updated before update on public.sale_vehicles for each row execute function public.set_updated_at();

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
  on conflict (identifier_hash, scope) do update
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

create or replace function public.apply_enquiry_retention()
returns integer
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  affected integer;
begin
  delete from storage.objects
  where bucket_id = 'enquiry-attachments'
    and name in (
      select ea.object_path
      from public.enquiry_attachments ea
      join public.enquiries e on e.id = ea.enquiry_id
      where e.status = 'closed' and e.closed_at < now() - interval '12 months'
    );

  delete from public.enquiry_attachments
  where enquiry_id in (
    select id from public.enquiries
    where status = 'closed' and closed_at < now() - interval '12 months'
  );

  update public.customers c
  set name = 'Anonymised', email = null, phone = 'REDACTED', anonymised_at = now()
  where anonymised_at is null
    and not exists (
      select 1 from public.enquiries e
      where e.customer_id = c.id
        and (e.status <> 'closed' or e.closed_at >= now() - interval '12 months')
    );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.apply_enquiry_retention() from public, anon, authenticated;
grant execute on function public.apply_enquiry_retention() to service_role;

alter table public.admin_profiles enable row level security;
alter table public.site_settings enable row level security;
alter table public.content_entries enable row level security;
alter table public.content_revisions enable row level security;
alter table public.navigation_items enable row level security;
alter table public.offers enable row level security;
alter table public.service_prices enable row level security;
alter table public.media_assets enable row level security;
alter table public.reviews enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_attachments enable row level security;
alter table public.sale_vehicles enable row level security;
alter table public.sale_vehicle_images enable row level security;
alter table public.notification_attempts enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.admin_audit_log enable row level security;

create policy "published content is public" on public.content_entries for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy "published navigation is public" on public.navigation_items for select to anon, authenticated using (published or public.is_admin());
create policy "active offers are public" on public.offers for select to anon, authenticated using (active or public.is_admin());
create policy "published prices are public" on public.service_prices for select to anon, authenticated using (published or public.is_admin());
create policy "published media metadata is public" on public.media_assets for select to anon, authenticated using (published or public.is_admin());
create policy "visible reviews are public" on public.reviews for select to anon, authenticated using (visible or public.is_admin());
create policy "public stock is readable" on public.sale_vehicles for select to anon, authenticated using (status in ('available', 'reserved') or public.is_admin());
create policy "public stock images are readable" on public.sale_vehicle_images for select to anon, authenticated using (
  exists(select 1 from public.sale_vehicles v where v.id = sale_vehicle_id and (v.status in ('available', 'reserved') or public.is_admin()))
);

create policy "admins manage profiles" on public.admin_profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage content" on public.content_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage revisions" on public.content_revisions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage navigation" on public.navigation_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage offers" on public.offers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage prices" on public.service_prices for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage media" on public.media_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage reviews" on public.reviews for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage customers" on public.customers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage vehicles" on public.vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage enquiries" on public.enquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage attachments" on public.enquiry_attachments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage sale vehicles" on public.sale_vehicles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage sale images" on public.sale_vehicle_images for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage notifications" on public.notification_attempts for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins read audit log" on public.admin_audit_log for select to authenticated using (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('public-media', 'public-media', true, 12582912, array['image/jpeg', 'image/png', 'image/webp']),
  ('vehicle-sales', 'vehicle-sales', true, 12582912, array['image/jpeg', 'image/png', 'image/webp']),
  ('enquiry-attachments', 'enquiry-attachments', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "admins upload public media" on storage.objects for insert to authenticated with check (bucket_id in ('public-media', 'vehicle-sales') and public.is_admin());
create policy "admins update public media" on storage.objects for update to authenticated using (bucket_id in ('public-media', 'vehicle-sales') and public.is_admin());
create policy "admins delete public media" on storage.objects for delete to authenticated using (bucket_id in ('public-media', 'vehicle-sales') and public.is_admin());
create policy "admins read private attachments" on storage.objects for select to authenticated using (bucket_id = 'enquiry-attachments' and public.is_admin());

insert into public.site_settings (id, value)
values (true, jsonb_build_object(
  'name', 'SOB Autofix',
  'legalName', 'SOB Autofix Limited',
  'tagline', 'Professional Diagnostics. Not Guesswork.',
  'supportingLine', 'Automotive Diagnosis, Repair & Sales',
  'companyNumber', '16182532',
  'phone', '07469273483',
  'whatsapp', '07468273483',
  'email', 'sobautofix@gmail.com',
  'address', jsonb_build_object('building', 'Cumbrae', 'street', 'Station Road', 'town', 'Norton', 'city', 'Doncaster', 'postcode', 'DN6 9HF', 'country', 'United Kingdom', 'countryCode', 'GB'),
  'openingHours', jsonb_build_object('monday', '24 Hours', 'tuesday', '24 Hours', 'wednesday', '24 Hours', 'thursday', '24 Hours', 'friday', '24 Hours', 'saturday', '24 Hours', 'sunday', '24 Hours', 'bankHolidays', '24 Hours')
)) on conflict (id) do nothing;
