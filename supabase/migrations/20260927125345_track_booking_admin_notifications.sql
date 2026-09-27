-- Keep a durable acknowledgement for newly created bookings. Historical
-- bookings are marked as reviewed, except for recent bookings that an admin
-- may still reasonably expect to see after this feature is deployed.
alter table public.bookings
  add column if not exists admin_seen_at timestamptz;

update public.bookings
set admin_seen_at = now()
where admin_seen_at is null
  and created_at < now() - interval '24 hours';

create index if not exists bookings_admin_unseen_idx
  on public.bookings (created_at desc)
  where admin_seen_at is null;

comment on column public.bookings.admin_seen_at is
  'When an administrator first opened this booking in the CMS; null means the new booking still needs review.';
