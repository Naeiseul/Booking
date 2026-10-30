-- Category foundation integration checks. Every fixture is rolled back.
begin;
create temporary table category_context as
select 'qa-'||gen_random_uuid()::text as slug1, gen_random_uuid()::text as key1,
       'qa-'||gen_random_uuid()::text as slug2, gen_random_uuid()::text as key2,
       'qa-'||gen_random_uuid()::text as inactive_slug, gen_random_uuid()::text as inactive_key;
insert into public.businesses(slug,admin_key,name)
select slug1,key1,'Category fixture A' from category_context
union all select slug2,key2,'Category fixture B' from category_context;
insert into public.businesses(slug,admin_key,name,active)
select inactive_slug,inactive_key,'Inactive category fixture',false from category_context;
grant select on category_context to anon,authenticated;

set local role anon;
do $test$
declare
    ctx record; c jsonb; replay jsonb; s jsonb; page jsonb; listing jsonb;
    cat1 uuid := gen_random_uuid(); cat2 uuid := gen_random_uuid();
    empty_cat uuid := gen_random_uuid(); disabled_cat uuid := gen_random_uuid();
    hidden_cat uuid := gen_random_uuid(); inactive_cat uuid := gen_random_uuid();
    foreign_cat uuid := gen_random_uuid(); service_id uuid := gen_random_uuid();
    ver timestamptz;
