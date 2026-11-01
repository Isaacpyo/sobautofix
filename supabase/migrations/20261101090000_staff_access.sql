-- Staff & access: who may sign in to the admin moves from a hard-coded email
-- list to admin_profiles, managed by owners from /admin/staff.
--
-- * admin_profiles gains the staff member's email and access-removal fields.
--   A profile with access_removed_at set no longer counts as an administrator
--   (is_admin(), and so current_staff_role() and every RLS policy built on it).
-- * Profiles are written only by the server (service role) after an owner check;
--   authenticated administrators may read them but no longer insert, update or
--   delete them directly (previously any administrator could, which would have
--   let a non-owner raise their own role).
-- * Invoices follow the finance rule used elsewhere: owner and manager only.
--
-- Additive and idempotent. The existing administrators keep their access.

begin;

alter table public.admin_profiles add column if not exists email text;
alter table public.admin_profiles add column if not exists invited_by uuid references auth.users(id) on delete set null;
alter table public.admin_profiles add column if not exists invited_at timestamptz;
alter table public.admin_profiles add column if not exists access_removed_at timestamptz;
alter table public.admin_profiles add column if not exists access_removed_by uuid references auth.users(id) on delete set null;
alter table public.admin_profiles add column if not exists updated_at timestamptz not null default now();

update public.admin_profiles profile
set email = lower(auth_user.email)
from auth.users auth_user
where auth_user.id = profile.user_id
  and profile.email is null
  and auth_user.email is not null;

alter table public.admin_profiles drop constraint if exists admin_profiles_email_lowercase;
alter table public.admin_profiles add constraint admin_profiles_email_lowercase
  check (email is null or email = lower(btrim(email)));

create unique index if not exists admin_profiles_email_key on public.admin_profiles (email) where email is not null;

-- Sign-in looks staff up by email, so a profile created without one (seed
-- scripts, SQL run by hand) takes its email from the auth account.
create or replace function public.fill_admin_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    select lower(btrim(auth_user.email)) into new.email from auth.users auth_user where auth_user.id = new.user_id;
  end if;
  return new;
end;
$$;
revoke all on function public.fill_admin_profile_email() from public, anon, authenticated;

drop trigger if exists fill_admin_profile_email on public.admin_profiles;
create trigger fill_admin_profile_email
  before insert on public.admin_profiles
  for each row execute function public.fill_admin_profile_email();

-- The email list in the trigger and in is_admin() is replaced by the profile
-- itself: only the server can create profiles, after an owner has invited them.
drop trigger if exists enforce_allowed_admin_email on public.admin_profiles;
drop function if exists public.enforce_allowed_admin_email();

-- Same MFA rules as before (20260926213537), with the email list replaced by
-- an active-profile check.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles profile
    where profile.user_id = auth.uid()
      and profile.access_removed_at is null
      and (
        (
          exists (
            select 1
            from auth.mfa_factors factor
            where factor.user_id = auth.uid()
              and factor.status = 'verified'
              and factor.factor_type = 'totp'
          )
          and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        )
        or (
          not exists (
            select 1
            from auth.mfa_factors factor
            where factor.user_id = auth.uid()
              and factor.status = 'verified'
              and factor.factor_type = 'totp'
          )
          and not coalesce((
            select mandatory_mfa_enabled
            from public.admin_mfa_policy
            where singleton
          ), false)
        )
      )
  );
$$;

-- Profiles: administrators read, the server writes.
drop policy if exists "admins manage profiles" on public.admin_profiles;
drop policy if exists "admins read profiles" on public.admin_profiles;
create policy "admins read profiles" on public.admin_profiles
  for select to authenticated using ((select public.is_admin()));

revoke insert, update, delete on table public.admin_profiles from public, anon, authenticated;
grant select on table public.admin_profiles to authenticated;
grant select, insert, update, delete on table public.admin_profiles to service_role;

-- Invoices: finance roles only (owner, manager), for reads and for the
-- invoice RPCs, which all check require_invoice_actor().
drop policy if exists "admins read invoices" on public.invoices;
create policy "admins read invoices" on public.invoices
  for select to authenticated using ((select public.staff_can_view_finance()));

drop policy if exists "admins read invoice items" on public.invoice_items;
create policy "admins read invoice items" on public.invoice_items
  for select to authenticated using ((select public.staff_can_view_finance()));

drop policy if exists "admins read invoice email sends" on public.invoice_email_sends;
create policy "admins read invoice email sends" on public.invoice_email_sends
  for select to authenticated using ((select public.staff_can_view_finance()));

drop policy if exists "admins read invoice email attempts" on public.invoice_email_attempts;
create policy "admins read invoice email attempts" on public.invoice_email_attempts
  for select to authenticated using ((select public.staff_can_view_finance()));

drop policy if exists "admins read invoice payments" on public.invoice_payments;
create policy "admins read invoice payments" on public.invoice_payments
  for select to authenticated using ((select public.staff_can_view_finance()));

create or replace function public.require_invoice_actor()
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
     or not public.is_admin()
     or not public.staff_can_view_finance() then
    raise exception 'UNAUTHORISED' using errcode = '42501';
  end if;
  return actor_id;
end
$$;

revoke all on function public.require_invoice_actor() from public, anon, authenticated, service_role;

commit;
