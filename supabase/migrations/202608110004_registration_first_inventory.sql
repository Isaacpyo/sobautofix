alter type public.sale_vehicle_status add value if not exists 'draft' before 'available';
alter type public.sale_vehicle_status add value if not exists 'archived' after 'sold';
