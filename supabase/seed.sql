-- Staff users and passwords are intentionally not created here. Create or
-- invite each authorised user through Supabase Auth, then explicitly grant access:
-- insert into public.admin_profiles (user_id, display_name)
-- select id,
--   case lower(email)
--     when 'sobautofix@gmail.com' then 'SOB Autofix Admin'
--     when 'temitopeagbola@gmail.com' then 'Temitope Agbola'
--   end
-- from auth.users
-- where lower(email) in ('sobautofix@gmail.com', 'temitopeagbola@gmail.com')
-- on conflict (user_id) do update set display_name = excluded.display_name;

insert into public.offers (title, description, active)
values (
  'Full Service + Comprehensive Module Diagnostic Scan',
  'Book a full service and receive a computerized diagnostic scan of vehicle modules.',
  true
)
on conflict do nothing;
