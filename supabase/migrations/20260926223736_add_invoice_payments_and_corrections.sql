begin;

create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id),
  amount_pence bigint not null check (amount_pence between 1 and 9007199254740991),
  paid_at timestamptz not null,
  payment_method text not null check (payment_method in ('cash', 'card', 'bank_transfer', 'other')),
  payment_reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_paid_idx
on public.invoice_payments (invoice_id, paid_at, created_at);

create index invoice_payments_created_by_idx
on public.invoice_payments (created_by);

alter table public.invoice_payments enable row level security;

create policy "admins read invoice payments"
on public.invoice_payments for select to authenticated
using ((select public.is_admin()));

revoke all on table public.invoice_payments from public, anon, authenticated, service_role;
grant select on table public.invoice_payments to authenticated, service_role;

create function public.record_invoice_payment(
  p_invoice_id uuid,
  p_amount_pence bigint,
  p_paid_at timestamptz,
  p_method text,
  p_reference text
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  current_invoice public.invoices%rowtype;
  normalized_method text;
  already_paid bigint;
  outstanding bigint;
begin
  if p_paid_at is null then
    raise exception 'PAYMENT_DATE_REQUIRED';
  end if;
  normalized_method := lower(trim(p_method));
  if p_method is null or normalized_method not in ('cash', 'card', 'bank_transfer', 'other') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if p_amount_pence is null or p_amount_pence <= 0 then
    raise exception 'INVALID_PAYMENT_AMOUNT';
  end if;

  select invoice.*
  into current_invoice
  from public.invoices invoice
  where invoice.id = p_invoice_id
    and invoice.status = 'issued'
  for update;
  if not found then
    raise exception 'ISSUED_INVOICE_NOT_FOUND';
  end if;
  if exists (
    select 1
    from public.invoice_email_sends email_send
    where email_send.invoice_id = p_invoice_id
      and email_send.status = 'pending'
  ) then
    raise exception 'INVOICE_EMAIL_SEND_IN_PROGRESS';
  end if;

  select coalesce(sum(payment.amount_pence), 0)
  into already_paid
  from public.invoice_payments payment
  where payment.invoice_id = p_invoice_id;
  outstanding := current_invoice.total_pence - already_paid;
  if p_amount_pence > outstanding then
    raise exception 'PAYMENT_EXCEEDS_BALANCE';
  end if;

  insert into public.invoice_payments (
    invoice_id,
    amount_pence,
    paid_at,
    payment_method,
    payment_reference,
    created_by
  ) values (
    p_invoice_id,
    p_amount_pence,
    p_paid_at,
    normalized_method,
    nullif(trim(p_reference), ''),
    actor_id
  );

  if p_amount_pence = outstanding then
    update public.invoices
    set status = 'paid',
        paid_at = p_paid_at,
        payment_method = normalized_method,
        payment_reference = nullif(trim(p_reference), ''),
        updated_by = actor_id
    where id = p_invoice_id
      and status = 'issued'
    returning * into current_invoice;
  end if;

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (
    actor_id,
    case when p_amount_pence = outstanding then 'invoice.marked_paid' else 'invoice.part_payment_recorded' end,
    'invoice',
    p_invoice_id::text,
    jsonb_build_object(
      'amountPence', p_amount_pence,
      'amountPaidPence', already_paid + p_amount_pence,
      'balancePence', outstanding - p_amount_pence,
      'method', normalized_method,
      'paidAt', p_paid_at,
      'revision', current_invoice.revision
    )
  );
  return current_invoice;
end
$$;

create or replace function public.mark_invoice_paid(
  p_invoice_id uuid,
  p_paid_at timestamptz,
  p_method text,
  p_reference text
)
returns public.invoices
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_invoice public.invoices%rowtype;
  already_paid bigint;
begin
  perform public.require_invoice_actor();
  select invoice.*
  into current_invoice
  from public.invoices invoice
  where invoice.id = p_invoice_id
    and invoice.status = 'issued';
  if not found then
    raise exception 'ISSUED_INVOICE_NOT_FOUND';
  end if;
  select coalesce(sum(payment.amount_pence), 0)
  into already_paid
  from public.invoice_payments payment
  where payment.invoice_id = p_invoice_id;
  return public.record_invoice_payment(
    p_invoice_id,
    current_invoice.total_pence - already_paid,
    p_paid_at,
    p_method,
    p_reference
  );
end
$$;

create function public.create_invoice_correction(p_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := public.require_invoice_actor();
  draft_id uuid;
begin
  perform 1
  from public.invoices invoice
  where invoice.id = p_invoice_id
    and invoice.status = 'issued'
  for update;
  if not found then
    raise exception 'ISSUED_INVOICE_NOT_FOUND';
  end if;

  perform public.void_invoice(p_invoice_id);
  draft_id := public.duplicate_invoice_to_draft(p_invoice_id);

  insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, detail)
  values (actor_id, 'invoice.correction_created', 'invoice', p_invoice_id::text, jsonb_build_object('draftId', draft_id));
  return draft_id;
end
$$;

revoke all on function public.record_invoice_payment(uuid,bigint,timestamptz,text,text) from public, anon, authenticated, service_role;
revoke all on function public.create_invoice_correction(uuid) from public, anon, authenticated, service_role;
grant execute on function public.record_invoice_payment(uuid,bigint,timestamptz,text,text) to authenticated;
grant execute on function public.create_invoice_correction(uuid) to authenticated;

alter function public.get_invoice_dashboard(text,text,date,integer,integer)
rename to get_invoice_dashboard_without_payments;

revoke all on function public.get_invoice_dashboard_without_payments(text,text,date,integer,integer)
from public, anon, authenticated, service_role;

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
  result jsonb;
  outstanding_total numeric;
  current_week_paid_total numeric;
  week_start timestamptz := date_trunc('week', timezone('Europe/London', statement_timestamp())) at time zone 'Europe/London';
  week_end timestamptz := (date_trunc('week', timezone('Europe/London', statement_timestamp())) + interval '1 week') at time zone 'Europe/London';
begin
  perform public.require_invoice_actor();
  result := public.get_invoice_dashboard_without_payments(p_query, p_status, p_date, p_page, p_page_size);

  select coalesce(sum(invoice.total_pence - coalesce(payment.amount_paid_pence, 0)), 0)
  into outstanding_total
  from public.invoices invoice
  left join lateral (
    select sum(invoice_payment.amount_pence) as amount_paid_pence
    from public.invoice_payments invoice_payment
    where invoice_payment.invoice_id = invoice.id
  ) payment on true
  where invoice.status = 'issued';

  select
    coalesce((
      select sum(invoice_payment.amount_pence)
      from public.invoice_payments invoice_payment
      where invoice_payment.paid_at >= week_start
        and invoice_payment.paid_at < week_end
    ), 0)
    + coalesce((
      select sum(invoice.total_pence)
      from public.invoices invoice
      where invoice.status = 'paid'
        and invoice.paid_at >= week_start
        and invoice.paid_at < week_end
        and not exists (
          select 1
          from public.invoice_payments invoice_payment
          where invoice_payment.invoice_id = invoice.id
        )
    ), 0)
  into current_week_paid_total;

  return result || jsonb_build_object(
    'outstanding_total_pence', outstanding_total::text,
    'current_week_paid_total_pence', current_week_paid_total::text
  );
end
$$;

revoke all on function public.get_invoice_dashboard(text,text,date,integer,integer)
from public, anon, authenticated, service_role;
grant execute on function public.get_invoice_dashboard(text,text,date,integer,integer)
to authenticated;

commit;
