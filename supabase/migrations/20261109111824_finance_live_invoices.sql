alter table public.finance_accounts alter column mode set default 'live';
alter table public.finance_invoices alter column mode set default 'live';
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
 values(p_business,p_actor,p_request,'INV-'||lpad(seq::text,6,'0'),jsonb_build_object('name',b.name,'email',coalesce(b.email,''),'phone',coalesce(b.phone_number,'')),customer,canonical,total,coalesce((select mode from public.finance_accounts where business_id=p_business),'live'),p_due,coalesce(p_notes,''),snapshot) returning * into result;
 return result;
end $$;
