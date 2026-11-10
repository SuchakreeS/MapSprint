# 2.3 Drive upload + 2.4 `finalize-drive` + travel modes — design

Agreed with PS on 2026-11-10 (Opus session). Code is written by a Sonnet session from the plan
`docs/superpowers/plans/2026-11-10-drive-upload-finalize.md`; the security parts (migration, storage policies, Edge
Function) get an Opus review before they ship (CLAUDE.md).

## Intent
Drives live only on the phone today. They have to reach the server so they can count: XP, the shared map, leaderboards
and the Feed all need numbers the phone cannot fake. The server is the source of truth for anything that counts; the
phone is the source of truth for the raw recording until the server has it.

## Goals
- A finished drive (signed-in user) goes to the server by itself and comes back "counted" with the server's numbers.
- No drive is ever lost: no signal, app closed mid-upload, server error, all just mean "try again later".
- The recap only ever shows **final** numbers: no number changes after the driver has seen it.
- Every drive records **how** you travelled: Car / Motorbike / Other.
- The server cleans the track, recomputes the stats with the same rules as the phone, drops impossible data, simplifies
  the public route and hides the start/end inside privacy zones.

## Non-goals (this task)
- XP, levels, map cells, badges (Phase 3: 3.1–3.4). The columns exist and stay null; the Saving screen shows only the
  steps that exist.
- Uploading while the app is fully closed (needs a background-fetch library; later).
- "Looks like a train ride?" detection (needs rail map data on the server; later).
- Privacy zones screen (design 06, Phase 4 gate before the Feed). The server already honours zones if rows exist.
- Leaderboards, Feed, per-mode leaderboard screens (Phase 4).
- Deleting a drive's raw track file from Storage (see Gates).

## Anti-goals (a failure even if it "works")
- A number on the recap changes after the driver saw it.
- A drive disappears, or is counted twice (double XP later).
- The raw GPS track (it shows where people live) is readable by anyone but its owner and the server.
- Anything rewards or ranks speed. Max speed stays private (`drive_private`), never ranked (CLAUDE.md safety rule).
- New taps needed while moving (controls lock above 10 km/h; the mode is picked before the drive).

## Decided by PS (2026-11-10)
1. **Wait for the server, then show everything.** Finish (signed in) → Saving screen (design 09) → recap with final
   numbers. No "provisional" phone numbers for signed-in drives.
2. **No signal → wait for signal.** After about 10 s without progress the "No signal? Your drive is safe on your phone
   and uploads by itself when you're back online." note shows and "Open recap when ready" goes home. History shows the
   drive as **Waiting to upload**; it uploads by itself and a notification says it is counted.
3. **Modes: Car / Motorbike / Other** (Other = bus, BTS/MRT, train, passenger). Picked on the Pre-drive screen. Like
   Strava: not verified, the honest majority self-classifies. Motorbike, not bicycle (bicycle maybe later).
4. **Garage holds cars and motorbikes.** Car mode picks from your cars, Motorbike mode from your motorbikes, Other has
   no vehicle.
5. **One shared map:** every mode uncovers cells ("you got there, it doesn't matter how").
6. **Other earns the same XP** as Car and Motorbike.
7. **Anti-cheat stays light:** the server drops what is impossible (GPS jumps, > 250 km/h, teleports); everything else
   is trust. Farming is limited by XP rules in Phase 3 (daily cap, less XP for repeated roads), not by detection.
8. Only drives where you are the driver should be rewarded, but no app can prove it; one line of copy says so.

## My calls (PS can override)
- **Recap after the server:** distance, moving time, elapsed time, averages come from the server. The route drawn on
  the recap stays the owner's full local track (the owner may see their own home); the server's trimmed route is what
  others will see later.
- **Guests:** unchanged. Finish → local recap as today (no server). Their drives upload after they sign in (2.2 rule:
  guest drives move to the next account).
- **Existing drives on the phone** (signed-in owner, finished, not junk) are queued too, so the field-test drives count.
  Junk drives (`isJunkDrive`) never upload.
- **Mode of old drives = Car.** Mode can be changed on the recap later; changing it never changes the numbers.
- **Mode change after upload:** allowed (`drives.mode` is in the update grant). XP will not depend on mode (decision 6).
- **No double counting:** the drive id is generated on the phone when the drive is queued (uuid) so retries are
  idempotent; the server rejects a drive that overlaps in time with another counted drive of the same user (you can't
  drive twice at once).
