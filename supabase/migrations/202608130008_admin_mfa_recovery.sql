-- Server-only administrator MFA recovery codes and short-lived replacement capabilities.
-- Mandatory MFA remains disabled by default so deploying this migration cannot lock out
-- the sole production administrator before TOTP enrollment and recovery-code handoff.

create table public.admin_mfa_policy (
  singleton boolean primary key default true check (singleton),
  mandatory_mfa_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.admin_mfa_policy (singleton, mandatory_mfa_enabled)
values (true, false)
on conflict (singleton) do nothing;

create table public.admin_mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  set_id uuid not null,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz,
  check (used_at is null or used_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  unique (user_id, code_hash)
);

create index admin_mfa_recovery_codes_active_idx
  on public.admin_mfa_recovery_codes (user_id, created_at)
  where used_at is null and revoked_at is null;

create table public.admin_mfa_recovery_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recovery_code_id uuid not null unique references public.admin_mfa_recovery_codes(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  old_factor_ids uuid[] not null check (cardinality(old_factor_ids) > 0),
  new_factor_id uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz,
  completed_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (completed_at is null or (verified_at is not null and new_factor_id is not null))
);

create index admin_mfa_recovery_sessions_active_idx
  on public.admin_mfa_recovery_sessions (user_id, expires_at)
  where completed_at is null and revoked_at is null;

alter table public.admin_mfa_policy enable row level security;
alter table public.admin_mfa_recovery_codes enable row level security;
alter table public.admin_mfa_recovery_sessions enable row level security;

revoke all on table public.admin_mfa_policy from public, anon, authenticated;
revoke all on table public.admin_mfa_recovery_codes from public, anon, authenticated;
revoke all on table public.admin_mfa_recovery_sessions from public, anon, authenticated;

grant select, update on table public.admin_mfa_policy to service_role;
grant select, insert, update, delete on table public.admin_mfa_recovery_codes to service_role;
grant select, insert, update, delete on table public.admin_mfa_recovery_sessions to service_role;

comment on table public.admin_mfa_recovery_codes is
  'Server-only hashes of high-entropy, single-use administrator MFA recovery codes. Plaintext codes are never persisted.';
comment on table public.admin_mfa_recovery_sessions is
  'Short-lived server-only capabilities limited to replacing a lost verified TOTP factor.';
comment on table public.admin_mfa_policy is
  'Server-only rollout switch. Enable mandatory MFA only after the sole administrator has verified TOTP and saved recovery codes.';

create or replace function public.replace_admin_mfa_recovery_codes(
  p_user_id uuid,
  p_code_hashes text[],
  p_event_action text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_set_id uuid := gen_random_uuid();
  l_inserted integer;
  l_revoked_devices integer;
begin
  if p_event_action not in ('mfa_recovery_codes_created', 'mfa_recovery_codes_regenerated') then
    raise exception 'INVALID_RECOVERY_CODE_EVENT';
  end if;
  if cardinality(p_code_hashes) <> 10
     or (select count(distinct value) from unnest(p_code_hashes) as hashes(value)) <> 10
     or exists (select 1 from unnest(p_code_hashes) as hashes(value) where value !~ '^[0-9a-f]{64}$') then
    raise exception 'INVALID_RECOVERY_CODE_SET';
  end if;
  if not exists (select 1 from public.admin_profiles where user_id = p_user_id)
     or not exists (select 1 from auth.mfa_factors where user_id = p_user_id and status = 'verified' and factor_type = 'totp') then
    raise exception 'RECOVERY_CODES_REQUIRE_VERIFIED_ADMIN_TOTP';
  end if;

  update public.admin_mfa_recovery_codes
  set revoked_at = now()
  where user_id = p_user_id and used_at is null and revoked_at is null;

  update public.admin_mfa_recovery_sessions
  set revoked_at = now()
  where user_id = p_user_id and completed_at is null and revoked_at is null;

  update public.admin_trusted_devices
  set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;
  get diagnostics l_revoked_devices = row_count;

  insert into public.admin_mfa_recovery_codes (user_id, set_id, code_hash)
  select p_user_id, l_set_id, value
  from unnest(p_code_hashes) with ordinality as hashes(value, position)
  order by position;
  get diagnostics l_inserted = row_count;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    p_user_id,
    p_event_action,
    'admin_security',
    p_user_id::text,
    jsonb_build_object('count', l_inserted, 'setId', l_set_id)
  );
  if l_revoked_devices > 0 then
    insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
    values (p_user_id, 'trusted_devices_revoked', 'admin_security', p_user_id::text, jsonb_build_object('reason', p_event_action, 'count', l_revoked_devices));
  end if;
  return l_inserted;
end;
$$;

create or replace function public.consume_admin_mfa_recovery_code(
  p_user_id uuid,
  p_code_hash text,
  p_session_token_hash text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  l_code_id uuid;
  l_factor_ids uuid[];
  l_revoked_devices integer;
begin
  if p_code_hash !~ '^[0-9a-f]{64}$'
     or p_session_token_hash !~ '^[0-9a-f]{64}$'
     or p_expires_at <= now()
     or p_expires_at > now() + interval '20 minutes' then
    return false;
  end if;
  if not exists (select 1 from public.admin_profiles where user_id = p_user_id) then
    return false;
  end if;

  select array_agg(id order by created_at)
  into l_factor_ids
  from auth.mfa_factors
  where user_id = p_user_id and status = 'verified' and factor_type = 'totp';
  if coalesce(cardinality(l_factor_ids), 0) = 0 then
    return false;
  end if;

  -- One guarded UPDATE is the atomic single-use boundary. Concurrent callers
  -- cannot both satisfy used_at/revoked_at IS NULL for the same row.
  update public.admin_mfa_recovery_codes
  set used_at = now()
  where user_id = p_user_id
    and code_hash = p_code_hash
    and used_at is null
    and revoked_at is null
  returning id into l_code_id;
  if l_code_id is null then
    return false;
  end if;

  update public.admin_mfa_recovery_sessions
  set revoked_at = now()
  where user_id = p_user_id and completed_at is null and revoked_at is null;

  update public.admin_trusted_devices
  set revoked_at = now()
  where user_id = p_user_id and revoked_at is null;
  get diagnostics l_revoked_devices = row_count;

  insert into public.admin_mfa_recovery_sessions (
    user_id, recovery_code_id, token_hash, old_factor_ids, expires_at
  ) values (
    p_user_id, l_code_id, p_session_token_hash, l_factor_ids, p_expires_at
  );

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (p_user_id, 'mfa_recovery_code_used', 'admin_security', p_user_id::text, jsonb_build_object('recoveryCodeId', l_code_id));
  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (p_user_id, 'trusted_devices_revoked', 'admin_security', p_user_id::text, jsonb_build_object('reason', 'mfa_recovery_code_used', 'count', l_revoked_devices));
  return true;
end;
$$;

revoke all on function public.replace_admin_mfa_recovery_codes(uuid, text[], text) from public, anon, authenticated;
revoke all on function public.consume_admin_mfa_recovery_code(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.replace_admin_mfa_recovery_codes(uuid, text[], text) to service_role;
grant execute on function public.consume_admin_mfa_recovery_code(uuid, text, text, timestamptz) to service_role;

-- Database authorization follows the rollout switch. Enrolled administrators
-- always require a genuine AAL2 JWT; an unenrolled administrator is allowed only
-- while mandatory MFA remains disabled for the controlled rollout.
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
        (
          exists (
            select 1 from auth.mfa_factors factor
            where factor.user_id = auth.uid() and factor.status = 'verified' and factor.factor_type = 'totp'
          )
          and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        )
        or (
          not exists (
            select 1 from auth.mfa_factors factor
            where factor.user_id = auth.uid() and factor.status = 'verified' and factor.factor_type = 'totp'
          )
          and not coalesce((select mandatory_mfa_enabled from public.admin_mfa_policy where singleton), false)
        )
      )
  );
$$;