begin
    select * into ctx from pg_temp.category_context;
    if public.get_admin_categories(ctx.slug1,ctx.key1) <> '[]'::jsonb then raise exception 'Initial categories not empty'; end if;
    c := public.save_admin_category(ctx.slug1,ctx.key1,cat1,'  First  ','people',true,9);
    if c->>'label'<>'First' or (c->>'sort_order')::int<>9 then raise exception 'Category create incorrect'; end if;
    replay := public.save_admin_category(ctx.slug1,ctx.key1,cat1,'First','people',true,9);
    if replay<>c then raise exception 'Category create retry not idempotent'; end if;
    if public.get_admin_categories(ctx.slug2,ctx.key2)<>'[]'::jsonb then raise exception 'Cross-business category listing'; end if;
    ver := (c->>'updated_at')::timestamptz;
    begin perform public.get_admin_categories(ctx.slug1,'wrong'); raise exception 'Wrong read key accepted'; exception when sqlstate '28000' then null; end;
    begin perform public.get_admin_categories(ctx.inactive_slug,ctx.inactive_key); raise exception 'Inactive read accepted'; exception when sqlstate '28000' then null; end;
    begin perform public.save_admin_category(ctx.slug1,'wrong',gen_random_uuid(),'X','grid',true,0); raise exception 'Wrong write key accepted'; exception when sqlstate '28000' then null; end;
    begin perform public.save_admin_category(ctx.inactive_slug,ctx.inactive_key,gen_random_uuid(),'X','grid',true,0); raise exception 'Inactive write accepted'; exception when sqlstate '28000' then null; end;
    begin perform public.save_admin_category(ctx.slug2,ctx.key2,cat1,'First','people',true,9); raise exception 'Cross-business category ID retry'; exception when serialization_failure then null; end;
    begin perform public.save_admin_category(ctx.slug2,ctx.key2,cat1,'Hijack','grid',true,0,ver); raise exception 'Cross-business category update'; exception when serialization_failure then null; end;
    begin perform public.save_admin_category(ctx.slug1,ctx.key1,cat1,'Different','people',true,9); raise exception 'Changed retry accepted'; exception when serialization_failure then null; end;
    begin perform public.save_admin_category(ctx.slug1,ctx.key1,gen_random_uuid(),' ','grid',true,0); raise exception 'Empty label'; exception when check_violation then null; end;
    begin perform public.save_admin_category(ctx.slug1,ctx.key1,gen_random_uuid(),repeat('x',81),'grid',true,0); raise exception 'Long label'; exception when check_violation then null; end;
    begin perform public.save_admin_category(ctx.slug1,ctx.key1,gen_random_uuid(),'X','invalid',true,0); raise exception 'Invalid icon'; exception when check_violation then null; end;
    begin perform public.save_admin_category(ctx.slug1,ctx.key1,gen_random_uuid(),'X','grid',true,-1); raise exception 'Negative order'; exception when check_violation then null; end;
    begin perform public.save_admin_category(ctx.slug1,ctx.key1,gen_random_uuid(),'X','grid',null,0); raise exception 'Null enabled'; exception when not_null_violation then null; end;
    c := public.save_admin_category(ctx.slug1,ctx.key1,cat1,'First edited','people',true,2,ver);
    begin perform public.save_admin_category(ctx.slug1,ctx.key1,cat1,'Stale','grid',false,0,ver); raise exception 'Stale category update'; exception when serialization_failure then null; end;
    perform public.save_admin_category(ctx.slug1,ctx.key1,cat2,'Earlier','calendar',true,1);
    perform public.save_admin_category(ctx.slug1,ctx.key1,empty_cat,'Empty','grid',true,0);
    perform public.save_admin_category(ctx.slug1,ctx.key1,disabled_cat,'Disabled','book',false,0);
    perform public.save_admin_category(ctx.slug1,ctx.key1,hidden_cat,'Hidden only','star',true,0);
    perform public.save_admin_category(ctx.slug1,ctx.key1,inactive_cat,'Inactive only','person',true,0);
    perform public.save_admin_category(ctx.slug2,ctx.key2,foreign_cat,'Other business','grid',true,0);
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Wrong category','','private',60,100,'per_session',1,false,null,foreign_cat,true);
        raise exception 'Cross-business assignment accepted';
    exception when check_violation then null; end;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Missing category','','private',60,100,'per_session',1,true,null,null,true);
        raise exception 'Published without category accepted';
    exception when check_violation then null; end;
    s := public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Configured service','','private',90,12000,'per_session',1,true,null,cat1,true);
    replay := public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Configured service','','private',90,12000,'per_session',1,true,null,cat1,true);
    if replay<>s then raise exception 'Service assignment retry changed'; end if;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Configured service','','private',90,12000,'per_session',1,true,null,cat2,true);
        raise exception 'Changed category retry accepted';
    exception when serialization_failure then null; end;
    begin
        perform public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Configured service','','private',90,12000,'per_session',1,true,null,cat1,false);
        raise exception 'Changed active retry accepted';
    exception when serialization_failure then null; end;
    perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Class fixture','','class',45,10000,'per_person',null,true,null,cat2,true);
    perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Disabled fixture','','private',60,100,'per_session',1,true,null,disabled_cat,true);
    perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Hidden fixture','','private',60,100,'per_session',1,false,null,hidden_cat,true);
    perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Inactive fixture','','private',60,100,'per_session',1,true,null,inactive_cat,false);
    perform public.save_admin_service(ctx.slug1,ctx.key1,gen_random_uuid(),'Unassigned draft','','private',60,100,'per_session',1,false,null,null,true);
    perform public.save_admin_service(ctx.slug2,ctx.key2,gen_random_uuid(),'Other fixture','','private',60,100,'per_session',1,true,null,foreign_cat,true);
    page := public.get_public_page(ctx.slug1)::jsonb;
    if jsonb_array_length(page->'categories')<>2 or jsonb_array_length(page->'services')<>2 then raise exception 'Eligibility filter failed'; end if;
    if page->'categories'->0->>'id'<>cat2::text or page->'categories'->1->>'label'<>'First edited' then raise exception 'Category order/label failed'; end if;
    if page->'categories'->0 ?| array['business_id','created_at','updated_at','admin_key'] then raise exception 'Private category fields leaked'; end if;
    if (select count(*) from jsonb_object_keys(page->'categories'->0))<>4 then raise exception 'Category field whitelist'; end if;
    if exists(select 1 from jsonb_array_elements(page->'services') item where item->>'category_id' not in (cat1::text,cat2::text)) then raise exception 'Unsafe public assignment'; end if;
    if (page->'services'->0) ?| array['business_id','is_active','is_published','updated_at','admin_key'] then raise exception 'Service fields leaked'; end if;
    if jsonb_array_length(public.get_public_page(ctx.slug2)::jsonb->'categories')<>1 then raise exception 'Business category isolation failed'; end if;

    -- Active, published and category enabled are independent. Reassignment preserves booking type.
    s := public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Configured service','','private',90,12000,'per_session',1,true,(s->>'updated_at')::timestamptz,cat2,false);
    if s->>'category_id'<>cat2::text or s->>'service_type'<>'private' or not (s->>'is_published')::boolean or (s->>'is_active')::boolean then raise exception 'Service state conflated'; end if;
    page := public.get_public_page(ctx.slug1)::jsonb;
    if jsonb_array_length(page->'categories')<>1 or jsonb_array_length(page->'services')<>1 then raise exception 'Deactivation not reflected'; end if;
    s := public.save_admin_service(ctx.slug1,ctx.key1,service_id,'Configured service','','private',90,12000,'per_session',1,true,(s->>'updated_at')::timestamptz,cat2,true);
    select item into c from jsonb_array_elements(public.get_admin_categories(ctx.slug1,ctx.key1)) item where item->>'id'=cat2::text;
    perform public.save_admin_category(ctx.slug1,ctx.key1,cat2,'Earlier','calendar',false,1,(c->>'updated_at')::timestamptz);
    page := public.get_public_page(ctx.slug1)::jsonb;
    if jsonb_array_length(page->'services')<>0 or jsonb_array_length(page->'categories')<>0 then raise exception 'Category disabling not reflected'; end if;
    if jsonb_array_length(public.get_admin_services(ctx.slug1,ctx.key1))<>6 then raise exception 'Hidden admin services lost'; end if;
    if public.get_public_page(ctx.inactive_slug) is not null then raise exception 'Inactive business exposed'; end if;
    begin perform count(*) from public.service_categories; raise exception 'Direct category read allowed'; exception when insufficient_privilege then null; end;
    begin update public.service_categories set label='Unauthorized'; raise exception 'Direct category write allowed'; exception when insufficient_privilege then null; end;
    begin delete from public.service_categories; raise exception 'Direct category deletion allowed'; exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
