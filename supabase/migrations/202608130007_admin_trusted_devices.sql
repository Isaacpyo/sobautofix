create table public.admin_trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) = 64),
  device_label text not null check (char_length(device_label) between 1 and 160),
  user_agent_summary text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint admin_trusted_devices_expiry check (expires_at > created_at)
);

create index admin_trusted_devices_user_active_idx
  on public.admin_trusted_devices (user_id, expires_at)
  where revoked_at is null;

alter table public.admin_trusted_devices enable row level security;

revoke all on table public.admin_trusted_devices from public, anon, authenticated;
grant select, insert, update, delete on table public.admin_trusted_devices to service_role;

comment on table public.admin_trusted_devices is
  'Server-only, hashed browser credentials that may suppress the ordinary admin TOTP prompt for seven days. They never confer Supabase AAL2.';

