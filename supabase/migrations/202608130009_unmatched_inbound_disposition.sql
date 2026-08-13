begin;

alter table public.unmatched_inbound_emails
  add column if not exists ignored_at timestamptz,
  add column if not exists ignored_by uuid references auth.users(id);

alter table public.unmatched_inbound_emails
  add constraint unmatched_inbound_ignore_coherence
  check (
    (ignored_at is null and ignored_by is null)
    or (ignored_at is not null and ignored_by is not null)
  );

create index if not exists unmatched_inbound_email_review_queue_idx
  on public.unmatched_inbound_emails (created_at desc)
  where linked_enquiry_id is null and ignored_at is null;

commit;