set local role authenticated;
do $test$
declare ctx record; c jsonb;
begin
    select * into ctx from pg_temp.category_context;
    c := public.save_admin_category(ctx.slug1,ctx.key1,gen_random_uuid(),'Authenticated','grid',true,0);
    if jsonb_array_length(public.get_admin_categories(ctx.slug1,ctx.key1))<>7 then raise exception 'Authenticated category save/read failed'; end if;
    begin perform count(*) from public.service_categories; raise exception 'Authenticated direct category read'; exception when insufficient_privilege then null; end;
    begin perform public.save_admin_category(ctx.slug1,'wrong',gen_random_uuid(),'X','grid',true,0); raise exception 'Authenticated bad key'; exception when sqlstate '28000' then null; end;
end;
$test$;
reset role;
-- The composite FK independently enforces business ownership even for privileged writes.
do $test$
begin
    begin
        insert into public.services(id,business_id,name,service_type,duration_minutes,price_amount,price_basis,participant_count,category_id)
        select gen_random_uuid(),a.id,'FK fixture','private',60,100,'per_session',1,c.id
        from public.businesses a cross join public.service_categories c
        where a.slug=(select slug1 from pg_temp.category_context) and c.business_id=(select b.id from public.businesses b where b.slug=(select slug2 from pg_temp.category_context)) limit 1;
        raise exception 'Composite ownership FK missing';
    exception when foreign_key_violation then null; end;
end;
$test$;
rollback;
select 'PASS: category CRUD without deletion, ownership, keys, inactive business, validation, ordering, stale edits, retries, assignments, separate active/publication/type, public filtering/whitelists, anon/authenticated grants, composite FK and direct table denial. Fixtures rolled back.' as result;
