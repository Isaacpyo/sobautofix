-- Require AAL2 for database admin access once the administrator has a verified MFA factor.
-- Accounts without an enrolled factor continue to work at AAL1 so enrollment remains opt-in.
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
      and lower(coalesce(auth_user.email, '')) = 'sobautofix@gmail.com'
      and (
        coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        or not exists (
          select 1
          from auth.mfa_factors factor
          where factor.user_id = auth.uid()
            and factor.status = 'verified'
        )
      )
  );
$$;
