-- 2.2 onboarding: car colour (design 05) and profile photos (design 04).

-- ============ vehicles.colour ============
-- Keys match the 8 swatches in design/source/ScrAddCar.dc.html. The colour becomes the car icon on the map.
alter table public.vehicles
  add column colour text not null default 'sport_yellow'
  check (colour in ('pearl_white', 'onyx_black', 'silver', 'gunmetal',
                    'sport_yellow', 'racing_red', 'deep_blue', 'forest_green'));

grant insert (colour), update (colour) on public.vehicles to authenticated;

-- profiles.avatar_url may only point at the user's OWN photo (otherwise anyone could show someone else's face).
alter table public.profiles
  add constraint profiles_avatar_url_own check (avatar_url is null or avatar_url = id::text || '/avatar.jpg');

-- ============ avatars bucket ============
-- Private bucket: only signed-in users can read (the app shows photos via signed URLs).
-- Each user writes only inside their own folder: avatars/<user_id>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: signed-in users can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "avatars: upload into own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: replace own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
