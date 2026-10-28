-- SOB Auto Exchange, part 4: role-aware database policies.
--
-- The application already enforces staff roles on the server. These policies
-- make the database enforce the same rules for any staff session token, so
-- a workshop login cannot read customer contacts and only finance roles can
-- open invoice documents, even when calling Supabase directly.
--
-- Safe for existing flows: every database function that touches customers is
-- SECURITY DEFINER, and the application reads these tables with the server
-- key, which bypasses RLS.

begin;

create or replace function public.staff_can_view_customers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() in ('owner', 'manager', 'sales'), false);
$$;

revoke all on function public.staff_can_view_customers() from public, anon;
grant execute on function public.staff_can_view_customers() to authenticated, service_role;

drop policy if exists "admins manage customers" on public.customers;
drop policy if exists "customer staff manage customers" on public.customers;
create policy "customer staff manage customers" on public.customers for all to authenticated
  using (public.staff_can_view_customers()) with check (public.staff_can_view_customers());

-- Customer vehicles carry registrations; same audience as customer contacts.
drop policy if exists "admins manage vehicles" on public.vehicles;
drop policy if exists "customer staff manage vehicles" on public.vehicles;
create policy "customer staff manage vehicles" on public.vehicles for all to authenticated
  using (public.staff_can_view_customers()) with check (public.staff_can_view_customers());

-- Private documents: purchase and sale invoices show what SOB paid or was
-- paid, so only finance roles may read them. Other documents and seller
-- photos stay readable by all staff (workshop needs them for inspections).
drop policy if exists "admins read exchange private files" on storage.objects;
drop policy if exists "staff read seller photos" on storage.objects;
create policy "staff read seller photos" on storage.objects for select to authenticated
  using (bucket_id = 'seller-submission-photos' and public.is_admin());
drop policy if exists "staff read permitted vehicle documents" on storage.objects;
create policy "staff read permitted vehicle documents" on storage.objects for select to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.is_admin()
    and (
      public.staff_can_view_finance()
      or not exists (
        select 1 from public.vehicle_documents document
        where document.object_path = storage.objects.name
          and document.kind in ('purchase_invoice', 'sale_invoice')
      )
    )
  );

drop policy if exists "admins manage vehicle documents" on public.vehicle_documents;
drop policy if exists "staff manage permitted vehicle documents" on public.vehicle_documents;
create policy "staff manage permitted vehicle documents" on public.vehicle_documents for all to authenticated
  using (public.is_admin() and (public.staff_can_view_finance() or kind not in ('purchase_invoice', 'sale_invoice')))
  with check (public.is_admin() and (public.staff_can_view_finance() or kind not in ('purchase_invoice', 'sale_invoice')));

commit;
