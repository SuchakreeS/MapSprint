begin;
-- On the cloud the CLI logs in as cli_login_postgres, which can't use the "extensions"
-- schema (where pgTAP lives). Become postgres for the whole test. Locally this is a no-op.
set local role postgres;
create extension if not exists pgtap with schema extensions;
set local search_path to extensions, public;

select plan(47);


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

insert into public.drives (id, user_id, started_at, ended_at, visibility, status) values
  ('d1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 'followers', 'processed'),
  ('d1000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 'private',   'processed'),
  ('d1000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 'followers', 'uploading'),
  ('d1000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', now() - interval '1 hour', now(), 'public',    'processed'),
  ('d1000000-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', now() - interval '1 hour', now(), 'public',    'processed');

insert into public.drive_private (drive_id, user_id, max_kmh)
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
select is_empty('select * from public.drive_private', 'follower cannot read drive_private (max speed)');
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
-- 2.2: car colour + avatar photos  [7]  (still signed in as A)
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
-- PDPA: deleting the account removes everything  [3]
-- =====================================================================
set local role postgres;
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from public.drives        where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'account delete removes drives');
select is((select count(*)::int from public.privacy_zones where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'account delete removes privacy zones');
select is((select count(*)::int from public.xp_events     where user_id = '11111111-1111-1111-1111-111111111111'), 0, 'account delete removes XP history');

select * from finish();
rollback;
