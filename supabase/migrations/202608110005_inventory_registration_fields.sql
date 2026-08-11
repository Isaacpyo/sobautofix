alter table public.sale_vehicles
  add column if not exists registration text,
  add column if not exists body_type text;

alter table public.sale_vehicles
  add constraint sale_vehicles_registration_format
  check (registration is null or registration ~ '^[A-Z0-9]{2,8}$');

create unique index if not exists sale_vehicles_registration_unique
  on public.sale_vehicles (registration)
  where registration is not null;

alter table public.sale_vehicles alter column status set default 'draft';

drop policy if exists "public stock is readable" on public.sale_vehicles;
create policy "public stock is readable" on public.sale_vehicles for select to anon, authenticated
using (status in ('available', 'reserved') or public.is_admin());
