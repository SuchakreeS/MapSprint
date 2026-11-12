begin;
-- On the cloud the CLI logs in as cli_login_postgres, which can't use the "extensions"
-- schema (where pgTAP lives). Become postgres for the whole test. Locally this is a no-op.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(95);


-- =====================================================================
-- Setup (as postgres, which skips RLS)
--   A = public account with drives     B = stranger
--   C = follows A and D (accepted)     D = PRIVATE account
-- =====================================================================
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'c@test.com'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.com');

update public.profiles set is_private = true where id = '44444444-4444-4444-4444-444444444444';

insert into public.follows (follower_id, followee_id) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444');
update public.follows set status = 'accepted'
  where follower_id = '33333333-3333-3333-3333-333333333333'
    and followee_id = '44444444-4444-4444-4444-444444444444';

-- A's processed drives must not overlap in time (2.3: exclusion constraint), so they are staggered.
-- d1 -5h..-4h, d2 -4h..-3h (back to back is allowed), d4 -2h..-1h. d3/d6 are 'uploading' and may overlap.
insert into public.drives (id, user_id, started_at, ended_at, visibility, status) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now() - interval '5 hours', now() - interval '4 hours', 'followers', 'processed'),
  ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', now() - interval '4 hours', now() - interval '3 hours', 'private',   'processed'),
  ('d1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 'followers', 'uploading'),
  ('d1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', now() - interval '2 hours', now() - interval '1 hour', 'public',    'processed'),
  ('d1000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', now() - interval '1 hour', now(), 'public',    'processed');

insert into public.drive_private (drive_id, user_id, top_kmh)
  values ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 88);
insert into public.xp_events (user_id, drive_id, source, amount)
  values ('11111111-1111-1111-1111-111111111111', 'd1000000-0000-0000-0000-000000000001', 'distance', 100);
insert into public.explored_cells (user_id, h3_index, first_drive_id)
  values ('11111111-1111-1111-1111-111111111111', '8964a4b138fffff', 'd1000000-0000-0000-0000-000000000001');
insert into public.privacy_zones (user_id, label, center)
  values ('11111111-1111-1111-1111-111111111111', 'Home', 'SRID=4326;POINT(100.5 13.75)');
insert into public.comments (id, drive_id, user_id, body)
  values ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Nice drive');

-- =====================================================================
-- anon (not signed in): nothing at all  [3]
-- =====================================================================
set local role anon;
select throws_ok('select * from public.profiles',      '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.drives',        '42501', null, 'anon cannot read drives');
select throws_ok('select * from public.privacy_zones', '42501', null, 'anon cannot read privacy zones');
set local role postgres;

-- =====================================================================
-- B, a stranger  [13]
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select results_eq('select id from public.drives order by id',
  $$values ('d1000000-0000-0000-0000-000000000004'::uuid)$$,
  'stranger sees only the public drive of a public account');
