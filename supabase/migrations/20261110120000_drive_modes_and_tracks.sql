-- 2.3 / 2.4 groundwork (design: docs/superpowers/specs/2026-11-10-drive-upload-finalize-design.md)
--   * travel modes on drives (car / motorbike / other) and vehicle kinds (car / motorbike)
--   * counted drives of one person can never overlap in time (so a drive can't be counted twice)
--   * private `tracks` bucket for the raw gzipped GPS track (write-only for the owner, read by the server only)

-- ============ drives.mode / vehicles.kind ============
alter table public.drives
  add column mode text not null default 'car' check (mode in ('car', 'motorbike', 'other'));
alter table public.vehicles
  add column kind text not null default 'car' check (kind in ('car', 'motorbike'));

-- mode can be chosen on upload and corrected later; kind is chosen once when the vehicle is added.
grant insert (mode), update (mode) on public.drives to authenticated;
grant insert (kind) on public.vehicles to authenticated;

-- ============ drives policies: vehicle must be the user's own AND match the mode ============
-- car -> own car, motorbike -> own motorbike, other -> no vehicle (a kind never equals 'other').
-- Editing (mode / vehicle) is allowed only once the server has counted the drive (status = 'processed');
-- the app changes mode and vehicle_id in ONE update so the pair is always valid.
drop policy "drives: insert own" on public.drives;
drop policy "drives: update own" on public.drives;

create policy "drives: insert own"
  on public.drives for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (vehicle_id is null or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = (select auth.uid()) and v.kind = mode))
  );
create policy "drives: update own"
  on public.drives for update to authenticated
  using (user_id = (select auth.uid()) and status = 'processed')
  with check (
    user_id = (select auth.uid())
    and (vehicle_id is null or exists (
      select 1 from public.vehicles v
      where v.id = vehicle_id and v.user_id = (select auth.uid()) and v.kind = mode))
  );

-- ============ no double counting ============
-- Counted (processed) drives of one user may not overlap in time. Back to back is fine ('[)' ranges).
-- The Edge Function checks first for a friendly message; this constraint makes it impossible to race.
create extension if not exists btree_gist with schema extensions;
alter table public.drives
  add constraint drives_no_overlap_when_processed
  exclude using gist (user_id with =, tstzrange(started_at, ended_at) with &&)
  where (status = 'processed');

-- ============ tracks bucket ============
-- Private. The owner may only CREATE the file of an own drive that is still 'uploading', named exactly
-- <user_id>/<drive_id>.json.gz. No select / update / delete policies: nobody can read, replace or remove a
-- track through the API; finalize-drive reads it with the service role. (Deleting the file together with the
-- drive or account is a 2.6 gate in plan.md.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tracks', 'tracks', false, 5242880, array['application/gzip', 'application/x-gzip'])
on conflict (id) do nothing;

create policy "tracks: upload the track of an own uploading drive"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tracks'
    and exists (
      select 1 from public.drives d
      where d.user_id = (select auth.uid())
        and d.status = 'uploading'
        and name = d.user_id::text || '/' || d.id::text || '.json.gz')
  );
