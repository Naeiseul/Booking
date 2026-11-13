-- Platform sales: separate from customer appointment payments.
create table if not exists public.logtraq_sales_orders (
 id uuid primary key default gen_random_uuid(),
 business_id uuid unique references public.businesses(id),
 business_name text not null check(length(trim(business_name)) between 2 and 150),
 contact_name text not null check(length(trim(contact_name)) between 2 and 150),
 contact_email text not null,
 contact_phone text,
 business_slug text,
 offer_version text not null default 'founding-2026-11-v1',
 terms_version text not null default 'service-2026-11-v1',
 terms_accepted_at timestamptz not null,
 accepted_ip_hash text,
 agreed_total_cents integer not null default 100000 check(agreed_total_cents=100000),
 deposit_cents integer not null default 25000 check(deposit_cents=25000),
 balance_cents integer not null default 75000 check(balance_cents=75000),
 payment_reference text unique,
 payment_status text not null default 'not_started' check(payment_status in ('not_started','pending','paid','failed','refunded')),
 payment_verified_at timestamptz,
 project_status text not null default 'awaiting_payment' check(project_status in ('awaiting_payment','onboarding','configuration','testing','handover','live')),
 access_token_hash text not null,
 onboarding_complete_at timestamptz,
 checkout_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists logtraq_sales_orders_email_idx on public.logtraq_sales_orders(contact_email,created_at desc);
alter table public.logtraq_sales_orders enable row level security;
revoke all on public.logtraq_sales_orders from anon,authenticated;
create table if not exists public.logtraq_sales_events (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.logtraq_sales_orders(id) on delete cascade,
 event_type text not null,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists logtraq_sales_events_order_idx on public.logtraq_sales_events(order_id,created_at desc);
alter table public.logtraq_sales_events enable row level security;
revoke all on public.logtraq_sales_events from anon,authenticated;
create or replace function public.logtraq_sales_finalize_verified(p_order uuid,p_reference text,p_slug text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.logtraq_sales_orders%rowtype; b uuid;
begin
 select * into o from public.logtraq_sales_orders where id=p_order for update;
 if not found then raise exception 'Sales order not found'; end if;
 if o.payment_reference is distinct from p_reference then raise exception 'Payment reference mismatch'; end if;
 if o.payment_status='paid' then return o.business_id; end if;
 if o.payment_status <> 'pending' then raise exception 'Order not awaiting verified payment'; end if;
 if p_slug !~ '^[a-z0-9-]{2,40}$' then raise exception 'Invalid slug'; end if;
 insert into public.businesses(slug,name,owner_name,email,phone_number,active)
 values(p_slug,o.business_name,o.contact_name,o.contact_email,coalesce(o.contact_phone,''),true)
 returning id into b;
 update public.logtraq_sales_orders
 set business_id=b,business_slug=p_slug,payment_status='paid',payment_verified_at=now(),project_status='onboarding',updated_at=now()
 where id=p_order;
 insert into public.logtraq_sales_events(order_id,event_type,metadata)
 values(p_order,'deposit_verified',jsonb_build_object('business_id',b,'payment_reference',p_reference));
 return b;
end $$;
revoke all on function public.logtraq_sales_finalize_verified(uuid,text,text) from public,anon,authenticated;
grant execute on function public.logtraq_sales_finalize_verified(uuid,text,text) to service_role;