select is_empty('select * from public.drive_private',  'stranger cannot read drive_private');
select is_empty('select * from public.xp_events',      'stranger cannot read xp_events');
select is_empty('select * from public.explored_cells', 'stranger cannot read explored_cells');
select is_empty('select * from public.privacy_zones',  'stranger cannot read privacy zones');
select is_empty('select * from public.comments',       'stranger cannot read comments on a followers-only drive');
select throws_ok($$insert into public.kudos (drive_id) values ('d1000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'stranger cannot give kudos on a followers-only drive');
select throws_ok($$insert into public.comments (drive_id, body) values ('d1000000-0000-0000-0000-000000000001', 'hi')$$,
  '42501', null, 'stranger cannot comment on a followers-only drive');
select lives_ok($$insert into public.follows (followee_id) values ('44444444-4444-4444-4444-444444444444')$$,
  'stranger can request to follow a private account');
select is((select status from public.follows
           where follower_id = '22222222-2222-2222-2222-222222222222'
             and followee_id = '44444444-4444-4444-4444-444444444444'),
  'pending', 'follow into a private account starts as pending');
select throws_ok($$insert into public.follows (followee_id, status) values ('11111111-1111-1111-1111-111111111111', 'accepted')$$,
  '42501', null, 'app cannot choose the follow status');
select lives_ok($$update public.follows set status = 'accepted' where follower_id = '22222222-2222-2222-2222-222222222222'$$,
  'self-accept runs but should change nothing');
select is((select status from public.follows
           where follower_id = '22222222-2222-2222-2222-222222222222'
             and followee_id = '44444444-4444-4444-4444-444444444444'),
  'pending', 'follower cannot accept their own request');

-- =====================================================================
-- C, follows A and private D  [4]
-- =====================================================================
set local request.jwt.claims to '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select results_eq('select id from public.drives order by id',
  $$values ('d1000000-0000-0000-0000-000000000001'::uuid),
           ('d1000000-0000-0000-0000-000000000004'::uuid),
           ('d1000000-0000-0000-0000-000000000005'::uuid)$$,
  'follower sees processed followers/public drives (also of a private account), never private or uploading ones');
select lives_ok($$insert into public.kudos (drive_id) values ('d1000000-0000-0000-0000-000000000001')$$,
  'follower can give kudos');
select is_empty('select * from public.drive_private', 'follower cannot read drive_private (private top speed)');
select is((select count(*)::int from public.comments), 1, 'follower can read comments on the drive');

-- =====================================================================
-- A, the owner: can manage own stuff, cannot cheat  [14]
-- =====================================================================
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is((select count(*)::int from public.drives), 4, 'owner sees all own drives');
select is((select count(*)::int from public.privacy_zones), 1, 'owner reads own privacy zone');
select lives_ok($$insert into public.drives (id, started_at, ended_at)
                  values ('d1000000-0000-0000-0000-000000000006', now() - interval '1 hour', now())$$,
  'owner can upload a drive');
select is((select status from public.drives where id = 'd1000000-0000-0000-0000-000000000006'),
  'uploading', 'a new drive always starts as uploading');
select throws_ok($$update public.drives set distance_m = 99999 where id = 'd1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'owner cannot write distance');
select throws_ok($$update public.drives set status = 'processed' where id = 'd1000000-0000-0000-0000-000000000003'$$,
  '42501', null, 'owner cannot mark own drive processed');
select throws_ok($$update public.profiles set total_xp = 999999 where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'owner cannot write total_xp');
select throws_ok($$update public.profiles set plan = 'premium' where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'owner cannot make themselves premium');
select throws_ok($$insert into public.drives (user_id, started_at, ended_at)
                   values ('22222222-2222-2222-2222-222222222222', now() - interval '1 hour', now())$$,
  '42501', null, 'cannot upload a drive as someone else');
select throws_ok($$insert into public.xp_events (user_id, source, amount)
                   values ('11111111-1111-1111-1111-111111111111', 'distance', 1000)$$,
  '42501', null, 'cannot give yourself XP');
select throws_ok($$insert into public.explored_cells (user_id, h3_index)
                   values ('11111111-1111-1111-1111-111111111111', '8964a4ba0a3ffff')$$,
  '42501', null, 'cannot add explored cells');
select lives_ok($$update public.drives set visibility = 'private' where id = 'd1000000-0000-0000-0000-000000000004'$$,
  'owner can change visibility');
select lives_ok($$delete from public.comments where id = 'c1000000-0000-0000-0000-000000000001'$$,
  'drive owner can delete a comment on their drive');
select is_empty('select * from public.comments', 'the comment is gone');

-- =====================================================================
-- 3.10: private top speed  [6]  (still signed in as A)
-- Stranger B and follower C reading nothing from drive_private is tested above.
-- =====================================================================
select is((select top_kmh from public.drive_private where drive_id = 'd1000000-0000-0000-0000-000000000001'),
  88::real, 'owner reads the private top speed of their own drive');
select throws_ok($$update public.drive_private set top_kmh = 240 where drive_id = 'd1000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'owner cannot change their own top speed (only the server writes it)');
select throws_ok($$insert into public.drive_private (drive_id, user_id, top_kmh)
                   values ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 50)$$,
  '42501', null, 'owner cannot insert a top speed');
select hasnt_column('public', 'drives', 'top_kmh', 'top speed is never a column on drives (followers can read drive rows)');
select hasnt_column('public', 'drive_private', 'max_kmh', 'the old spike-prone max_kmh is gone');
select hasnt_column('public', 'profiles', 'share_max_speed', 'top speed can not be shared: the setting is gone');

-- =====================================================================
-- 2.2: car colour + avatar photos  [10]  (still signed in as A)
-- =====================================================================
select lives_ok($$insert into public.vehicles (nickname, colour) values ('Daily driver', 'racing_red')$$,
  'owner can add a car with a design colour');
select throws_ok($$insert into public.vehicles (nickname, colour) values ('Pinky', 'hot_pink')$$,
  '23514', null, 'colour must be one of the 8 design colours');
select lives_ok($$insert into storage.objects (bucket_id, name)
                  values ('avatars', '11111111-1111-1111-1111-111111111111/avatar.jpg')$$,
  'user can upload a photo into their own folder');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('avatars', '22222222-2222-2222-2222-222222222222/avatar.jpg')$$,
  '42501', null, 'user cannot upload into someone else''s folder');

select lives_ok($$update public.profiles set avatar_url = '11111111-1111-1111-1111-111111111111/avatar.jpg'
                  where id = '11111111-1111-1111-1111-111111111111'$$,
  'user can point their profile at their own photo');
select throws_ok($$update public.profiles set avatar_url = '22222222-2222-2222-2222-222222222222/avatar.jpg'
                   where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'user cannot use someone else''s photo as their avatar');
select lives_ok($$update public.profiles set avatar_url = '11111111-1111-1111-1111-111111111111/avatar-1731100000000.jpg'
                  where id = '11111111-1111-1111-1111-111111111111'$$,
  'user can point their profile at a new versioned photo of their own');
select throws_ok($$update public.profiles set avatar_url = '22222222-2222-2222-2222-222222222222/avatar-1731100000000.jpg'
                   where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'user cannot use someone else''s versioned photo');
select throws_ok($$update public.profiles set avatar_url = '11111111-1111-1111-1111-111111111111/avatar-1.jpg/../x.jpg'
                   where id = '11111111-1111-1111-1111-111111111111'$$,
  '23514', null, 'avatar path tricks are rejected');

-- =====================================================================
-- 2.3: travel modes + raw track uploads  [30]  (still signed in as A)
--   d1 -5h..-4h, d2 -4h..-3h, d4 -2h..-1h processed; d3 uploading. A's car: 'Daily driver'.
-- =====================================================================
select lives_ok($$insert into public.vehicles (nickname, kind) values ('Scooter', 'motorbike')$$,
  'owner can add a motorbike');
select throws_ok($$insert into public.vehicles (nickname, kind) values ('Tank', 'tank')$$,
  '23514', null, 'vehicle kind must be car or motorbike');
select throws_ok($$update public.vehicles set kind = 'motorbike' where nickname = 'Daily driver'$$,
  '42501', null, 'a vehicle cannot change kind after it is added');

select is((select mode from public.drives where id = 'd1000000-0000-0000-0000-000000000006'),
  'car', 'a drive uploaded without a mode is a car drive');
select is((select visibility from public.drives where id = 'd1000000-0000-0000-0000-000000000006'),
  'private', 'a newly uploaded drive is private until the owner chooses to share it');
select throws_ok($$insert into public.drives (id, started_at, ended_at, mode)
                   values ('d1000000-0000-0000-0000-000000000007', now() - interval '3 hours', now() - interval '2 hours', 'plane')$$,
  '23514', null, 'mode must be car, motorbike or other');
select lives_ok($$insert into public.drives (id, started_at, ended_at, mode, vehicle_id)
                  values ('d1000000-0000-0000-0000-000000000008', now() - interval '3 hours', now() - interval '2 hours', 'motorbike',
                          (select id from public.vehicles where nickname = 'Scooter'))$$,
  'a motorbike drive can use a motorbike');
select throws_ok($$insert into public.drives (id, started_at, ended_at, mode, vehicle_id)
                   values ('d1000000-0000-0000-0000-000000000009', now() - interval '3 hours', now() - interval '2 hours', 'car',
                           (select id from public.vehicles where nickname = 'Scooter'))$$,
  '42501', null, 'a car drive cannot use a motorbike');
select throws_ok($$insert into public.drives (id, started_at, ended_at, mode, vehicle_id)
                   values ('d1000000-0000-0000-0000-00000000000a', now() - interval '3 hours', now() - interval '2 hours', 'other',
                           (select id from public.vehicles where nickname = 'Daily driver'))$$,
  '42501', null, 'an Other drive has no vehicle');
select lives_ok($$insert into public.drives (id, started_at, ended_at, mode)
                  values ('d1000000-0000-0000-0000-00000000000b', now() - interval '3 hours', now() - interval '2 hours', 'other')$$,
  'an Other drive without a vehicle is fine');

-- Editing mode/vehicle: only after the drive is counted (processed), and the pair must stay valid.
select lives_ok($$update public.drives set mode = 'motorbike', vehicle_id = (select id from public.vehicles where nickname = 'Scooter')
                  where id = 'd1000000-0000-0000-0000-000000000004'$$,
  'owner can switch a counted drive to motorbike and pick the motorbike in one update');
select throws_ok($$update public.drives set mode = 'car' where id = 'd1000000-0000-0000-0000-000000000004'$$,
  '42501', null, 'switching to car while the motorbike is still attached is refused');
select lives_ok($$update public.drives set mode = 'other', vehicle_id = null where id = 'd1000000-0000-0000-0000-000000000004'$$,
  'owner can switch a counted drive to Other and drop the vehicle in one update');
select lives_ok($$update public.drives set mode = 'other' where id = 'd1000000-0000-0000-0000-000000000003'$$,
  'editing a drive that is not counted yet runs but changes nothing');
select is((select mode from public.drives where id = 'd1000000-0000-0000-0000-000000000003'),
  'car', 'a drive that is still uploading keeps its mode');
select throws_ok($$update public.drives set started_at = now() - interval '9 hours' where id = 'd1000000-0000-0000-0000-000000000004'$$,
  '42501', null, 'owner cannot move a drive in time');

-- Raw track files: write only your own uploading drive's file, never read, replace or delete.
select lives_ok($$insert into storage.objects (bucket_id, name)
                  values ('tracks', '11111111-1111-1111-1111-111111111111/d1000000-0000-0000-0000-000000000003.json.gz')$$,
  'owner can upload the track of their own uploading drive');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('tracks', '11111111-1111-1111-1111-111111111111/d1000000-0000-0000-0000-000000000003.json.gz')$$,
  '23505', null, 'a track cannot be uploaded twice (no overwrite)');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('tracks', '11111111-1111-1111-1111-111111111111/d1000000-0000-0000-0000-000000000004.json.gz')$$,
  '42501', null, 'no track upload for a drive that is already counted');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('tracks', '11111111-1111-1111-1111-111111111111/d1000000-0000-0000-0000-0000000000ff.json.gz')$$,
  '42501', null, 'no track upload for a drive that does not exist');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('tracks', '22222222-2222-2222-2222-222222222222/d1000000-0000-0000-0000-000000000003.json.gz')$$,
  '42501', null, 'no track upload into someone else''s folder');
