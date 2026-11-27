create or replace function private.service_slot_allowed(p_config jsonb,p_date date,p_time time,p_duration integer)
returns boolean language plpgsql stable security definer set search_path='' as $function$
declare
  v_availability jsonb; v_days jsonb; v_windows jsonb; v_interval integer; v_notice integer;
  v_before integer; v_after integer; v_weekday integer; v_start timestamp;
  v_window jsonb; v_window_days jsonb; v_start_time time; v_end_time time; v_ok boolean:=false;
begin
  v_availability:=coalesce(p_config->'availability','{}'::jsonb);
  v_weekday:=extract(dow from p_date)::integer;
  v_days:=coalesce(v_availability->'days','[0,1,2,3,4,5,6]'::jsonb);
  if not v_days @> to_jsonb(v_weekday) then return false; end if;
  v_interval:=greatest(1,coalesce((v_availability->>'interval_minutes')::integer,60));
  if mod(extract(hour from p_time)::integer*60+extract(minute from p_time)::integer,v_interval)<>0 then return false; end if;
  v_notice:=greatest(0,coalesce((v_availability->>'advance_notice_minutes')::integer,0));
  v_before:=greatest(0,coalesce((v_availability->>'buffer_before_minutes')::integer,0));
  v_after:=greatest(0,coalesce((v_availability->>'buffer_after_minutes')::integer,0));
  v_start:=p_date+p_time;
  if v_start < (statement_timestamp() at time zone 'Africa/Johannesburg')+make_interval(mins=>v_notice) then return false; end if;
  v_windows:=coalesce(v_availability->'windows','[]'::jsonb);
  if jsonb_typeof(v_windows)<>'array' or jsonb_array_length(v_windows)=0 then return true; end if;
  for v_window in select value from jsonb_array_elements(v_windows) loop
    v_window_days:=coalesce(v_window->'days','[0,1,2,3,4,5,6]'::jsonb);
    if not v_window_days @> to_jsonb(v_weekday) then continue; end if;
    v_start_time:=coalesce(v_window->>'start','00:00')::time;
    v_end_time:=coalesce(v_window->>'end','23:59')::time;
    if (v_start-make_interval(mins=>v_before))::time < v_start_time
      or (v_start+make_interval(mins=>p_duration+v_after))::time > v_end_time then continue; end if;
    v_ok:=true;exit;
  end loop;
  return v_ok;
end $function$;

create or replace function private.apply_service_booking_confirmation()
returns trigger language plpgsql security definer set search_path='' as $function$
declare v_confirmation text;
begin
  v_confirmation:=coalesce(NEW.configuration_snapshot->'requirements'->>'confirmation','automatic');
  NEW.expires_at:=null;
  if NEW.total_amount is null then
    NEW.status:='quote_requested';
    NEW.payment_status:='not_required';
  else
    NEW.status:=case when v_confirmation='manual' then 'pending_confirmation' else 'confirmed' end;
    NEW.payment_status:=case when coalesce(NEW.payment_amount,0)>0 then 'pending' else 'not_required' end;
  end if;
  return NEW;
end $function$;
drop trigger if exists service_booking_confirmation_status on public.service_bookings;
create trigger service_booking_confirmation_status before insert on public.service_bookings
for each row execute function private.apply_service_booking_confirmation();

create or replace function private.admin_update_service_booking(p_slug text,p_key text,p_booking_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_business uuid;v_booking public.service_bookings;v_status text;
begin
  select id into v_business from public.businesses where slug=p_slug and admin_key=p_key and active;
  if v_business is null then raise exception using errcode='28000',message='Invalid dashboard link';end if;
  select * into v_booking from public.service_bookings where id=p_booking_id and business_id=v_business for update;
  if v_booking.id is null then raise exception using errcode='P0002',message='Booking not found';end if;
  if p_action='confirm' and v_booking.status='pending_confirmation' then v_status:='confirmed';
  elsif p_action='cancel' and v_booking.payment_status<>'paid' and v_booking.status not in ('cancelled','expired') then v_status:='cancelled';
  else raise exception using errcode='22023',message='This booking cannot be changed in its current state';end if;
  update public.service_bookings set status=v_status,updated_at=clock_timestamp() where id=p_booking_id;
  return jsonb_build_object('id',p_booking_id,'status',v_status);
end $function$;
create or replace function public.admin_update_service_booking(p_slug text,p_key text,p_booking_id uuid,p_action text)
returns jsonb language sql security invoker set search_path='' as $function$
  select private.admin_update_service_booking($1,$2,$3,$4);
$function$;
grant execute on function private.admin_update_service_booking(text,text,uuid,text) to anon,authenticated;
revoke all on function private.admin_update_service_booking(text,text,uuid,text) from public;
revoke all on function public.admin_update_service_booking(text,text,uuid,text) from public;
grant execute on function public.admin_update_service_booking(text,text,uuid,text) to anon,authenticated;
notify pgrst,'reload schema';