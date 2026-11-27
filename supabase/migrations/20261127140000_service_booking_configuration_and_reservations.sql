alter table public.businesses
  add column if not exists booking_defaults jsonb not null default '{
    "pricing":{"mode":"fixed","amount":0,"tiers":[]},
    "duration_minutes":60,
    "capacity":{"minimum":1,"maximum":1},
    "availability":{"days":[0,1,2,3,4,5,6],"windows":[],"interval_minutes":60,"buffer_before_minutes":0,"buffer_after_minutes":0,"advance_notice_minutes":0},
    "addons":[],
    "location":{"modes":["business"],"places":[]},
    "requirements":{"cancellation_policy":"","confirmation":"automatic"},
    "payment":{"mode":"full","fixed_deposit_amount":0,"percentage":0},
    "customer_fields":{"first_name":true,"last_name":true,"phone":true,"email":true,"notes":false},
    "questions":[]
  }'::jsonb;

alter table public.services add column if not exists booking_config jsonb not null default '{}'::jsonb;
alter table public.services drop constraint if exists services_booking_config_object;
alter table public.services add constraint services_booking_config_object check(jsonb_typeof(booking_config)='object');

create table if not exists public.service_bookings(
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  idempotency_key uuid not null,
  slot_date date not null,
  slot_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null check(duration_minutes between 1 and 1440),
  buffer_before_minutes integer not null default 0 check(buffer_before_minutes between 0 and 1440),
  buffer_after_minutes integer not null default 0 check(buffer_after_minutes between 0 and 1440),
  participant_count integer not null check(participant_count between 1 and 10000),
  status text not null check(status in ('awaiting_payment','pending_confirmation','confirmed','quote_requested','cancelled','expired')),
  payment_status text not null default 'not_required' check(payment_status in ('not_required','pending','paid','failed','refunded')),
  total_amount integer check(total_amount is null or total_amount>=0),
  payment_amount integer check(payment_amount is null or payment_amount>=0),
  currency text not null default 'ZAR' check(currency='ZAR'),
  customer_data jsonb not null default '{}'::jsonb,
  selected_addons jsonb not null default '[]'::jsonb,
  answers jsonb not null default '{}'::jsonb,
  configuration_snapshot jsonb not null default '{}'::jsonb,
  payment_reference text unique,
  expires_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique(business_id,idempotency_key),
  check(ends_at>starts_at)
);
create index if not exists service_bookings_capacity_idx
  on public.service_bookings(business_id,service_id,starts_at,ends_at)
  where status in ('awaiting_payment','pending_confirmation','confirmed');
alter table public.service_bookings enable row level security;
revoke all on public.service_bookings from public,anon,authenticated;
grant select,insert,update,delete on public.service_bookings to service_role;