- **Auto-pause:** the phone sends the auto-pause setting used for the drive (2/5/10 min or off); the server uses it for
  moving time (only display numbers depend on it, nothing that counts).
- **Privacy-zone trimming = hide start and end:** the public route drops points from the start until it first leaves a
  zone, and from the last entry into a zone to the end (Strava's approach). A drive passing through a zone mid-route is
  not cut (a LineString can't have holes; a straight jump across the zone would look odd and leak little). Stats use the
  full cleaned track.
- **Route simplification:** Douglas–Peucker 5 m on the cleaned points, after trimming.
- **Upload only while the app is open:** right after Finish, when the app comes to the front, when the network comes
  back, and on pull-to-refresh in History. Oldest first, one at a time, back-off on errors.
- **"Counted" notification** only when the upload finished while the driver was not on the Saving screen.
- **Rejected drives:** status `rejected` with a reason in `drive_private.flags`; History shows "Couldn't count this
  drive" with a short reason (e.g. "overlaps another drive", "track unreadable"). The local drive is kept.
- **Max speed** is computed by the server and stored only in `drive_private` (owner-only).
- **Wire format (v1):** JSON `{ v: 1, mode, startedAt, endedAt, autoPauseMs, points: columnar arrays, pauses: [...] }`,
  gzipped, at `tracks/<user_id>/<drive_id>.json.gz`. Columnar keeps it small (~50–150 KB for a 40-min drive).

## Data model changes (one migration + pgTAP)
- `drives.mode text not null default 'car' check (mode in ('car','motorbike','other'))`; in the insert and update grants.
- `vehicles.kind text not null default 'car' check (kind in ('car','motorbike'))`; in the insert grant only (a car
  doesn't become a motorbike; delete and re-add).
- Drive insert/update policy: `vehicle_id` is null, or an own vehicle whose `kind` equals `mode`; `mode = 'other'`
  requires `vehicle_id is null`.
- Storage bucket **`tracks`**: private, size limit (5 MB), gzip only. Authenticated users may INSERT only into
  `<own uid>/<uuid>.json.gz`, only when a `drives` row with that id, owned by them, has `status = 'uploading'`. No
  select / update / delete for users (the server reads with the service role; download-my-data comes later).
- `create extension if not exists btree_gist` and the exclusion constraint on processed drives (rule 3 above).
- `drives.status` already has `uploading` / `processed` / `rejected`; stats, `route`, `drive_private` already exist
  and are server-written only (no user grants). XP/cells columns stay null until Phase 3.
- pgTAP: mode/kind checks, vehicle-kind policy, users cannot write server columns or `status`, storage insert only into
  own folder + own uploading drive, no overwrite, no read of other users' tracks.

## Rules settled after the builder check (my calls; the Opus security review confirms them)
1. **Editing mode / vehicle:** only while `status = 'processed'` (update policy `using`). The update must keep the
   vehicle rule (own vehicle with `kind = mode`; `mode = 'other'` needs `vehicle_id` null), so the phone changes
   `mode` and `vehicle_id` in ONE statement. A deleted vehicle makes `vehicle_id` null; the drive stays valid.
2. **Times:** `started_at` / `ended_at` come from the phone, but the server compares them with the track's first and
   last timestamp and REJECTS a mismatch over 120 s ("times don't match"). The overlap check uses the track's own times.
3. **Exactly one winner (never counted twice):** two guards. (a) The server writes `status = 'processed'` only with
   a compare-and-set (`... where id = ? and status = 'uploading'`); zero rows updated = someone else finished, return
   the stored result. (b) A database exclusion constraint on processed drives per user over
   `tstzrange(started_at, ended_at)` (needs `btree_gist`): the overlap check can't be raced. The drive that finishes
   processing second is the one rejected ("overlaps another drive"), whatever the upload order.
4. **Failure classes.** TRANSIENT (track not downloadable yet, timeout, 5xx, no network) keeps `status = 'uploading'`
   and the phone retries with back-off. PERMANENT (overlap, unreadable or invalid track, times mismatch, too few good
   points, too long) sets `rejected` with a reason in `drive_private.flags`. Recovery in v1: History shows "Couldn't
   count this drive" + reason, the local drive stays, and the user may delete the rejected server row (delete grant
   exists). No re-queue in v1.
5. **Limits:** max 12 h, 60,000 points, 5 MB file; beyond = permanent reject "too long to count". One synchronous call;
   the phone waits up to 60 s and then treats the drive as waiting (still `uploading`, retried later). The builder
   MUST measure the function on a 12 h track against Supabase Edge Function CPU/wall limits; if it doesn't fit,
   switch to start-then-poll (`finalize-drive` returns 202, the phone polls the drive row's status).
6. **Route after trimming:** fewer than 2 points left (e.g. the whole drive inside zones) = `route` null, drive still
   processed and counted. Later Feed/map code treats a null route as "no route to show". Zones are read with the
   service role at finalize time only; changing a zone later does not re-trim old routes (Phase 4 may add that).
7. **`vehicle_id` is already a server uuid** (`public.vehicles.id`, from `useVehicles()`), not a local id. The phone
   sends it only if that vehicle is still one of the user's cars/motorbikes of the right kind; otherwise null. Old
   drives are mode `car`, so keep `vehicle_id` only if it is one of the user's cars.
8. **"Counted" notification** uses the permission and channel code from the finish reminder; if permission was
   refused, skip it silently.

## Flow
Phone (per queued drive): insert `drives` row (id, mode, vehicle_id, started_at, ended_at; duplicate = already done)
→ upload the gzipped track (already exists = done) → call `finalize-drive` with the drive id → save the returned stats
locally → state `counted` (or `rejected`).

`finalize-drive` (Edge Function, JWT required): load the caller's drive (must be theirs). Already processed → return the
stored result (idempotent). Download the track with the service role; validate (size, version, point count, timestamps
inside started/ended, sane values). Reject on overlap with another processed drive. Clean + recompute stats with the
same rules as the app (`src/lib/geo.ts`, `live-stats.ts` `summarize`). Simplify + trim the route with the user's
privacy zones. Write stats + `route` + `status = processed` to `drives`, and `track_path`, `max_kmh`, `raw_points`,
`flags` to `drive_private`. Return the stats.

## Screens
- **Pre-drive (07):** mode picker Car / Motorbike / Other above the vehicle row (remembers the last choice, per
  account). Vehicle row shows vehicles of that kind; Other hides it. Copy "Only count drives where you were the driver."
  (exact place: builder, small, not a dialog).
- **Garage (23) / car form:** kind Car / Motorbike when adding (icon per kind if one exists in the design; otherwise
  the car icon for both is fine for v1).
- **Saving (09), new route `record/saving`:** ring = steps done (prepare, upload, server), rows "Track cleaned" and
  "Speed and distance" only (XP/badges and map cells come with Phase 3), no-signal note + "Open recap when ready".
- **Recap (10):** server numbers for signed-in drives; a mode row (tap to change).
- **History (21):** status per row: Waiting to upload / Uploading / Counted / Couldn't count; pull-to-refresh retries.
  Tapping a waiting drive explains it will upload when online (PS decision 2).

## Constraints
- Expo SDK 58: read the docs / typings in `node_modules`, never trust memory (AGENTS.md); `npx expo install` for libs.
- Never edit `android/` / `ios/`. No hard-coded colours. Metric units. Safety rules above.
- `vehicles` SELECT is `using (true)`: always filter by `user_id` in the app.

## Gates written into plan.md
- Before 2.6 (closed test): deleting a drive or the account must also delete its raw track file (`tracks/...`); today
  deleting a `drives` row leaves the file. Goes with the account-deletion Edge Function.
- Before Phase 4 Feed: privacy zones screen (already a gate).

## Left to the builder (verify, do not guess)
- Whether a Supabase Edge Function can import the shared pure rules from `src/lib/*.ts` when deployed (bundling outside
  `supabase/functions/`). If not: a `supabase/functions/_shared/` copy kept identical by a test or a copy script.
- gzip in React Native (e.g. `fflate`, pure JS) and in Deno (built-in `DecompressionStream`); uuid on the phone
  (`expo-crypto` `randomUUID` or equivalent); network-back detection (`expo-network` listener or equivalent). Any new
  native module means one more EAS build; batch them.
- Exact back-off timings, file naming of new modules, UI details within the design.
