-- Plan 3.3: count a drive and record its explored cells in ONE transaction.
--
-- Called only by the finalize-drive Edge Function (service role). Doing it in one database function means a counted drive can
-- never exist without its cells (and the other way round), and the app's retry stays idempotent:
--   1. compare-and-set 'uploading' -> 'processed' on the drive (the exclusion constraint 23P01 on overlapping counted drives
--      fires here and rolls back EVERYTHING that follows: no private row, no cells),
--   2. owner-only details in drive_private,
--   3. the explored cells (the first drive to see a cell keeps it: on conflict do nothing),
--   4. drives.new_cells = how many cells were new.
-- Returns the number of new cells, or NULL when the drive was no longer 'uploading' (someone else decided it first).
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
  p_cells text[]
) returns int
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_new int;
begin
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

  update public.drives set new_cells = v_new where id = p_drive_id;
  return v_new;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default and Supabase adds anon/authenticated: take all of them away.
revoke execute on function public.finalize_counted_drive(
  uuid, uuid, timestamptz, timestamptz, real, int, int, real, real, text, text, real, int, jsonb, text[]
) from public, anon, authenticated;
grant execute on function public.finalize_counted_drive(
  uuid, uuid, timestamptz, timestamptz, real, int, int, real, real, text, text, real, int, jsonb, text[]
) to service_role;
