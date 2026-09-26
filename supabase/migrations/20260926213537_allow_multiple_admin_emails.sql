begin;

do $$
begin
  if exists (
    select 1
    from public.admin_profiles profile
    join auth.users auth_user on auth_user.id = profile.user_id
    where lower(coalesce(auth_user.email, '')) not in (
      'sobautofix@gmail.com',
      'temitopeagbola@gmail.com'
    )
  ) then
    raise exception 'A non-authorised admin profile exists; review it before applying this migration.';
  end if;
end;
$$;

-- Preserve the existing per-user MFA enforcement while allowing either
-- explicitly approved administrator identity.
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
    join auth.users auth_user on auth_user.id = profile.user_id
    where profile.user_id = auth.uid()
      and lower(coalesce(auth_user.email, '')) in (
        'sobautofix@gmail.com',
        'temitopeagbola@gmail.com'
      )
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

create or replace function public.enforce_allowed_admin_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = new.user_id
      and lower(coalesce(auth_user.email, '')) in (
        'sobautofix@gmail.com',
        'temitopeagbola@gmail.com'
      )
  ) then
    raise exception 'Only an authorised SOB Autofix email can be granted administrator access.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_allowed_admin_email() from public, anon, authenticated;

drop trigger if exists enforce_single_admin_email on public.admin_profiles;
drop trigger if exists enforce_allowed_admin_email on public.admin_profiles;
create trigger enforce_allowed_admin_email
before insert or update of user_id on public.admin_profiles
for each row execute function public.enforce_allowed_admin_email();

drop function if exists public.enforce_single_admin_email();

-- Provision profiles idempotently when either Auth user already exists. If an
-- invitation is sent after deployment, run the equivalent statement from the
-- documented staff-access procedure once Supabase has created the Auth user.
insert into public.admin_profiles (user_id, display_name)
select
  auth_user.id,
  case lower(auth_user.email)
    when 'sobautofix@gmail.com' then 'SOB Autofix Admin'
    when 'temitopeagbola@gmail.com' then 'Temitope Agbola'
  end
from auth.users auth_user
where lower(coalesce(auth_user.email, '')) in (
  'sobautofix@gmail.com',
  'temitopeagbola@gmail.com'
)
on conflict (user_id) do nothing;

commit;
