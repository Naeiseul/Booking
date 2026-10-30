-- Business-configured browsing categories, independent of service_type.
create table public.service_categories (
    id uuid primary key,
    business_id uuid not null references public.businesses(id) on delete cascade,
    label text not null check (label = btrim(label) and char_length(label) between 1 and 80),
    icon text not null default 'grid' check (icon in ('grid','person','people','calendar','book','star')),
    enabled boolean not null default true,
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    unique (business_id, id)
);
create index service_categories_business_order_idx on public.service_categories(business_id, sort_order, created_at, id);
alter table public.service_categories enable row level security;
revoke all on public.service_categories from public, anon, authenticated;

alter table public.services add column category_id uuid, add column is_active boolean not null default true;
alter table public.services add constraint services_category_business_fkey
    foreign key (business_id, category_id) references public.service_categories(business_id, id);
create index services_business_category_idx on public.services(business_id, category_id);

create function private.get_admin_categories(p_slug text, p_key text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare v_business_id uuid;
begin
    select b.id into v_business_id from public.businesses b
    where b.slug = p_slug and b.admin_key = p_key and b.active;
    if v_business_id is null then
        raise exception using errcode = '28000', message = 'Invalid dashboard link';
    end if;
    return coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order, c.created_at, c.id)
        from public.service_categories c where c.business_id = v_business_id), '[]'::jsonb);
end;
$function$;

create function private.save_admin_category(
    p_slug text, p_key text, p_id uuid, p_label text, p_icon text,
    p_enabled boolean, p_sort_order integer, p_expected_updated_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare v_business_id uuid; v_category public.service_categories;
begin
    select b.id into v_business_id from public.businesses b
    where b.slug = p_slug and b.admin_key = p_key and b.active;
    if v_business_id is null then
        raise exception using errcode = '28000', message = 'Invalid dashboard link';
    end if;
    if p_expected_updated_at is null then
        insert into public.service_categories(id, business_id, label, icon, enabled, sort_order)
        values (p_id, v_business_id, btrim(p_label), p_icon, p_enabled, p_sort_order)
        on conflict (id) do nothing returning * into v_category;
        if v_category.id is null then
            select c.* into v_category from public.service_categories c
            where c.id = p_id and c.business_id = v_business_id and c.label = btrim(p_label)
                and c.icon = p_icon and c.enabled = p_enabled and c.sort_order = p_sort_order;
        end if;
    else
        update public.service_categories c set label = btrim(p_label), icon = p_icon,
            enabled = p_enabled, sort_order = p_sort_order, updated_at = clock_timestamp()
        where c.id = p_id and c.business_id = v_business_id and c.updated_at = p_expected_updated_at
        returning c.* into v_category;
    end if;
    if v_category.id is null then
        raise exception using errcode = '40001', message = 'Category changed or is unavailable. Reload and try again.';
    end if;
    return to_jsonb(v_category);
end;
$function$;

create function public.get_admin_categories(p_slug text, p_key text)
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.get_admin_categories(p_slug, p_key); $function$;
create function public.save_admin_category(
    p_slug text, p_key text, p_id uuid, p_label text, p_icon text,
    p_enabled boolean, p_sort_order integer, p_expected_updated_at timestamptz default null
)
returns jsonb language sql security invoker set search_path = ''
as $function$
    select private.save_admin_category(p_slug, p_key, p_id, p_label, p_icon, p_enabled, p_sort_order, p_expected_updated_at);
$function$;

-- Replace the old signature to avoid ambiguous PostgREST overloads.
drop function public.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz);
drop function private.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz);

create function private.save_admin_service(
    p_slug text, p_key text, p_id uuid, p_name text, p_description text,
    p_service_type text, p_duration_minutes integer, p_price_amount integer,
    p_price_basis text, p_participant_count integer, p_is_published boolean,
    p_expected_updated_at timestamptz default null,
    p_category_id uuid default null, p_is_active boolean default true
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

    if p_expected_updated_at is null then
        -- The form reuses its generated UUID when retrying a lost response.
        insert into public.services (
            id, business_id, name, description, service_type, duration_minutes,
            price_amount, price_basis, participant_count, is_published, category_id, is_active
        ) values (
            p_id, v_business_id, btrim(p_name), btrim(coalesce(p_description, '')),
            p_service_type, p_duration_minutes, p_price_amount,
            p_price_basis, p_participant_count, p_is_published, p_category_id, p_is_active
        ) on conflict (id) do nothing returning * into v_service;

        if v_service.id is null then
            select s.* into v_service from public.services s
            where s.id = p_id and s.business_id = v_business_id
                and s.name = btrim(p_name) and s.description = btrim(coalesce(p_description, ''))
                and s.service_type = p_service_type and s.duration_minutes = p_duration_minutes
                and s.price_amount = p_price_amount and s.price_basis = p_price_basis
                and s.participant_count is not distinct from p_participant_count
                and s.is_published = p_is_published
                and s.category_id is not distinct from p_category_id and s.is_active = p_is_active;
        end if;
    else
        update public.services s set
            name = btrim(p_name), description = btrim(coalesce(p_description, '')),
            service_type = p_service_type, duration_minutes = p_duration_minutes,
            price_amount = p_price_amount, price_basis = p_price_basis,
            participant_count = p_participant_count, is_published = p_is_published,
            category_id = p_category_id, is_active = p_is_active,
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
    p_category_id uuid default null, p_is_active boolean default true
)
returns jsonb language sql security invoker set search_path = ''
as $function$
    select private.save_admin_service(
        p_slug, p_key, p_id, p_name, p_description, p_service_type,
        p_duration_minutes, p_price_amount, p_price_basis, p_participant_count,
        p_is_published, p_expected_updated_at, p_category_id, p_is_active
    );
$function$;

revoke all on function private.get_admin_categories(text,text) from public, anon, authenticated;
grant execute on function private.get_admin_categories(text,text) to anon, authenticated;
revoke all on function public.get_admin_categories(text,text) from public, anon, authenticated;
grant execute on function public.get_admin_categories(text,text) to anon, authenticated;
revoke all on function private.save_admin_category(text,text,uuid,text,text,boolean,integer,timestamptz) from public, anon, authenticated;
grant execute on function private.save_admin_category(text,text,uuid,text,text,boolean,integer,timestamptz) to anon, authenticated;
revoke all on function public.save_admin_category(text,text,uuid,text,text,boolean,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.save_admin_category(text,text,uuid,text,text,boolean,integer,timestamptz) to anon, authenticated;
revoke all on function private.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean) from public, anon, authenticated;
grant execute on function private.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean) to anon, authenticated;
revoke all on function public.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean) from public, anon, authenticated;
grant execute on function public.save_admin_service(text,text,uuid,text,text,text,integer,integer,text,integer,boolean,timestamptz,uuid,boolean) to anon, authenticated;

-- Public catalogue exposes only published services for an active business.
-- Keep slot objects date/time-only, matching the existing client contract.
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
    where a.business_id = v_business.id and a.status = 'open' and a.slot_date >= current_date;

    select coalesce(json_agg(json_build_object(
        'id', s.id, 'category_id', s.category_id, 'name', s.name, 'description', s.description,
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
