create table if not exists public.enquiry_conversations (
  enquiry_id uuid primary key references public.enquiries(id) on delete cascade,
  reply_token uuid not null default gen_random_uuid() unique,
  subject text not null check (char_length(subject) between 3 and 180),
  unread_count integer not null default 0 check (unread_count >= 0),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.enquiry_messages (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  message_type text not null check (message_type in ('website_enquiry', 'email', 'internal_note', 'automatic_confirmation')),
  sender_name text,
  sender_email text,
  recipient_email text,
  subject text not null check (char_length(subject) between 3 and 180),
  text_body text not null check (char_length(text_body) between 1 and 50000),
  provider text check (provider is null or provider = 'resend'),
  provider_email_id text,
  message_id text,
  in_reply_to text,
  reference_ids text[] not null default '{}',
  delivery_status text not null default 'received' check (delivery_status in ('sending', 'sent', 'delivered', 'failed', 'bounced', 'received', 'note')),
  is_read boolean not null default true,
  client_request_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index if not exists enquiry_messages_provider_email_id_unique on public.enquiry_messages(provider_email_id) where provider_email_id is not null;
create unique index if not exists enquiry_messages_message_id_unique on public.enquiry_messages(message_id) where message_id is not null;
create unique index if not exists enquiry_messages_client_request_unique on public.enquiry_messages(enquiry_id, client_request_id) where client_request_id is not null;
create index if not exists enquiry_messages_thread_order on public.enquiry_messages(enquiry_id, created_at, id);

alter table public.enquiry_attachments
  add column if not exists enquiry_message_id uuid references public.enquiry_messages(id) on delete set null;
create index if not exists enquiry_attachments_message on public.enquiry_attachments(enquiry_message_id) where enquiry_message_id is not null;

create table if not exists public.resend_webhook_events (
  svix_id text primary key,
  event_type text not null,
  provider_email_id text,
  processing_status text not null default 'processing' check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.unmatched_inbound_emails (
  id uuid primary key default gen_random_uuid(),
  provider_email_id text not null unique,
  message_id text,
  sender_email text not null,
  recipient_emails text[] not null default '{}',
  subject text not null,
  text_body text not null check (char_length(text_body) between 1 and 50000),
  in_reply_to text,
  reference_ids text[] not null default '{}',
  reason text not null,
  linked_enquiry_id uuid references public.enquiries(id) on delete set null,
  created_at timestamptz not null default now(),
  linked_at timestamptz
);

insert into public.enquiry_conversations (enquiry_id, subject, last_activity_at)
select e.id, 'Re: Your SOB Autofix ' || replace(e.type::text, '_', ' ') || ' enquiry', e.updated_at
from public.enquiries e
on conflict (enquiry_id) do nothing;

alter table public.enquiry_conversations enable row level security;
alter table public.enquiry_messages enable row level security;
alter table public.resend_webhook_events enable row level security;
alter table public.unmatched_inbound_emails enable row level security;

drop policy if exists "admins manage enquiry conversations" on public.enquiry_conversations;
create policy "admins manage enquiry conversations" on public.enquiry_conversations for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins manage enquiry messages" on public.enquiry_messages;
create policy "admins manage enquiry messages" on public.enquiry_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins read resend webhook events" on public.resend_webhook_events;
create policy "admins read resend webhook events" on public.resend_webhook_events for select to authenticated using (public.is_admin());
drop policy if exists "admins manage unmatched inbound" on public.unmatched_inbound_emails;
create policy "admins manage unmatched inbound" on public.unmatched_inbound_emails for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.increment_enquiry_unread(target_enquiry_id uuid, activity_at timestamptz)
returns void
language sql
security definer
set search_path = public
as $$
  update public.enquiry_conversations
  set unread_count = unread_count + 1,
      last_activity_at = greatest(last_activity_at, activity_at)
  where enquiry_id = target_enquiry_id;
$$;

revoke all on function public.increment_enquiry_unread(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.increment_enquiry_unread(uuid, timestamptz) to service_role;
