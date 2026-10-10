begin;

create index if not exists sale_vehicles_recently_sold_idx
  on public.sale_vehicles (sold_at desc)
  where deleted_at is null and status = 'sold';

drop policy if exists "public stock is readable" on public.sale_vehicles;
create policy "public stock is readable" on public.sale_vehicles for select to anon, authenticated
  using (
    public.is_admin()
    or (
      deleted_at is null
      and (
        status in ('available', 'reserved')
        or (status = 'sold' and sold_at >= now() - interval '90 days')
      )
    )
  );

drop policy if exists "public stock images are readable" on public.sale_vehicle_images;
create policy "public stock images are readable" on public.sale_vehicle_images for select to anon, authenticated
  using (exists (
    select 1
    from public.sale_vehicles vehicle
    where vehicle.id = sale_vehicle_id
      and (
        public.is_admin()
        or (
          vehicle.deleted_at is null
          and (
            vehicle.status in ('available', 'reserved')
            or (vehicle.status = 'sold' and vehicle.sold_at >= now() - interval '90 days')
          )
        )
      )
  ));

commit;
