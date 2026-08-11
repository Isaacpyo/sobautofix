alter table public.enquiry_messages
  drop constraint if exists enquiry_messages_provider_check;

alter table public.enquiry_messages
  add constraint enquiry_messages_provider_check
  check (provider is null or provider in ('resend', 'cloudflare'));

alter table public.unmatched_inbound_emails
  add column if not exists provider text not null default 'resend';

alter table public.unmatched_inbound_emails
  drop constraint if exists unmatched_inbound_emails_provider_check;

alter table public.unmatched_inbound_emails
  add constraint unmatched_inbound_emails_provider_check
  check (provider in ('resend', 'cloudflare'));

create table if not exists public.inbound_email_events (
  transport text not null check (transport = 'cloudflare'),
  event_id text not null,
  raw_digest text not null check (raw_digest ~ '^[a-f0-9]{64}$'),
  processing_status text not null default 'processing' check (processing_status in ('processing', 'processed', 'ignored', 'failed')),
  error_code text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (transport, event_id)
);

alter table public.inbound_email_events enable row level security;

drop policy if exists "admins read inbound email events" on public.inbound_email_events;
create policy "admins read inbound email events"
on public.inbound_email_events for select to authenticated
using (public.is_admin());

create or replace function public.claim_inbound_email_event(
  transport_name text,
  transport_event_id text,
  mime_digest text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer;
begin
  if transport_name <> 'cloudflare' or mime_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid inbound email event';
  end if;

  insert into public.inbound_email_events (transport, event_id, raw_digest)
  values (transport_name, transport_event_id, mime_digest)
  on conflict (transport, event_id) do update
  set processing_status = 'processing',
      raw_digest = excluded.raw_digest,
      error_code = null,
      received_at = now(),
      processed_at = null
  where public.inbound_email_events.processing_status = 'failed'
     or (
       public.inbound_email_events.processing_status = 'processing'
       and public.inbound_email_events.received_at < now() - interval '15 minutes'
     );

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create or replace function public.finish_inbound_email_event(
  transport_name text,
  transport_event_id text,
  final_status text,
  final_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if final_status not in ('processed', 'ignored', 'failed') then
    raise exception 'Invalid inbound email event status';
  end if;

  update public.inbound_email_events
  set processing_status = final_status,
      error_code = final_error_code,
      processed_at = now()
  where transport = transport_name
    and event_id = transport_event_id;
end;
$$;

create or replace function public.store_inbound_email_message(
  target_enquiry_id uuid,
  transport_name text,
  transport_event_id text,
  sender_name_value text,
  sender_email_value text,
  recipient_email_value text,
  subject_value text,
  text_body_value text,
  rfc_message_id text,
  reply_to_message_id text,
  reference_id_values text[],
  message_created_at timestamptz,
  match_reason text
)
returns table(stored_message_id uuid, was_inserted boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message_id uuid;
begin
  if transport_name not in ('resend', 'cloudflare') then
    raise exception 'Invalid inbound email transport';
  end if;

  insert into public.enquiry_messages (
    enquiry_id,
    direction,
    message_type,
    sender_name,
    sender_email,
    recipient_email,
    subject,
    text_body,
    provider,
    provider_email_id,
    message_id,
    in_reply_to,
    reference_ids,
    delivery_status,
    is_read,
    created_at
  ) values (
    target_enquiry_id,
    'inbound',
    'email',
    sender_name_value,
    sender_email_value,
    recipient_email_value,
    subject_value,
    text_body_value,
    transport_name,
    transport_event_id,
    rfc_message_id,
    reply_to_message_id,
    coalesce(reference_id_values, '{}'),
    'received',
    false,
    message_created_at
  )
  on conflict do nothing
  returning id into new_message_id;

  if new_message_id is null then
    select id into new_message_id
    from public.enquiry_messages
    where provider_email_id = transport_event_id
       or (rfc_message_id is not null and message_id = rfc_message_id)
    order by created_at
    limit 1;

    return query select new_message_id, false;
    return;
  end if;

  update public.enquiry_conversations
  set unread_count = unread_count + 1,
      last_activity_at = greatest(last_activity_at, message_created_at)
  where enquiry_id = target_enquiry_id;

  update public.enquiries
  set status = 'contacted'
  where id = target_enquiry_id
    and status <> 'closed';

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    null,
    'enquiry.reply_received',
    'enquiry_message',
    new_message_id::text,
    jsonb_build_object('enquiryId', target_enquiry_id, 'match', match_reason, 'transport', transport_name)
  );

  return query select new_message_id, true;
end;
$$;

revoke all on function public.claim_inbound_email_event(text, text, text) from public, anon, authenticated;
revoke all on function public.finish_inbound_email_event(text, text, text, text) from public, anon, authenticated;
revoke all on function public.store_inbound_email_message(uuid, text, text, text, text, text, text, text, text, text, text[], timestamptz, text) from public, anon, authenticated;

grant execute on function public.claim_inbound_email_event(text, text, text) to service_role;
grant execute on function public.finish_inbound_email_event(text, text, text, text) to service_role;
grant execute on function public.store_inbound_email_message(uuid, text, text, text, text, text, text, text, text, text, text[], timestamptz, text) to service_role;
