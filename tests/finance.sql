begin;
do $test$
declare
 b uuid; other_b uuid; actor uuid=gen_random_uuid(); outsider uuid=gen_random_uuid(); request uuid=gen_random_uuid();
 i public.finance_invoices; again public.finance_invoices; attempt public.finance_attempts; p public.finance_payments; payload jsonb;
 customer jsonb='{"name":"Isolated finance fixture","email":"finance-fixture@example.invalid","address":""}';
 items jsonb='[{"description":"Private SQL test only","quantity":2,"unit_amount":25000}]';
begin
 insert into auth.users(id,email,email_confirmed_at) values(actor,'finance-'||actor||'@example.invalid',now()),(outsider,'finance-'||outsider||'@example.invalid',now());
 insert into public.businesses(slug,admin_key,name) values('qa-'||gen_random_uuid(),gen_random_uuid()::text,'Isolated finance SQL fixture') returning id into b;
 insert into public.businesses(slug,admin_key,name) values('qa-'||gen_random_uuid(),gen_random_uuid()::text,'Other isolated business') returning id into other_b;
 insert into public.finance_members values(b,actor);
 insert into public.finance_accounts(business_id,integration_id,mode) values(b,987654321,'live');
 begin perform public.finance_issue_invoice(b,outsider,request,customer,items,null,'');raise exception 'Non-member issued invoice';exception when insufficient_privilege then null;end;
 begin perform public.finance_issue_invoice(other_b,actor,request,customer,items,null,'');raise exception 'Cross-business access';exception when insufficient_privilege then null;end;
 i=public.finance_issue_invoice(b,actor,request,customer,items,null,'');
 if i.total_amount<>50000 or i.number<>'INV-000001' or i.mode<>'live' then raise exception 'Incorrect total/number/live environment';end if;
 again=public.finance_issue_invoice(b,actor,request,customer,items,null,'');
 if again.id<>i.id or (select count(*) from public.finance_invoices where business_id=b)<>1 then raise exception 'Duplicate retry invoice';end if;
 begin perform public.finance_issue_invoice(b,actor,request,customer,'[{"description":"Changed","quantity":1,"unit_amount":1}]',null,'');raise exception 'Changed retry accepted';exception when serialization_failure then null;end;
 begin perform public.finance_issue_invoice(b,actor,gen_random_uuid(),customer,'[{"description":"Bad","quantity":10000,"unit_amount":2147483647}]',null,'');raise exception 'Overflow accepted';exception when invalid_parameter_value then null;end;
 attempt=public.finance_prepare_payment(i.id,'qa-'||gen_random_uuid());
 if (public.finance_prepare_payment(i.id,'qa-'||gen_random_uuid())).id<>attempt.id then raise exception 'Duplicate checkout';end if;
 begin perform public.finance_void_invoice(b,i.id,actor);raise exception 'Voided open checkout';exception when serialization_failure then null;end;
 payload=jsonb_build_object('integration_id',987654321,'provider_id',gen_random_uuid()::text,'reference',attempt.reference,'mode','live','amount',50000,'currency','ZAR','customer_email','finance-fixture@example.invalid','status','success','paid_at',now());
 begin perform public.finance_record_payment(b,payload||'{"amount":100}');raise exception 'Wrong amount accepted';exception when invalid_parameter_value then null;end;
 begin perform public.finance_record_payment(b,payload||'{"mode":"test"}');raise exception 'Test payment accepted for live invoice';exception when invalid_parameter_value then null;end;
 p=public.finance_record_payment(b,payload);perform public.finance_record_payment(b,payload);
 if (select count(*) from public.finance_payments where business_id=b)<>1 or (select count(*) from public.finance_email_jobs where business_id=b)<>1 then raise exception 'Duplicate payment/receipt';end if;
 if (select status from public.finance_invoices where id=i.id)<>'paid' then raise exception 'Invoice not paid';end if;
 perform public.finance_record_payment(b,payload||'{"status":"reversed"}');perform public.finance_record_payment(b,payload);
 if (select status from public.finance_payments where id=p.id)<>'reversed' then raise exception 'Reversal downgraded';end if;
 if (select status from public.finance_email_jobs where payment_id=p.id)<>'manual_review' then raise exception 'Reversed receipt still queued';end if;
 payload=payload||jsonb_build_object('reference','old-'||gen_random_uuid(),'provider_id',gen_random_uuid()::text,'send_receipt',false);
 perform public.finance_record_payment(b,payload);
 if (select count(*) from public.finance_email_jobs where business_id=b)<>1 then raise exception 'Historical import sent an email';end if;
 again=public.finance_issue_invoice(b,actor,gen_random_uuid(),customer,items,null,'');
 if again.number<>'INV-000002' then raise exception 'Number sequence wrong';end if;
 perform public.finance_void_invoice(b,again.id,actor);
 if (select status from public.finance_invoices where id=again.id)<>'void' then raise exception 'Void failed';end if;
end $test$;
set local role anon;
do $$ begin
 begin perform count(*) from public.finance_invoices;raise exception 'Anon read invoices';exception when insufficient_privilege then null;end;
 begin perform public.finance_prepare_payment(gen_random_uuid(),'denied');raise exception 'Anon called payment RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$ begin
 begin perform count(*) from public.finance_payments;raise exception 'Authenticated direct read payments';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS finance ownership, totals, numbering, retries, payment checks, reversals, email deduplication, historical import and closed RLS' as result;
rollback;