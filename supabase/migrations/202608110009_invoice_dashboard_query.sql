begin;

create function public.get_invoice_dashboard(
  p_query text,
  p_status text,
  p_date date,
  p_page integer,
  p_page_size integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  normalized_query text := lower(trim(coalesce(p_query, '')));
  normalized_registration text := upper(regexp_replace(coalesce(p_query, ''), '[^A-Za-z0-9]', '', 'g'));
  matching_count bigint;
  page_count integer;
  effective_page integer;
  page_rows jsonb;
  draft_count bigint;
  outstanding_count bigint;
  paid_count bigint;
  outstanding_total numeric;
begin
  if length(normalized_query) > 200 then
    raise exception 'INVALID_INVOICE_SEARCH_QUERY';
  end if;
  if p_status is not null and p_status not in ('draft', 'issued', 'paid', 'void') then
    raise exception 'INVALID_INVOICE_STATUS';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size not between 1 and 100 then
    raise exception 'INVALID_INVOICE_PAGE';
  end if;

  select count(*)
  into matching_count
  from public.invoices invoice
  where (p_status is null or invoice.status::text = p_status)
    and (
      p_date is null
      or invoice.issue_date = p_date
      or (invoice.created_at at time zone 'UTC')::date = p_date
    )
    and (
      normalized_query = ''
      or position(normalized_query in lower(concat_ws(
        ' ',
        invoice.invoice_number,
        invoice.customer_name,
        invoice.customer_email,
        invoice.customer_phone,
        invoice.vehicle_registration,
        invoice.vehicle_make,
        invoice.vehicle_model
      ))) > 0
      or (
        length(normalized_registration) >= 2
        and position(normalized_registration in coalesce(invoice.vehicle_registration, '')) > 0
      )
    );

  page_count := greatest(1, ceil(matching_count::numeric / p_page_size)::integer);
  effective_page := least(p_page, page_count);

  select coalesce(jsonb_agg(to_jsonb(invoice_page) order by invoice_page.created_at desc, invoice_page.id desc), '[]'::jsonb)
  into page_rows
  from (
    select
      invoice.id,
      invoice.invoice_number,
      invoice.status,
      invoice.source_type,
      invoice.customer_name,
      invoice.customer_email,
      invoice.customer_phone,
      invoice.vehicle_registration,
      invoice.vehicle_make,
      invoice.vehicle_model,
      invoice.issue_date,
      invoice.due_date,
      invoice.total_pence,
      invoice.created_at
    from public.invoices invoice
    where (p_status is null or invoice.status::text = p_status)
      and (
        p_date is null
        or invoice.issue_date = p_date
        or (invoice.created_at at time zone 'UTC')::date = p_date
      )
      and (
        normalized_query = ''
        or position(normalized_query in lower(concat_ws(
          ' ',
          invoice.invoice_number,
          invoice.customer_name,
          invoice.customer_email,
          invoice.customer_phone,
          invoice.vehicle_registration,
          invoice.vehicle_make,
          invoice.vehicle_model
        ))) > 0
        or (
          length(normalized_registration) >= 2
          and position(normalized_registration in coalesce(invoice.vehicle_registration, '')) > 0
        )
      )
    order by invoice.created_at desc, invoice.id desc
    offset (effective_page - 1) * p_page_size
    limit p_page_size
  ) invoice_page;

  select
    count(*) filter (where invoice.status = 'draft'),
    count(*) filter (where invoice.status = 'issued'),
    count(*) filter (where invoice.status = 'paid'),
    coalesce(sum(invoice.total_pence) filter (where invoice.status = 'issued'), 0)
  into draft_count, outstanding_count, paid_count, outstanding_total
  from public.invoices invoice;

  return jsonb_build_object(
    'invoices', page_rows,
    'matching_count', matching_count::text,
    'page', effective_page,
    'pages', page_count,
    'draft_count', draft_count::text,
    'outstanding_count', outstanding_count::text,
    'paid_count', paid_count::text,
    'outstanding_total_pence', outstanding_total::text
  );
end
$$;

revoke all on function public.get_invoice_dashboard(text,text,date,integer,integer)
from public, anon, authenticated, service_role;

grant execute on function public.get_invoice_dashboard(text,text,date,integer,integer)
to authenticated;

commit;
