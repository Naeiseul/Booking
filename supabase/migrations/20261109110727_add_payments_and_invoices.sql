-- Finance records are accessible only through the authenticated Edge API.
create table public.finance_accounts (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 paystack_key_env text check(paystack_key_env ~ '^PAYSTACK_SECRET_KEY(_[A-Z0-9_]+)?$'),
 webhook_secret_env text check(webhook_secret_env ~ '^PAYSTACK_WEBHOOK_SECRET(_[A-Z0-9_]+)?$'),
 integration_id bigint, mode text not null default 'test' check(mode in('test','live')),
 live_enabled boolean not null default false, created_at timestamptz not null default now()
);
create unique index finance_account_integration on public.finance_accounts(integration_id,mode) where integration_id is not null;
create table public.finance_members (
 business_id uuid not null references public.businesses(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, primary key(business_id,user_id)
);
create table public.finance_counters (
 business_id uuid primary key references public.businesses(id) on delete cascade, next_number bigint not null default 1
);
create table public.finance_invoices (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 actor_id uuid not null references auth.users(id), request_id uuid not null, number text not null,
 seller jsonb not null, customer jsonb not null, items jsonb not null,
 total_amount bigint not null check(total_amount between 1 and 2147483647),
 currency text not null default 'ZAR' check(currency='ZAR'),
 status text not null default 'issued' check(status in('issued','paid','reversed','void')),
 due_date date, notes text not null default '', link_version integer not null default 1,
 request_snapshot jsonb not null, created_at timestamptz not null default now(), paid_at timestamptz,
 unique(business_id,request_id), unique(business_id,number), unique(id,business_id)
);
create index finance_invoices_business_date on public.finance_invoices(business_id,created_at desc);
create table public.finance_attempts (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, invoice_id uuid not null,
 reference text not null unique,
 status text not null default 'initializing' check(status in('initializing','pending','success','failed','reversed')),
 authorization_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(invoice_id,business_id) references public.finance_invoices(id,business_id)
);
create unique index finance_one_open_attempt on public.finance_attempts(invoice_id) where status in('initializing','pending');
create table public.finance_payments (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id), invoice_id uuid,
 integration_id bigint not null, provider_id text not null, reference text not null,
 mode text not null check(mode in('test','live')), amount bigint not null check(amount between 1 and 2147483647),
 currency text not null check(currency='ZAR'), customer_email text not null, customer_name text not null default '',
 status text not null check(status in('success','reversed')), channel text not null default '',
 paid_at timestamptz not null, verified_at timestamptz not null default now(),
 foreign key(invoice_id,business_id) references public.finance_invoices(id,business_id),
 unique(integration_id,mode,provider_id), unique(business_id,mode,reference)
);
create index finance_payments_business_date on public.finance_payments(business_id,paid_at desc);
create table public.finance_email_jobs (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
 invoice_id uuid, payment_id uuid references public.finance_payments(id),
 kind text not null check(kind in('invoice','receipt')),
 status text not null default 'pending' check(status in('pending','sending','sent','failed','manual_review')),
 dedupe_key text not null unique, attempts integer not null default 0,
 available_at timestamptz not null default now(), last_error text, provider_id text,
 created_at timestamptz not null default now(), sent_at timestamptz,
 foreign key(invoice_id,business_id) references public.finance_invoices(id,business_id)
);
create index finance_email_pending on public.finance_email_jobs(status,available_at);
do $$ declare t text; begin
 foreach t in array array['finance_accounts','finance_members','finance_counters','finance_invoices','finance_attempts','finance_payments','finance_email_jobs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.finance_issue_invoice(p_business uuid,p_actor uuid,p_request uuid,p_customer jsonb,p_items jsonb,p_due date,p_notes text)
returns public.finance_invoices language plpgsql security invoker set search_path='' as $$
declare b public.businesses; prior public.finance_invoices; result public.finance_invoices;
 item jsonb; canonical jsonb='[]'; customer jsonb; total bigint=0; qty bigint; price bigint; seq bigint; snapshot jsonb;
begin
 if not exists(select 1 from public.finance_members where business_id=p_business and user_id=p_actor) then raise exception using errcode='42501',message='Finance access denied'; end if;
 select * into b from public.businesses where id=p_business and active;
 if b.id is null then raise exception using errcode='42501',message='Business unavailable'; end if;
 if p_request is null or jsonb_typeof(p_customer) is distinct from 'object' or jsonb_typeof(p_items) is distinct from 'array' then raise exception using errcode='22023',message='Check customer and line items'; end if;
 if jsonb_array_length(p_items) not between 1 and 20 then raise exception using errcode='22023',message='Use 1 to 20 line items'; end if;
 customer=jsonb_build_object('name',btrim(coalesce(p_customer->>'name','')),'email',lower(btrim(coalesce(p_customer->>'email',''))),'address',btrim(coalesce(p_customer->>'address','')));
 if length(customer->>'name') not between 1 and 120 or length(customer->>'email')>254 or (customer->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(customer->>'address')>500 or length(coalesce(p_notes,''))>1000 then raise exception using errcode='22023',message='Check customer details'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
 if jsonb_typeof(item) is distinct from 'object' or length(btrim(coalesce(item->>'description',''))) not between 1 and 200 or coalesce(item->>'quantity','') !~ '^[0-9]{1,5}$' or coalesce(item->>'unit_amount','') !~ '^[0-9]{1,10}$' then raise exception using errcode='22023',message='Check line items'; end if;
 qty=(item->>'quantity')::bigint; price=(item->>'unit_amount')::bigint;
 if qty not between 1 and 10000 or price not between 0 and 2147483647 then raise exception using errcode='22023',message='Check quantity and price'; end if;
 total=total+qty*price;
 canonical=canonical||jsonb_build_array(jsonb_build_object('description',btrim(item->>'description'),'quantity',qty,'unit_amount',price));
 end loop;
 if total not between 1 and 2147483647 then raise exception using errcode='22023',message='Check invoice total'; end if;
 snapshot=jsonb_build_object('customer',customer,'items',canonical,'due',p_due,'notes',coalesce(p_notes,''));
 insert into public.finance_counters(business_id) values(p_business) on conflict do nothing;
 perform 1 from public.finance_counters where business_id=p_business for update;
 select * into prior from public.finance_invoices where business_id=p_business and request_id=p_request;
 if prior.id is not null then
 if prior.actor_id<>p_actor or prior.request_snapshot<>snapshot then raise exception using errcode='40001',message='Request already used for another invoice'; end if;
 return prior;
 end if;
 if p_due is not null and p_due<(now() at time zone 'Africa/Johannesburg')::date then raise exception using errcode='22023',message='Due date has already passed'; end if;
 update public.finance_counters set next_number=next_number+1 where business_id=p_business returning next_number-1 into seq;
 insert into public.finance_invoices(business_id,actor_id,request_id,number,seller,customer,items,total_amount,due_date,notes,request_snapshot)
 values(p_business,p_actor,p_request,'INV-'||lpad(seq::text,6,'0'),jsonb_build_object('name',b.name,'email',coalesce(b.email,''),'phone',coalesce(b.phone_number,'')),customer,canonical,total,p_due,coalesce(p_notes,''),snapshot) returning * into result;
 return result;
end $$;
create function public.finance_prepare_payment(p_invoice uuid,p_reference text)
returns public.finance_attempts language plpgsql security invoker set search_path='' as $$
declare inv public.finance_invoices; result public.finance_attempts;
begin
 select * into inv from public.finance_invoices where id=p_invoice for update;
 if inv.id is null or inv.status<>'issued' then raise exception using errcode='22023',message='Invoice is not payable'; end if;
 select * into result from public.finance_attempts where invoice_id=p_invoice and status in('initializing','pending') order by created_at desc limit 1;
 if result.id is not null then return result; end if;
 insert into public.finance_attempts(business_id,invoice_id,reference) values(inv.business_id,p_invoice,p_reference) returning * into result;
 return result;
end $$;
-- Only service-role results normalized after Paystack verification may call this function.
create function public.finance_record_payment(p_business uuid,p_payment jsonb)
returns public.finance_payments language plpgsql security invoker set search_path='' as $$
declare account public.finance_accounts; attempt public.finance_attempts; inv public.finance_invoices; result public.finance_payments; prior public.finance_payments;
 ref text=p_payment->>'reference'; payment_status text=p_payment->>'status'; v_amount bigint; integration bigint; v_mode text;
begin
 select * into account from public.finance_accounts where business_id=p_business;
 integration=(p_payment->>'integration_id')::bigint; v_mode=p_payment->>'mode'; v_amount=(p_payment->>'amount')::bigint;
 if account.business_id is null or account.integration_id is distinct from integration or account.mode is distinct from v_mode or payment_status is null or payment_status not in('success','reversed') or p_payment->>'currency' is distinct from 'ZAR' or v_amount is null or v_amount not between 1 and 2147483647 or coalesce(ref,'')='' or length(ref)>150 or coalesce(p_payment->>'provider_id','')='' or coalesce(p_payment->>'customer_email','')='' or p_payment->>'paid_at' is null then raise exception using errcode='22023',message='Payment verification mismatch'; end if;
 select * into attempt from public.finance_attempts where reference=ref and business_id=p_business;
 if attempt.id is not null then
 select * into inv from public.finance_invoices where id=attempt.invoice_id and business_id=p_business for update;
 if inv.status='void' or inv.total_amount<>v_amount or inv.currency<>p_payment->>'currency' or lower(inv.customer->>'email')<>lower(p_payment->>'customer_email') then raise exception using errcode='22023',message='Invoice payment mismatch'; end if;
 end if;
 select * into prior from public.finance_payments where business_id=p_business and mode=v_mode and reference=ref for update;
 if prior.id is not null and (prior.amount<>v_amount or prior.provider_id<>p_payment->>'provider_id') then raise exception using errcode='22023',message='Reference collision'; end if;
 insert into public.finance_payments(business_id,invoice_id,integration_id,provider_id,reference,mode,amount,currency,customer_email,customer_name,status,channel,paid_at)
 values(p_business,inv.id,integration,p_payment->>'provider_id',ref,v_mode,v_amount,'ZAR',lower(p_payment->>'customer_email'),left(coalesce(p_payment->>'customer_name',''),120),payment_status,left(coalesce(p_payment->>'channel',''),50),(p_payment->>'paid_at')::timestamptz)
 on conflict(business_id,mode,reference) do update set status=case when public.finance_payments.status='reversed' then 'reversed' else excluded.status end,verified_at=now() returning * into result;
 if inv.id is not null then
 update public.finance_attempts set status=result.status,updated_at=now() where id=attempt.id;
 update public.finance_invoices set status=case when result.status='success' then 'paid' else 'reversed' end,paid_at=coalesce(paid_at,result.paid_at) where id=inv.id;
 end if;
 if result.status='success' then
 insert into public.finance_email_jobs(business_id,invoice_id,payment_id,kind,dedupe_key) values(p_business,inv.id,result.id,'receipt','receipt:'||result.id) on conflict(dedupe_key) do nothing;
 else
 update public.finance_email_jobs set status='manual_review',last_error='Payment reversed. Receipt not sent.' where payment_id=result.id and status in('pending','failed');
 end if;
 return result;
end $$;
revoke all on function public.finance_issue_invoice(uuid,uuid,uuid,jsonb,jsonb,date,text) from public,anon,authenticated;
revoke all on function public.finance_prepare_payment(uuid,text) from public,anon,authenticated;
revoke all on function public.finance_record_payment(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finance_issue_invoice(uuid,uuid,uuid,jsonb,jsonb,date,text) to service_role;
grant execute on function public.finance_prepare_payment(uuid,text) to service_role;
grant execute on function public.finance_record_payment(uuid,jsonb) to service_role;
