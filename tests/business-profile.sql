-- Transactional fixtures only. No real business profile is edited.
begin;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
 slug text:='profile-qa-'||substr(gen_random_uuid()::text,1,20); other_slug text:='profile-qa-'||substr(gen_random_uuid()::text,1,20);
 p jsonb; result jsonb; before_public jsonb; path text; rejected boolean;
begin
 insert into public.businesses(id,slug,name,admin_key,owner_name,whatsapp_number,phone_number)
 values(a,slug,'Original','profile-qa-key','Owner untouched','+27820000001','+27820000001'),
 (b,other_slug,'Other business','profile-other-key','Other owner','','');
 before_public:=public.get_public_page(slug)::jsonb;
 set local role anon;
 result:=public.get_admin_business_profile(slug,'profile-qa-key');
 if result->>'name'<>'Original' or result->>'profile_version'<>'0' then raise exception 'Profile load failed'; end if;
 if result ?| array['admin_key','id','owner_name','active'] then raise exception 'Private data leaked'; end if;
 p:=result-'slug'-'profile_version';
 p:=p||jsonb_build_object('name','Updated','tagline','Stronger','description','About this business','email','hello@example.com',
 'phone_number','+27 (82) 000-0002','whatsapp_number','0820000003','website_url','https://example.com/',
 'instagram_url','https://instagram.com/example','facebook_url','https://facebook.com/example','tiktok_url','https://tiktok.com/@example',
 'service_area','Cape Town','delivery_methods',jsonb_build_array('online','in_person'),'show_social_icons',false);
 result:=public.save_admin_business_profile(slug,'profile-qa-key',p,0);
 if result->>'name'<>'Updated' or result->>'profile_version'<>'1' then raise exception 'Save failed'; end if;
 result:=public.save_admin_business_profile(slug,'profile-qa-key',p,0);
 if result->>'profile_version'<>'1' then raise exception 'Retry wrote duplicate version'; end if;
 result:=public.get_public_page(slug)::jsonb;
 if result->>'name'<>'Updated' or result->>'phone_number'<>'+27 (82) 000-0002' or result->>'instagram_url' is not null then raise exception 'Public profile/visibility failed'; end if;
 if result ?| array['admin_key','id','owner_name','profile_version'] then raise exception 'Public private-field leak'; end if;
 if result->'services' is distinct from before_public->'services' or result->'slots' is distinct from before_public->'slots' then raise exception 'Catalogue/slots changed'; end if;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"name":"stale"}',0); raise exception 'Stale edit accepted'; exception when serialization_failure then null; end;
 begin perform public.save_admin_business_profile(other_slug,'profile-qa-key',p,0); raise exception 'Other business key accepted'; exception when invalid_authorization_specification then null; end;
 begin perform public.get_admin_business_profile(slug,'wrong-key'); raise exception 'Wrong key accepted'; exception when invalid_authorization_specification then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"admin_key":"injected"}',1); raise exception 'Unknown field accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"name":""}',1); raise exception 'Empty name accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||jsonb_build_object('tagline',repeat('x',101)),1); raise exception 'Long tagline accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"email":"bad"}',1); raise exception 'Invalid email accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"phone_number":"123"}',1); raise exception 'Invalid phone accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"website_url":"javascript:alert(1)"}',1); raise exception 'Unsafe URL accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"delivery_methods":["unknown"]}',1); raise exception 'Unknown delivery accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||'{"logo_url":"https://example.com/logo.png"}',1); raise exception 'Unowned logo accepted'; exception when check_violation then null; end;
 begin perform public.save_admin_business_profile(slug,'profile-qa-key',p||jsonb_build_object('hero_photo_path',a::text||'/'||gen_random_uuid()::text||'.png'),1); raise exception 'Missing object accepted'; exception when check_violation then null; end;
 begin perform name from public.businesses limit 1; raise exception 'Direct table access granted'; exception when insufficient_privilege then null; end;
 reset role;
 if (select owner_name from public.businesses where id=a)<>'Owner untouched' or (select name from public.businesses where id=b)<>'Other business' then raise exception 'Unrelated fields changed'; end if;
 path:=a::text||'/'||gen_random_uuid()::text||'.png';
 insert into storage.objects(bucket_id,name,metadata) values('service-photos',path,'{"size":68,"mimetype":"image/png"}');
 set local role authenticated;
 p:=p||jsonb_build_object('hero_photo_path',path,'gallery_photo_paths',jsonb_build_array(path),'logo_url','https://jtonmfevmcmnkmdjmubn.supabase.co/storage/v1/object/public/service-photos/'||path,'show_social_icons',true);
 result:=public.save_admin_business_profile(slug,'profile-qa-key',p,1);
 if result->>'profile_version'<>'2' or result->>'hero_photo_path'<>path then raise exception 'Owned photos failed'; end if;
 begin perform public.save_admin_business_profile(other_slug,'profile-other-key',(public.get_admin_business_profile(other_slug,'profile-other-key')-'slug'-'profile_version')||jsonb_build_object('hero_photo_path',path),0); raise exception 'Other photo accepted'; exception when check_violation then null; end;
 reset role;
 update public.businesses set active=false where id=a;
 set local role anon;
 begin perform public.get_admin_business_profile(slug,'profile-qa-key'); raise exception 'Inactive access accepted'; exception when invalid_authorization_specification then null; end;
 if public.get_public_page(slug) is not null then raise exception 'Inactive publicly visible'; end if;
 reset role;
end $$;
rollback;
