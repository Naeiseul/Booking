-- Owner approval and free direct email delivery. No provider subscription is provisioned.
alter table public.finance_accounts add column owner_email text check(owner_email is null or owner_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.finance_accounts add column email_from text check(email_from is null or email_from ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');
alter table public.finance_accounts add column email_key_env text check(email_key_env is null or email_key_env ~ '^RESEND_API_KEY(_[A-Z0-9_]+)?$');
alter table public.finance_accounts add column email_enabled boolean not null default false;
alter table public.finance_accounts add column last_login_request timestamptz;
alter table public.finance_email_jobs drop constraint finance_email_jobs_kind_check;
alter table public.finance_email_jobs add constraint finance_email_jobs_kind_check check(kind in('invoice','receipt','login'));
alter table public.finance_email_jobs add column payload jsonb;
alter table public.finance_email_jobs add column first_attempt_at timestamptz;
alter table public.finance_email_jobs add column lease_token uuid;
alter table public.finance_email_jobs add column leased_until timestamptz;
create table public.finance_mail_reservations (
 job_id uuid primary key references public.finance_email_jobs(id) on delete cascade,
 provider_hash text not null, reserved_at timestamptz not null default now()
);
create index finance_mail_quota_window on public.finance_mail_reservations(provider_hash,reserved_at);
create table public.finance_worker_config (
 id boolean primary key default true check(id),
 signing_secret text not null default replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','')
);
insert into public.finance_worker_config(id) values(true);
alter table public.finance_worker_config enable row level security;
alter table public.finance_mail_reservations enable row level security;
revoke all on public.finance_worker_config,public.finance_mail_reservations from public,anon,authenticated;
grant all on public.finance_worker_config,public.finance_mail_reservations to service_role;

create function public.finance_activate_owner(p_business uuid,p_user uuid,p_email text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.finance_accounts where business_id=p_business and lower(owner_email)=lower(p_email)) then return false; end if;
 insert into public.finance_members(business_id,user_id) values(p_business,p_user) on conflict do nothing;
 return true;
end $$;
create function public.finance_login_request(p_business uuid)
returns text language plpgsql security invoker set search_path='' as $$
declare email text;
begin
 update public.finance_accounts set last_login_request=now()
 where business_id=p_business and owner_email is not null and (last_login_request is null or last_login_request<now()-interval '60 seconds') returning owner_email into email;
 return email;
end $$;
create function public.finance_claim_email(p_business uuid,p_provider_hash text)
returns public.finance_email_jobs language plpgsql security invoker set search_path='' as $$
declare job public.finance_email_jobs; quota integer;
begin
 if not exists(select 1 from public.finance_accounts where business_id=p_business and email_enabled and email_from is not null and email_key_env is not null) then return null; end if;
 -- Keep retries within the provider's 24-hour idempotency window. Ambiguous older deliveries require review.
 update public.finance_email_jobs set status='manual_review',last_error='Delivery needs review before retrying.'
 where business_id=p_business and status in('pending','failed','sending') and
 (attempts>=5 or first_attempt_at<now()-interval '20 hours' or (kind='login' and created_at<now()-interval '30 minutes'));
 select * into job from public.finance_email_jobs
 where business_id=p_business and available_at<=now() and
 (status in('pending','failed') or (status='sending' and leased_until<now()))
 order by created_at for update skip locked limit 1;
 if job.id is null then return null; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_provider_hash,0));
 if not exists(select 1 from public.finance_mail_reservations where job_id=job.id) then
  select count(*) into quota from public.finance_mail_reservations where provider_hash=p_provider_hash and reserved_at>now()-interval '24 hours';
  if quota>=95 then
   update public.finance_email_jobs set available_at=now()+interval '1 hour',last_error='Free email allowance reached. Delivery will retry later.' where id=job.id;
   return null;
  end if;
  insert into public.finance_mail_reservations(job_id,provider_hash) values(job.id,p_provider_hash);
 end if;
 update public.finance_email_jobs set status='sending',attempts=attempts+1,
 first_attempt_at=coalesce(first_attempt_at,now()),lease_token=gen_random_uuid(),leased_until=now()+interval '5 minutes'
 where id=job.id returning * into job;
 return job;
end $$;
create function public.finance_store_mail_payload(p_id uuid,p_lease uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 update public.finance_email_jobs set payload=coalesce(payload,p_payload) where id=p_id and lease_token=p_lease and status='sending' returning payload into result;
 if result is null then raise exception using errcode='40001',message='Email delivery lease changed'; end if;
 return result;
end $$;
create function public.finance_finish_email(p_id uuid,p_lease uuid,p_status text,p_provider_id text,p_error text,p_delay integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_status not in('sent','failed','manual_review') then raise exception using errcode='22023',message='Invalid delivery status'; end if;
 update public.finance_email_jobs set status=p_status,provider_id=coalesce(p_provider_id,provider_id),
 sent_at=case when p_status='sent' then now() else sent_at end,last_error=left(p_error,300),
 available_at=now()+make_interval(secs=>greatest(30,least(coalesce(p_delay,60),86400))),leased_until=null
 where id=p_id and lease_token=p_lease and status='sending';
 return found;
end $$;
do $$ declare f regprocedure; begin
 for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('finance_activate_owner','finance_login_request','finance_claim_email','finance_store_mail_payload','finance_finish_email') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
