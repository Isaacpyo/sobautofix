-- Moving an invoice to or from the CMS trash is an administrative lifecycle
-- change, not an edit to its financial history. Keep every existing invoice
-- immutability rule while permitting only deleted_at/deleted_by to change.
do $$
declare
  function_definition text;
  insertion_marker constant text := '  if new.id is distinct from old.id';
  trash_guard constant text := $guard$
  if (
    new.deleted_at is distinct from old.deleted_at
    or new.deleted_by is distinct from old.deleted_by
  ) and (
    to_jsonb(new) - array['deleted_at', 'deleted_by']
  ) is not distinct from (
    to_jsonb(old) - array['deleted_at', 'deleted_by']
  ) then
    if (new.deleted_at is null) is distinct from (new.deleted_by is null) then
      raise exception 'INVALID_INVOICE_TRASH_STATE';
    end if;
    return new;
  end if;

$guard$;
begin
  select pg_get_functiondef('public.protect_invoice_history()'::regprocedure)
  into function_definition;

  if position(insertion_marker in function_definition) = 0 then
    raise exception 'Could not locate the invoice-history insertion point';
  end if;

  function_definition := replace(
    function_definition,
    insertion_marker,
    trash_guard || insertion_marker
  );

  execute function_definition;
end
$$;
