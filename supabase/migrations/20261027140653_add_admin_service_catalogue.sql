-- Services are managed with the existing business slug/admin-key access model.
-- Public RPCs are invokers; privileged, credential-checked implementations stay private.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table public.services (
    id uuid primary key,
    business_id uuid not null references public.businesses(id) on delete cascade,
    name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
    description text not null default '' check (char_length(description) <= 2000),
    service_type text not null check (service_type in ('private', 'class')),
    duration_minutes integer not null check (duration_minutes between 1 and 1440),
    price_amount integer not null check (price_amount >= 0),
    currency text not null default 'ZAR' check (currency = 'ZAR'),
    price_basis text not null check (price_basis in ('per_session', 'per_person')),
    participant_count integer,
    is_published boolean not null default false,
    sort_order integer not null default 0 check (sort_order >= 0),
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    constraint services_participants check (
        (service_type = 'private' and participant_count is not null and participant_count between 1 and 10000)
        or (service_type = 'class' and participant_count is null and price_basis = 'per_person')
    )
);
create index services_business_order_idx on public.services (business_id, sort_order, created_at, id);
alter table public.services enable row level security;
-- No direct browser access, including unpublished services. Only the scoped RPCs below.
revoke all on table public.services from public, anon, authenticated;

create function private.get_admin_services(p_slug text, p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
    v_business_id uuid;
begin
    select b.id into v_business_id
    from public.businesses b
    where b.slug = p_slug and b.admin_key = p_key and b.active;
    if v_business_id is null then
        raise exception using errcode = '28000', message = 'Invalid dashboard link';
    end if;
    return coalesce((
        select jsonb_agg(to_jsonb(s) order by s.sort_order, s.created_at, s.id)
        from public.services s where s.business_id = v_business_id
    ), '[]'::jsonb);
end;
$function$;

create function private.save_admin_service(
    p_slug text, p_key text, p_id uuid, p_name text, p_description text,
    p_service_type text, p_duration_minutes integer, p_price_amount integer,
    p_price_basis text, p_participant_count integer, p_is_published boolean,
    p_expected_updated_at timestamptz default null
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

    if p_expected_updated_at is null then
        -- The form reuses its generated UUID when retrying a lost response.
        insert into public.services (
            id, business_id, name, description, service_type, duration_minutes,
            price_amount, price_basis, participant_count, is_published
        ) values (
            p_id, v_business_id, btrim(p_name), btrim(coalesce(p_description, '')),
            p_service_type, p_duration_minutes, p_price_amount,
            p_price_basis, p_participant_count, p_is_published
        ) on conflict (id) do nothing returning * into v_service;

        if v_service.id is null then
            select s.* into v_service from public.services s
            where s.id = p_id and s.business_id = v_business_id
                and s.name = btrim(p_name) and s.description = btrim(coalesce(p_description, ''))
                and s.service_type = p_service_type and s.duration_minutes = p_duration_minutes
                and s.price_amount = p_price_amount and s.price_basis = p_price_basis
                and s.participant_count is not distinct from p_participant_count
                and s.is_published = p_is_published;
        end if;
    else
        update public.services s set
            name = btrim(p_name), description = btrim(coalesce(p_description, '')),
            service_type = p_service_type, duration_minutes = p_duration_minutes,
            price_amount = p_price_amount, price_basis = p_price_basis,
            participant_count = p_participant_count, is_published = p_is_published,
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

create function public.get_admin_services(p_slug text, p_key text)
returns jsonb language sql stable security invoker set search_path = ''
as $function$ select private.get_admin_services(p_slug, p_key); $function$;

create function public.save_admin_service(
    p_slug text, p_key text, p_id uuid, p_name text, p_description text,
    p_service_type text, p_duration_minutes integer, p_price_amount integer,
    p_price_basis text, p_participant_count integer, p_is_published boolean,
    p_expected_updated_at timestamptz default null
)
returns jsonb language sql security invoker set search_path = ''
as $function$
    select private.save_admin_service(
        p_slug, p_key, p_id, p_name, p_description, p_service_type,
        p_duration_minutes, p_price_amount, p_price_basis, p_participant_count,
        p_is_published, p_expected_updated_at
    );
$function$;

revoke all on function private.get_admin_services(text, text) from public, anon, authenticated;
revoke all on function private.save_admin_service(text, text, uuid, text, text, text, integer, integer, text, integer, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.get_admin_services(text, text) from public, anon, authenticated;
revoke all on function public.save_admin_service(text, text, uuid, text, text, text, integer, integer, text, integer, boolean, timestamptz) from public, anon, authenticated;
grant execute on function private.get_admin_services(text, text) to anon, authenticated;
grant execute on function private.save_admin_service(text, text, uuid, text, text, text, integer, integer, text, integer, boolean, timestamptz) to anon, authenticated;
grant execute on function public.get_admin_services(text, text) to anon, authenticated;
grant execute on function public.save_admin_service(text, text, uuid, text, text, text, integer, integer, text, integer, boolean, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';
