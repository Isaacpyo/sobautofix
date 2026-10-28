-- Explicit Data API grants.
--
-- Projects created before Supabase changed its defaults (including the SOB
-- Autofix production project) grant anon, authenticated and service_role
-- every table privilege automatically; RLS is what restricts access. Newer
-- projects and current local stacks grant nothing, so the application could
-- not read its own tables in local development or CI.
--
-- This migration grants the privileges the application relies on. On the
-- production project every statement is a no-op because the same privileges
-- already exist. Row-level security still decides which rows each role sees.
-- Tables whose privileges were deliberately locked down (invoices, invoice
-- numbering, MFA recovery and trusted devices) are intentionally not listed.

begin;

grant select, insert, update, delete on table
  public.booking_audit_log,
  public.booking_notification_events,
  public.booking_service_types,
  public.bookings,
  public.content_entries,
  public.content_revisions,
  public.customers,
  public.enquiries,
  public.enquiry_attachments,
  public.enquiry_conversations,
  public.enquiry_messages,
  public.inbound_email_events,
  public.media_assets,
  public.navigation_items,
  public.notification_attempts,
  public.offers,
  public.provider_webhook_events,
  public.rate_limit_buckets,
  public.resend_webhook_events,
  public.reviews,
  public.sale_vehicle_images,
  public.sale_vehicles,
  public.service_prices,
  public.site_settings,
  public.unmatched_inbound_emails,
  public.vehicles,
  public.exchange_settings,
  public.exchange_private_settings,
  public.vehicle_internal_records,
  public.vehicle_costs,
  public.vehicle_prep_items,
  public.seller_submissions,
  public.seller_submission_photos,
  public.vehicle_inspections,
  public.vehicle_documents,
  public.vehicle_sales,
  public.diary_appointments
to authenticated, service_role;

grant select, insert, update, delete on table public.admin_audit_log, public.admin_profiles to service_role;

-- Visitors read only what the public RLS policies allow.
grant select on table
  public.content_entries,
  public.navigation_items,
  public.offers,
  public.service_prices,
  public.media_assets,
  public.reviews,
  public.sale_vehicles,
  public.sale_vehicle_images,
  public.exchange_settings
to anon;

commit;
