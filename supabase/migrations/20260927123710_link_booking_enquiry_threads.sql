alter table public.enquiries
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create unique index if not exists enquiries_booking_thread_unique
  on public.enquiries (booking_id)
  where booking_id is not null;

comment on column public.enquiries.booking_id is
  'Booking that originated this admin-created enquiry email thread.';

create or replace function public.create_booking_enquiry_thread(
  target_booking_id uuid,
  actor_id_value uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_booking record;
  selected_enquiry_id uuid;
  was_created boolean := false;
  initial_message text;
begin
  select
    booking.id,
    booking.booking_reference,
    booking.customer_id,
    booking.vehicle_id,
    booking.service_key,
    booking.service_name,
    booking.problem_description,
    booking.notes,
    booking.service_postcode,
    booking.appointment_start
  into selected_booking
  from public.bookings as booking
  where booking.id = target_booking_id;

  if not found then
    raise exception 'Booking not found';
  end if;

  select enquiry.id
  into selected_enquiry_id
  from public.enquiries as enquiry
  where enquiry.booking_id = target_booking_id;

  if selected_enquiry_id is null then
    initial_message := concat_ws(
      E'\n',
      'Booking ' || selected_booking.booking_reference,
      'Service: ' || selected_booking.service_name,
      'Appointment: ' || to_char(selected_booking.appointment_start at time zone 'Europe/London', 'FMDay, FMDD FMMonth YYYY at HH24:MI') || ' (UK time)',
      case
        when nullif(trim(coalesce(selected_booking.problem_description, '')), '') is not null
          then 'Customer description: ' || trim(selected_booking.problem_description)
      end,
      case
        when nullif(trim(coalesce(selected_booking.notes, '')), '') is not null
          then 'Booking notes: ' || trim(selected_booking.notes)
      end
    );

    begin
      insert into public.enquiries (
        type,
        customer_id,
        vehicle_id,
        booking_id,
        service_slug,
        description,
        location_postcode,
        status,
        notification_status
      )
      values (
        'general',
        selected_booking.customer_id,
        selected_booking.vehicle_id,
        target_booking_id,
        selected_booking.service_key,
        initial_message,
        selected_booking.service_postcode,
        'booked',
        'sent'
      )
      returning id into selected_enquiry_id;
      was_created := true;
    exception
      when unique_violation then
        select enquiry.id
        into selected_enquiry_id
        from public.enquiries as enquiry
        where enquiry.booking_id = target_booking_id;
    end;
  end if;

  if selected_enquiry_id is null then
    raise exception 'Booking enquiry thread could not be created';
  end if;

  insert into public.enquiry_conversations (enquiry_id, subject)
  values (
    selected_enquiry_id,
    left('Your SOB Autofix booking ' || selected_booking.booking_reference, 180)
  )
  on conflict (enquiry_id) do nothing;

  if was_created then
    insert into public.admin_audit_log (
      actor_id,
      action,
      entity_type,
      entity_id,
      detail
    )
    values (
      actor_id_value,
      'booking.enquiry_thread_created',
      'enquiry',
      selected_enquiry_id,
      jsonb_build_object(
        'bookingId', target_booking_id,
        'bookingReference', selected_booking.booking_reference
      )
    );
  end if;

  return selected_enquiry_id;
end;
$$;

revoke all on function public.create_booking_enquiry_thread(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_booking_enquiry_thread(uuid, uuid)
  to service_role;
