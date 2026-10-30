grant usage on schema private to service_role;
alter table public.services drop constraint services_photo_path_check;
alter table public.services add constraint services_photo_path_check check(photo_path='' or photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](png|jpg|webp)$');
