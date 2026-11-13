-- Plan 3.6: badges are awarded by the server, in the same transaction that counts the drive.
-- PS decisions (2026-11-13): XP per badge below, one-time each, never capped; 7 badges can be earned now (First Gear, Century,
-- Cartographer I-III, Weekend Explorer, Streak 7); Zen Driver (needs smooth score, 3.5), District Hunter and Province Collector
-- (need district boundaries, 3.8) are never awarded yet.
-- A drive older than 60 days earns no distance / cell XP (xp.ts), but badges still unlock with their XP: each badge can only be
-- earned once per account, so there is nothing to farm.

-- ============ XP per badge, descriptions in the wording of the design (screen 22) ============
update public.badges set xp_reward = v.xp, description = v.descr
  from (values
    ('first_gear',         50,   'Record your first drive'),
    ('century',            100,  '100 km total'),
    ('cartographer_1',     100,  '100 cells explored'),
    ('cartographer_2',     300,  '1,000 cells explored'),
    ('cartographer_3',     1000, '10,000 cells explored'),
    ('district_hunter',    200,  'Explore 50% of any district'),
    ('zen_driver',         150,  'Smooth score 90+ on a 20 km+ drive'),
    ('weekend_explorer',   100,  '20 new cells on a Saturday or Sunday'),
    ('province_collector', 300,  'Drive in all 4 launch provinces'),
    ('streak_7',           200,  'Drive 7 days in a row')
  ) as v(code, xp, descr)
 where badges.code = v.code;

-- ============ xp_events: one row per badge ============
-- The old unique index allowed one row per (drive, source): a drive that unlocks two badges needs one 'badge' row each.
-- restrict: deleting a badge row must never silently delete XP history (total_xp is the sum of the events).
alter table public.xp_events add column badge_id int references public.badges (id) on delete restrict;

drop index public.xp_events_drive_source_uq;
create unique index xp_events_drive_source_uq on public.xp_events (drive_id, source)
  where drive_id is not null and source <> 'badge';
-- A badge pays once per account, whatever happens to the drive (drive_id is set null when a drive is deleted).
create unique index xp_events_user_badge_uq on public.xp_events (user_id, badge_id) where source = 'badge';
alter table public.xp_events add constraint xp_events_badge_id_matches_source
  check ((source = 'badge') = (badge_id is not null));

-- ============ the rules ============
-- Looks at the account AFTER this drive's cells were inserted. Returns [{code, xp}] for the badges unlocked right now.
-- Service role only (called from finalize_counted_drive, which runs as service_role).
create function private.award_badges(p_user uuid, p_drive uuid, p_started_at timestamptz, p_new_cells int)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_day date := (p_started_at at time zone 'Asia/Bangkok')::date;
  v_drives int;
  v_dist double precision;
  v_cells int;
  v_streak int := 0;
  v_k int;
  v_codes text[] := '{}';
  v_out jsonb := '[]'::jsonb;
  v_inserted int;
  r record;
