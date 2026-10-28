-- SOB Auto Exchange, part 3: lifecycle records required by the delivery brief.
-- Additive and idempotent, like parts 1 and 2. Existing code ignores it.
--
-- * seller_offers keeps every provisional, revised and final offer with its
--   amount, conditions, expiry and decision, instead of overwriting fields.
-- * Handover checklist on vehicle_sales, completed explicitly.
-- * Diary conflict overrides record who overrode and why.
-- * Bounded notification retries for enquiries.
-- * sale_vehicles.purchased_from_submission_id: at most one stock record per
--   purchased seller submission (no duplicates).

begin;

create table if not exists public.seller_offers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.seller_submissions(id) on delete cascade,
  stage text not null check (stage in ('provisional', 'final', 'revised')),
  amount_pence integer not null check (amount_pence >= 0),
  conditions text,
  expires_on date,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'withdrawn', 'expired', 'superseded')),
  decision_note text,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists seller_offers_submission_idx on public.seller_offers (submission_id, created_at desc);
-- Only one open offer per submission at a time; a new offer supersedes it.
create unique index if not exists seller_offers_one_open_idx on public.seller_offers (submission_id) where status = 'open';

-- Carry existing single-field offers into the history (no-op on a new database).
insert into public.seller_offers (submission_id, stage, amount_pence, expires_on, status, created_at)
select id, 'provisional', provisional_offer_pence, provisional_offer_expires_on,
       case when final_offer_pence is not null then 'superseded' when offer_accepted_at is not null then 'accepted' else 'open' end,
       updated_at
from public.seller_submissions submission
where provisional_offer_pence is not null
  and not exists (select 1 from public.seller_offers offer where offer.submission_id = submission.id);
insert into public.seller_offers (submission_id, stage, amount_pence, expires_on, status, created_at)
select id, 'final', final_offer_pence, final_offer_expires_on,
       case when offer_accepted_at is not null then 'accepted' else 'open' end,
       updated_at
from public.seller_submissions submission
where final_offer_pence is not null
  and not exists (select 1 from public.seller_offers offer where offer.submission_id = submission.id and offer.stage = 'final');

alter table public.sale_vehicles add column if not exists purchased_from_submission_id uuid references public.seller_submissions(id) on delete set null;
create unique index if not exists sale_vehicles_purchased_from_submission_key
  on public.sale_vehicles (purchased_from_submission_id) where purchased_from_submission_id is not null;

-- Handover checklist: [{ "label": text, "done": bool, "doneBy": uuid, "doneAt": timestamptz }]
alter table public.vehicle_sales add column if not exists handover_checklist jsonb not null default '[]'::jsonb;
alter table public.vehicle_sales drop constraint if exists vehicle_sales_handover_checklist_array;
alter table public.vehicle_sales add constraint vehicle_sales_handover_checklist_array check (jsonb_typeof(handover_checklist) = 'array');
alter table public.vehicle_sales add column if not exists completed_by uuid references auth.users(id) on delete set null;

alter table public.diary_appointments
  add column if not exists conflict_override_reason text,
  add column if not exists conflict_override_by uuid references auth.users(id) on delete set null,
  add column if not exists conflict_override_at timestamptz,
  add column if not exists duration_minutes integer generated always as ((extract(epoch from (ends_at - starts_at)) / 60)::integer) stored;

alter table public.enquiries
  add column if not exists notification_attempt_count integer not null default 0,
  add column if not exists notification_next_retry_at timestamptz;
create index if not exists enquiries_notification_retry_idx
  on public.enquiries (notification_next_retry_at)
  where notification_status = 'failed' and notification_next_retry_at is not null;

alter table public.seller_offers enable row level security;
revoke all on table public.seller_offers from anon;
grant select, insert, update, delete on table public.seller_offers to authenticated, service_role;
drop policy if exists "admins manage seller offers" on public.seller_offers;
create policy "admins manage seller offers" on public.seller_offers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

commit;
