-- Change only the public contact identity. The Gmail mailbox remains the
-- admin identity, transactional Reply-To and hidden notification destination.
begin;

update public.site_settings
set value = jsonb_set(value, '{email}', to_jsonb('info@sobautofix.com'::text), true),
    updated_at = now()
where id = true
  and value->>'email' = 'sobautofix@gmail.com';

-- Invoice issuer details are immutable snapshots. Preserve every existing
-- invoice and use the public address only for invoices created after this
-- migration.
alter table public.invoices
  alter column issuer_email set default 'info@sobautofix.com';

commit;
