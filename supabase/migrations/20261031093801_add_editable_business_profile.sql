-- Extend the existing business record; keep service/calendar/payment data untouched.
alter table public.businesses
 add column tagline text not null default '',
 add column description text not null default '',
 add column email text not null default '',
 add column phone_number text,
 add column website_url text not null default '',
 add column hero_photo_path text not null default '',
 add column gallery_photo_paths text[] not null default '{}',
 add column service_area text not null default '',
 add column delivery_methods text[] not null default '{}',
 add column show_social_icons boolean not null default true,
 add column profile_version bigint not null default 0;
-- The existing UI used WhatsApp as its phone. Preserve that display at migration.
update public.businesses set phone_number=coalesce(whatsapp_number,'');
alter table public.businesses alter column phone_number set default '';
alter table public.businesses enable row level security;

create function private.business_profile_json(b public.businesses) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('name',coalesce(b.name,''),
 'tagline',coalesce(b.tagline,''),
 'description',coalesce(b.description,''),
 'email',coalesce(b.email,''),
 'phone_number',coalesce(b.phone_number,''),
 'whatsapp_number',coalesce(b.whatsapp_number,''),
 'instagram_url',coalesce(b.instagram_url,''),
 'facebook_url',coalesce(b.facebook_url,''),
 'tiktok_url',coalesce(b.tiktok_url,''),
 'website_url',coalesce(b.website_url,''),
 'logo_url',coalesce(b.logo_url,''),
 'hero_photo_path',coalesce(b.hero_photo_path,''),
 'service_area',coalesce(b.service_area,''),
 'gallery_photo_paths',b.gallery_photo_paths,
 'delivery_methods',b.delivery_methods,
 'show_social_icons',b.show_social_icons,
 'slug',b.slug,
 'profile_version',b.profile_version);
$$;
revoke all on function private.business_profile_json(public.businesses) from public,anon,authenticated;

