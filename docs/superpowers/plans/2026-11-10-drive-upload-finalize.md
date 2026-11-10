# Plan: 2.3 drive upload + 2.4 `finalize-drive` + travel modes

Design (read first, it has every decision and rule): `docs/superpowers/specs/2026-11-10-drive-upload-finalize-design.md`.
No code is written in this file: the Sonnet session writes it. Follow CLAUDE.md: read handoff.md first, AGENTS.md
(Expo SDK 58: check `node_modules` docs/typings, never trust memory), use TDD for pure logic in `src/lib`,
`verification-before-completion` (`npm run typecheck`, `npx eslint .`, `npm test`) before ticking a step, update
handoff.md / plan.md / testlist.md at the end. Never edit `android/` / `ios/`.

**Model split:** Steps 1 and 4 are security-sensitive (RLS, Storage policies, Edge Function, anti-cheat). A Sonnet
session may write them, but they are NOT done until an Opus high-effort session reviews them (step 6). If a design
question comes up, stop, note it in handoff.md, hand it to Opus.

Order matters: 1 → 2 → 3 → 4 → 5 → 6. Batch any new native module (gzip, uuid, network listener) into ONE EAS build.

## Step 1 — Database migration + pgTAP (security)
Do: one new migration (filename timestamp after `20261109120000`) implementing "Data model changes" in the spec:
`drives.mode`, `vehicles.kind`, grants, vehicle-kind/mode policies on insert AND update, update only when
`status = 'processed'`, `btree_gist` + exclusion constraint on processed drives, private `tracks` bucket + storage
policies (insert only into own folder + only for an own `uploading` drive, no overwrite, no select/update/delete for
users). Raise `plan(n)` in `supabase/tests/rls_test.sql`.
Tests (pgTAP, must fail before the migration): mode/kind check constraints; mode `other` with a vehicle rejected;
vehicle kind ≠ mode rejected on insert and update; user cannot update `status`, stats, `route`, `started_at`,
`ended_at`; update blocked when status ≠ processed; overlapping processed drives rejected by the constraint (and a
`rejected` drive does not block); storage insert into another user's folder fails, into own folder without a matching
uploading drive fails, overwrite fails, reading another user's track fails.
Apply: `npx supabase db push --remote`, then run the pgTAP file against the cloud (as in Session 7 notes).

## Step 2 — Modes in the app (no server needed)
Pure logic first, in `src/lib/` with node tests: `TravelMode` type + parse, and a function that decides which vehicle
kinds a mode accepts and whether a saved `vehicle_id` is still valid for a mode (rule 7). Then:
- Local SQLite: `sessions.mode` column (safe ALTER, same pattern as `vehicle_id`), default `car`; `startSession` takes
  the mode; `SessionInfo` exposes it. Old rows read as `car`.
- Pre-drive screen: mode picker Car / Motorbike / Other, remembered per account (`prefs.ts`), vehicle row follows
  the mode (Other hides it, guests keep the "no car" row), the "only count drives where you were the driver" line.
- Garage + car form: kind Car / Motorbike when adding; vehicles list filtered by kind for the picker; `Car` type,
  `pickSelected`, cached list and `fetchCars` (`CAR_COLUMNS`) get `kind`. Keep filtering by `user_id`.
- Tests: mode parsing, vehicle/mode compatibility, selection per mode, plus existing tests still pass.

## Step 3 — Upload queue (2.3) in the app
Pure logic first (node tests): wire-format builder (columnar arrays, version 1, size sanity) and parser used by tests
of the round trip; upload state machine per drive: `local → queued → uploading → counted | rejected(reason) | waiting`
with the transient/permanent rules (spec rule 4) and back-off; "which drives to queue" rule (signed-in owner, finished,
not junk, not already done; guests excluded; oldest first).
Then (verify libraries in the SDK 58 docs, use `npx expo install`): uuid, gzip, network-back detection. Persist the
queue state locally (new table or columns, safe migration). Runner: insert the `drives` row (duplicate id = already
done), upload the gzip to `tracks/<uid>/<id>.json.gz` (already exists = done), call `finalize-drive`, store the
returned stats locally, notify on counted when the user is not on the Saving screen. Triggers: right after Finish,
app comes to front, network back, pull-to-refresh in History. Backfill existing drives on first sign-in run.
History shows Waiting to upload / Uploading / Counted / Couldn't count.
Until step 4 is deployed the runner can be tested against a stub; do not ship the app before step 4.

## Step 4 — `finalize-drive` Edge Function (security)
`supabase/functions/finalize-drive/`, JWT required, caller must own the drive. Implement the "Flow" and rules 2–6 of the
spec. First verify how to share the pure rules from `src/lib/` with Deno (spec "Left to the builder"); do not
fork the cleaning logic silently: if a copy is needed, add a test that keeps both identical.
Pure parts get node tests (validation, trimming at zones, Douglas–Peucker 5 m, overlap decision, mode-independent
stats). Test fixtures: a clean drive, a drive with a GPS jump, > 250 km/h, times mismatch, whole drive inside a zone,
duplicate call (idempotent), two simultaneous calls, overlap with another drive, 12 h / 60k points (measure CPU/wall).
Deploy with `npx supabase functions deploy finalize-drive`. Service-role key only inside the function, never in the app.
`max_kmh` goes only to `drive_private`.

## Step 5 — Saving screen + recap
New route `record/saving` (design 09, `design/screens/*/09-saving-drive.png`, sizes in `design/source/`): ring, two real
step rows (Track cleaned, Speed and distance), no-signal note after ~10 s, "Open recap when ready". Finish for a
signed-in drive goes here, then replaces itself with the recap showing the server numbers. Guests keep today's flow.
Recap: mode row (tap to change, one update of `mode` + `vehicle_id`), server numbers for signed-in drives.
Add test-list section for the phone (testlist.md): normal upload, airplane mode then reconnect, kill the app mid-upload,
two drives waiting, rejected drive, change mode, guest flow unchanged.

## Step 6 — Opus review + docs
Opus high-effort review of the migration, storage policies and Edge Function against the spec (RLS bypass, double
counting, privacy-zone leak, service-role misuse, DoS through big files). Then: tick 2.3 / 2.4 in plan.md, add the
2.6 gate (raw track deleted with the drive/account), add the XP decisions to plan 3.1 (same XP for all modes, daily cap,
less XP for repeated roads, one shared map), update handoff.md.

## Phone test (PS)
Needs one new EAS build after step 3 if a native module was added. Run the new testlist section.