select throws_ok($$insert into storage.objects (bucket_id, name)
                   values ('tracks', '11111111-1111-1111-1111-111111111111/random-name.json.gz')$$,
  '42501', null, 'track files must be named after the drive id');
select is_empty($$select 1 from storage.objects where bucket_id = 'tracks'$$,
  'the owner cannot read the raw track back (only the server can)');
select throws_ok($$delete from storage.objects where bucket_id = 'tracks'$$,
  '42501', null, 'a track cannot be deleted by the owner (Supabase blocks direct deletes in storage tables)');
select lives_ok($$update storage.objects set name = '11111111-1111-1111-1111-111111111111/moved.json.gz' where bucket_id = 'tracks'$$,
  'replacing a track runs but changes nothing (no update policy)');

-- Server side (postgres = what the Edge Function can do): the exclusion constraint on counted drives.
set local role postgres;
select is((select count(*)::int from storage.objects where bucket_id = 'tracks'
             and name = '11111111-1111-1111-1111-111111111111/d1000000-0000-0000-0000-000000000003.json.gz'),
  1, 'the uploaded track is still there, untouched');
select throws_ok($$update public.drives set status = 'processed', started_at = now() - interval '90 minutes'
                   where id = 'd1000000-0000-0000-0000-000000000003'$$,
  '23P01', null, 'two counted drives of the same person cannot overlap in time');
