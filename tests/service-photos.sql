begin;
create temporary table photo_test_context as select gen_random_uuid() as a,gen_random_uuid() as b,gen_random_uuid() as service_id,gen_random_uuid() as object_id,
'qa-'||gen_random_uuid()::text as slug1,'qa-'||gen_random_uuid()::text as slug2,gen_random_uuid()::text as key1,gen_random_uuid()::text as key2;
insert into public.businesses(id,slug,name,admin_key) select a,slug1,'Photo fixture A',key1 from photo_test_context union all select b,slug2,'Photo fixture B',key2 from photo_test_context;
insert into public.service_categories(id,business_id,label,icon,enabled) select gen_random_uuid(),a,'Configured','grid',true from photo_test_context;
insert into storage.objects(bucket_id,name,metadata)
select 'service-photos',a::text||'/'||object_id::text||'.png','{"mimetype":"image/png","size":100}'::jsonb from photo_test_context
union all select 'service-photos',b::text||'/'||object_id::text||'.png','{"mimetype":"image/png","size":100}'::jsonb from photo_test_context;
insert into public.availability(business_id,slot_date,slot_time,status)
select a,(v.moment)::date,(v.moment)::time,'open' from photo_test_context cross join
(values ((statement_timestamp() at time zone 'Africa/Johannesburg')-interval '1 minute'),((statement_timestamp() at time zone 'Africa/Johannesburg')+interval '1 hour')) v(moment);
grant select on photo_test_context to anon,authenticated;
set local role anon;
do $test$
declare c record;s jsonb;page jsonb;category uuid;own_path text;foreign_path text;
begin
 select * into c from pg_temp.photo_test_context;
 own_path:=c.a::text||'/'||c.object_id::text||'.png';foreign_path:=c.b::text||'/'||c.object_id::text||'.png';
 if public.get_admin_photo_context(c.slug1,c.key1)<>c.a then raise exception 'Photo auth scope';end if;
 begin perform public.get_admin_photo_context(c.slug1,'wrong');raise exception 'Wrong photo key accepted';exception when sqlstate '28000' then null;end;
 if jsonb_array_length(public.get_admin_service_photos(c.slug1,c.key1))<>1 then raise exception 'Photo library isolation';end if;
 -- Category ID is exposed through the existing credential-checked admin category RPC.
 category:=(public.get_admin_categories(c.slug1,c.key1)->0->>'id')::uuid;
 s:=public.save_admin_service(c.slug1,c.key1,c.service_id,'Photo service','','private',60,10000,'per_session',1,true,null,category,true,own_path);
 if s->>'photo_path'<>own_path then raise exception 'Photo not saved';end if;
 page:=public.get_public_page(c.slug1)::jsonb;
 if page->'services'->0->>'photo_path'<>own_path then raise exception 'Public photo missing';end if;
 if jsonb_array_length(page->'slots')<>1 or (page->'slots'->0)?'status' then raise exception 'Expired slots/slot contract';end if;
 begin perform public.save_admin_service(c.slug1,c.key1,c.service_id,'Photo service','','private',60,10000,'per_session',1,true,(s->>'updated_at')::timestamptz,category,true,foreign_path);raise exception 'Cross-business photo accepted';exception when check_violation then null;end;
 begin perform public.save_admin_service(c.slug1,c.key1,c.service_id,'Photo service','','private',60,10000,'per_session',1,true,(s->>'updated_at')::timestamptz,category,true,c.a::text||'/'||gen_random_uuid()::text||'.png');raise exception 'Missing photo accepted';exception when check_violation then null;end;
 s:=public.save_admin_service(c.slug1,c.key1,c.service_id,'Photo service','','private',60,10000,'per_session',1,true,(s->>'updated_at')::timestamptz,category,true);
 if s->>'photo_path'<>own_path then raise exception 'Old client removed photo';end if;
 s:=public.save_admin_service(c.slug1,c.key1,c.service_id,'Photo service','','private',60,10000,'per_session',1,true,(s->>'updated_at')::timestamptz,category,true,'');
 if s->>'photo_path'<>'' then raise exception 'Photo removal failed';end if;
end;
$test$;
reset role;rollback;
select 'PASS: photo auth/library/ownership/attachment/removal/backward compatibility; past slots omitted; date/time-only response. Fixtures rolled back.' as result;