with changed as (
  update public.site_settings
  set value = value - 'openingHours',
      updated_at = now()
  where id = true
    and value ? 'openingHours'
  returning id
)
insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'correct_business_claim', 'site_settings', 'primary', jsonb_build_object(
  'field', 'openingHours',
  'reason', 'Unapproved hours removed pending confirmation'
)
from changed;