select lives_ok($$insert into public.drives (id, user_id, started_at, ended_at, status)
                  values ('d1000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111',
                          now() - interval '4 hours 30 minutes', now() - interval '4 hours', 'rejected')$$,
  'a rejected drive does not block anything');
select lives_ok($$insert into public.drives (id, user_id, started_at, ended_at, status)
                  values ('d1000000-0000-0000-0000-00000000000d', '22222222-2222-2222-2222-222222222222',
                          now() - interval '5 hours', now() - interval '4 hours', 'processed')$$,
  'different people can drive at the same time');
select lives_ok($$update public.drives set status = 'processed' where id = 'd1000000-0000-0000-0000-000000000003'$$,
  'back-to-back counted drives are fine (d4 ends when d3 starts)');
set local role authenticated;
set local request.jwt.claims to '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

set local role anon;
select is_empty($$select 1 from storage.objects where bucket_id = 'avatars'$$, 'signed-out visitors cannot list photos');
set local role authenticated;

set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is((select count(*)::int from storage.objects
           where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg'),
  1, 'signed-in users can see other people''s photos');
select lives_ok($$update storage.objects set name = '22222222-2222-2222-2222-222222222222/stolen.jpg'
                  where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg'$$,
  'moving someone else''s photo runs but should change nothing');
select is((select count(*)::int from storage.objects
           where bucket_id = 'avatars' and name = '11111111-1111-1111-1111-111111111111/avatar.jpg'),
  1, 'cannot move or overwrite someone else''s photo');

-- =====================================================================
-- 3.3: counting a drive and its explored cells, atomically  [9]
-- =====================================================================
set local role postgres;
insert into public.drives (id, user_id, started_at, ended_at, status) values
  ('d1000000-0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', now() - interval '10 hours', now() - interval '9 hours', 'uploading'),
  ('d1000000-0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', now() - interval '4 hours 30 minutes', now() - interval '4 hours 10 minutes', 'uploading');

-- The happy path runs as the role the Edge Function really uses, so a missing EXECUTE or table grant would show up here.
set local role service_role;
select is(public.finalize_counted_drive('d1000000-0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', now() - interval '10 hours', now() - interval '9 hours', 1000, 600, 600, 6, 6, 'SRID=4326;LINESTRING(100.5 13.75,100.51 13.76)', 'p', 50, 10, '{}'::jsonb, array['8964a4b138fffff','8964a4ba0a3ffff']),
  2, 'first counted drive: both cells are new');
select is(public.finalize_counted_drive('d1000000-0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', now() - interval '10 hours', now() - interval '9 hours', 1000, 600, 600, 6, 6, 'SRID=4326;LINESTRING(100.5 13.75,100.51 13.76)', 'p', 50, 10, '{}'::jsonb, array['8964a4b138fffff','8964a4ba0a3ffff']),
  null, 'a drive that is no longer uploading is not counted twice');
set local role postgres;

select is((select status from public.drives where id = 'd1000000-0000-0000-0000-00000000000e'), 'processed', 'the drive is counted');
select is((select new_cells from public.drives where id = 'd1000000-0000-0000-0000-00000000000e'), 2, 'drives.new_cells holds the number of new cells');
select is((select count(*)::int from public.explored_cells where user_id = '22222222-2222-2222-2222-222222222222'), 2, 'both cells were saved for the driver');

-- (the args below put ...0f at -10h..-9h, so it collides with the just-counted ...0e: any overlap proves the rollback)
select throws_ok($$select public.finalize_counted_drive('d1000000-0000-0000-0000-00000000000f', '22222222-2222-2222-2222-222222222222', now() - interval '10 hours', now() - interval '9 hours', 1000, 600, 600, 6, 6, 'SRID=4326;LINESTRING(100.5 13.75,100.51 13.76)', 'p', 50, 10, '{}'::jsonb, array['89283082803ffff'])$$,
  '23P01', null, 'an overlapping drive is refused');
select is((select count(*)::int from public.explored_cells where h3_index = '89283082803ffff'), 0, 'a refused drive leaves no cells');
select is((select count(*)::int from public.drive_private where drive_id = 'd1000000-0000-0000-0000-00000000000f'), 0, 'a refused drive leaves no private row');

set local role authenticated;
set local request.jwt.claims to '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select throws_ok($$select public.finalize_counted_drive('d1000000-0000-0000-0000-00000000000e', '22222222-2222-2222-2222-222222222222', now() - interval '10 hours', now() - interval '9 hours', 1000, 600, 600, 6, 6, 'SRID=4326;LINESTRING(100.5 13.75,100.51 13.76)', 'p', 50, 10, '{}'::jsonb, array['89283082803ffff'])$$,
  '42501', null, 'the app cannot call finalize_counted_drive');
set local role postgres;

-- =====================================================================
-- PDPA: deleting the account removes everything  [3]
-- =====================================================================
set local role postgres;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.drives        where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'account delete removes drives');
select is((select count(*)::int from public.privacy_zones where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'account delete removes privacy zones');
select is((select count(*)::int from public.xp_events     where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'account delete removes XP history');

select * from finish();
rollback;
