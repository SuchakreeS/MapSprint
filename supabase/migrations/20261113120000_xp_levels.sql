-- Plan 3.1 XP + 3.2 levels, and the anti-cheat gates from 2.4 that must exist before XP counts for anything.
-- Rules (PS 2026-11-13) live in src/lib/xp.ts (pure, tested); the Edge Function computes the distance XP and passes it in.
-- Everything a counted drive changes still happens in ONE transaction (finalize_counted_drive below).
--
-- Gates:
--   (a) the same track uploaded again (delete + re-upload, or shifted timestamps) is refused: drive_fingerprints keeps a SHA-256
--       of the rounded route per user. It survives deleting the drive (that is the point) and is deleted with the account (PDPA).
--   (b) at most 20 drives may sit in 'uploading' per user (trigger below). PostgREST turns SQLSTATE PT429 into HTTP 429, which
--       the app treats as "try again later" (classifyFailure), so a 21st drive waits instead of being lost.
--   (c) drives older than 60 days earn no XP: decided in xp.ts (computeDriveXp.tooOld), nothing to store here.

-- ============ xp_events: the Bangkok day each award belongs to, and idempotence ============
-- `day` = the Bangkok calendar day the DRIVE started (not when it was uploaded): daily caps and the first-drive bonus use it.
alter table public.xp_events add column day date;
update public.xp_events set day = (created_at at time zone 'Asia/Bangkok')::date where day is null;
alter table public.xp_events
  alter column day set default (now() at time zone 'Asia/Bangkok')::date,
  alter column day set not null;

-- One award of each kind per drive (a drive is counted once; this backs it up).
create unique index xp_events_drive_source_uq on public.xp_events (drive_id, source) where drive_id is not null;
-- One first-drive bonus per Bangkok day, race-proof.
create unique index xp_events_first_drive_day_uq on public.xp_events (user_id, day) where source = 'first_drive';
-- Daily distance sum.
create index xp_events_user_day_idx on public.xp_events (user_id, day);

-- ============ drive_fingerprints (gate a), server-only ============
create table public.drive_fingerprints (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  hash       text not null check (hash ~ '^[0-9a-f]{64}$'),
  -- The drive that first had this route. Set null (not cascade) when it is deleted: the fingerprint must outlive it.
  drive_id   uuid references public.drives (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, hash)
);
alter table public.drive_fingerprints enable row level security;
revoke all on public.drive_fingerprints from anon, authenticated;
grant all on public.drive_fingerprints to service_role;
-- No policies: nobody but the server reads or writes it.

-- ============ levels (plan 3.2): level L -> L+1 costs round(100 * L^1.5) XP ============
-- Same rule as src/lib/levels.ts (levelForXp); pgTAP pins the same checkpoints (0 -> 1, 100 -> 2, 383 -> 3, 903 -> 4).
create function private.level_for_xp(p_total bigint) returns int
language plpgsql immutable
set search_path = ''
as $$
declare
  v_left bigint := greatest(coalesce(p_total, 0), 0);
  v_level int := 1;
  v_step bigint;
begin
  loop
    v_step := round(100 * power(v_level, 1.5));
    exit when v_left < v_step;
    v_left := v_left - v_step;
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;
revoke execute on function private.level_for_xp(bigint) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.level_for_xp(bigint) to service_role;

-- ============ what the XP rules need to know before a drive is counted ============
-- known_cells: how many of the drive's cells this user explored before; distance_xp_today / first_drive_taken: the Bangkok day
-- of p_started_at. Read-only, service_role only.
create function public.drive_xp_context(p_user_id uuid, p_started_at timestamptz, p_cells text[])
returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'known_cells', (select count(*) from public.explored_cells
                     where user_id = p_user_id and h3_index = any (p_cells)),
    'distance_xp_today', (select coalesce(sum(amount), 0) from public.xp_events
                           where user_id = p_user_id and source = 'distance'
                             and day = (p_started_at at time zone 'Asia/Bangkok')::date),
    'first_drive_taken', exists (select 1 from public.xp_events
                                  where user_id = p_user_id and source = 'first_drive'
                                    and day = (p_started_at at time zone 'Asia/Bangkok')::date)
  );
$$;
revoke execute on function public.drive_xp_context(uuid, timestamptz, text[]) from public, anon, authenticated;
grant execute on function public.drive_xp_context(uuid, timestamptz, text[]) to service_role;

-- ============ gate (b): at most 20 open uploads per user ============
-- SECURITY INVOKER on purpose: the count only sees rows the inserting user may read (their own), so it can never reveal anything
-- about other accounts. Two inserts at the same instant can both pass at 19: a soft limit is enough here.
-- `id <> new.id`: the app re-inserts a drive's row on every retry and relies on the primary-key error (23505 = "already done").
-- A BEFORE trigger fires before that check, so without this a user at the limit could never get past their own retries.
create function private.drives_limit_open_uploads() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'uploading' and (
    select count(*) from public.drives where user_id = new.user_id and status = 'uploading' and id <> new.id
  ) >= 20 then
    raise exception 'too many drives waiting to be counted' using errcode = 'PT429';
  end if;
  return new;
end;
$$;
-- Trigger functions need no EXECUTE grant to fire; nobody should call it directly (same pattern as private.follows_set_status).
revoke execute on function private.drives_limit_open_uploads() from public, anon, authenticated;
create trigger drives_limit_open_uploads
  before insert on public.drives
  for each row execute function private.drives_limit_open_uploads();

-- ============ finalize_counted_drive, now with the fingerprint and XP ============
-- Replaces the 3.3 version (the return type changes, so it is dropped first). The Edge Function MUST be redeployed right after
-- this migration: the old function code calls the old signature.
drop function public.finalize_counted_drive(
  uuid, uuid, timestamptz, timestamptz, real, int, int, real, real, text, text, real, int, jsonb, text[]
);

-- One transaction:
--   1. compare-and-set 'uploading' -> 'processed' (23P01 on overlapping counted drives rolls everything back),
--   2. the fingerprint (same route already counted -> SQLSTATE MSDUP, everything rolls back, the function rejects as 'duplicate'),
--   3. owner-only details in drive_private,
--   4. the explored cells (v_new = how many were really new),
--   5. XP: distance (computed by the Edge Function, already capped), new cells = v_new * p_xp_per_new_cell (exact, so the XP
--      always matches the "New cells" tile), first-drive bonus (on conflict do nothing: a second bonus the same day is simply not
--      given, it never fails the drive),
--   6. drives.new_cells / xp_earned, profiles.total_xp / level.
-- Returns { new_cells, xp_new_cells, xp_first_drive, xp_total, total_xp, level }, or NULL when the drive was no longer 'uploading'.
create function public.finalize_counted_drive(
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
  p_fingerprint text,        -- SHA-256 hex, or null when the route is too short to be a fingerprint
  p_xp_distance int,         -- already capped by the daily limit; 0 for drives too old to earn XP
  p_xp_per_new_cell int,     -- 0 for drives too old to earn XP
  p_xp_first_drive int       -- 0 when not the first drive of the day (or too old / too short)
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

  v_total := coalesce(p_xp_distance, 0) + v_xp_cells + v_xp_first;

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
