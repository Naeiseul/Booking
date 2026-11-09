begin;
do $test$
declare b uuid; job uuid; claimed public.finance_email_jobs; again public.finance_email_jobs; payload jsonb; other uuid; n integer;
begin
 insert into public.businesses(slug,admin_key,name) values('qa-'||gen_random_uuid(),gen_random_uuid()::text,'Private delivery SQL verification') returning id into b;
 insert into public.finance_accounts(business_id,owner_email,email_from,email_key_env,email_enabled)
 values(b,'owner@example.invalid','owner@example.invalid','RESEND_API_KEY_QA',true);
 insert into public.finance_email_jobs(business_id,kind,dedupe_key,payload) values(b,'login',gen_random_uuid()::text,'{"to":["owner@example.invalid"]}') returning id into job;
 claimed=public.finance_claim_email(b,'private-quota-unit');
 if claimed.id<>job or claimed.attempts<>1 then raise exception 'Claim failed';end if;
 again=public.finance_claim_email(b,'private-quota-unit');if again.id is not null then raise exception 'Double claim';end if;
 payload=public.finance_store_mail_payload(job,claimed.lease_token,'{"changed":true}');
 if payload<>'{"to":["owner@example.invalid"]}' then raise exception 'Frozen payload changed';end if;
 if public.finance_finish_email(job,gen_random_uuid(),'sent','wrong',null,30) then raise exception 'Stale lease finished';end if;
 perform public.finance_finish_email(job,claimed.lease_token,'failed',null,'Private retry check',30);
 update public.finance_email_jobs set available_at=now()-interval '1 second' where id=job;
 again=public.finance_claim_email(b,'private-quota-unit');
 if again.lease_token=claimed.lease_token or again.attempts<>2 then raise exception 'Retry lease not renewed';end if;
 if (select count(*) from public.finance_mail_reservations where job_id=job)<>1 then raise exception 'Retry consumed quota twice';end if;
 perform public.finance_finish_email(job,again.lease_token,'sent','private-provider-unit',null,30);
 if (select status from public.finance_email_jobs where id=job)<>'sent' then raise exception 'Send not stored';end if;
 insert into public.finance_email_jobs(business_id,kind,dedupe_key,first_attempt_at) values(b,'invoice',gen_random_uuid()::text,now()-interval '21 hours') returning id into other;
 perform public.finance_claim_email(b,'private-quota-unit');
 if (select status from public.finance_email_jobs where id=other)<>'manual_review' then raise exception 'Ambiguous old email retried';end if;
 insert into public.finance_email_jobs(business_id,kind,dedupe_key,created_at) values(b,'login',gen_random_uuid()::text,now()-interval '31 minutes') returning id into other;
 perform public.finance_claim_email(b,'private-quota-unit');
 if (select status from public.finance_email_jobs where id=other)<>'manual_review' then raise exception 'Expired sign-in email retried';end if;
 for n in 1..94 loop
  insert into public.finance_email_jobs(business_id,kind,dedupe_key,status) values(b,'invoice',gen_random_uuid()::text,'sent') returning id into other;
  insert into public.finance_mail_reservations(job_id,provider_hash) values(other,'private-quota-unit');
 end loop;
 insert into public.finance_email_jobs(business_id,kind,dedupe_key) values(b,'invoice',gen_random_uuid()::text) returning id into other;
 again=public.finance_claim_email(b,'private-quota-unit');if again.id is not null then raise exception 'Free quota bypass';end if;
 if (select available_at from public.finance_email_jobs where id=other)<=now() then raise exception 'Quota job not deferred';end if;
 if public.finance_activate_owner(b,gen_random_uuid(),'wrong@example.invalid') then raise exception 'Unapproved owner activated';end if;
end $test$;
set local role anon;
do $$begin
 begin perform * from public.finance_worker_config;raise exception 'Worker key exposed';exception when insufficient_privilege then null;end;
 begin perform public.finance_claim_email(gen_random_uuid(),'denied');raise exception 'Anon claimed email';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'PASS email leases, stale completion denial, frozen payload, retry quota, expiry, free allowance, owner approval and closed permissions' as result;
rollback;