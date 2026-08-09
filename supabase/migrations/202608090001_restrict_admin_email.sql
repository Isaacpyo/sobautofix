do $$
begin
  if exists (
    select 1
    from public.admin_profiles profile
    join auth.users auth_user on auth_user.id = profile.user_id
    where lower(coalesce(auth_user.email, '')) <> 'sobautofix@gmail.com'
  ) then
    raise exception 'A non-authorised admin profile exists; review it before applying this migration.';
  end if;
end;
$$;

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
  );
$$;

create or replace function public.enforce_single_admin_email()
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
      and lower(coalesce(auth_user.email, '')) = 'sobautofix@gmail.com'
  ) then
    raise exception 'Only the authorised SOB Autofix email can be granted administrator access.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_single_admin_email() from public, anon, authenticated;

drop trigger if exists enforce_single_admin_email on public.admin_profiles;
create trigger enforce_single_admin_email
before insert or update of user_id on public.admin_profiles
for each row execute function public.enforce_single_admin_email();
