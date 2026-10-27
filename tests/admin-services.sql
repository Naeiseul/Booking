-- Integration tests: run against the target database; all fixtures are rolled back.
begin;
create temporary table service_test_context as
select 'qa-' || gen_random_uuid()::text as slug1, gen_random_uuid()::text as key1,
       'qa-' || gen_random_uuid()::text as slug2, gen_random_uuid()::text as key2,
       'qa-' || gen_random_uuid()::text as inactive_slug, gen_random_uuid()::text as inactive_key;
insert into public.businesses (slug, admin_key, name)
select slug1, key1, 'Services integration fixture A' from service_test_context
union all select slug2, key2, 'Services integration fixture B' from service_test_context;
insert into public.businesses (slug, admin_key, name, active)
select inactive_slug, inactive_key, 'Inactive services fixture', false from service_test_context;
insert into public.availability (business_id, slot_date, slot_time, status)
select b.id, current_date + 1, t.slot_time, t.status
from public.businesses b cross join (values ('10:00'::time, 'open'), ('11:00'::time, 'taken')) t(slot_time,status)
where b.slug = (select slug1 from service_test_context);
grant select on service_test_context to anon, authenticated;
set local role anon;

do $test$
declare
    ctx record;
    service_id uuid := gen_random_uuid();
    class_id uuid := gen_random_uuid();
    item jsonb;
    replay jsonb;
    listing jsonb;
    old_version timestamptz;
begin
    select * into ctx from pg_temp.service_test_context;
    if public.get_admin_services(ctx.slug1, ctx.key1) <> '[]'::jsonb then raise exception 'Initial list not empty'; end if;
    begin
        perform public.get_admin_services(ctx.slug1, 'wrong');
        raise exception 'Invalid key accepted';
    exception when sqlstate '28000' then null; end;
    begin
        perform public.get_admin_services(ctx.inactive_slug, ctx.inactive_key);
        raise exception 'Inactive business accepted';
    exception when sqlstate '28000' then null; end;

    item := public.save_admin_service(ctx.slug1,ctx.key1,service_id,'  Test service  ','  Details  ','private',90,45050,'per_session',2,false,null);
    if item->>'name' <> 'Test service' or (item->>'duration_minutes')::int <> 90 or (item->>'price_amount')::int <> 45050 then raise exception 'Create values incorrect'; end if;
    if item->>'description' <> 'Details' or item->>'currency' <> 'ZAR' then raise exception 'Normalization incorrect'; end if;
    replay := public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Test service','Details','private',90,45050,'per_session',2,false,null);
    if replay <> item then raise exception 'Create retry not idempotent'; end if;
    if jsonb_array_length(public.get_admin_services(ctx.slug1,ctx.key1)) <> 1 then raise exception 'Read after create failed'; end if;
    if public.get_admin_services(ctx.slug2,ctx.key2) <> '[]'::jsonb then raise exception 'Business isolation failed'; end if;
    old_version := (item->>'updated_at')::timestamptz;

    begin
        perform public.save_admin_service(ctx.slug2,ctx.key2,service_id,'Hijack','','private',60,100,'per_session',1,false,old_version);
        raise exception 'Cross-business update accepted';
    exception when serialization_failure then null; end;
    begin
        perform public.save_admin_service(ctx.slug2,ctx.key2,service_id,'Test service','Details','private',90,45050,'per_session',2,false,null);
        raise exception 'Cross-business ID collision accepted';
    exception when serialization_failure then null; end;
    begin
        perform public.save_admin_service(ctx.slug1,'wrong',gen_random_uuid(),'Test','','private',60,100,'per_session',1,false,null);
        raise exception 'Save accepted invalid key';
    exception when sqlstate '28000' then null; end;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'','','private',0,-1,'per_session',0,false,null);
        raise exception 'Invalid fields accepted';
    exception when check_violation then null; end;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Missing duration','','private',null,100,'per_session',1,false,null);
        raise exception 'Null duration accepted';
    exception when not_null_violation then null; end;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Invalid class','','class',60,100,'per_session',10,false,null);
        raise exception 'Class capacity stored as service participants';
    exception when check_violation then null; end;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Invalid duration','','private',1441,100,'per_session',1,false,null);
        raise exception 'Duration over 24 hours accepted';
    exception when check_violation then null; end;

    item := public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Edited service','Updated','private',95,12345,'per_person',3,true,old_version);
    listing := public.get_admin_services(ctx.slug1,ctx.key1);
    if listing->0->>'name' <> 'Edited service' or not (listing->0->>'is_published')::boolean or (listing->0->>'price_amount')::int <> 12345 then raise exception 'Edit/read/visibility failed'; end if;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Stale edit','','private',60,100,'per_session',1,false,old_version);
        raise exception 'Stale update accepted';
    exception when serialization_failure then null; end;
    item := public.save_admin_service(ctx.slug1,ctx.key1,class_id,'Shared class','','class',45,0,'per_person',null,false,null);
    if item->>'participant_count' is not null or item->>'price_basis' <> 'per_person' then raise exception 'Class setup incorrect'; end if;

    begin perform count(*) from public.services; raise exception 'Direct table read allowed'; exception when insufficient_privilege then null; end;
    begin update public.services set name = 'Unauthorized'; raise exception 'Direct update allowed'; exception when insufficient_privilege then null; end;
    begin delete from public.services; raise exception 'Direct delete allowed'; exception when insufficient_privilege then null; end;
    listing := public.get_public_page(ctx.slug1)::jsonb;
    if jsonb_array_length(listing->'slots') <> 1 or (listing->'slots'->0) ? 'status' then raise exception 'Public slot contract changed'; end if;
end;
$test$;

reset role;
set local role authenticated;
do $test$
declare ctx record;
begin
    select * into ctx from pg_temp.service_test_context;
    if jsonb_array_length(public.get_admin_services(ctx.slug1,ctx.key1)) <> 2 then raise exception 'Authenticated RPC failed'; end if;
    begin perform count(*) from public.services; raise exception 'Authenticated direct read allowed'; exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
rollback;
select 'PASS: create, read after save, edit, duration, integer cents, visibility, class settings, idempotent create retry, stale edit protection, invalid input, invalid/inactive keys, cross-business isolation, anon/authenticated grants, direct table denial, public slot contract; fixtures rolled back.' as result;
