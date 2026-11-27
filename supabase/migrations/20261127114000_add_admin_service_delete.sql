-- Delete only through the credential-checked admin RPC. Photos remain in the
-- business library because they may be reused by another service or profile field.
create function private.delete_admin_service(
    p_slug text, p_key text, p_id uuid, p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_business_id uuid;
    v_deleted public.services;
begin
    select b.id into v_business_id
    from public.businesses b
    where b.slug = p_slug and b.admin_key = p_key and b.active;
    if v_business_id is null then
        raise exception using errcode = '28000', message = 'Invalid dashboard link';
    end if;

    delete from public.services s
    where s.id = p_id
      and s.business_id = v_business_id
      and s.updated_at = p_expected_updated_at
    returning s.* into v_deleted;

    if v_deleted.id is null then
        raise exception using errcode = '40001',
            message = 'Service changed or is unavailable. Reload services and try again.';
    end if;
    return jsonb_build_object('id', v_deleted.id);
end;
$function$;

create function public.delete_admin_service(
    p_slug text, p_key text, p_id uuid, p_expected_updated_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
    select private.delete_admin_service(p_slug, p_key, p_id, p_expected_updated_at);
$function$;

revoke all on function private.delete_admin_service(text,text,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.delete_admin_service(text,text,uuid,timestamptz) from public, anon, authenticated;
grant execute on function private.delete_admin_service(text,text,uuid,timestamptz) to anon, authenticated;
grant execute on function public.delete_admin_service(text,text,uuid,timestamptz) to anon, authenticated;
notify pgrst, 'reload schema';

