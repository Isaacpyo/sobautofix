with changed as (
  update public.site_settings
  set value = jsonb_set(value, '{whatsapp}', value -> 'phone', true),
      updated_at = now()
  where id = true
    and value ->> 'phone' is not null
    and value ->> 'whatsapp' is distinct from value ->> 'phone'
  returning id
)
insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
select null, 'update', 'site_settings', 'primary', jsonb_build_object(
  'field', 'whatsapp',
  'reason', 'WhatsApp approved to use the main phone number'
)
from changed;
