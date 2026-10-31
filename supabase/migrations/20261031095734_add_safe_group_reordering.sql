create function private.reorder_admin_categories(p_slug text,p_key text,p_ids uuid[],p_expected_versions jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare business uuid; current_ids uuid[];
begin
 business:=private.get_admin_photo_context(p_slug,p_key);
 perform c.id from public.service_categories c where c.business_id=business order by c.id for update;
 select coalesce(array_agg(c.id order by c.sort_order,c.created_at,c.id),'{}') into current_ids from public.service_categories c where c.business_id=business;
 if p_ids is null or cardinality(p_ids)<>cardinality(current_ids) or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) or not(p_ids @> current_ids and current_ids @> p_ids) then
 raise exception using errcode='40001',message='Your groups changed. Reload Services and try again.'; end if;
 if p_ids=current_ids then return private.get_admin_categories(p_slug,p_key); end if;
 if exists(select 1 from public.service_categories c where c.business_id=business and c.updated_at is distinct from (p_expected_versions->>c.id::text)::timestamptz) then
 raise exception using errcode='40001',message='Your groups changed. Reload Services and try again.'; end if;
 update public.service_categories c set sort_order=array_position(p_ids,c.id)-1,updated_at=clock_timestamp()
 where c.business_id=business and c.sort_order is distinct from array_position(p_ids,c.id)-1;
 return private.get_admin_categories(p_slug,p_key);
end; $$;
revoke all on function private.reorder_admin_categories(text,text,uuid[],jsonb) from public;
grant execute on function private.reorder_admin_categories(text,text,uuid[],jsonb) to anon,authenticated;
create function public.reorder_admin_categories(p_slug text,p_key text,p_ids uuid[],p_expected_versions jsonb) returns jsonb language sql security invoker set search_path='' as $$
select private.reorder_admin_categories(p_slug,p_key,p_ids,p_expected_versions); $$;
revoke all on function public.reorder_admin_categories(text,text,uuid[],jsonb) from public;
grant execute on function public.reorder_admin_categories(text,text,uuid[],jsonb) to anon,authenticated;