begin
  select count(*), coalesce(sum(distance_m), 0) into v_drives, v_dist
    from public.drives where user_id = p_user and status = 'processed';
  select count(*) into v_cells from public.explored_cells where user_id = p_user;
  -- 7 days in a row = 7 distinct Bangkok days inside some 7-day window that contains this drive's day. Looking at every such window
  -- (not only the one that ends today) matters: drives can be counted out of date order (an older drive waiting in the upload
  -- back-off is overtaken by newer ones), and the drive that completes the run may be an old one.
  for v_k in 0..6 loop
    select count(distinct (started_at at time zone 'Asia/Bangkok')::date) into v_streak
      from public.drives
     where user_id = p_user and status = 'processed'
       and (started_at at time zone 'Asia/Bangkok')::date between v_day - 6 + v_k and v_day + v_k;
    exit when v_streak >= 7;
  end loop;

  if v_drives >= 1 then v_codes := array_append(v_codes, 'first_gear'); end if;
  if v_dist >= 100000 then v_codes := array_append(v_codes, 'century'); end if;
  if v_cells >= 100 then v_codes := array_append(v_codes, 'cartographer_1'); end if;
  if v_cells >= 1000 then v_codes := array_append(v_codes, 'cartographer_2'); end if;
  if v_cells >= 10000 then v_codes := array_append(v_codes, 'cartographer_3'); end if;
  if coalesce(p_new_cells, 0) >= 20 and extract(isodow from p_started_at at time zone 'Asia/Bangkok') in (6, 7) then
    v_codes := array_append(v_codes, 'weekend_explorer');
  end if;
  if v_streak >= 7 then v_codes := array_append(v_codes, 'streak_7'); end if;
  -- zen_driver, district_hunter, province_collector: not earnable yet (plan 3.5 / 3.8).

  for r in select id, code, xp_reward from public.badges where code = any (v_codes) order by id loop
    insert into public.user_badges (user_id, badge_id, drive_id) values (p_user, r.id, p_drive)
    on conflict (user_id, badge_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 1 then
      if r.xp_reward > 0 then
        insert into public.xp_events (user_id, drive_id, source, amount, day, badge_id)
        values (p_user, p_drive, 'badge', r.xp_reward, v_day, r.id);
      end if;
      v_out := v_out || jsonb_build_object('code', r.code, 'xp', r.xp_reward);
    end if;
  end loop;
  return v_out;
end;
$$;
revoke execute on function private.award_badges(uuid, uuid, timestamptz, int) from public, anon, authenticated;
grant execute on function private.award_badges(uuid, uuid, timestamptz, int) to service_role;

-- ============ review fixes (code review 2026-11-13) ============
-- (1) The 20-open-uploads limit counted stuck rows forever: the app gives up on a drive after its row was inserted when the track
--     upload or finalize-drive fails permanently, and that row stays 'uploading' (nothing cleans it up). 20 of those and every new
--     drive got 429 forever, silently. Only rows created in the last day count now (a normal upload finishes in seconds).
create or replace function private.drives_limit_open_uploads() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'uploading' and (
    select count(*) from public.drives
     where user_id = new.user_id and status = 'uploading' and id <> new.id
       and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'too many drives waiting to be counted' using errcode = 'PT429';
  end if;
  return new;
end;
$$;
revoke execute on function private.drives_limit_open_uploads() from public, anon, authenticated;

-- (2) The daily distance XP cap was applied by the Edge Function from a value read BEFORE the save, so several finalize calls
--     at the same time (a hand-made client, up to 20 open drives) could each see "nothing earned today" and dodge the cap.
--     finalize_counted_drive now locks the user's profile row first (one finalization per user at a time) and clamps the
--     distance XP itself. Same value as XP.dailyDistanceCap in src/lib/xp.ts (tests/xp.test.mts checks they match).
create function private.xp_daily_distance_cap() returns int
language sql immutable
set search_path = ''
as $$ select 1500 $$;
revoke execute on function private.xp_daily_distance_cap() from public, anon, authenticated;
grant execute on function private.xp_daily_distance_cap() to service_role;

-- ============ finalize_counted_drive: same signature and return type, plus badges ============
-- (create or replace: no drop, so the deployed Edge Function keeps working during the push; it just ignores the new keys.)
-- New: step 4b awards badges after the cells; their XP joins xp_earned, profiles.total_xp and level.
-- Review fix: the user's profile row is locked first (finalizations of one user run one at a time) and the distance XP is
-- clamped here to what is left of the Bangkok day's cap, so concurrent calls cannot dodge it.
-- Returns { new_cells, xp_distance, xp_capped, xp_new_cells, xp_first_drive, xp_badges, badges: [{code, xp}], xp_total, total_xp, level }.
create or replace function public.finalize_counted_drive(
  p_drive_id uuid,
  p_user_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_distance_m real,
  p_moving_s int,
  p_elapsed_s int,
  p_avg_moving_kmh real,
  p_avg_overall_kmh real,
  p_route text,
  p_track_path text,
  p_top_kmh real,
  p_raw_points int,
  p_flags jsonb,
  p_cells text[],
  p_fingerprint text,
  p_xp_distance int,
  p_xp_per_new_cell int,
  p_xp_first_drive int
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_new int;
  v_day date := (p_started_at at time zone 'Asia/Bangkok')::date;
  v_xp_cells int;
  v_xp_first int := 0;
  v_badges jsonb;
  v_xp_badges int;
  v_total int;
  v_profile_total int;
  v_level int;
  v_today int;
  v_xp_distance int;
  v_capped boolean := false;
begin
  if coalesce(p_xp_distance, 0) < 0 or coalesce(p_xp_per_new_cell, 0) < 0 or coalesce(p_xp_first_drive, 0) < 0 then
    raise exception 'negative xp' using errcode = '22023';
  end if;

  -- One finalization per user at a time: the daily cap, known cells and badges below all read this user's earlier results.
  perform 1 from public.profiles where id = p_user_id for update;

  update public.drives
     set status = 'processed',
         started_at = p_started_at,
         ended_at = p_ended_at,
         distance_m = p_distance_m,
         moving_s = p_moving_s,
         elapsed_s = p_elapsed_s,
         avg_moving_kmh = p_avg_moving_kmh,
         avg_overall_kmh = p_avg_overall_kmh,
         route = p_route::extensions.geography
   where id = p_drive_id and user_id = p_user_id and status = 'uploading'
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  if p_fingerprint is not null then
    insert into public.drive_fingerprints (user_id, hash, drive_id)
    values (p_user_id, p_fingerprint, p_drive_id)
    on conflict (user_id, hash) do nothing;
    if not found then
      raise exception 'this route was already counted' using errcode = 'MSDUP';
    end if;
  end if;

  insert into public.drive_private (drive_id, user_id, track_path, top_kmh, raw_points, flags)
  values (p_drive_id, p_user_id, p_track_path, p_top_kmh, p_raw_points, p_flags)
  on conflict (drive_id) do update
    set track_path = excluded.track_path,
        top_kmh = excluded.top_kmh,
        raw_points = excluded.raw_points,
        flags = excluded.flags;

  insert into public.explored_cells (user_id, h3_index, first_drive_id, first_seen_at)
  select p_user_id, c, p_drive_id, p_started_at
    from unnest(p_cells) as c
  on conflict (user_id, h3_index) do nothing;
  get diagnostics v_new = row_count;

  v_xp_cells := v_new * coalesce(p_xp_per_new_cell, 0);

  -- Distance XP: never more than what is left of today's cap (read under the lock above).
  select coalesce(sum(amount), 0) into v_today
    from public.xp_events where user_id = p_user_id and source = 'distance' and day = v_day;
  v_xp_distance := least(coalesce(p_xp_distance, 0), greatest(0, private.xp_daily_distance_cap() - v_today));
  v_capped := v_xp_distance < coalesce(p_xp_distance, 0);
  if v_capped then
    update public.drive_private set flags = flags || '{"xpCapped": true}'::jsonb where drive_id = p_drive_id;
  end if;

  if v_xp_distance > 0 then
    insert into public.xp_events (user_id, drive_id, source, amount, day)
    values (p_user_id, p_drive_id, 'distance', v_xp_distance, v_day);
  end if;
  if v_xp_cells > 0 then
    insert into public.xp_events (user_id, drive_id, source, amount, day)
    values (p_user_id, p_drive_id, 'new_cell', v_xp_cells, v_day);
  end if;
  if coalesce(p_xp_first_drive, 0) > 0 then
    insert into public.xp_events (user_id, drive_id, source, amount, day)
    values (p_user_id, p_drive_id, 'first_drive', p_xp_first_drive, v_day)
    on conflict (user_id, day) where source = 'first_drive' do nothing;
    if found then
      v_xp_first := p_xp_first_drive;
    end if;
  end if;

  -- 4b: badges (plan 3.6), after the cells so Cartographer sees them.
  v_badges := private.award_badges(p_user_id, p_drive_id, p_started_at, v_new);
  select coalesce(sum((b ->> 'xp')::int), 0) into v_xp_badges from jsonb_array_elements(v_badges) as b;

  v_total := v_xp_distance + v_xp_cells + v_xp_first + v_xp_badges;

  update public.drives set new_cells = v_new, xp_earned = v_total where id = p_drive_id;

  update public.profiles
     set total_xp = total_xp + v_total,
         level = private.level_for_xp(total_xp + v_total)
   where id = p_user_id
  returning total_xp, level into v_profile_total, v_level;

  return jsonb_build_object(
    'new_cells', v_new,
    'xp_distance', v_xp_distance,
    'xp_capped', v_capped,
    'xp_new_cells', v_xp_cells,
    'xp_first_drive', v_xp_first,
    'xp_badges', v_xp_badges,
    'badges', v_badges,
    'xp_total', v_total,
    'total_xp', v_profile_total,
    'level', v_level
  );
end;
$$;

revoke execute on function public.finalize_counted_drive(
  uuid, uuid, timestamptz, timestamptz, real, int, int, real, real, text, text, real, int, jsonb, text[], text, int, int, int
) from public, anon, authenticated;
grant execute on function public.finalize_counted_drive(
  uuid, uuid, timestamptz, timestamptz, real, int, int, real, real, text, text, real, int, jsonb, text[], text, int, int, int
) to service_role;
