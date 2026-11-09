alter table public.finance_accounts add column invoice_link_secret text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
comment on column public.finance_accounts.invoice_link_secret is 'Server-only per-business HMAC key. Never return to clients or logs.';
