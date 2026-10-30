create function private.get_admin_service_photos(p_slug text,p_key text)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare v_id uuid;
begin
 v_id:=private.get_admin_photo_context(p_slug,p_key);
 return coalesce((select jsonb_agg(jsonb_build_object('path',o.name) order by o.created_at,o.name)
 from storage.objects o where o.bucket_id='service-photos' and split_part(o.name,'/',1)=v_id::text
 and o.metadata->>'mimetype' in ('image/png','image/jpeg','image/webp')), '[]'::jsonb);
end;
$function$;
create function public.get_admin_service_photos(p_slug text,p_key text)
returns jsonb language sql stable security invoker set search_path=''
as $function$ select private.get_admin_service_photos(p_slug,p_key); $function$;
revoke all on function private.get_admin_service_photos(text,text) from public,anon,authenticated;
revoke all on function public.get_admin_service_photos(text,text) from public,anon,authenticated;
grant execute on function private.get_admin_service_photos(text,text) to anon,authenticated;
grant execute on function public.get_admin_service_photos(text,text) to anon,authenticated;
notify pgrst,'reload schema';
