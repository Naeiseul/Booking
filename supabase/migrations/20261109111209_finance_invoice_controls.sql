alter table public.finance_invoices add column mode text not null default 'test' check(mode in('test','live'));
alter table public.finance_invoices add column voided_at timestamptz;
alter table public.finance_invoices add column voided_by uuid references auth.users(id);
create or replace function public.finance_issue_invoice(p_business uuid,p_actor uuid,p_request uuid,p_customer jsonb,p_items jsonb,p_due date,p_notes text)
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
 insert into public.finance_invoices(business_id,actor_id,request_id,number,seller,customer,items,total_amount,mode,due_date,notes,request_snapshot)
 values(p_business,p_actor,p_request,'INV-'||lpad(seq::text,6,'0'),jsonb_build_object('name',b.name,'email',coalesce(b.email,''),'phone',coalesce(b.phone_number,'')),customer,canonical,total,coalesce((select mode from public.finance_accounts where business_id=p_business),'test'),p_due,coalesce(p_notes,''),snapshot) returning * into result;
 return result;
end $$;
create or replace function public.finance_record_payment(p_business uuid,p_payment jsonb)
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
 if inv.mode<>v_mode or inv.status='void' or inv.total_amount<>v_amount or inv.currency<>p_payment->>'currency' or lower(inv.customer->>'email')<>lower(p_payment->>'customer_email') then raise exception using errcode='22023',message='Invoice payment mismatch'; end if;
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
 if result.status='success' and coalesce((p_payment->>'send_receipt')::boolean,true) then
 insert into public.finance_email_jobs(business_id,invoice_id,payment_id,kind,dedupe_key) values(p_business,inv.id,result.id,'receipt','receipt:'||result.id) on conflict(dedupe_key) do nothing;
 elsif result.status='reversed' then
 update public.finance_email_jobs set status='manual_review',last_error='Payment reversed. Receipt not sent.' where payment_id=result.id and status in('pending','failed');
 end if;
 return result;
end $$;

create function public.finance_void_invoice(p_business uuid,p_invoice uuid,p_actor uuid)
returns public.finance_invoices language plpgsql security invoker set search_path='' as $$
declare inv public.finance_invoices;
begin
 if not exists(select 1 from public.finance_members where business_id=p_business and user_id=p_actor) then raise exception using errcode='42501',message='Finance access denied'; end if;
 select * into inv from public.finance_invoices where id=p_invoice and business_id=p_business for update;
 if inv.id is null or inv.status<>'issued' then raise exception using errcode='22023',message='Only unpaid invoices can be voided'; end if;
 if exists(select 1 from public.finance_attempts where invoice_id=inv.id and status in('initializing','pending','success')) then raise exception using errcode='40001',message='Check the open payment before voiding this invoice'; end if;
 update public.finance_invoices set status='void',voided_at=now(),voided_by=p_actor,link_version=link_version+1 where id=inv.id returning * into inv;
 return inv;
end $$;
revoke all on function public.finance_void_invoice(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.finance_void_invoice(uuid,uuid,uuid) to service_role;
