-- SOB Auto Exchange, part 1 of 2.
-- New enum values live in their own migration because PostgreSQL cannot use
-- a value added by ALTER TYPE ... ADD VALUE inside the same transaction.
-- Both statements are additive and idempotent; existing rows are unchanged.

alter type public.sale_vehicle_status add value if not exists 'preparation' after 'draft';
alter type public.enquiry_type add value if not exists 'vehicle_purchase';