create or replace function private.resolve_service_booking_config(p_service_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_defaults jsonb; v_service jsonb; v_inherit jsonb; v_result jsonb; v_key text;
begin
  select b.booking_defaults,s.booking_config into v_defaults,v_service
  from public.services s join public.businesses b on b.id=s.business_id where s.id=p_service_id;
  if v_defaults is null then return null; end if;
  v_result:=v_defaults;
  v_inherit:=coalesce(v_service->'inherit','[]'::jsonb);
  for v_key in select jsonb_object_keys(v_service) loop
    if v_key<>'inherit' and not (v_inherit @> to_jsonb(v_key)) then
      v_result:=v_result || jsonb_build_object(v_key,v_service->v_key);
    end if;
  end loop;
  return v_result;
end $$;
revoke all on function private.resolve_service_booking_config(uuid) from public,anon,authenticated;

create or replace function private.save_service_booking_config(p_slug text,p_key text,p_service_id uuid,p_config jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_business uuid; v_result jsonb;
begin
  select id into v_business from public.businesses where slug=p_slug and admin_key=p_key and active;
  if v_business is null then raise exception using errcode='28000',message='Invalid dashboard link'; end if;
  if jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>30000 then
    raise exception using errcode='22023',message='Invalid service booking settings';
  end if;
  if not exists(select 1 from public.services where id=p_service_id and business_id=v_business) then
    raise exception using errcode='P0002',message='Service not found';
  end if;
  update public.services set booking_config=p_config,updated_at=clock_timestamp()
    where id=p_service_id and business_id=v_business returning booking_config into v_result;
  return v_result;
end $$;

create or replace function private.save_business_booking_defaults(p_slug text,p_key text,p_config jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_business uuid; v_result jsonb;
begin
  select id into v_business from public.businesses where slug=p_slug and admin_key=p_key and active;
  if v_business is null then raise exception using errcode='28000',message='Invalid dashboard link'; end if;
  if jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>30000 then
    raise exception using errcode='22023',message='Invalid business booking defaults';
  end if;
  update public.businesses set booking_defaults=p_config where id=v_business returning booking_defaults into v_result;
  return v_result;
end $$;

create or replace function private.get_admin_services(p_slug text,p_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_business_id uuid; v_defaults jsonb;
begin
  select b.id,b.booking_defaults into v_business_id,v_defaults
  from public.businesses b where b.slug=p_slug and b.admin_key=p_key and b.active;
  if v_business_id is null then raise exception using errcode='28000',message='Invalid dashboard link'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(s) || jsonb_build_object('detail_people_count',d.people_count,
      'detail_duration_minutes',d.duration_minutes,'location',s.location,'booking_policy',s.booking_policy,
      'booking_config',s.booking_config,'resolved_booking_config',private.resolve_service_booking_config(s.id),
      'booking_defaults',v_defaults) order by s.sort_order,s.created_at,s.id)
    from public.services s left join public.service_details d on d.service_id=s.id
    where s.business_id=v_business_id
  ),'[]'::jsonb);
end $$;

create or replace function public.save_service_booking_config(p_slug text,p_key text,p_service_id uuid,p_config jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.save_service_booking_config($1,$2,$3,$4);
$$;
create or replace function public.save_business_booking_defaults(p_slug text,p_key text,p_config jsonb)
returns jsonb language sql security invoker set search_path='' as $$
  select private.save_business_booking_defaults($1,$2,$3);
$$;

create or replace function private.service_slot_allowed(p_config jsonb,p_date date,p_time time,p_duration integer)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_availability jsonb; v_days jsonb; v_windows jsonb; v_interval integer; v_notice integer; v_before integer; v_after integer;
  v_weekday text; v_start timestamp; v_window jsonb; v_window_days jsonb; v_start_text text; v_end_text text;
  v_window_ok boolean := false;
begin
  v_availability:=coalesce(p_config->'availability','{}'::jsonb);
  v_weekday:=extract(dow from p_date)::integer::text;
  v_days:=coalesce(v_availability->'days','[0,1,2,3,4,5,6]'::jsonb);
  if not v_days @> to_jsonb(extract(dow from p_date)::integer) then return false; end if;
  v_interval:=greatest(1,coalesce((v_availability->>'interval_minutes')::integer,60));
  if mod(extract(hour from p_time)::integer*60+extract(minute from p_time)::integer,v_interval)<>0 then return false; end if;
  v_notice:=greatest(0,coalesce((v_availability->>'advance_notice_minutes')::integer,0));
  v_before:=greatest(0,coalesce((v_availability->>'buffer_before_minutes')::integer,0));
  v_after:=greatest(0,coalesce((v_availability->>'buffer_after_minutes')::integer,0));
  v_start:=p_date+p_time;
  if v_start < (statement_timestamp() at time zone 'Africa/Johannesburg') + make_interval(mins=>v_notice) then return false; end if;
  v_windows:=coalesce(v_availability->'windows','[]'::jsonb);
  if jsonb_typeof(v_windows)<>'array' or jsonb_array_length(v_windows)=0 then return true; end if;
  for v_window in select value from jsonb_array_elements(v_windows) loop
    v_window_days:=coalesce(v_window->'days','[0,1,2,3,4,5,6]'::jsonb);
    if not v_window_days @> to_jsonb(extract(dow from p_date)::integer) then continue; end if;
    v_start_text:=left(coalesce(v_window->>'start','00:00'),5);
    v_end_text:=left(coalesce(v_window->>'end','23:59'),5);
    if (v_start-make_interval(mins=>v_before))::time::text < v_start_text
      or (v_start+make_interval(mins=>p_duration+v_after))::time::text > v_end_text then continue; end if;
    v_window_ok:=true; exit;
  end loop;
  return v_window_ok;
end $$;
revoke all on function private.service_slot_allowed(jsonb,date,time,integer) from public,anon,authenticated;

create or replace function private.get_service_availability(p_slug text,p_service_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_business uuid; v_config jsonb; v_duration integer; v_min integer; v_max integer;
  v_before integer; v_after integer; v_result jsonb;
begin
  if p_from is null or p_to is null or p_to<p_from or p_to>p_from+interval '90 days' then
    raise exception using errcode='22023',message='Choose a date range of 90 days or less';
  end if;
  select b.id,private.resolve_service_booking_config(s.id),
    coalesce((private.resolve_service_booking_config(s.id)->>'duration_minutes')::integer,s.duration_minutes),
    coalesce((private.resolve_service_booking_config(s.id)->'capacity'->>'minimum')::integer,1),
    coalesce((private.resolve_service_booking_config(s.id)->'capacity'->>'maximum')::integer,1),
    coalesce((private.resolve_service_booking_config(s.id)->'availability'->>'buffer_before_minutes')::integer,0),
    coalesce((private.resolve_service_booking_config(s.id)->'availability'->>'buffer_after_minutes')::integer,0)
  into v_business,v_config,v_duration,v_min,v_max,v_before,v_after
  from public.businesses b join public.services s on s.business_id=b.id
  where b.slug=p_slug and b.active and s.id=p_service_id and s.is_published and s.is_active;
  if v_business is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',a.slot_date,'time',a.slot_time) order by a.slot_date,a.slot_time),'[]'::jsonb)
  into v_result from public.availability a
  where a.business_id=v_business and a.status='open' and a.slot_date between p_from and p_to
    and private.service_slot_allowed(v_config,a.slot_date,a.slot_time,v_duration)
    and coalesce((select sum(b.participant_count) from public.service_bookings b
      where b.business_id=v_business and b.service_id=p_service_id
        and b.status in ('awaiting_payment','pending_confirmation','confirmed')
        and (b.expires_at is null or b.expires_at>statement_timestamp())
        and (a.slot_date+a.slot_time) at time zone 'Africa/Johannesburg' <
          b.ends_at+make_interval(mins=>b.buffer_after_minutes+v_before)
        and ((a.slot_date+a.slot_time) at time zone 'Africa/Johannesburg')+
          make_interval(mins=>v_duration+v_after) > b.starts_at-make_interval(mins=>b.buffer_before_minutes)),0)+v_min<=v_max;
  return v_result;
end $$;

create or replace function public.get_service_availability(p_slug text,p_service_id uuid,p_from date,p_to date)
returns jsonb language sql stable security invoker set search_path='' as $$
  select private.get_service_availability($1,$2,$3,$4);
$$;

create or replace function private.create_service_booking(
  p_slug text,p_service_id uuid,p_idempotency_key uuid,p_date date,p_time time,
  p_participant_count integer,p_customer_data jsonb,p_selected_addons jsonb,p_answers jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_business uuid; v_service public.services; v_config jsonb; v_start timestamptz; v_end timestamptz;
  v_duration integer; v_before integer; v_after integer; v_min integer; v_max integer; v_occupied integer;
  v_pricing jsonb; v_mode text; v_base integer; v_total integer; v_payment jsonb; v_payment_due integer;
  v_status text; v_paystatus text; v_addons jsonb:='[]'::jsonb; v_addon jsonb; v_id uuid; v_existing public.service_bookings;
  v_required jsonb; v_field text; v_answer jsonb; v_amount integer; v_tier jsonb; v_tier_found boolean:=false;
  v_question jsonb; v_in numeric; v_booking jsonb;
begin
  if p_idempotency_key is null or jsonb_typeof(coalesce(p_customer_data,'{}'::jsonb))<>'object'
    or jsonb_typeof(coalesce(p_selected_addons,'[]'::jsonb))<>'array'
    or jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' then
    raise exception using errcode='22023',message='Booking details are invalid';
  end if;
  select b.id into v_business from public.businesses b where b.slug=p_slug and b.active;
  if v_business is null then raise exception using errcode='P0002',message='This service is no longer available'; end if;
  select s.* into v_service from public.services s
    where s.business_id=v_business and s.id=p_service_id and s.is_published and s.is_active for share;
  if v_service.id is null then raise exception using errcode='P0002',message='This service is no longer available'; end if;
  select * into v_existing from public.service_bookings where business_id=v_business and idempotency_key=p_idempotency_key;
  if v_existing.id is not null then return jsonb_build_object('booking_id',v_existing.id,'status',v_existing.status,
    'total_amount',v_existing.total_amount,'payment_amount',v_existing.payment_amount,'currency',v_existing.currency,
    'payment_reference',v_existing.payment_reference); end if;

  v_config:=private.resolve_service_booking_config(v_service.id);
  v_duration:=greatest(1,least(1440,coalesce((v_config->>'duration_minutes')::integer,v_service.duration_minutes)));
  v_before:=greatest(0,least(1440,coalesce((v_config->'availability'->>'buffer_before_minutes')::integer,0)));
  v_after:=greatest(0,least(1440,coalesce((v_config->'availability'->>'buffer_after_minutes')::integer,0)));
  v_min:=greatest(1,coalesce((v_config->'capacity'->>'minimum')::integer,1));
  v_max:=greatest(v_min,coalesce((v_config->'capacity'->>'maximum')::integer,1));
  if p_participant_count not between v_min and v_max then raise exception using errcode='22023',message='Choose a participant count within this service capacity'; end if;
  if not private.service_slot_allowed(v_config,p_date,p_time,v_duration)
    or not exists(select 1 from public.availability a where a.business_id=v_business and a.slot_date=p_date and a.slot_time=p_time and a.status='open') then
    raise exception using errcode='P0001',message='This service or time is not available';
  end if;
  v_start:=(p_date+p_time) at time zone 'Africa/Johannesburg';
  v_end:=v_start+make_interval(mins=>v_duration);
  perform pg_advisory_xact_lock(hashtextextended(v_business::text||':'||v_service.id::text||':'||v_start::text,0));
  update public.service_bookings set status='expired',payment_status=case when payment_status='pending' then 'failed' else payment_status end,updated_at=clock_timestamp()
  where business_id=v_business and status='awaiting_payment' and expires_at<=statement_timestamp();
  select coalesce(sum(b.participant_count),0)::integer into v_occupied from public.service_bookings b
  where b.business_id=v_business and b.service_id=v_service.id
    and b.status in ('awaiting_payment','pending_confirmation','confirmed')
    and (b.expires_at is null or b.expires_at>statement_timestamp())
    and v_start < b.ends_at+make_interval(mins=>b.buffer_after_minutes+v_before)
    and v_end+make_interval(mins=>v_after) > b.starts_at-make_interval(mins=>b.buffer_before_minutes);
  if v_occupied+p_participant_count>v_max then raise exception using errcode='P0001',message='This time has reached its participant capacity'; end if;

  v_required:=coalesce(v_config->'customer_fields','{}'::jsonb);
  for v_field in select key from jsonb_each(v_required) where value='true'::jsonb loop
    if nullif(btrim(coalesce(p_customer_data->>v_field,'')),'') is null then
      raise exception using errcode='22023',message='Complete all required customer information';
    end if;
  end loop;
  if length(coalesce(p_customer_data->>'email',''))>254 or length(coalesce(p_customer_data->>'phone',''))>30 then
    raise exception using errcode='22023',message='Customer contact details are too long';
  end if;
  for v_question in select value from jsonb_array_elements(coalesce(v_config->'questions','[]'::jsonb)) loop
    if coalesce((v_question->>'required')::boolean,false) and nullif(btrim(coalesce(p_answers->>(v_question->>'id'),'')),'') is null then
      raise exception using errcode='22023',message='Answer all required booking questions';
    end if;
  end loop;

  v_pricing:=coalesce(v_config->'pricing','{}'::jsonb);
  v_mode:=coalesce(v_pricing->>'mode','fixed');
  v_base:=greatest(0,coalesce((v_pricing->>'amount')::integer,v_service.price_amount));
  if v_mode='custom_quote' then v_total:=null;
  elsif v_mode='per_person' then v_total:=v_base*p_participant_count;
  elsif v_mode='per_hour' then v_total:=round(v_base*v_duration::numeric/60)::integer;
  elsif v_mode='tiered' then
    v_tier_found:=false;
    for v_tier in select value from jsonb_array_elements(coalesce(v_pricing->'tiers','[]'::jsonb)) loop
      if p_participant_count between (v_tier->>'minimum')::integer and (v_tier->>'maximum')::integer then
        v_total:=greatest(0,(v_tier->>'amount')::integer);v_tier_found:=true;exit;
      end if;
    end loop;
    if not v_tier_found then raise exception using errcode='22023',message='No price tier covers this participant count';end if;
  else v_total:=v_base;
  end if;
  if v_total is not null then
    for v_answer in select value from jsonb_array_elements(p_selected_addons) loop
      v_addon:=null;
      select value into v_addon from jsonb_array_elements(coalesce(v_config->'addons','[]'::jsonb))
        where value->>'id'=trim(both '"' from v_answer::text);
      if v_addon is null then raise exception using errcode='22023',message='One selected extra is no longer available';end if;
      v_amount:=greatest(0,coalesce((v_addon->>'price_amount')::integer,0));
      if coalesce(v_addon->>'price_basis','per_booking')='per_person' then v_amount:=v_amount*p_participant_count;end if;
      v_total:=v_total+v_amount;
      v_addons:=v_addons||jsonb_build_array(v_addon);
    end loop;
  elsif jsonb_array_length(p_selected_addons)>0 then
    raise exception using errcode='22023',message='Extras cannot be priced until this service has a quotation';
  end if;
  v_payment:=coalesce(v_config->'payment','{"mode":"full"}'::jsonb);
  if v_total is null then v_payment_due:=null;
  elsif coalesce(v_payment->>'mode','full')='fixed_deposit' then
    v_payment_due:=least(v_total,greatest(0,coalesce((v_payment->>'fixed_deposit_amount')::integer,0)));
  elsif coalesce(v_payment->>'mode','full')='percentage_deposit' then
    v_payment_due:=least(v_total,greatest(0,round(v_total*greatest(0,least(100,coalesce((v_payment->>'percentage')::numeric,0)))/100)::integer));
  else v_payment_due:=v_total;
  end if;
  if v_total is null then v_status:='quote_requested';v_paystatus:='not_required';
  elsif v_payment_due=0 then
    v_status:=case when coalesce(v_config->'requirements'->>'confirmation','automatic')='manual' then 'pending_confirmation' else 'confirmed' end;
    v_paystatus:='not_required';
  else v_status:='awaiting_payment';v_paystatus:='pending';end if;
  v_id:=gen_random_uuid();
  insert into public.service_bookings(id,business_id,service_id,service_name,idempotency_key,slot_date,slot_time,starts_at,ends_at,
    duration_minutes,buffer_before_minutes,buffer_after_minutes,participant_count,status,payment_status,total_amount,payment_amount,
    customer_data,selected_addons,answers,configuration_snapshot,payment_reference,expires_at)
  values(v_id,v_business,v_service.id,v_service.name,p_idempotency_key,p_date,p_time,v_start,v_end,v_duration,v_before,v_after,
    p_participant_count,v_status,v_paystatus,v_total,v_payment_due,p_customer_data,v_addons,p_answers,v_config,
    'LQ'||replace(v_id::text,'-',''),case when v_status='awaiting_payment' then statement_timestamp()+interval '15 minutes' else null end);
  return jsonb_build_object('booking_id',v_id,'status',v_status,'total_amount',v_total,'payment_amount',v_payment_due,
    'currency','ZAR','payment_reference','LQ'||replace(v_id::text,'-',''),'duration_minutes',v_duration,'participant_count',p_participant_count,
    'selected_addons',v_addons,'booking',v_booking);
end $$;

create or replace function public.create_service_booking(
 p_slug text,p_service_id uuid,p_idempotency_key uuid,p_date date,p_time time,p_participant_count integer,
 p_customer_data jsonb,p_selected_addons jsonb,p_answers jsonb
) returns jsonb language sql security invoker set search_path='' as $$
 select private.create_service_booking($1,$2,$3,$4,$5,$6,$7,$8,$9);
$$;

create or replace function private.confirm_service_booking(p_reference text,p_paid_amount integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_booking public.service_bookings;v_config jsonb;v_next text;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception using errcode='42501',message='Not allowed';end if;
  select * into v_booking from public.service_bookings where payment_reference=p_reference for update;
  if v_booking.id is null then raise exception using errcode='P0002',message='Booking payment reference not found';end if;
  if v_booking.payment_status='paid' then return jsonb_build_object('booking_id',v_booking.id,'status',v_booking.status,'payment_status','paid');end if;
  if v_booking.payment_amount is distinct from p_paid_amount then raise exception using errcode='22023',message='Verified amount does not match booking';end if;
  v_config:=v_booking.configuration_snapshot;
  v_next:=case when coalesce(v_config->'requirements'->>'confirmation','automatic')='manual' then 'pending_confirmation' else 'confirmed' end;
  update public.service_bookings set payment_status='paid',status=v_next,expires_at=null,updated_at=clock_timestamp()
    where id=v_booking.id;
  return jsonb_build_object('booking_id',v_booking.id,'status',v_next,'payment_status','paid');
end $$;

create or replace function public.confirm_service_booking(p_reference text,p_paid_amount integer)
returns jsonb language sql security invoker set search_path='' as $$
 select private.confirm_service_booking($1,$2);
$$;

create or replace function private.get_service_booking(p_reference text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',b.status,'service_name',b.service_name,'slot_date',b.slot_date,'slot_time',b.slot_time,
   'total_amount',b.total_amount,'payment_amount',b.payment_amount,'currency',b.currency)
 from public.service_bookings b where b.payment_reference=p_reference;
$$;
create or replace function public.get_service_booking(p_reference text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.get_service_booking($1);
$$;

create or replace function private.get_public_page(p_slug text)
returns json language plpgsql stable security definer set search_path='' as $$
declare v_business record; v_slots json; v_services json; v_categories json;
begin
  select b.* into v_business from public.businesses b where b.slug=p_slug and b.active;
  if v_business.id is null then return null; end if;
  select coalesce(json_agg(json_build_object('date',a.slot_date,'time',a.slot_time) order by a.slot_date,a.slot_time),'[]'::json)
  into v_slots from public.availability a where a.business_id=v_business.id and a.status='open'
    and (a.slot_date+a.slot_time)>(statement_timestamp() at time zone 'Africa/Johannesburg');
  select coalesce(json_agg(json_build_object(
    'id',s.id,'category_id',s.category_id,'photo_path',nullif(s.photo_path,''),'name',s.name,'description',s.description,
    'service_type',s.service_type,'duration_minutes',coalesce(d.duration_minutes,s.duration_minutes),
    'price_amount',s.price_amount,'currency',s.currency,'price_basis',s.price_basis,'participant_count',coalesce(d.people_count,s.participant_count),
    'location',s.location,'booking_policy',s.booking_policy,'booking_config',private.resolve_service_booking_config(s.id)
  ) order by s.sort_order,s.created_at,s.id),'[]'::json)
  into v_services from public.services s left join public.service_categories c on c.id=s.category_id and c.business_id=s.business_id
    left join public.service_details d on d.service_id=s.id
  where s.business_id=v_business.id and s.is_published and s.is_active and (s.category_id is null or c.enabled);
  select coalesce(json_agg(json_build_object('id',c.id,'label',c.label,'icon',c.icon,'sort_order',c.sort_order)
    order by c.sort_order,c.created_at,c.id),'[]'::json)
  into v_categories from public.service_categories c where c.business_id=v_business.id and c.enabled and exists(
    select 1 from public.services s where s.business_id=c.business_id and s.category_id=c.id and s.is_published and s.is_active);
  return json_build_object('name',v_business.name,'whatsapp_number',v_business.whatsapp_number,
    'last_updated_at',v_business.last_updated_at,'logo_url',v_business.logo_url,
    'instagram_url',case when v_business.show_social_icons then v_business.instagram_url else null end,
    'facebook_url',case when v_business.show_social_icons then v_business.facebook_url else null end,
    'tiktok_url',case when v_business.show_social_icons then v_business.tiktok_url else null end,
    'slots',v_slots,'services',v_services,'categories',v_categories,
    'tagline',v_business.tagline,'description',v_business.description,'email',v_business.email,'phone_number',v_business.phone_number,
    'website_url',v_business.website_url,'hero_photo_path',v_business.hero_photo_path,'service_area',v_business.service_area,
    'show_social_icons',v_business.show_social_icons,'gallery_photo_paths',v_business.gallery_photo_paths,'delivery_methods',v_business.delivery_methods);
end $$;

create or replace function private.get_service_booking_defaults(p_slug text,p_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare v_defaults jsonb;
begin
  select booking_defaults into v_defaults from public.businesses where slug=p_slug and admin_key=p_key and active;
  if v_defaults is null then raise exception using errcode='28000',message='Invalid dashboard link';end if;
  return v_defaults;
end $function$;
create or replace function public.get_service_booking_defaults(p_slug text,p_key text)
returns jsonb language sql security invoker set search_path='' as $function$
 select private.get_service_booking_defaults($1,$2);
$function$;
create or replace function private.get_admin_service_bookings(p_slug text,p_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare v_business uuid;
begin
  select id into v_business from public.businesses where slug=p_slug and admin_key=p_key and active;
  if v_business is null then raise exception using errcode='28000',message='Invalid dashboard link';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'service_name',b.service_name,'date',b.slot_date,'time',b.slot_time,
    'participants',b.participant_count,'status',b.status,'payment_status',b.payment_status,'total_amount',b.total_amount,
    'payment_amount',b.payment_amount,'customer',b.customer_data,'created_at',b.created_at)
    order by b.slot_date,b.slot_time,b.created_at desc)
    from public.service_bookings b where b.business_id=v_business and b.status not in ('cancelled','expired')
      and b.slot_date>=current_date),'[]'::jsonb);
end $function$;
create or replace function public.get_admin_service_bookings(p_slug text,p_key text)
returns jsonb language sql security invoker set search_path='' as $function$
 select private.get_admin_service_bookings($1,$2);
$function$;

grant execute on function private.save_service_booking_config(text,text,uuid,jsonb) to anon,authenticated;
grant execute on function private.save_business_booking_defaults(text,text,jsonb) to anon,authenticated;
grant execute on function private.get_admin_services(text,text) to anon,authenticated;
grant execute on function private.get_service_availability(text,uuid,date,date) to anon,authenticated;
grant execute on function private.create_service_booking(text,uuid,uuid,date,time,integer,jsonb,jsonb,jsonb) to anon,authenticated;
grant execute on function private.get_service_booking(text) to anon,authenticated;
grant execute on function private.get_service_booking_defaults(text,text) to anon,authenticated;
grant execute on function private.get_admin_service_bookings(text,text) to anon,authenticated;
grant execute on function private.confirm_service_booking(text,integer) to service_role;

revoke all on function private.save_service_booking_config(text,text,uuid,jsonb) from public;
revoke all on function private.save_business_booking_defaults(text,text,jsonb) from public;
revoke all on function private.get_admin_services(text,text) from public;
revoke all on function private.get_service_availability(text,uuid,date,date) from public;
revoke all on function private.create_service_booking(text,uuid,uuid,date,time,integer,jsonb,jsonb,jsonb) from public;
revoke all on function private.confirm_service_booking(text,integer) from public,anon,authenticated;
revoke all on function private.get_service_booking(text) from public;
revoke all on function private.get_service_booking_defaults(text,text) from public;
revoke all on function private.get_admin_service_bookings(text,text) from public;
revoke all on function public.save_service_booking_config(text,text,uuid,jsonb) from public;
revoke all on function public.save_business_booking_defaults(text,text,jsonb) from public;
revoke all on function public.get_service_availability(text,uuid,date,date) from public;
revoke all on function public.create_service_booking(text,uuid,uuid,date,time,integer,jsonb,jsonb,jsonb) from public;
revoke all on function public.confirm_service_booking(text,integer) from public;
revoke all on function public.get_service_booking(text) from public;
grant execute on function public.save_service_booking_config(text,text,uuid,jsonb) to anon,authenticated;
grant execute on function public.save_business_booking_defaults(text,text,jsonb) to anon,authenticated;
grant execute on function public.get_service_availability(text,uuid,date,date) to anon,authenticated;
grant execute on function public.create_service_booking(text,uuid,uuid,date,time,integer,jsonb,jsonb,jsonb) to anon,authenticated;
grant execute on function public.confirm_service_booking(text,integer) to service_role;
grant execute on function public.get_service_booking(text) to anon,authenticated;
grant execute on function public.get_admin_service_bookings(text,text) to anon,authenticated;
notify pgrst,'reload schema';
