-- Staff users are intentionally not created here. Invite a user through
-- Supabase Auth, then explicitly grant access:
-- insert into public.admin_profiles (user_id, display_name)
-- values ('<auth-user-uuid>', '<staff display name>');

insert into public.offers (title, description, active)
values (
  'Full Service + Comprehensive Module Diagnostic Scan',
  'Book a full service and receive a computerized diagnostic scan of vehicle modules.',
  true
)
on conflict do nothing;
