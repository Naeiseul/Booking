-- Categories organise browsing; active published services may also be uncategorised.
-- Preserve credential/ownership checks, existing function ACLs and public field whitelists.
CREATE OR REPLACE FUNCTION private.save_admin_service(p_slug text, p_key text, p_id uuid, p_name text, p_description text, p_service_type text, p_duration_minutes integer, p_price_amount integer, p_price_basis text, p_participant_count integer, p_is_published boolean, p_expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_category_id uuid DEFAULT NULL::uuid, p_is_active boolean DEFAULT true, p_photo_path text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_business_id uuid;
    v_service public.services;
begin
    select b.id into v_business_id
    from public.businesses b
    where b.slug = p_slug and b.admin_key = p_key and b.active;
    if v_business_id is null then
        raise exception using errcode = '28000', message = 'Invalid dashboard link';
    end if;

    if p_category_id is not null and not exists (
        select 1 from public.service_categories c where c.id = p_category_id and c.business_id = v_business_id
    ) then
        raise exception using errcode = '23514', message = 'Choose a category owned by this business';
    end if;

    if coalesce(p_photo_path,'') <> '' and (
        split_part(p_photo_path,'/',1) <> v_business_id::text or
        not exists(select 1 from storage.objects o where o.bucket_id='service-photos' and o.name=p_photo_path
            and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp')
            and (o.metadata->>'size')::bigint between 1 and 5242880)
    ) then raise exception using errcode='23514', message='Choose an uploaded photo owned by this business'; end if;

    if p_expected_updated_at is null then
        -- The form reuses its generated UUID when retrying a lost response.
        insert into public.services (
            id, business_id, name, description, service_type, duration_minutes,
            price_amount, price_basis, participant_count, is_published, category_id, is_active, photo_path
        ) values (
            p_id, v_business_id, btrim(p_name), btrim(coalesce(p_description, '')),
            p_service_type, p_duration_minutes, p_price_amount,
            p_price_basis, p_participant_count, p_is_published, p_category_id, p_is_active, coalesce(p_photo_path,'')
        ) on conflict (id) do nothing returning * into v_service;

        if v_service.id is null then
            select s.* into v_service from public.services s
            where s.id = p_id and s.business_id = v_business_id
                and s.name = btrim(p_name) and s.description = btrim(coalesce(p_description, ''))
                and s.service_type = p_service_type and s.duration_minutes = p_duration_minutes
                and s.price_amount = p_price_amount and s.price_basis = p_price_basis
                and s.participant_count is not distinct from p_participant_count
                and s.is_published = p_is_published
                and s.category_id is not distinct from p_category_id and s.is_active = p_is_active
                and s.photo_path = coalesce(p_photo_path,'');
        end if;
    else
        update public.services s set
            name = btrim(p_name), description = btrim(coalesce(p_description, '')),
            service_type = p_service_type, duration_minutes = p_duration_minutes,
            price_amount = p_price_amount, price_basis = p_price_basis,
            participant_count = p_participant_count, is_published = p_is_published,
            category_id = p_category_id, is_active = p_is_active, photo_path = coalesce(p_photo_path,s.photo_path),
            updated_at = clock_timestamp()
        where s.id = p_id and s.business_id = v_business_id
            and s.updated_at = p_expected_updated_at
        returning s.* into v_service;
    end if;

    if v_service.id is null then
        raise exception using errcode = '40001',
            message = 'Service changed or is unavailable. Reload services and try again.';
    end if;
    return to_jsonb(v_service);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.get_public_page(p_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    v_business record;
    v_slots json;
    v_services json;
    v_categories json;
begin
    select b.id, b.name, b.whatsapp_number, b.last_updated_at, b.logo_url,
           b.instagram_url, b.facebook_url, b.tiktok_url
    into v_business from public.businesses b where b.slug = p_slug and b.active;
    if v_business.id is null then return null; end if;

    select coalesce(json_agg(json_build_object('date', a.slot_date, 'time', a.slot_time)
                            order by a.slot_date, a.slot_time), '[]'::json)
    into v_slots from public.availability a
    where a.business_id = v_business.id and a.status = 'open' and (a.slot_date + a.slot_time) > (statement_timestamp() at time zone 'Africa/Johannesburg');

    select coalesce(json_agg(json_build_object(
        'id', s.id, 'category_id', s.category_id, 'photo_path', nullif(s.photo_path,''), 'name', s.name, 'description', s.description,
        'service_type', s.service_type, 'duration_minutes', s.duration_minutes,
        'price_amount', s.price_amount, 'currency', s.currency,
        'price_basis', s.price_basis, 'participant_count', s.participant_count
    ) order by s.sort_order, s.created_at, s.id), '[]'::json)
    into v_services from public.services s
    left join public.service_categories c on c.id = s.category_id and c.business_id = s.business_id
    where s.business_id = v_business.id and s.is_published and s.is_active
        and (s.category_id is null or c.enabled);

    select coalesce(json_agg(json_build_object(
        'id', c.id, 'label', c.label, 'icon', c.icon, 'sort_order', c.sort_order
    ) order by c.sort_order, c.created_at, c.id), '[]'::json)
    into v_categories from public.service_categories c
    where c.business_id = v_business.id and c.enabled and exists (
        select 1 from public.services s where s.business_id = c.business_id
        and s.category_id = c.id and s.is_published and s.is_active
    );

    return json_build_object(
        'name', v_business.name, 'whatsapp_number', v_business.whatsapp_number,
        'last_updated_at', v_business.last_updated_at, 'logo_url', v_business.logo_url,
        'instagram_url', v_business.instagram_url, 'facebook_url', v_business.facebook_url,
        'tiktok_url', v_business.tiktok_url, 'slots', v_slots, 'services', v_services,
        'categories', v_categories
    );
end;
$function$
;

notify pgrst, 'reload schema';