create function private.get_admin_business_profile(p_slug text,p_key text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare b public.businesses;
begin
 select * into b from public.businesses where slug=p_slug and admin_key=p_key and active;
 if b.id is null then raise exception using errcode='28000',message='Invalid dashboard link'; end if;
 return private.business_profile_json(b);
end; $$;
revoke all on function private.get_admin_business_profile(text,text) from public;
grant execute on function private.get_admin_business_profile(text,text) to anon,authenticated;
create function public.get_admin_business_profile(p_slug text,p_key text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select private.get_admin_business_profile(p_slug,p_key);
$$;
revoke all on function public.get_admin_business_profile(text,text) from public;
grant execute on function public.get_admin_business_profile(text,text) to anon,authenticated;

create function private.save_admin_business_profile(p_slug text,p_key text,p_profile jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 b public.businesses; v jsonb; k text; path text;
 fields text[]:=array['name','tagline','description','email','phone_number','whatsapp_number','instagram_url','facebook_url','tiktok_url','website_url','logo_url','hero_photo_path','service_area'];
 allowed text[]:=fields||array['show_social_icons','gallery_photo_paths','delivery_methods'];
 prefix text:='https://jtonmfevmcmnkmdjmubn.supabase.co/storage/v1/object/public/service-photos/';
begin
 select * into b from public.businesses where slug=p_slug and admin_key=p_key and active for update;
 if b.id is null then raise exception using errcode='28000',message='Invalid dashboard link'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' or not(p_profile ?& allowed)
 or exists(select 1 from jsonb_object_keys(p_profile) x where not(x=any(allowed))) then
 raise exception using errcode='23514',message='Check the business profile fields'; end if;
 v:=p_profile;
 foreach k in array fields loop
  if jsonb_typeof(v->k)<>'string' then raise exception using errcode='23514',message='Check the '||k||' field'; end if;
  v:=jsonb_set(v,array[k],to_jsonb(btrim(v->>k)));
 end loop;
 if length(v->>'name') not between 1 and 120 then raise exception using errcode='23514',message='Enter a business name of 1 to 120 characters'; end if;
 if length(v->>'tagline')>100 or length(v->>'description')>2000 or length(v->>'service_area')>250 then
 raise exception using errcode='23514',message='Check the tagline, description or location length'; end if;
 if length(v->>'email')>254 or ((v->>'email')<>'' and (v->>'email')!~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
 raise exception using errcode='23514',message='Enter a valid business email'; end if;
 foreach k in array array['phone_number','whatsapp_number'] loop
 if (v->>k)<>'' and ((v->>k)!~ '^\+?[0-9 ()\.\-]+$' or length(v->>k)>40 or length(regexp_replace(v->>k,'[^0-9]','','g')) not between 7 and 15) then
 raise exception using errcode='23514',message='Enter a valid phone or WhatsApp number (7 to 15 digits)'; end if;
 end loop;
 foreach k in array array['instagram_url','facebook_url','tiktok_url','website_url'] loop
 if length(v->>k)>2048 or ((v->>k)<>'' and ((v->>k)!~* '^https://[a-z0-9][a-z0-9.\-]*(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$' or (v->>k)~ '[[:cntrl:]]')) then
 raise exception using errcode='23514',message='Enter a valid HTTPS link for '||k; end if;
 end loop;
 if jsonb_typeof(v->'show_social_icons')<>'boolean' or jsonb_typeof(v->'gallery_photo_paths')<>'array' or jsonb_typeof(v->'delivery_methods')<>'array' then
 raise exception using errcode='23514',message='Check the profile settings'; end if;
 if jsonb_array_length(v->'gallery_photo_paths')>12 or jsonb_array_length(v->'delivery_methods')>3
 or exists(select 1 from jsonb_array_elements(v->'gallery_photo_paths') x where jsonb_typeof(x)<>'string')
 or exists(select 1 from jsonb_array_elements(v->'delivery_methods') x where jsonb_typeof(x)<>'string')
 or exists(select 1 from jsonb_array_elements_text(v->'delivery_methods') x where x not in ('in_person','online','mobile')) then
 raise exception using errcode='23514',message='Choose up to 12 gallery photos and valid delivery methods'; end if;
 -- Retry of an identical request after a lost response succeeds, without another write.
 if p_expected_version is distinct from b.profile_version then
 if v=(private.business_profile_json(b)-'slug'-'profile_version') then return private.business_profile_json(b); end if;
 raise exception using errcode='40001',message='This profile changed in another tab. Your edits are retained. Reload the saved profile before editing again.';
 end if;
 if (v->>'logo_url')<>coalesce(b.logo_url,'') and (v->>'logo_url')<>'' then
 if left(v->>'logo_url',length(prefix))<>prefix then raise exception using errcode='23514',message='Upload a logo for this business'; end if;
 path:=substr(v->>'logo_url',length(prefix)+1);
 if split_part(path,'/',1)<>b.id::text or not exists(select 1 from storage.objects o where o.bucket_id='service-photos' and o.name=path and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and (o.metadata->>'size')::bigint between 1 and 5242880) then
 raise exception using errcode='23514',message='Choose a logo owned by this business'; end if;
 end if;
 for path in select v->>'hero_photo_path' union all select jsonb_array_elements_text(v->'gallery_photo_paths') loop
 if path<>'' and (split_part(path,'/',1)<>b.id::text or not exists(select 1 from storage.objects o where o.bucket_id='service-photos' and o.name=path and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp') and (o.metadata->>'size')::bigint between 1 and 5242880)) then
 raise exception using errcode='23514',message='Choose uploaded branding photos owned by this business'; end if;
 end loop;
 update public.businesses set
 name=v->>'name',
 tagline=v->>'tagline',
 description=v->>'description',
 email=v->>'email',
 phone_number=v->>'phone_number',
 whatsapp_number=v->>'whatsapp_number',
 instagram_url=v->>'instagram_url',
 facebook_url=v->>'facebook_url',
 tiktok_url=v->>'tiktok_url',
 website_url=v->>'website_url',
 logo_url=v->>'logo_url',
 hero_photo_path=v->>'hero_photo_path',
 service_area=v->>'service_area',
 gallery_photo_paths=array(select jsonb_array_elements_text(v->'gallery_photo_paths')),
 delivery_methods=array(select jsonb_array_elements_text(v->'delivery_methods')),
 show_social_icons=(v->>'show_social_icons')::boolean,profile_version=profile_version+1
 where id=b.id returning * into b;
 return private.business_profile_json(b);
end; $$;
revoke all on function private.save_admin_business_profile(text,text,jsonb,bigint) from public;
grant execute on function private.save_admin_business_profile(text,text,jsonb,bigint) to anon,authenticated;
create function public.save_admin_business_profile(p_slug text,p_key text,p_profile jsonb,p_expected_version bigint) returns jsonb
language sql security invoker set search_path='' as $$
 select private.save_admin_business_profile(p_slug,p_key,p_profile,p_expected_version);
$$;
revoke all on function public.save_admin_business_profile(text,text,jsonb,bigint) from public;
grant execute on function public.save_admin_business_profile(text,text,jsonb,bigint) to anon,authenticated;

-- Restore the deployed contract while the owner revisits the category feature.
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
    select b.*
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
        'instagram_url', case when v_business.show_social_icons then v_business.instagram_url else null end, 'facebook_url', case when v_business.show_social_icons then v_business.facebook_url else null end,
        'tiktok_url', case when v_business.show_social_icons then v_business.tiktok_url else null end, 'slots', v_slots, 'services', v_services,
        'categories', v_categories,
        'tagline',v_business.tagline,
        'description',v_business.description,
        'email',v_business.email,
        'phone_number',v_business.phone_number,
        'website_url',v_business.website_url,
        'hero_photo_path',v_business.hero_photo_path,
        'service_area',v_business.service_area,
        'show_social_icons',v_business.show_social_icons,'gallery_photo_paths',v_business.gallery_photo_paths,'delivery_methods',v_business.delivery_methods
    );
end;
$function$
;


