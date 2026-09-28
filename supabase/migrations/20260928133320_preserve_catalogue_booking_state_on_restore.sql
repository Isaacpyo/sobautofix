-- Soft deletion already makes catalogue rows unavailable through every read
-- path. Preserve each service's online-booking preference so restoring it (or
-- its parent system) returns the exact pre-trash configuration.
do $$
declare
  function_definition text;
  old_fragment constant text := $fragment$
    if p_entity = 'catalogue_services' then
      update public.booking_service_types set online_booking_enabled = false where id = any(p_ids);
    elsif p_entity = 'catalogue_systems' then
      update public.booking_service_types set online_booking_enabled = false where system_id = any(p_ids);
    end if;
$fragment$;
begin
  select pg_get_functiondef('public.manage_admin_trash(text,uuid[],text)'::regprocedure)
  into function_definition;

  if position(old_fragment in function_definition) = 0 then
    raise exception 'Could not locate the catalogue trash-state fragment';
  end if;

  execute replace(function_definition, old_fragment, '');
end
$$;
