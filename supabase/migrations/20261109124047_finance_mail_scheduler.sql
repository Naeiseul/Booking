create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create function public.finance_dispatch_pending_email()
returns integer language plpgsql security invoker set search_path='' as $$
declare item record; payload jsonb; ts text; signature text; secret text; submitted integer=0;
begin
 select signing_secret into secret from public.finance_worker_config where id=true;
 for item in
  select distinct b.slug from public.businesses b
  join public.finance_accounts a on a.business_id=b.id
  join public.finance_email_jobs j on j.business_id=b.id
  where b.active and a.email_enabled and a.email_key_env is not null and j.available_at<=now()
   and (j.status in('pending','failed') or (j.status='sending' and j.leased_until<now()))
 loop
  payload=jsonb_build_object('slug',item.slug,'action','dispatch_emails');
  ts=floor(extract(epoch from clock_timestamp()))::bigint::text;
  signature=encode(extensions.hmac(convert_to(ts||'.'||payload::text,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex');
  perform net.http_post(
   url:='https://jtonmfevmcmnkmdjmubn.supabase.co/functions/v1/finance-api',
   headers:=jsonb_build_object('Content-Type','application/json','X-Finance-Worker-Time',ts,'X-Finance-Worker-Signature',signature),
   body:=payload
  );
  submitted=submitted+1;
 end loop;
 return submitted;
end $$;
revoke all on function public.finance_dispatch_pending_email() from public,anon,authenticated;
select cron.schedule('finance-email-delivery','*/5 * * * *','select public.finance_dispatch_pending_email();');
