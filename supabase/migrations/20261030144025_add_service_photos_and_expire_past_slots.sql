-- Business-owned public service-photo library; writes only through the credential-checked Edge Function.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('service-photos','service-photos',true,5242880,array['image/jpeg','image/png','image/webp']);

alter table public.services add column photo_path text not null default ''
check(photo_path='' or photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(png|jpg|webp)$');

create function private.get_admin_photo_context(p_slug text,p_key text)
returns uuid language plpgsql stable security definer set search_path=''
as $function$
declare v_id uuid;
begin
 select b.id into v_id from public.businesses b where b.slug=p_slug and b.admin_key=p_key and b.active;
 if v_id is null then raise exception using errcode='28000',message='Invalid dashboard link'; end if;
 return v_id;
end;
$function$;
create function public.get_admin_photo_context(p_slug text,p_key text)
returns uuid language sql stable security invoker set search_path=''
as $function$ select private.get_admin_photo_context(p_slug,p_key); $function$;
revoke all on function private.get_admin_photo_context(text,text) from public,anon,authenticated;
revoke all on function public.get_admin_photo_context(text,text) from public,anon,authenticated;
grant execute on function private.get_admin_photo_context(text,text) to anon,authenticated,service_role;
grant execute on function public.get_admin_photo_context(text,text) to anon,authenticated,service_role;

drop function public.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean);
drop function private.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean);
create function private.save_admin_service(
    p_slug text, p_key text, p_id uuid, p_name text, p_description text,
    p_service_type text, p_duration_minutes integer, p_price_amount integer,
    p_price_basis text, p_participant_count integer, p_is_published boolean,
    p_expected_updated_at timestamptz default null,
    p_category_id uuid default null, p_is_active boolean default true,
    p_photo_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
    if p_is_published and p_category_id is null then
        raise exception using errcode = '23514', message = 'Choose a category before publishing';
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
$function$;


create function public.save_admin_service(
    p_slug text, p_key text, p_id uuid, p_name text, p_description text,
    p_service_type text, p_duration_minutes integer, p_price_amount integer,
    p_price_basis text, p_participant_count integer, p_is_published boolean,
    p_expected_updated_at timestamptz default null,
    p_category_id uuid default null, p_is_active boolean default true,
    p_photo_path text default null
)
returns jsonb language sql security invoker set search_path = ''
as $function$
    select private.save_admin_service(
        p_slug, p_key, p_id, p_name, p_description, p_service_type,
        p_duration_minutes, p_price_amount, p_price_basis, p_participant_count,
        p_is_published, p_expected_updated_at, p_category_id, p_is_active, p_photo_path
    );
$function$;


revoke all on function private.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean,text) from public,anon,authenticated;
revoke all on function public.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean,text) from public,anon,authenticated;
grant execute on function private.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean,text) to anon,authenticated;
grant execute on function public.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean,text) to anon,authenticated;
create or replace function private.get_public_page(p_slug text)
returns json language plpgsql stable security definer set search_path = ''
as $function$
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
    join public.service_categories c on c.id = s.category_id and c.business_id = s.business_id
    where s.business_id = v_business.id and s.is_published and s.is_active and c.enabled;

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

