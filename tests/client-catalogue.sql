-- Public catalogue integration tests. All fixture data is rolled back.
begin;
create temporary table catalogue_context as
select 'qa-'||gen_random_uuid()::text as slug1, 'qa-'||gen_random_uuid()::text as slug2,
       'qa-'||gen_random_uuid()::text as inactive_slug, gen_random_uuid()::text as admin_key;
insert into public.businesses (slug,name,admin_key)
select slug1,'Catalogue fixture A',admin_key from catalogue_context
union all select slug2,'Catalogue fixture B',gen_random_uuid()::text from catalogue_context;
insert into public.businesses (slug,name,admin_key,active)
select inactive_slug,'Inactive catalogue fixture',gen_random_uuid()::text,false from catalogue_context;
insert into public.service_categories(id,business_id,label,icon,enabled)
select gen_random_uuid(),b.id,'Configured','grid',true from public.businesses b
where b.slug in (select slug1 from catalogue_context union all select slug2 from catalogue_context union all select inactive_slug from catalogue_context);
insert into public.services (id,business_id,name,service_type,duration_minutes,price_amount,price_basis,participant_count,is_published,sort_order,category_id)
select gen_random_uuid(),b.id,s.name,s.kind,90,s.price,s.basis,s.people,s.published,s.rank,c.id
from public.businesses b join public.service_categories c on c.business_id=b.id cross join (values
 ('Visible private','private',12050,'per_person',2,true,1),
 ('Hidden service','private',45000,'per_session',1,false,0),
 ('Visible class','class',10000,'per_person',null,true,2)
) s(name,kind,price,basis,people,published,rank)
where b.slug in (select slug1 from catalogue_context union all select slug2 from catalogue_context union all select inactive_slug from catalogue_context);
insert into public.availability (business_id,slot_date,slot_time,status)
select b.id,current_date+1,t.time,t.status from public.businesses b
cross join (values ('10:00'::time,'open'),('11:00'::time,'taken')) t(time,status)
where b.slug=(select slug1 from catalogue_context);
grant select on catalogue_context to anon,authenticated;
set local role anon;
do $test$
declare ctx record; page jsonb; item jsonb; other jsonb;
begin
 select * into ctx from pg_temp.catalogue_context;
 page:=public.get_public_page(ctx.slug1)::jsonb;
 if jsonb_array_length(page->'services')<>2 then raise exception 'Hidden service leaked'; end if;
 if page->'services'->0->>'name'<>'Visible private' then raise exception 'Sort order incorrect'; end if;
 if page->'services'->1->>'service_type'<>'class' then raise exception 'Class missing'; end if;
 if (page->'services'->0->>'duration_minutes')::int<>90 or (page->'services'->0->>'price_amount')::int<>12050 then raise exception 'Service values changed'; end if;
 foreach item in array array(select jsonb_array_elements(page->'services')) loop
  if item ?| array['business_id','admin_key','is_published','created_at','updated_at','sort_order'] then raise exception 'Internal fields exposed'; end if;
  if (select count(*) from jsonb_object_keys(item))<>10 then raise exception 'Public field whitelist changed'; end if;
 end loop;
 other:=public.get_public_page(ctx.slug2)::jsonb;
 if exists(select 1 from jsonb_array_elements(page->'services') a join jsonb_array_elements(other->'services') b on a->>'id'=b->>'id') then raise exception 'Cross-business service leak'; end if;
 if public.get_public_page(ctx.inactive_slug) is not null then raise exception 'Inactive business exposed'; end if;
 if public.get_public_page('nonexistent-'||substr(gen_random_uuid()::text,1,8)) is not null then raise exception 'Missing business returned data'; end if;
 if jsonb_array_length(page->'slots')<>1 or (page->'slots'->0) ? 'status' then raise exception 'Slot contract changed'; end if;
 begin perform count(*) from public.services; raise exception 'Direct table read allowed'; exception when insufficient_privilege then null; end;
end;
$test$;
reset role;
update public.services set name='Updated catalogue service',duration_minutes=95,price_amount=20000
where name='Visible private' and business_id=(select b.id from public.businesses b join catalogue_context c on b.slug=c.slug1);
update public.services set is_published=false
where name='Visible class' and business_id=(select b.id from public.businesses b join catalogue_context c on b.slug=c.slug1);
set local role authenticated;
do $test$
declare page jsonb;
begin
 page:=public.get_public_page((select slug1 from pg_temp.catalogue_context))::jsonb;
 if jsonb_array_length(page->'services')<>1 then raise exception 'Visibility edit not reflected'; end if;
 if page->'services'->0->>'name'<>'Updated catalogue service' or (page->'services'->0->>'price_amount')::int<>20000 then raise exception 'Service edits not reflected'; end if;
end;
$test$;
reset role;
rollback;
select 'PASS: published-only services; business isolation; safe field whitelist; ordering; inactive/missing business; fresh edits and visibility; anon/authenticated access; table denial; date/time-only slots. Fixtures rolled back.' as result;
