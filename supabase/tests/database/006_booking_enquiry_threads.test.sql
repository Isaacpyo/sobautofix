begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

select has_column('public', 'enquiries', 'booking_id', 'enquiries record their source booking');
select has_index('public', 'enquiries', 'enquiries_booking_thread_unique', 'one enquiry thread is allowed per booking');
select ok(
  has_function_privilege('service_role', 'public.create_booking_enquiry_thread(uuid,uuid)', 'execute'),
  'service role can create a booking enquiry thread'
);
select ok(
  not has_function_privilege('anon', 'public.create_booking_enquiry_thread(uuid,uuid)', 'execute'),
  'anonymous callers cannot create booking enquiry threads'
);
select ok(
  not has_function_privilege('authenticated', 'public.create_booking_enquiry_thread(uuid,uuid)', 'execute'),
  'authenticated clients cannot bypass the guarded admin action'
);

insert into public.customers (id, name, email, phone, preferred_contact)
values (
  '10000000-0000-4000-8000-000000000001',
  'Booking Thread Test Customer',
  'booking-thread@example.test',
  '07000000000',
  'email'
);

insert into public.vehicles (id, customer_id, registration, make, model)
values (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  'THREAD1',
  'Test',
  'Vehicle'
);

insert into public.bookings (
  id,
  customer_id,
  vehicle_id,
  service_name,
  service_key,
  problem_description,
  appointment_start,
  original_appointment_start
)
values (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  'Vehicle diagnostics',
  'vehicle-diagnostics',
  'Intermittent warning light',
  '2026-10-05 09:00:00+01',
  '2026-10-05 09:00:00+01'
);

set local role service_role;

select is(
  public.create_booking_enquiry_thread('10000000-0000-4000-8000-000000000003', null),
  public.create_booking_enquiry_thread('10000000-0000-4000-8000-000000000003', null),
  'opening the same booking twice returns the same enquiry thread'
);
select is(
  (select count(*)::integer from public.enquiries where booking_id = '10000000-0000-4000-8000-000000000003'),
  1,
  'only one enquiry is created for the booking'
);
select is(
  (select status::text from public.enquiries where booking_id = '10000000-0000-4000-8000-000000000003'),
  'booked',
  'the enquiry reflects that the customer already has a booking'
);
select matches(
  (select description from public.enquiries where booking_id = '10000000-0000-4000-8000-000000000003'),
  'Intermittent warning light',
  'the booking context is copied into the conversation'
);
select matches(
  (
    select conversation.subject
    from public.enquiry_conversations as conversation
    join public.enquiries as enquiry on enquiry.id = conversation.enquiry_id
    where enquiry.booking_id = '10000000-0000-4000-8000-000000000003'
  ),
  '^Your SOB Autofix booking SOB-[0-9]{6}$',
  'the conversation has a booking-specific subject'
);

reset role;
select * from finish();
rollback;
