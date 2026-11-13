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

-- ============ finalize_counted_drive: same signature and return type, plus badges ============
-- (create or replace: no drop, so the deployed Edge Function keeps working during the push; it just ignores the new keys.)
-- New: step 4b awards badges after the cells; their XP joins xp_earned, profiles.total_xp and level.
-- Returns { new_cells, xp_new_cells, xp_first_drive, xp_badges, badges: [{code, xp}], xp_total, total_xp, level }.
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
begin
  if coalesce(p_xp_distance, 0) < 0 or coalesce(p_xp_per_new_cell, 0) < 0 or coalesce(p_xp_first_drive, 0) < 0 then
    raise exception 'negative xp' using errcode = '22023';
  end if;

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

  if coalesce(p_xp_distance, 0) > 0 then
    insert into public.xp_events (user_id, drive_id, source, amount, day)
    values (p_user_id, p_drive_id, 'distance', p_xp_distance, v_day);
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

  v_total := coalesce(p_xp_distance, 0) + v_xp_cells + v_xp_first + v_xp_badges;

  update public.drives set new_cells = v_new, xp_earned = v_total where id = p_drive_id;

  update public.profiles
     set total_xp = total_xp + v_total,
         level = private.level_for_xp(total_xp + v_total)
   where id = p_user_id
  returning total_xp, level into v_profile_total, v_level;

  return jsonb_build_object(
    'new_cells', v_new,
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
