-- Public catalogue exposes only published services for an active business.
-- Keep slot objects date/time-only, matching the existing client contract.
create or replace function private.get_public_page(p_slug text)
returns json language plpgsql stable security definer set search_path = ''
as $function$
declare
    v_business record;
    v_slots json;
    v_services json;
begin
    select b.id, b.name, b.whatsapp_number, b.last_updated_at, b.logo_url,
           b.instagram_url, b.facebook_url, b.tiktok_url
    into v_business from public.businesses b where b.slug = p_slug and b.active;
    if v_business.id is null then return null; end if;

    select coalesce(json_agg(json_build_object('date', a.slot_date, 'time', a.slot_time)
                            order by a.slot_date, a.slot_time), '[]'::json)
    into v_slots from public.availability a
    where a.business_id = v_business.id and a.status = 'open' and a.slot_date >= current_date;

    select coalesce(json_agg(json_build_object(
        'id', s.id, 'name', s.name, 'description', s.description,
        'service_type', s.service_type, 'duration_minutes', s.duration_minutes,
        'price_amount', s.price_amount, 'currency', s.currency,
        'price_basis', s.price_basis, 'participant_count', s.participant_count
    ) order by s.sort_order, s.created_at, s.id), '[]'::json)
    into v_services from public.services s
    where s.business_id = v_business.id and s.is_published;

    return json_build_object(
        'name', v_business.name, 'whatsapp_number', v_business.whatsapp_number,
        'last_updated_at', v_business.last_updated_at, 'logo_url', v_business.logo_url,
        'instagram_url', v_business.instagram_url, 'facebook_url', v_business.facebook_url,
        'tiktok_url', v_business.tiktok_url, 'slots', v_slots, 'services', v_services
    );
end;
$function$;

create or replace function public.get_public_page(p_slug text)
returns json language sql stable security invoker set search_path = ''
as $function$ select private.get_public_page(p_slug); $function$;
revoke all on function private.get_public_page(text) from public, anon, authenticated;
revoke all on function public.get_public_page(text) from public, anon, authenticated;
grant usage on schema private to anon, authenticated;
grant execute on function private.get_public_page(text) to anon, authenticated;
grant execute on function public.get_public_page(text) to anon, authenticated;
notify pgrst, 'reload schema';
