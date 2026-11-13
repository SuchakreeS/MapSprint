# Handoff — read this first

_Last updated: 2026-11-05 (session 3)_

## Status
Phase 0 (Spikes) — **all three spikes done: Spike 1 (Mapbox) PASS, Spike 2 (GPS) PASS under the revised rule (see below), Spike 3 (H3) PASS. Ready to start Phase 1.** Standalone preview APK runs on the Samsung without Metro.

## Done
- Expo SDK 58 project scaffolded in this folder (template cleaned out).
- Installed: expo-location, expo-task-manager, expo-dev-client, @rnmapbox/maps 10.3.x,
  expo-keep-awake, expo-sqlite, h3-js 4.5.0, eslint + eslint-config-expo.
- `app.json`: name Mapsprint, package `com.suchakree.mapsprint`, plugins for mapbox,
  expo-location (foreground service ON, background location OFF), expo-sqlite.
- `eas.json` with `development` (dev client APK), `preview`, `production` profiles.
- `index.ts` entry registers the background location task before expo-router.
- `src/lib/geo.ts` GPS maths (haversine, cleaning rules, summarize) + 6 passing tests.
- `src/features/recording/` db.ts (SQLite), location-task.ts, recorder.ts.
- Spike screens: `src/app/index.tsx` (hub), `map.tsx`, `gps.tsx`, `h3.tsx`.
- Verified in a Linux workspace: `tsc` OK, `eslint` OK, `npm test` 6/6 pass.

## Spike results
- 2026-11-03 Spike 1 Mapbox: **PASS.** Dark map with streets/labels loads, location puck shows (Samsung, EAS dev build).
- 2026-11-03 Spike 3 H3 on Hermes: **PASS**, 361 ms total. latLngToCell OK (8964a4b138fffff -> 8964a4ba0a3ffff), gridPathCells 20 cells, cellsToMultiPolygon 1 polygon, 3,600 conversions (1 h drive) in 185 ms. H3 can run on the phone, no need to move it to an Edge Function.
- 2026-11-03 Standalone preview APK (no Metro) installed on the Samsung: app opens on its own and the Mapbox map shows, so the EAS env var for the token works. Use this build for the GPS spike.
- 2026-11-03/05 Spike 2 GPS (standalone APK, Samsung, screen locked, Battery = Unrestricted): **PASS under the revised rule.**
  | Run | What | Time | Points (coverage) | Max gap | Distance |
  |---|---|---|---|---|---|
  | #3 | walk, phone in pants pocket | 33:20 | 1,898 (~95%) | 6 s | 2.21 km |
  | #4 | drive home | 22:53 | 1,371 (~99.9%) | 19 s (short stretch under the BTS viaduct) | 7.91 km (PS: about right) |
  | #5 | drive home -> BTS (morning) | 12:53 | 772 (~99.9%) | 2 s | 9.41 km |
  | #6 | walk BTS -> office, PS forgot to stop | 88:47 | 5,146 (~96.6%) | 9 s | 2.37 km |
  (#1 and #2 were tiny tests, ignore.)
  - The original rule was "30 min+ AND max gap <= 5 s". No single run met both: #3 missed by 1 s, #4 and #6 had longer gaps, #5 was clean but only 13 min.
  - Revised rule used: **>= 95% point coverage, no repeated long gaps, service survives with screen off.** All four runs meet it. PS reviewed the verdict and asked to record it (2026-11-05).
  - Why it is considered OK: the service survived 88 min of screen-off recording; the long gaps happened in the pocket, walking, indoors, or under the BTS viaduct (GPS blocked), not as a repeating pattern; the one drive in clean conditions had a 2 s gap. During the ~hour at the office in #6 no phantom distance was added, so the stopped (< 3 km/h) and accuracy rules work.
  - Still to confirm: #5 distance 9.41 km vs the car trip meter / Google Maps (PS has not answered yet). A literal 30 min+ drive with max gap <= 5 s is still nice to have; every Phase 1 field-test drive will show it anyway.
- 2026-11-05 evening, standalone preview APK, real drive Thu 5 Nov 17:55 -> 18:37 (42 min wall clock): recap GPS check card says **2,500 of 2,507 points used, longest gap 2 s, gaps over 3 s: 0**. This is a clean pass of the ORIGINAL Spike 2 rule (30 min+ AND max gap <= 5 s), so the "revised rule" above is no longer needed. Spike 2 = **PASS (literal)**.

## Dev notes
- The dev build loads JS from Metro. Run `npx expo start --dev-client` (add `--tunnel` if the phone can't see the PC). "Unable to load script" = Metro not running.
- Do not press Reload on the error screen: it crashes with an expo-ui UnsatisfiedLinkError. Close the app fully and reopen instead.
- Removed unused template deps `@expo/ui`, `expo-symbols`, `expo-web-browser`, `expo-glass-effect` from package.json (session 2). expo-router still pulls expo-glass-effect in itself; that is fine. User must run `npm install` on Windows to prune node_modules.
- Standalone test build: `npx eas-cli@latest build --profile preview -p android`. EXPO_PUBLIC_MAPBOX_TOKEN must exist as an EAS env var (environment preview), because the local .env is not uploaded. eas.json profiles now set `environment`.

## Session 4 (2026-11-05): Phase 1 task 1.1 code done
Branch `phase1-ui-kit` (off master). Plan: `docs/superpowers/plans/2026-11-05-fonts-and-ui-kit.md`.
- `src/lib/format.ts` + `tests/format.test.mts` (speed/distance/duration display; `--` for unknown speed). Committed.
- Fonts: `@expo-google-fonts/{sora,rajdhani,manrope,michroma}` via `useFonts` (no native rebuild). `src/theme/fonts.ts` (`useAppFonts`), `fonts` + `type` scale in `tokens.ts`, `useTheme()` now returns `{ mode, c, fonts, type }`. Root layout holds the splash until fonts load or fail.
- Roles: Manrope body, Sora headings, Rajdhani big numbers, Michroma logo/labels only.
- UI kit in `src/components/`: Button, Card, Stat, Switch, Header. Temporary preview route `src/app/kit.tsx` (linked from the spike hub); remove under 1.12.
- Results: `npm run typecheck` clean, `npx eslint .` clean, `npm test` 13/13, no hex colours outside `src/theme`.
- NOT yet done: on-phone check of the Kit screen (fonts distinct, dark + light, disabled Button inert). No independent code review was run (self-check only).
- PS commits manually from now on (not uncommitted: fonts/kit/plan/handoff changes).
- Note: after adding a route, `.expo/types/router.d.ts` is stale until Metro starts; typecheck then fails on the new href.

## Session 4b (2026-11-05): task 1.2 router structure, code done (uncommitted, PS commits manually)
- Kit screen checked on the Samsung by PS: looks good, button feedback works.
- App now opens on `(tabs)`: Feed (`index`), Map (`world`), Record (`start`, raised yellow circle via `src/components/RecordTabButton.tsx`, opens `/record/pre-drive`), Ranks, Profile. Tab bar has text labels only, no icons.
- Ruling: no icon library. `@expo/vector-icons` is discouraged in SDK 58 and any other lib needs a native rebuild. Revisit icons later (decide then).
- Ruling: file names avoid clashing with spike routes: tab Map = `world.tsx` (spike keeps `/map`), onboarding profile = `about-you.tsx`.
- `record/` is a modal stack: pre-drive, hud, saving, recap, share (placeholders with back button). `(onboarding)/`: welcome, sign-in, location, about-you, car, zones (placeholders, not linked yet; auth is Phase 2).
- Spike hub moved from `/` to `/dev`; reach it from Profile tab → "Dev: spikes and UI kit preview". Remove with 1.12.
- Shared `src/components/Placeholder.tsx` used by all stub screens.
- Results: typecheck clean, eslint clean, npm test 13/13, no hex outside `src/theme`.
- NOT yet checked: on the phone (tab bar colours dark/light, Record circle overlaps the bar nicely, modal opens/closes, Android back button).

## Session 4c (2026-11-05): task 1.3 location permission, code done (uncommitted)
- 1.2 checked on the Samsung by PS ("works") and committed.
- `src/lib/permission.ts` `permissionState()` -> granted / can-ask / blocked, 6 tests in `tests/permission.test.mts` (RED then GREEN).
- `src/features/permissions/use-location-permission.ts` hook (re-reads when app returns from settings).
- Screen `src/app/(onboarding)/location.tsx` (route `/location`, optional `?next=record`): explains why, "Allow location", blocked state -> "Open settings", "Not now" -> tabs. No design 03 mockup existed; PS said design it from the theme.
- Record circle (`RecordTabButton`) now checks permission: granted -> `/record/pre-drive`, else `/location?next=record`.
- Ruling: "Not now" is allowed (browse without location); recording is blocked at the Record button. PS did not answer whether location should be required; change if wanted.
- `recorder.ts` `ensureForegroundPermission` left as-is (still asks inline as a safety net).
- Results: typecheck clean, eslint clean, npm test 19/19, no hex outside `src/theme`.
- NOT yet checked on phone: first-time prompt, deny once then Record again, deny with "don't ask again" -> Open settings -> allow -> back in app, granted path goes to pre-drive. To retest: Android Settings > Apps > Mapsprint > Permissions > Location > Don't allow.

## Session 4d (2026-11-05): task 1.4 pre-drive check, code done (uncommitted)
- 1.3 checked on the Samsung by PS and committed.
- `src/lib/gps-signal.ts` `signalQuality(accuracyM)`: searching (null/NaN/negative) / excellent <=5 m / good <=15 m / weak >15 m. 5 tests in `tests/gps-signal.test.mts` (RED then GREEN).
- `src/features/recording/use-gps-signal.ts` hook (watchPositionAsync while screen open, cleans up).
- `src/features/settings/prefs.ts`: sound on/off and "battery tip hidden" via `expo-sqlite/kv-store` (sync API).
- `src/app/record/pre-drive.tsx`: signal row, Samsung battery tip (Open settings opens the app's settings page, not the battery page directly; "Got it" hides it for good), placeholder "My car" row, Sound switch (saved), Start drive -> `/record/hud` (HUD is still a placeholder, recorder is NOT started yet: wire `startRecording()` in 1.5).
- Ruling: Start stays enabled even on weak signal (tunnels/car parks are normal), BUT (PS request, same session) weak or searching now shows a confirm dialog ("Wait" / "Start anyway") saying distance and route may be wrong. Rule is `needsSignalConfirm()` in `src/lib/gps-signal.ts`, 2 more tests (26 total). Not yet checked on phone (test indoors).
- Ruling: signal thresholds 5 m / 15 m are my guess; tune in field tests (1.9). geo.ts drops points over 25 m.
- Results: typecheck clean, eslint clean, npm test 24/24, no hex outside `src/theme`.
- Gotcha: if typecheck complains a route like "/" is missing, delete `.expo/types/router.d.ts` and start Metro once; the file is generated and was stale.
- NOT yet checked on phone: signal row updates outdoors, battery tip dismiss persists after restart, sound toggle persists, Start goes to HUD placeholder.

## Design pack (added after 1.4)
All 29 approved screens are now in `design/`: dark (Onyx) + light (Pearl) PNGs in `design/screens/`, overview
sheets, exact values in `design/source/*.dc.html`, and `design/README.md` (screen -> plan task -> route index + warnings).
The old design canvas can't be read from VS Code, so **use this folder**.
- Tasks 1.1-1.4 were built BEFORE this folder existed ("no mockup" for screen 03). Plan task **1.13** is the alignment pass.
  Known gaps to check: the design tab bar has **icons** and a raised yellow Record circle (see `design/source/KitTabBar.dc.html`),
  but the app has text-only tabs; screen 03 and 07 layouts; Button/Card/Stat/Switch/Header sizes vs the source.
- **Decision for PS (icons):** the design uses simple inline SVG icons (paths are in `design/source/`). Showing them needs
  `react-native-svg` (one native rebuild), or keep text-only tabs. Earlier ruling was "no icon library"; revisit before 1.13.
- Screen 03 copy in the design is outdated (says "Allow all the time"); we only request "while using the app".
- For 1.5 use `design/screens/dark/08-driving-hud.png` and `design/source/Hud2.dc.html` as the visual spec.

## Session 4e (2026-11-05): task 1.13 design alignment pass, code done (uncommitted)
Compared UI kit, tab bar, screen 03 and 07 with `design/`; PS approved the difference list. Done:
- Tokens: `radius.notice` 14 and `radius.button` 18; type scale rewritten to the design sizes (title 26 Sora 600, sheetTitle 24, body 15, rowTitle, small, caption 13, button 16/17, `label` = Manrope bold 12 uppercase). Michroma is now `fonts.wordmark` / `type.wordmark` (wordmark only, per design/README.md). `src/constants/app.ts` `APP_NAME` is the one place for the name (also used in the recorder notification text).
- Button: light mode bug fixed (primary now uses `primary`/`onPrimary`: black with yellow text in Pearl); 56 high (`size="lg"` 60), radius 18; new `ghost` text-only variant; `leading` glyph slot. New `PlayGlyph` and `CloseGlyph` (drawn with Views, no SVG lib).
- Switch: custom 52x32 with caption (no system switch).
- Tab bar: Record circle ring now the surface colour, "Record" label added, active tab labels bold. Still text-only tabs, plain dot in the circle (no icons).
- Location screen (03): design layout (progress bar only when `?step=N&of=6` is passed, art rings, 3 reason rows with a gold dot instead of icons, notice box, Continue + ghost Not now). Copy rewritten: "While using the app" only, no "Allow all the time", no "when the app is closed". **DRAFT privacy wording (SUBTITLE and DISCLOSURE in `location.tsx`) must be reviewed by an Opus session before release (CLAUDE.md / README).**
- Pre-drive (07): real Mapbox map (reuses the spike setup) behind a bottom sheet, round close button, grouped checklist (GPS signal "Strong/Weak/Searching…", Samsung battery tip row with Hide, car row, "Sound cues and voice" switch), Start drive 60 high with play glyph. Weak-signal confirm dialog kept.
- Ruling: map backdrop = real Mapbox (option A) because it matches the design and the HUD needs it anyway.
- Ruling: battery row shows the Samsung Unrestricted tip, not "Battery 64%" (that needs `expo-battery`, a native library; decide with the icons question).
- Ruling: the "Accuracy about N m" caption was dropped to match the design.
- Not changed: the design inconsistency on screen 07 light (`surface2` there is `#F5F3EE`); we use the token `#EEEBE4`.
- Results: typecheck clean, eslint clean, npm test 26/26, no hex outside `src/theme` (only `notificationColor` in recorder.ts, native notification, pre-existing).
- NOT yet checked on phone: pre-drive map + sheet in dark and light, location screen (normal and blocked states), tab bar, Button/Switch in the Kit preview, light-mode buttons are black with yellow text.

## Session 4f (2026-11-05): task 1.5a HUD pure logic, code done (uncommitted)
- 1.13 checked on the Samsung and committed by PS. PS approved the HUD plan: `docs/superpowers/plans/2026-11-05-driving-hud.md` (3 parts: 1.5a logic, 1.5b screen, 1.5c controls). Gauge stays View-drawn (no react-native-svg).
- `src/lib/live-stats.ts`: `createLiveStats()` (push one point at a time, `snapshot()` = `DriveSummary`) and `summarize()`, which now delegates to it. **`summarize` moved from `geo.ts` to `live-stats.ts`** (avoids a circular import); importers updated (`gps.tsx`, tests).
- Safety net: 3 characterization tests pin the old `summarize` numbers (`tests/live-stats.test.mts`, drives in `tests/fixtures.mts`); they still pass after the refactor. Plus tests that the live engine equals `summarize` at prefixes 1, 10, all.
- `src/lib/hud.ts`: `CONTROL_LOCK_KMH` 10, `controlsLocked(kmh)` (null = not locked), `GAUGE_MAX_KMH` 160, `REDLINE_START` 0.85, `gaugeFraction`. `src/lib/route-line.ts`: `appendRoutePoint` (5 m thinning, `[lng, lat]`). `formatKmh1` in `format.ts`.
- `tsconfig.json`: added `allowImportingTsExtensions` (lib files that import each other need `.ts` so Node tests can run them; base config already has `noEmit`).
- Results: typecheck clean, eslint clean, npm test 44/44.
- Gotcha again: stale `.expo/types/router.d.ts` makes typecheck fail on `"/"`; delete it and start Metro once.

## Session 4g (2026-11-05): task 1.5b HUD screen with live data, code done (uncommitted)
- 1.5a committed by PS. HUD plan: `docs/superpowers/plans/2026-11-05-driving-hud.md`.
- `src/app/record/hud.tsx` now matches design 08 minus the Level/XP card and the district / new-cells chips (fake data must not ship; Phase 3). Full-screen Mapbox map (follow camera zoom 16, puck with course bearing, route line = casing 16 px at 18% + 5 px line in `c.primary`), recenter button, bottom sheet with gauge, 3 stats, Pause + Hold to finish.
- `use-live-drive.ts`: starts recording on mount (`startRecording()` returns the active session, so reopening resumes), loads existing points, then polls SQLite every 1 s through the live stats engine. Unmount stops polling only, never the recording. Added `getPointsSince` and `getSessionStartedAt` to `db.ts`.
- `SpeedGauge` (View-drawn 240-degree arc, 80 segments, fill = speed/160, red band from 85%, `--` when speed unknown), `HudStat`, `PauseGlyph`, shared `src/features/map/map-style.ts` (pre-drive uses it too). `hudNumber` is now 84/84, new `hudStat` 26/28. `formatDistanceKm(m, decimals = 2)`; HUD shows 1 decimal like the design.
- Gauge test strip (null, 64, 150, 200 km/h) added to the Kit preview screen.
- Still inert on purpose: **Pause (disabled until 1.6) and Hold to finish (does nothing until 1.5c)**. There is no way to stop a recording from the HUD yet: stop it from the GPS spike screen (`/dev` -> Spike 2) after testing.
- Ruling: recenter button is always visible like the design (it does nothing visible while already following).
- Results: typecheck clean, eslint clean, npm test 45/45, no hex outside `src/theme`.
- NOT yet checked on phone: see "What to test" in the chat for 1.5b.

## Session 4h (2026-11-05): task 1.5c HUD safety controls and flow, code done (uncommitted)
- 1.5b committed by PS. PS will build a standalone APK (`npx eas-cli@latest build --profile preview -p android`, see Dev notes) to test the HUD away from the PC.
- `HoldToFinishButton` (`src/components/`): 800 ms `Animated` fill (22% overlay like the design), early release resets and does nothing, fires once, re-arms when `onFinish` settles (a failed stop can be retried), ignores touches and cancels a hold in progress when `locked`. No `onPress`, so a quick tap can never finish; TalkBack gets an `activate` accessibility action instead (still respects the lock).
- HUD: `controlsLocked(speedKmh)` locks Hold to finish (Pause is disabled anyway until 1.6) and shows "Controls are locked while you are moving."; `useKeepAwake()`; hardware back does nothing (`BackHandler`), swipe-back off for `hud` in `record/_layout.tsx`. Finish = `stopRecording()` then `router.replace('/record/saving')`; on failure an error `ConfirmDialog` ("Your points are saved on this phone. Try again?").
- Record tab button: if a drive is already recording (`isRecording()`), it opens `/record/hud` (resume), skipping permission and pre-drive.
- Ruling (found while building): a speed older than 10 s counts as unknown (`currentSpeedKmh`, `STALE_SPEED_MS`), so GPS lost in a tunnel at 60 km/h can't leave the controls locked once the car has stopped. `useLiveDrive` exposes `speedKmh`; the gauge uses it too (shows `--`). `createLiveStats().lastAcceptedTs()` added for this. 6 new tests (51 total).
- Results: typecheck clean, eslint clean (fixed a refs-during-render error by holding the Animated value in `useState`), npm test 51/51, no hex outside `src/theme`.
- NOT checked on phone: everything in 1.5b and 1.5c (hold 800 ms finishes and lands on the saving placeholder, early release does nothing, walking/driving above 10 km/h locks it, screen stays on, back does nothing, leave app mid-drive then Record returns to the same drive, tunnel/GPS-lost behaviour).
- `/record/saving` is still a placeholder (1.7 local recap, 2.3 upload): after finishing, the drive is saved in SQLite but there is no screen showing it yet except the GPS spike list.

## Session 4i (2026-11-05): task 1.6 pause and auto-pause, code done (uncommitted)
Plan: `docs/superpowers/plans/2026-11-05-pause.md`. PS asked to keep building while waiting to test (testing needs a real walk/drive, hours away).
- Engine (`src/lib/live-stats.ts`, test-first, `tests/pause.test.mts`, 65 tests total): `AUTO_PAUSE_MS` 5 min; `pause(ts)`, `resume(ts)`, `pauseState()`, `elapsedAt(nowMs)`, options `{ autoPauseMs }` (Infinity = off); `summarize(points, pauseEvents?)`; `applyEvent`. Auto-pause is derived from the points (replays identically after a restart): stopped (< 3 km/h) for 5 min pauses, idle time not counted, first moving point resumes. A resume starts a new baseline so no distance is added across the gap. `elapsedS` is now ACTIVE time (same as before when nothing is paused). The old characterization tests pass unchanged.
- Storage (`db.ts`): `pause_events` table, kv key `manual_pause_since`, `insertPauseEvent`, `getPauseEventsSince`, `get/setManualPauseSince`; cleared on session start and end. `recorder.ts`: `pauseRecording()`, `resumeRecording()`. `location-task.ts`: while manually paused it drops points with `ts >= pausedSince` (late batches stamped before the pause are kept). So **nothing is stored on the phone during a manual pause**; the foreground service and notification keep running.
- HUD: Pause button is live (locked above 10 km/h or before ready); becomes "Resume" with a play glyph when paused; caption "Paused. Nothing is recorded until you resume." or "Paused: stopped for 5 min. Moving again resumes the drive."; gauge shows `--` while paused; Hold to finish still works while paused. `useLiveDrive` now returns `paused`, `pause()`, `resume()` and merges pause events with points by time. Time shows engine active time (wall clock only before the first GPS point).
- Design note: the design has no paused state; this is a minimal version of mine. Show PS before polishing.
- Known small gaps: a route line drawn across a manual pause gap is a straight line; a late batch of points stamped before a pause that arrives after the HUD already applied the pause is ignored live (a replay after reopening the HUD would count it); the auto-pause time is a constant (screen 28 "Auto-pause after stopped for 2/5/10 min" comes with Settings, 4.6).
- Phase 2 reminder: when drives are uploaded, upload only stored points (none exist for manual pauses) and carry the pause events so the server can recompute time the same way.
- Results: typecheck clean, eslint clean, npm test 65/65, no hex outside `src/theme`.
- NOT checked on phone: Pause/Resume on the HUD, auto-pause after 5 min stopped (try a 6 min stop), auto-resume when moving, pause then leave app and reopen (same Time, still paused), Hold to finish while paused.

## Session 4j (2026-11-05): task 1.7 local drive history + recap, code done (uncommitted)
- 1.6 committed by PS. Designs read: `design/screens/dark/10-drive-recap-full-scroll.png`, `21-drive-history.png`, `design/source/Recap2.dc.html`, `ScrDriveHistory.dc.html`.
- Pure logic, test-first (85 tests total): `src/lib/route-art.ts` (`fitRoute` keeps aspect, centred, north up; `simplifyRoute` Douglas-Peucker; `simplifyToMax`), `src/lib/drive-format.ts` (`driveTitle`, `formatDriveDay`, `monthLabel`, `formatDateTimeRange`, `formatDriveCount`, `groupByMonth`).
- `src/features/recording/drive-history.ts`: `loadDrive(id)` and `loadDrives()` (finished sessions with a usable track, newest first, skips the active one); uses `summarize(points, pauseEvents)`, so recap numbers respect pauses. `getSession` added to `db.ts`.
- `src/components/RouteArt.tsx`: route on a blueprint grid drawn with Views (no SVG library), optional glow and start/end markers.
- Recap `src/app/record/recap.tsx` (design 10): Done, "Drive complete", date + time range + minutes, route card, 4 real tiles (Distance 2 decimals, Moving time, Moving avg, Overall avg). **Hold to finish now goes here** (`/record/recap?id=`) instead of the Saving placeholder. Done goes to the tabs, or back to the list when opened from history (`from=history`).
- History `src/app/history.tsx` (design 21, route `/history`, button on the Profile tab): grouped by month with counts, thumbnail, auto title ("Morning drive" etc. from the start time), "Tue 3 · 18.4 km", drive time on the right. Tap opens the recap.
- Left out on purpose (Phase 3 / Phase 2 data, no fake data): XP card, level, new cells, smooth score, badges, "Share to feed", car filter chips, "Signature drive" label.
- Rulings: recap distance shows 2 decimals (design shows 1) so the field test (1.9) can compare with the trip meter; right-hand value on a history row is drive time where the design has XP; sessions without `ended_at` (app killed mid-drive) are hidden until 1.11 handles them.
- New tokens: `type.headline` 30/34, `type.statTile` 28/31.
- Known: `loadDrives` reads every session's points once when the history screen opens (fine for tens of drives; cache or store summaries when it gets slow). Route pictures use all points with accuracy <= 25 m; a teleport spike would show.
- Results: typecheck clean, eslint clean, npm test 85/85, no hex outside `src/theme`.
- NOT checked on phone: finish a drive and see the recap (route picture, 4 numbers, date/time, minutes); Done goes to the app; Profile > Drive history lists the drive with thumbnail, title, day, km, time; tap it opens the recap and Done goes back; empty state with no drives; dark + light; recap numbers match the HUD at the moment of finishing (distance within rounding).

## Session 4k (2026-11-05): tasks 1.10 gap log and 1.11 finish prompt (in-app only), code done (uncommitted)
- 1.7 committed by PS.
- **1.10** `src/lib/gaps.ts` `findGaps(points, pauseEvents)`: every stretch with no point for more than 3 s (`GAP_MIN_S`), with start/end time and the position before and after; gaps that overlap a manual pause are excluded; longest equals the engine's `rawMaxGapS`. Derived from stored points (no new table, replays identically). `DriveItem.gaps`; recap shows a **GPS check card** (`GpsCheckCard`): points used of raw, longest gap, count, and the 5 longest gaps with clock time and lat/lng. Use it in the 1.9 field tests to tell tunnels from throttling. Decide later whether it moves behind a debug switch.
- **1.11** PS chose **in-app prompt only for now; the notification comes later** (noted in plan.md at 4.3: needs `expo-notifications`, native rebuild). `src/lib/finish-prompt.ts`: asks after 15 min stopped (auto-paused, counted from when the stop began) or 30 min manual pause; "Keep recording" snoozes 15 min. HUD shows a "Finish this drive?" dialog ("Finish drive" is the filled button; new `emphasis="confirm"` option on `ConfirmDialog`). `useLiveDrive` now returns `nowMs` (so screens don't read the clock while rendering). New **"Drive in progress" pill** above the tab bar (`DriveInProgressBanner`, `useDriveInProgress` polls the active session every 3 s and on app foreground): tap opens the HUD. Caveat: the pill appears for any active drive, not only a stopped one.
- Still hidden from history: a drive whose session never got an `ended_at` (killed app): it now shows as "in progress" via the pill until finished from the HUD.
- Results: typecheck clean, eslint clean, npm test 102/102, no hex outside `src/theme`.
- NOT checked on phone: recap GPS check card on a real drive (numbers plausible, gap list matches what happened); stop for 15+ min with a drive running then open the HUD: dialog "Finish this drive?" appears; "Keep recording" hides it for 15 min; "Finish drive" ends it and opens the recap; leave the app mid-drive, reopen: pill "Drive in progress" on the tabs, tap opens the HUD; after finishing, the pill disappears (within 3 s); a manually paused drive asks after 30 min.

## Session 4l (2026-11-05): task 1.8 battery guide screen, code done (uncommitted)
- 1.10 + 1.11 committed by PS.
- `src/lib/oem-guide.ts` (test-first, `tests/oem-guide.test.mts`, 109 tests total): `OEM_GUIDES` for Samsung, Xiaomi/Redmi/POCO, OPPO, Realme, Vivo, Huawei/Honor, OnePlus and stock Android/Pixel; `detectOem(manufacturer, brand)`; `orderedGuides(id)` (your phone first, unknown phones start with stock Android). Steps come from dontkillmyapp.com (read 2026-11-05 through a fetch subagent; its pages are old for some makers, so wording is soft: "older phones", "menus differ"). App name via `APP_NAME`.
- Screen `src/app/battery-guide.tsx` (route `/battery-guide`): "Keep recording alive", intro, **Open battery settings** (Android intent `android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS`, falls back to the app settings page if it fails), **Open Mapsprint settings**, one expandable card per maker (yours open and highlighted "YOUR PHONE"), footer caveat + source. Uses `expo-device` (already installed) for `Device.manufacturer` / `Device.brand`.
- Pre-drive battery tip row now opens this guide (was: app settings).
- Ruling: Huawei's computer + USB (adb) workaround is NOT in the guide (not something a driver can do); the Huawei note says recordings may end early on newer phones.
- **Unverified on a real device:** the `IGNORE_BATTERY_OPTIMIZATION_SETTINGS` intent (the fetch could not confirm it from the vendor pages; it is a documented Android settings action, so it should open the battery optimization list, but Samsung may redirect). The fallback covers failure. Also check the Samsung steps match the S-series you test on (PS's Samsung model/One UI version not yet recorded).
- Results: typecheck clean, eslint clean, npm test 109/109, no hex outside `src/theme`.
- NOT checked on phone: pre-drive battery row opens the guide; your Samsung is detected ("YOUR PHONE: Samsung" open first); both buttons work (battery list opens; app settings opens); other makers expand/collapse; dark + light.

## Session 5 (2026-11-06): PS on-phone test of the evening drive on 2026-11-05 (standalone APK)
PS tested the HUD (1.5), recap and history (1.7) and the GPS check card (1.10) on a real drive: "everything works fine", with one UI problem (below). What the screens showed:
- Drive Thu 5 Nov 17:55 -> 18:37: Distance 7.86 km, Moving time 21:25, Moving avg 22.0 km/h, Overall avg 12.9 km/h. HUD at 15 km/h showed Pause and Hold to finish dimmed with the lock message (lock works). History listed the drive with thumbnail, title, day, km and time.
- First field-test data point (1.9): same commute route measured 7.91 km on Tue 3 Nov (spike run #4) and 7.86 km on Thu 5 Nov, 0.6% apart. Still no car trip meter comparison.
- **Open UI problem (PS feedback) -> plan task 1.5d:** "Controls are locked while you are moving." is rendered inside the bottom sheet (`src/app/record/hud.tsx` around line 147). Above 10 km/h it makes the sheet taller, so the sheet covers the user's location dot. PS wants the message moved to the TOP of the screen with RED text. Proposed: a small pill overlaid on the map under the status bar (absolute, so the sheet keeps a fixed height), colour `c.danger` on a dark mostly opaque pill (both themes), short static text, only while speed > 10 km/h. Also give the Mapbox camera bottom padding equal to the sheet height so the follow puck stays in the visible map even without the message.
- Not a bug, but confusing: the recap header says "17:55 -> 18:37 · 42 min" (wall clock, `formatDateTimeRange`) while the stats and the history row use 36:40 (active time). Overall avg 12.9 km/h = 7.86 km / 36:40. The 5:20 difference is almost certainly auto-pause (a stop of 5+ min, no points counted). Consider showing both ("42 min · 36:40 active") or labelling the history time as active time. PS has not decided.
- Minor: history also lists tiny junk sessions from spike tests ("0.0 km", "0:00"). Consider hiding drives under about 100 m, or adding delete.

## Session 5b (2026-11-06): task 1.5d HUD lock pill, code done (uncommitted)
- `hud.tsx`: "Controls locked while moving" is now an absolute pill at the top (`insets.top + 8`, `pointerEvents="none"`, `accessibilityRole="alert"`), text `c.danger`, background new token `overlayPill` (`rgba(10,10,10,0.9)`, same in both themes). Shown only while `controlsLocked(speedKmh)`. The sheet no longer contains the lock text, so it does not change height when locking. Pause / Hold to finish still dim and ignore touches while locked (unchanged).
- Camera `followPadding.paddingBottom = sheetHeight`, so the follow puck sits in the map area above the sheet.
- The PAUSED caption still lives in the sheet, so the sheet is slightly taller while paused (not while locked). Pause needs a stop, so this does not overlap with the locked state.
- Heads-up: light-theme `danger` (#B3261E) on the dark pill is only ~3:1 contrast. Readable at bold 13 px, but check on the phone in light mode; if weak, give the pill a light-mode variant or brighten danger for overlays.
- No src/lib logic changed, so no new tests. typecheck clean (after deleting the stale `.expo/types/router.d.ts`), eslint clean, npm test 109/109.
- NOT checked on phone: pill appears above 10 km/h and disappears when slower, in dark and light; sheet does not jump; puck stays above the sheet; recenter still works.
- Re-verified in a later session: typecheck clean, eslint clean, npm test 109/109. No code changed in the re-check.
- PS chose a1 + b1 (done, uncommitted, test-first, 112 tests): recap header `formatDateTimeRange(start, end, activeS)` appends "· 36:40 active" only when active time is >= 1 min shorter than the wall clock; history hides drives under 100 m (`isJunkDrive`, `MIN_LISTED_DRIVE_M` in `drive-format.ts`, filtered in `loadDrives`; data stays in SQLite). Delete UI left for after the field tests.
- NOT checked on phone: recap header on the 5 Nov drive shows "42 min · 36:40 active"; junk rows gone from history.

## App icon (2026-11-06)
App icon: winding road + tach dial (design/logo/), wired in app.json, needs a native build to appear. Verified paths and sizes; splash `imageWidth` is 76, proposed 200 (artwork is only ~59% of the PNG width), not changed yet. expo-doctor: only dependency patch-version mismatches (`npx expo install --check`), no icon or asset errors.

## 3D map decision (2026-11-06, PS, discussion only, nothing coded)
- FREE: 3D replay of a drive on the recap (plan 3.9). Explored cells = 3D buildings, unexplored = flat blueprint. Car = a dot.
- PREMIUM (Update 1): live 3D driving mode (U1.5) and the 3D car (U1.6). Rule: 3D map in live mode means a 3D car.
- Before building the fog (3.4), run the map style spike 3.0 (Mapbox Standard vs current style), because the fog
  and the 3D buildings must work in the same style. Not part of Phase 1; does not change the Phase 1 gate.
- Not designed yet: the replay UI on the recap and the premium 3D screens.

## Session 6 (2026-11-09): on-phone tests PASS
- PS tested everything pending on the phone (1.1-1.8, 1.10, 1.11, 1.13, 1.5d, recap header, junk-drive filter) and did ~4 test drives: "all the things work fine".
- Only gap: "the notification is not shown yet". Asked PS which one: (a) "Finish this drive?" when locked = expected, not built (in-app only by PS decision, notification is 4.3); (b) the foreground-service "Recording your drive" notification = likely Android 13+ POST_NOTIFICATIONS not granted (expo-location does not request it; recording still works). PS answered: BOTH are missing.
- (a) is expected (not built, 4.3). (b) root cause: `POST_NOTIFICATIONS` is declared in app.json but the app never REQUESTED it at runtime (nothing in `src/` asked), and on Android 13+ it is off until asked, so Android hides the foreground-service notification while the service keeps recording.
- Fix (uncommitted): `ensureNotificationPermission()` in `recorder.ts`, called by `startRecording()` before the session starts. Uses core RN `PermissionsAndroid` (no new library, permission already in the manifest, so no native rebuild is needed in principle; the standalone APK still needs a new preview build to get the JS). Android < 13 skipped; refusal never blocks recording. No unit test (platform glue, no src/lib logic). typecheck clean, eslint clean, npm test 112/112.
- NOT checked on phone: press Start drive -> Android asks "Allow Mapsprint to send notifications?" -> Allow -> "Recording your drive" shows in the drawer during the drive. If the dialog never appears, the notification permission was already refused twice: turn it on in Settings > Apps > Mapsprint > Notifications.
- 1.9: PS will record trip-meter vs app distance on the next drives and report them; don't ask again until PS brings them.

## Session 7 (2026-11-09): task 2.1 Supabase backend, done and committed (ea0aadd)
PS built the SQL by pasting my blocks (guided mode, Claude did not run the DB steps); I wrote files only for the test fix, `supabase.ts`, env and types. Plan was written in plan mode (`C:\Users\PS\.claude\plans\bro-in-the-mean-federated-penguin.md`, partly outdated: PS created the cloud project himself, CLI v3 needs `--remote`).
- Cloud project **Mapsprint**, ref `gwcutbwcmxcwpgndaphi`, Singapore, free plan. Dashboard settings: Data API on, "auto expose new tables" OFF (we grant by hand), "automatic RLS" ON.
- `supabase/migrations/`: `*_init_schema.sql` (12 tables: profiles, vehicles, drives, drive_private, follows, kudos, comments, privacy_zones, explored_cells, xp_events, badges, user_badges; RLS on all; column-level GRANTs so the app can never write stats, XP, level, plan, status, cells or badges; `private` schema helpers `can_view`, `can_view_drive`, `is_accepted_follower`; triggers `handle_new_user` and `follows_set_status`), `*_seed_badges.sql` (10 badges, xp_reward 0 until 3.6), `*_service_role_grants.sql` (server role grants, explicit).
- Security design: `max_kmh`, `track_path` and flags live in owner-only `drive_private`; `drives.route` is the privacy-zone TRIMMED line only (written by 2.4); others see a drive only when `status='processed'` and visibility allows (private / followers / public; a private account's public drives go to followers only); privacy zones, cells and XP are owner-only; deleting the auth user cascades everything (PDPA).
- Tests: `supabase/tests/rls_test.sql`, 37 pgTAP tests, PASS local (`npx supabase test db`) and cloud (`--remote`). The file starts with `set local role postgres` and uses it instead of `reset role`, because on the cloud the CLI logs in as `cli_login_postgres`, which cannot use the `extensions` schema.
- CLI v3 gotchas: `db push` and `test db` target LOCAL by default; use `--remote` for the cloud. Types: `npx supabase gen types typescript --local > src/features/sync/database.types.ts` (run in bash, not PowerShell).
- App client: `src/features/sync/supabase.ts` (supabase-js + react-native-url-polyfill + expo-sqlite localStorage session, AppState start/stopAutoRefresh), `database.types.ts` generated. Nothing imports the client yet (sign-in is 2.2). `.env` + `.env.example` have `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only; the service_role key must never go in the app).
- Results: typecheck clean, eslint clean, npm test 112/112.
- Advisors (cloud, PS ran them): Security flagged `public.rls_auto_enable()` (event trigger function made by the dashboard's "Enable automatic RLS" option, EXECUTE open to anon/authenticated). Fixed by migration `*_revoke_rls_auto_enable.sql` (guarded, the function only exists on the cloud). Performance flagged two permissive SELECT policies on `drives`; merged into one by `*_merge_drives_select_policies.sql` (same rule, owner OR processed + can_view). Both pushed with `db push --remote`; tests 37/37 local + cloud; Security and Performance advisors now clean (only expected "unused index" noise on an empty DB, if any). 5 migrations in total.
- STILL TO DO by PS: (1) add the two `EXPO_PUBLIC_SUPABASE_*` env vars on expo.dev (preview + development) like the Mapbox token, or the APK throws at import once 2.2 uses the client; (2) commit `supabase/`, package files, `src/features/sync`, `.env.example`, plan.md, handoff.md.
- Notes for 2.2+: Auth providers (Google + email), leaked-password protection and email confirmation are Auth settings, not done. Server writes (2.3/2.4) must use the service role from an Edge Function only. Edge Function `finalize-drive` must trim routes by privacy zones (zones table is owner-only, service role reads it). Feed display of max speed when "Share max speed" is on is undecided (4.2).
- Phase 2 is security-sensitive: the next steps (2.2 auth, 2.4 anti-cheat) belong in an Opus session per CLAUDE.md.

## Session 8 (2026-11-09, Opus): task 2.2 auth + guest mode + onboarding, code done, committed (fedd1a3 db, 577f783 app); NOT yet tested on a phone
Brainstormed with PS → spec `docs/superpowers/specs/2026-11-09-auth-onboarding-design.md` (builder-checked) → plan
`docs/superpowers/plans/2026-11-09-auth-onboarding.md`.
- PS decisions: guest mode ("Continue as guest"; guests record, HUD, stats recap, history; locked: 3D replay, badges, Feed,
  Ranks, following); guest drives move to the NEXT account that signs up/logs in; sign-out returns to Welcome and hides that
  account's local drives until it logs back in; no email confirmation for now → **GOOGLE-ONLY** (with confirmation off,
  Supabase auto-links a later Google sign-in into a pre-registered email account = hijack risk); photo optional (letter
  avatar default); tab icons in the same native rebuild; privacy zones (06) moved to Phase 4 as a gate before the Feed.
- Google OAuth set up by PS: Cloud project "Mapsprint", Google Auth Platform External/Testing (PS's Gmail = test user),
  Web client (secret only in the Supabase dashboard) + Android client (package com.suchakree.mapsprint, SHA-1
  5D:49:C5:…:6A:31, same for EAS preview + development). Supabase Google provider: Client IDs `WEB,ANDROID`, nonce check off.
  PS keeps a `client_secret_*.json` in the repo folder: git-ignored (.gitignore line 53), never committed; suggested moving it
  out and optionally rotating the secret (it appeared in chat).
- DB: migration `*_vehicles_colour_and_avatars.sql` (`vehicles.colour`, 8 keys = `carColours` in tokens.ts; private
  `avatars` bucket 1 MB jpeg/png/webp, write only in `<uid>/`, read for signed-in users). pgTAP now 44 tests, PASS locally.
  **NOT yet pushed to the cloud.**
- Pure logic test-first (`tests/auth-rules.test.mts`, 14 tests): `src/lib/username.ts`, `avatar.ts`, `password.ts`,
  `onboarding.ts` (`nextRoute`), `drive-owner.ts` (`visibleTo`, `claimable`). npm test 126/126.
- Local ownership: `sessions.owner_id` (ALTER on existing installs), kv `current_owner`, `claimGuestSessions`;
  `startSession` stamps the owner; `loadDrive`/`loadDrives` filter with `visibleTo`. Old Phase 1 drives (owner NULL) go to
  the first account that signs in. Sign-out is blocked while recording.
- Auth: `src/features/auth/` — `auth-provider.tsx` (session, guest flag, profile + offline cache, onboarding route; state
  derived in render to satisfy the React Compiler lint), `onboarding-guard.tsx` (redirects per `nextRoute`; `location`
  stays reachable for the Record button), `google.ts` (lazy native import; `signInWithIdToken`), `avatar-photo.ts`
  (picker square crop → 512×512 JPEG → upload; signed URLs), `onboarding-flags.ts`. Root layout latches "started" once
  so later auth changes never unmount the navigator.
- Screens: welcome (01, SVG art from the design, "Continue as guest", copy says "Track your drives" not speed),
  sign-in (02, built, redirects to welcome while the flag is off), location (03 now marks the step done, "Step 3 of 5"),
  about-you (04, debounced username check + unique constraint, Google name pre-filled, optional photo), car (05, colour
  swatches + top-down car), Feed/Ranks `LockedFeature` for guests, Profile (account header / guest "Create account" /
  Sign out). New components: icons.tsx (react-native-svg, from design/source), TextField, Avatar, StepHeader, LockedFeature.
  Record button now shows the steering-wheel icon. Tab bar has icons.
- Native: `@react-native-google-signin/google-signin` 17 (plugin MUST have `iosUrlScheme`, otherwise it runs in Firebase
  mode and the Android build fails; current value = reversed WEB client ID as a placeholder, replace with the iOS client's
  when iOS starts), `expo-image-picker` (camera + microphone permissions disabled), `expo-image-manipulator`,
  `react-native-svg`. `expo install --fix` aligned 4 patch versions. `npx expo config --type prebuild` OK.
- Env: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env` + `.env.example`.
- Results: typecheck clean, eslint clean, npm test 126/126, pgTAP 44/44 local, no hex outside src/theme.
- Known/open: no Terms/Privacy footer on Welcome (no policy exists yet; gate at 2.6). Step 04 has no back button (my call:
  signed-in users can't go back to Welcome without signing out). Feed/Ranks for signed-in users are still placeholders.
  Nonce: none sent; if Supabase rejects Google tokens, pass a nonce or enable "Skip nonce check".
- **Code review (subagent, end of 2.2): "ready with fixes", no criticals. Fixed (claims checked in supabase-js 2.119
  source first):** (1) offline cold start with an expired token returned "no session" → signed-in drivers landed on
  Welcome: now `offlineUserId` falls back to the stored `current_owner` on `AuthRetryableFetchError`, and the owner kv is
  no longer wiped before the stored session is read; (2) sign-out now `scope: 'local'` (default 'global' signed out the
  user's other phones and did nothing offline); (3) email sign-up off is now also in `supabase/config.toml`
  (`[auth.email] enabled = false`; local probe returns `email_provider_disabled`); (4) a failed photo upload no longer
  blocks step 04; plus: username check never says "available" on a network error, sign-in buttons stay locked until the
  guard moves on, avatar resize keeps aspect ratio, Google errors are logged and DEVELOPER_ERROR (code 10) gets its own
  message, `justSignedIn` only reset by the live fetch, new DB check `profiles.avatar_url` = own `<uid>/avatar.jpg` only,
  pgTAP 47/47 (own-avatar check, foreign avatar rejected, anon can't list photos).
- **Deferred (noted, not fixed):** returning user whose first profile fetch fails sees step 04 with an empty field and
  could overwrite their own username (retry state later); car insert not idempotent (duplicate car on a retried save);
  fixed avatar path + upsert may show a cached old photo when "change photo" is built (use a versioned file name then);
  dev GPS screen lists all accounts' sessions (removed in 1.12); `claimable()` tested but SQL hard-codes the rule;
  after a guest upgrades they land on Feed, not "back where they were"; profile cache of a signed-out account stays on the
  phone (username/display name/avatar path only); pgTAP has no avatar-delete or PDPA-avatar test (2.6 gate);
  Expo Router `Stack.Protected` could replace the effect guard (removes a first-frame tab flash).

## Session 9 (2026-11-09, Sonnet): car picker on the Pre-drive screen, code done (uncommitted, JS only)
PS asked for car selection before recording (design 07 row was a placeholder). Plan file: ~/.claude/plans/bro-in-the-mean-federated-penguin.md.
- Decisions (PS): guests get no car; tapping the row opens a sheet to pick a car or add one; last-used car remembered per account.
  **My call:** the guest row has no sign-in button (just says to make an account from the Profile tab), so the Google flow never interrupts the record screen.
- Files: `src/lib/vehicles.ts` (+ `tests/vehicles.test.mts`, in `npm test`), `src/features/auth/vehicles.ts` (`useVehicles`: Supabase list
  filtered by `user_id` + offline cache), `src/features/settings/prefs.ts` (selected id + cache per account), `src/components/CarForm.tsx`
  (extracted from onboarding step 5), `src/components/CarPickerSheet.tsx`, `src/app/record/pre-drive.tsx`, `src/app/(onboarding)/car.tsx`,
  `src/features/recording/db.ts` (`sessions.vehicle_id`, safe ALTER) + `recorder.ts` (stamps the selected car at start).
- Security note: the `vehicles` SELECT policy is `using (true)` (any signed-in user can read all cars, by design for friends' garages), so the app
  MUST always filter `.eq('user_id', ...)`. Done in `useVehicles`. No DB change this session.
- Checks: typecheck clean, eslint clean, 130/130 tests. NOT tested on a phone yet (JS only, no native rebuild; it rides in the same APK as 2.2
  if you have not built yet). Test items: testlist.md section F9.
- Not done: Garage screen (4.6), edit/delete car, default-car flag, upload of `vehicle_id` (2.3 must send it with the drive).

## Session 10 (2026-11-09): Garage (23) + Edit profile, code done (uncommitted)
- Garage `src/app/garage.tsx`: car cards (icon, nickname, "Default" = the car Pre-drive starts with, colour + make/model, edit pencil),
  DISTANCE / DRIVES from drives on this phone (`carStats`, `DriveItem.vehicleId`), AVG SMOOTH shows "–" until 3.5. Dashed "Add a car".
  `src/app/garage-car.tsx` (`?id=` edit, no id = add): shared `CarForm` (now has edit mode), "Use as default car", "Delete car" with confirm.
- Edit profile `src/app/edit-profile.tsx`: photo, username (same live check as step 4, moved to `src/features/auth/use-username-field.ts`),
  display name. Profile tab got "Edit profile" and "Garage" buttons (signed-in only).
- Photo fix: each upload is now `avatars/<uid>/avatar-<ms>.jpg` (old fixed name showed a cached old photo after a change); old file removed
  after the profile points at the new one. **Migration `20261109120000_avatar_versioned_paths.sql`** widens `profiles_avatar_url_own`
  (still own folder only, regex). pgTAP 50 (3 new) PASS locally. Same rule in `src/lib/avatar.ts` `isOwnAvatarPath` (tested).
- **PS must run before testing the new APK:** `npx supabase db push --remote` then `npx supabase test db --remote` (expect 50 PASS).
  Without it every photo upload fails the DB check.
- Checks: typecheck clean, eslint clean, 134/134 tests. Not tested on a phone (testlist F10). JS only, no native rebuild.
- For 2.3: a deleted car leaves its id on local drives (`sessions.vehicle_id`); upload must send null if the car no longer exists
  (the drives INSERT policy rejects a vehicle_id that is not yours).

## Session 11 (2026-11-09): task 1.12 spike screens removed (uncommitted)
- Deleted `src/app/{dev,map,gps,h3,kit}.tsx`, their Stack.Screen lines in `_layout.tsx` and the "Dev: spikes" link on the Profile tab.
  `h3-js` stays (Phase 3.3). Unused leftovers, harmless, left in place: `components/Stat.tsx`, `components/GpsCheckCard.tsx`, `listSessions` in db.ts.
- Checks: typecheck, eslint clean, 134/134 tests. testlist.md "Kit preview" section replaced by a short look-and-feel list.

## Session 12 (2026-11-09, Sonnet): locked-phone "Finish this drive?" notification + Settings screens, code done (uncommitted)
Plan file: ~/.claude/plans/bro-in-the-mean-federated-penguin.md. **Needs a NEW EAS build** (adds the native `expo-notifications`).
- Notification: `src/features/recording/finish-reminder.ts` is called (throttled to 1/min) at the end of the location task. Screen off/app
  not in front + stopped 15 min (30 min if manually paused) + not snoozed (15 min) + setting on -> one LOCAL notification on channel
  "Drive reminders" (id `finish-reminder`). Tap -> root layout opens `/record/hud` (HUD shows its own finish dialog); cleared on stop.
  Pure rule `reminderPauseState` in `src/lib/finish-prompt.ts` (tests). db.ts: `getLastMovingTs`, `get/setFinishNotifiedAt`.
  `app.json`: expo-notifications plugin, small icon = android-icon-monochrome.png (may look small/odd: check), colour #FFC20E.
  UNVERIFIED: posting a notification from inside the background location task on the real phone (docs do not say it is safe);
  if nothing appears, check `adb logcat` / the "[finish-reminder]" warning first. SDK 58 API details were read from node_modules typings.
- Settings (`src/app/settings/{index,recording,privacy,account}.tsx`, `src/components/SettingsRow.tsx`, Profile tab "Settings" button):
  - Hub: Account and data / Privacy (signed-in only), Recording, Appearance Dark/Light/System (`Appearance.setColorScheme('auto'` for System in RN 0.88; applied at startup in `_layout.tsx`).
  - Recording: Auto-pause on/off + 2/5/10 min (now really used by live stats, HUD text and `summarize(points, events, autoPauseMs)` so the recap matches),
    Sound cues (same pref as Pre-drive; sounds come in 3.7), Keep screen on (HUD), extra "Remind me to finish" toggle. Voice lines hidden until 3.7.
    Side effect (shown in the screen): changing auto-pause changes the moving time of drives already on the phone (recomputed on read).
  - Privacy: Private account + Share max speed toggles on `profiles` (existing grants + RLS tests, optimistic, revert on error); other rows "Coming soon".
  - Account: email, Google "Connected", Sign out; Download / Delete are disabled "Coming soon" (Edge Functions, Opus, 2.6 gate: Play requires deletion).
- Prefs: `src/features/settings/prefs.ts` (+ `src/lib/recording-settings.ts`, tested). Checks: typecheck, eslint clean, 143/143 tests. NOT on a phone yet (testlist F11, F12).
- Not done: Notifications settings row, Help/Terms/Privacy Policy links (need URLs, plan 5.2), Default drive visibility (needs DB column), Blocked people, Voice lines.

## Claude chat notes (2026-11-09): 4 more recorded drives (GPS only) + planning talk (nothing coded)
Recap screenshots from PS (standalone APK, screen locked, foreground service). NO car trip meter reading was taken, so these do NOT count toward the 10-drive distance gate (1.9) until a reference exists (Google Maps route distance is a loose +-3% check; trip meter reset at Start is better; odometers often over-read 1-3%, so also compare with Maps).
| Drive | Wall | Distance | Moving | Moving avg | Points used | Longest gap | Gaps > 3 s |
|---|---|---|---|---|---|---|---|
| Thu 5 Nov 17:55 | 42 min (36:40 active) | 7.86 km | 21:25 | 22.0 km/h | 2500 / 2507 | 2 s | 0 |
| Fri 6 Nov 17:43 | 36 min | 7.90 km | 26:37 | 17.8 km/h | 2165 / 2165 | 1 s | 0 |
| Sat 7 Nov 10:47 | 44 min | 17.27 km | 32:39 | 31.7 km/h | 2604 / 2655 | 2 s | 0 |
| Sat 7 Nov 14:09 | 22 min | 9.74 km | 15:28 | 37.8 km/h | 1317 / 1317 | 2 s | 0 |
- Recording is solid: no gap over 3 s on any drive. The Sat 10:47 drive dropped 51 points (1.9%, probably accuracy > 25 m).
- Open questions for PS: was Fri 6 Nov the same trip as Thu 5 Nov (routes drawn differently, distances within 0.5%)? On both Saturday drives the recap route line extends a bit past the start circle, and on the 10:47 drive the end dot sits mid-route (out-and-back, or a U-turn / parking-lot start?). Could be a recap map marker issue, check later.
- Still to do for 1.9: trip-meter (or Maps) reference on each drive. Prefer drives of 10 km or more (meter shows 0.1 km steps).
- NEW field test: record while Google Maps navigation is the app on screen (the expected real-world use in Thailand). Check no gap over 3 s, normal points count, sane distance. Some Samsung phones kill background apps aggressively.
- Logo: JPG copy saved as `design/logo/icon.jpg` (full icon on #0A0A0A, 1024x1024). Not for the Android adaptive icon (needs the transparent PNGs).
- Planning talk (no code): 3D replay free / live 3D + 3D car premium (see "3D map decision" above), caravan, turn-by-turn navigation (out), Android Auto (not possible), music controls (skip), Mapbox free tiers. All parked in plan.md under "Later ideas" and "Mapbox free tiers".

## Task 1.9 field test: drives WITH a car trip meter reference (PS, 2026-11-10)
PS photographed the car's Trip A at the start and end of each drive (Trip A never reset between them; assumed photo order: 113.6 start Mon, 122.7 end Mon at home, 132.8 end Tue). The meter shows 0.1 km steps, so each reference is only good to about +-1% on a 9-10 km drive.
| # | Drive | Trip meter | App GPS | Diff | Points used | Longest gap | Gaps > 3 s |
|---|---|---|---|---|---|---|---|
| 1 | Mon 9 Nov 17:47 -> 19:13 (85 min, 46:19 active, 29:19 moving) | 9.1 km | 9.12 km | +0.2% | 3669 of 5089 | 7 s | 3 |
| 2 | Tue 10 Nov 05:34 -> 05:54 (20 min, 14:57 moving) | 10.1 km | 10.13 km | +0.3% | 1199 of 1199 | 2 s | 0 |
- Both far inside the 2% gate. This car's trip meter looks accurate (no obvious over-read). That is 2 of the 10 reference drives. The 5 Nov first data point (7.86 km vs 7.91 km) may count as a third if the 7.91 was a trip meter (PS to confirm what it came from). The 4 earlier GPS-only drives (table above) do not count.
- Drive 1 dropped 28% of points (1420 of 5089, others < 2%). Suspect: parking garage at the start (photo 1 is in a garage; GPS accuracy worse than 25 m is dropped). Distance still matched the meter, so it did no harm. Worth a look when tuning `CLEANING`.
- Correction (2026-11-10): on drive 1 PS forgot to press Finish after arriving home. The numbers say he was parked about 40 min, not the 10 min he first guessed (PS agrees): active 46:19 from 17:47 ends ~18:33 = 5 min after stopping (auto-pause), the 18:28 and 19:11 gaps are at the same spot (~15 m apart), and the reminder only fires after 30 min when auto-paused. So he arrived ~18:28 and the real drive was ~41 min wall; the 85 min wall time and 46:19 active include ~5 min stopped before auto-pause and ~40 min paused. Distance and moving time are unaffected. Both gaps are from the parked period (phone at home), not driving problems.
- BUG (PS, 2026-11-10, HIGH priority, battery): the ongoing foreground-service notification "Recording your drive" does NOT disappear after pressing Finish in the app. Suspect: `stopRecording()` only calls `Location.stopLocationUpdatesAsync` when `isRecording()` (= `hasStartedLocationUpdatesAsync`) is true; if that returns false (e.g. after the app process was recreated while the service kept running, `killServiceOnDestroy: false`), the stop is skipped and GPS + service keep running with no active session (the task stores nothing, but the battery drains). Also no orphan cleanup on app start. Agent prompt given.
- The 'Finish this drive?' reminder did NOT appear (PS only saw the recording notification), although he was parked ~40 min (rule: 15 min stopped, 30 min if manually paused). Check first whether the installed APK includes commit 8709b5c (expo-notifications needs a new EAS build); if it does, posting from the background task may be failing silently (see Session 12 UNVERIFIED note).
- Drive 1 gaps: 19:11:35 (7 s) at 13.9673, 100.6817 and 18:28:42 (5 s) at 13.9674, 100.6816 (same spot, 43 min apart); the third gap was cut off in the screenshot. PS to say what happened at 18:28 (about 40 min stopped there?) and optionally send the full GPS check.
- Next for 1.9: 8 more drives with the meter reset at Start (prefer >= 10 km). Then tune `CLEANING` if needed and decide the gate.

## Session 13 (2026-11-10, Opus): BUG "Recording your drive" stays after Finish + reminder did not fire (code done, uncommitted)
**Root cause, read from node_modules source (expo-location SDK 58 classic module, expo-task-manager, expo-modules-core):**
- `hasStartedLocationUpdatesAsync` = `TaskService.taskHasConsumerOfClass`, which reads expo-task-manager's task registry: static maps,
  persisted to SharedPreferences "TaskManagerModule" and restored in each new process (`restoreTasks`). So after an app restart it still
  returns true; the guess "isRecording() returns false so stop is skipped" is unlikely.
- `stopLocationUpdatesAsync` -> `unregisterTask` -> `LocationTaskConsumer.didUnregister()` -> removes the GPS PendingIntent (GPS off) and
  `stopForegroundService()` = `mService?.stop()` only. `mService` is set only when the consumer's `bindService` connects, made in
  `maybeStartForegroundService()`, which returns early if `AppForegroundedSingleton.isForegrounded` is false.
- Chain on PS's drive 1: phone parked, Samsung kills the process -> `LocationTaskService` returns `START_REDELIVER_INTENT` so Android
  restarts it (notification back) -> the next GPS broadcast restores the task in the background -> consumer never binds -> the headless JS
  instance (`RNHeadlessAppLoader.appRecords`) stays alive because a location event arrives every second (it is only dropped after 2 s
  idle) -> when PS opens the app, `TaskManagerInternalModule.onHostResume` sees "headless" and does NOT forward onHostResume to the
  consumer, so it still never binds -> Finish: GPS updates removed, service + notification left behind (idle service, small drain; the
  notification lies). The 5-7 s gaps at 18:28 and 19:11 at the same parked spot fit two process restarts.
- Fix (`src/features/recording/recorder.ts`): `stopLocationService()` re-registers the task with the same options while the app is in
  front (forces `startForegroundService` + bind on the running service), then unregisters; expo's `onServiceConnected` stops the service if
  the task was unregistered while the bind was pending. Falls back to a plain stop if re-attach fails (permission revoked). Errors logged
  `[recorder]` and rethrown; `stopRecording()` ends the drive only after GPS is off (HUD shows the error, Finish can be retried), and
  awaits `clearFinishReminder()`. Alternative (not done): patch-package expo-location so `stopForegroundService()` also calls
  `context.stopService(...)` when `mService` is null (native rebuild, cleaner; worth an upstream issue).
- Launch cleanup (`cleanUpRecorderOnLaunch()`, root layout once started): task registered + no open drive -> stop it. Open drive + task
  not registered: nothing at launch (no surprise GPS); opening the HUD (pill) now RESUMES GPS on the same drive. Before, `startRecording()`
  opened a second drive and left the first one open forever. Pure rules `planStart` / `planLaunchCleanup` in `src/lib/recording-state.ts`
  (tests `tests/recording-state.test.mts`).
- A zombie service from the OLD build cannot be detected from JS (the task is already unregistered): PS force-stops the app once.
**Reminder did not fire:** a real logic bug, whatever the APK: `getLastMovingTs` counted ANY point with speed >= 3 km/h, while the live
engine ignores points with accuracy > 25 m. Parked indoors, poor fixes with jittery speed kept "last moving" fresh, so 15 min stopped
never arrived (drive 1 dropped 1420 points for accuracy, likely the parked hour). Now the SQL also requires `accuracy <= 25`. Posting
errors are logged with `console.error('[finish-reminder] ...')`, a successful post with `console.log`. `AppState` in a headless JS context
is 'background' (RN AppStateModule), so the "app on screen" skip did not block it. Whether the APK had 8709b5c: if Profile has a
"Settings" button, it did (same commit); `npx eas-cli@latest build:list -p android --limit 5` shows each build's commit.
- Results: typecheck clean, eslint clean, npm test 148/148 (5 new). Not checked on the phone: testlist F13.
- **Needs a new EAS preview build** (JS change; no new native code). No OTA updates in this project.

## Session 14 (2026-11-10, Opus + chat with PS): 2.3 / 2.4 DESIGN written (docs only, no code)
- PS started the EAS preview build (includes the Session 13 fix) and is waiting to test testlist F13.
- Design agreed in chat, written to `docs/superpowers/specs/2026-11-10-drive-upload-finalize-design.md` (reviewed by a
  builder subagent; its answers are in the spec section "Rules settled after the builder check") and
  `docs/superpowers/plans/2026-11-10-drive-upload-finalize.md` (6 steps). plan.md 2.3/2.4 updated.
- Key decisions (PS): recap waits for the server, final numbers only; no signal = wait, History "Waiting to upload";
  modes Car / Motorbike / Other; Garage holds motorbikes; ONE shared map for all modes; Other earns the same XP; no
  proof of driving (trust, like Strava).
- The builder-check answers (mode edits only when processed, exclusion constraint for overlaps, failure classes, 12 h /
  60k point limits, null route when trimmed away) were settled by Claude and are NOT yet reviewed by Opus: the Opus
  security review (plan step 6) must confirm them.
- Next: PS tests F13 on the new build. Then a Sonnet session starts the plan at step 1 (migration + pgTAP).
- **Step 1 WRITTEN, NOT YET RUN (Sonnet, 2026-11-10):** `supabase/migrations/20261110120000_drive_modes_and_tracks.sql`
  (drives.mode, vehicles.kind, vehicle/mode insert+update policies, update only when processed, btree_gist exclusion
  constraint on processed drives, private `tracks` bucket + insert-only policy) and `supabase/tests/rls_test.sql`
  (29 new tests, `plan(79)`; A's fixture drives were re-timed so counted drives don't overlap). Docker does not start on
  this PC and the rolled-back cloud dry run was declined, so NOTHING was executed. To verify:
  `npx supabase db push --remote` then `npx supabase test db --remote` (expect 79 ok). Things most likely to need a fix:
  the exclusion constraint syntax (btree_gist in the `extensions` schema), the storage insert policy referencing
  `public.drives`, and whether the Storage API's real upload needs more than INSERT (docs say only upsert needs
  SELECT+UPDATE; confirm with a real upload in step 3). `src/features/sync/database.types.ts` is not regenerated yet.
  **Update:** PS pushed the migration (on the cloud) and ran `test db --remote`: 78/79; the one failure was a wrong test
  (Supabase's `storage.protect_delete` trigger makes a direct DELETE on storage.objects raise 42501 instead of deleting 0 rows).
  Test 66 now expects the error (still 79 tests). Needs one more `npx supabase test db --remote` run to confirm 79/79.

- **Step 1 DONE:** PS pushed the migration; pgTAP 79/79 on the cloud (`test db --remote`; test 66 fixed: direct DELETE on storage.objects raises 42501).
- **Step 2 DONE in code (Sonnet, 2026-11-10, uncommitted), phone test pending (testlist F14):** pure rules `src/lib/travel-mode.ts`
  (+ `Car.kind`, `normaliseKind` in `src/lib/vehicles.ts`; tests `tests/travel-mode.test.mts`, 155 total); prefs: default vehicle per kind
  (car keeps the old key), `getTravelMode/setTravelMode` per account (guests share a slot), `readCachedCars`; `useVehicles(mode)` returns
  `cars`, `modeCars`, `selected`, `selectedByKind`; local `sessions.mode` column (default car), `startSession(now, vehicleId, mode)`,
  `SessionInfo.mode`, `DriveItem.mode`; recorder stamps the mode and only a vehicle that still exists in the cached garage and fits
  the mode; Pre-drive mode picker (Segmented) + vehicle row per mode + "Other" row + driver line; `CarForm` `kind` prop / toggle (kind is
  insert-only: no update grant); `CarPickerSheet` takes `kind`; Garage + garage-car show cars and motorbikes. `database.types.ts` was
  edited by hand (`drives.mode`, `vehicles.kind`): regenerate it with `npx supabase gen types typescript --local` when Docker works.
- Not built yet: mode on the recap / History (step 5), upload (step 3). Mode is stored locally only; the recap does not show it.
- Results: typecheck clean, eslint clean, npm test 155/155. No new native module (JS only), but the phone needs a new build to get it.

- **Step 3 DONE in code (Sonnet, 2026-11-10, uncommitted), phone test pending (testlist F15):** pure rules `src/lib/track-format.ts`
  (wire format v1: columnar JSON, 6-decimal lat/lng, limits 12 h / 60k points / 5 MB; `parseTrackPayload` is what finalize-drive should
  reuse) and `src/lib/upload-queue.ts` (states, back-off 5 s..10 min, `classifyFailure`, `parseFinalizeResponse`, History labels);
  tests `tests/track-format.test.mts`, `tests/upload-queue.test.mts` (168 total). Local table `uploads` (db.ts). Runner
  `src/features/sync/upload-runner.ts`: discover finished drives of the signed-in owner (junk / <2 points are marked rejected locally),
  per drive: insert `drives` row -> upload `tracks/<uid>/<uuid>.json.gz` -> `functions.invoke('finalize-drive', { driveId })`; each step
  idempotent; oldest first; stops on transient errors. Trigger `use-upload-trigger.ts` (root layout): on sign-in, app to front, every 30 s
  (my call: polling instead of a network library; no extra native module). `retryUploadsNow()` on History pull-to-refresh and the queue
  also starts right after Finish. History shows the status per row; tapping a waiting drive explains (with "View on this phone").
  `counted-notification.ts` ("Your drive is counted" when it waited more than 2 min; tap opens the recap).
  New packages: `expo-crypto` (native: needs the next EAS build) and `fflate` (JS gzip).
- **Contract finalize-drive must follow (step 4):** POST `{ driveId }` with the user's JWT; answer 200 `{ status: 'processed', stats:
  { distanceM, movingS, elapsedS, avgMovingKmh, avgOverallKmh } }` or 200 `{ status: 'rejected', reason }` with reason one of
  `overlap | times_mismatch | unreadable | too_long | too_few_points | invalid`; transient trouble = non-2xx (5xx/timeouts are retried, 404 too
  so the app works before the function is deployed; 400/422 are final). The drive row times are the first/last point timestamps.
- Not built: Saving screen + recap numbers from the server (step 5), the function itself (step 4). Until step 4 is deployed every
  signed-in drive stays "Waiting to upload" (raw tracks of PS's own drives sit in the private bucket). Do not hand this build to testers.
- Results: typecheck clean, eslint clean, npm test 168/168.

- **Step 4 DONE in code (Opus, 2026-11-10, uncommitted), NOT DEPLOYED, not run against the cloud:** `supabase/functions/finalize-drive/index.ts`
  (Deno glue: verify the caller's JWT, load the caller's own drive, download `tracks/<uid>/<driveId>.json.gz` with the secret key, capped gunzip,
  validate, read the caller's privacy zones (FAIL CLOSED if unreadable), `finalizeTrack`, friendly overlap check, `drive_private` upsert,
  compare-and-set `status 'uploading' -> 'processed'` (23P01 = lost a race -> rejected 'overlap'), answers the contract above; a second call
  returns the stored result). All decisions are in the pure `src/lib/finalize.ts` (tests `tests/finalize.test.mts`, 19): limits (12 h /
  60k points before any work), NaN-safe times check (120 s tolerance), cleaning/stats via the same `summarize` as the phone, route =
  accuracy <= 25 m + teleport filter + 5 m step -> leading/trailing points inside a zone dropped (stats still use the whole track) ->
  Douglas-Peucker 5 m in metres -> EWKT (null when < 2 points left), auto-pause only from {2,5,10 min, off}, flags = counters/booleans.
  Benchmark (Node): a 43,200-point (12 h) track decodes + finalizes in ~0.3 s; 60k points is refused as too long.
- **Edge copy of the rules:** the function deploys from its own folder, so `supabase/functions/finalize-drive/lib/` holds IDENTICAL copies of 9
  files from `src/lib` (list in `scripts/sync-edge-lib.mjs`). After changing any of them run `npm run sync:edge`; `tests/edge-lib-sync.test.mts`
  fails on a stale copy. tsconfig and eslint exclude `supabase/functions` (Deno code). `supabase/config.toml`: `verify_jwt = true`.
- **Deploy (PS):** `npx supabase functions deploy finalize-drive --use-api` (server-side bundling, no Docker). Env needed is automatic
  (`SUPABASE_URL`, `SUPABASE_SECRET_KEYS` or legacy `SUPABASE_SERVICE_ROLE_KEY`). Never run in prod without testlist F16 afterwards.
- **Unverified (cannot run Deno/Docker here):** that PostgREST accepts an EWKT string for `drives.route` and returns `privacy_zones.center` as
  GeoJSON or EWKB hex (both parsed; anything else fails closed); `DecompressionStream`/`npm:@supabase/supabase-js@2` in the hosted runtime.
  First real call tells; read the function logs (Supabase dashboard > Edge Functions > finalize-drive > Logs, tag `[finalize-drive]`).
- **Opus review checklist (step 6):** JWT handling, every query scoped to `uid`, no path from the request, secret key never leaves the
  function, zones fail closed, compare-and-set + exclusion constraint, caps (gunzip 24 MB, 5 MB file, 60k points, 12 h), no coordinates in
  logs, error responses generic, 503/500 retried by the app (an unreadable zone would retry forever: acceptable, logged).
  Known gaps: no per-user rate limit; a user can burn CPU by uploading many max-size tracks (each is idempotent per drive id); the raw
  track file is kept for rejected drives (2.6 gate: delete with the drive/account).
- Results: typecheck clean, eslint clean, npm test 196/196.

- **Opus review of 2.3/2.4 done (fresh reviewer agent, read-only, 2026-11-10):** no way found to read or write another user's data. Fixed in code:
  (1) retry after the server decided: the runner now checks the drive row's status when the row already exists and skips the track upload
  (Storage only accepts 'uploading' drives) and goes straight to finalize (idempotent); Storage "already exists" is also recognised by its
  body code (`statusCode '409'` / `ResourceAlreadyExists`); (2) NEW MIGRATION `20261110130000_drives_default_private.sql`: drives default to
  `private` (before, followers could read the untrimmed route through the API because nobody has privacy zones yet); pgTAP now 80 tests;
  (3) finalize rejects dates before 2024 or more than 5 min in the future (`MIN_VALID_TS`, reason `invalid`); (4) pause events outside the track
  are ignored and elapsed/moving time never exceed the track length; (5) decompressed JSON cap 8 MB, `parseTrackPayload` refuses > 2x60k points
  before looping, Douglas-Peucker thins routes above 8000 points first; (6) the storage path uses the stored `drive.id`.
  Accepted / later: see the PHASE 3 GATES in plan.md 2.4 (content-hash dedupe, upload caps, past-date window, re-trim on new zones); a poison
  drive (deterministic 5xx) is retried every 10 min by the app; `alreadyDecided` returns float4 values (tiny rounding difference vs the first answer).
- **PS must run, in this order:** `npx supabase db push --remote` (applies the private-default migration), `npx supabase test db --remote`
  (expect 80), `npx supabase functions deploy finalize-drive --use-api`, then build the app and run testlist F16 and F17.
- **Step 5 DONE in code (Opus, 2026-11-10, uncommitted), phone test pending (testlist F17):** `src/lib/saving.ts` (+ `tests/saving.test.mts`) decides the
  ring %, label, the two real steps and "no signal after 10 s"; `src/app/record/saving.tsx` is design 09 (ring + 2 steps + no-signal note + "Open recap
  when ready"; XP / badges / map cells rows are NOT shown: Phase 3); `getUploadPhase()` in the runner feeds the ring; HUD Finish goes to Saving for
  signed-in users and straight to the local recap for guests; the recap shows the SERVER numbers once counted, a "Travelled by" Car / Motorbike /
  Other correction (one update of mode + vehicle_id; RLS allows it only for counted drives), or a "not counted yet" note.
- Results: typecheck clean, eslint clean, npm test 206/206.

## Session 15 (2026-11-12, Opus): 3.10 private top speed, CODE DONE, uncommitted, phone test F18 pending
- Rule (`src/lib/top-speed.ts`, shared with finalize-drive via `npm run sync:edge`):
  - Same cleaning as the drive stats: accuracy <= 25 m and the teleport filter.
  - It uses the RAW chip (Doppler) speed, not the EMA. The EMA lags a real peak and smears one glitch over several points;
    the window is the spike filter.
  - Top speed = max over every >= 3 s stretch of that stretch's SLOWEST point (sliding-window minimum, O(n)).
  - A stretch can't cross a GPS gap > 5 s, a point with no speed, or a speed > 250 km/h.
  - Result in km/h, 0.1 rounding, null when there is no 3 s stretch. Tests: `tests/top-speed.test.mts` (a 180 glitch in a
    90 drive gives 90, a 2 s burst doesn't count, 4 s held does, poor accuracy, teleport, gap, null speed, unsorted).
  - `shownTopKmh`: counted drives show the server value only, local or guest drives the phone value.
- DB: new migration `20261112120000_private_top_speed.sql`:
  - adds `drive_private.top_kmh` (0..250 check)
  - drops `drive_private.max_kmh` (old EMA max, never read, so old drives get none)
  - drops `profiles.share_max_speed`
  - Never on `drives`.
  - pgTAP `plan(86)`, 6 new tests: owner reads own top speed, owner can't update or insert it, `drives` has no top_kmh, both
    old columns are gone. Stranger and follower reading nothing from `drive_private` was already tested.
  - `database.types.ts` edited by hand.
- finalize-drive:
  - writes `top_kmh`
  - 200 response `stats.topKmh` (extra optional field, old apps unaffected), also on idempotent retries (read from `drive_private`)
  - `parseFinalizeResponse` keeps it only when it is a number
- Phone:
  - SQLite `sessions.has_top_speed` (0 for old rows, 1 from `startSession`), so new drives only.
  - `DriveItem.topKmh` computed on read and never uploaded.
  - The recap gets a third tile row "Top speed" (half width, same Tile style), and History's grey line gets "· top 92 km/h".
  - No HUD, Saving screen, feed or share use.
  - Privacy settings: the "Share max speed" row is removed.
- Results: typecheck clean, eslint clean, npm test 220/220.
- **PS must run, in this order:**
  1. `npx supabase db push --remote`
  2. `npx supabase test db --remote` (expect 86)
  3. `npx supabase functions deploy finalize-drive --use-api` RIGHT AFTER step 1. Between 1 and 3 the old function still writes
     `max_kmh` and gets 503; the app retries, so nothing is lost.
  4. New EAS preview build (JS only; it also carries the 3.0 spike screen)
  5. testlist F18

  Until the new APK is installed, the OLD app's Privacy screen can't load (it still asks for `share_max_speed`).

## Session 16 (2026-11-12, Sonnet executing the Opus plan `docs/superpowers/plans/2026-11-12-hex-cells.md`): 3.3 hex cells, CODE DONE, uncommitted, phone test F19 pending
- `src/lib/cells.ts` (`driveCells`, `CELL_RES` 9, `CELLS`): cleaned MOVING points only (accuracy <= 25 m, no teleports, speed >= 3 km/h, so parked
  drift explores nothing); gaps <= 2 km get `gridPathCells`, longer ones only the two own cells; sorted and unique. Shared with the Edge Function
  (`SHARED_FILES` has 11 files now) and `supabase/functions/finalize-drive/deno.json` maps `h3-js` to `npm:h3-js@4.5.0`.
- `finalizeTrack` returns `cells` (NOT trimmed by privacy zones: owner-only); more than 20,000 cells = `too_long`.
- Migration `20261112130000_finalize_counted_drive.sql`: `public.finalize_counted_drive(...)` does compare-and-set 'processed' + drive_private +
  explored_cells (`on conflict do nothing`, first drive keeps a cell) + `drives.new_cells` in ONE transaction; returns new-cell count, NULL when the
  drive was no longer 'uploading'. EXECUTE only for service_role (public, anon, authenticated revoked). A 23P01 overlap rolls everything back.
  pgTAP now `plan(95)`: 9 new tests (the happy path runs as `service_role`, not postgres, so a missing grant would show).
- finalize-drive now calls that RPC; 200 response `stats.newCells` (0 is valid; `alreadyDecided` reads `drives.new_cells`; check is `=== null`, never falsy).
  `parseFinalizeResponse` keeps `newCells` when it is a number.
- Recap: "New cells" tile (yellow `c.primaryText`) beside Top speed on the third row; counted drives only.
- Results: typecheck clean, eslint clean, npm test 230/230.
- **PS run order:** (1) `npx supabase db push --remote`, (2) `npx supabase test db --remote` (expect 95), (3) `npx supabase functions deploy finalize-drive --use-api`
  right after step 1 (between them the OLD function still counts drives without cells; they stay without cells, no back-fill), (4) EAS preview build, (5) testlist F19.
- **If something fails on the first real drive** (read the function logs, tag `[finalize-drive]`): `PGRST202` function not found = PostgREST schema cache is
  stale, run `notify pgrst, 'reload schema';` in the Supabase SQL editor; deploy error resolving `'h3-js'` = set the per-function import map in
  `supabase/config.toml` (look up the exact key in the Supabase CLI docs, do not guess); a drive stuck on "Waiting to upload" = see the logs.
- Unverified (no Deno/Docker here): h3-js under the hosted Deno runtime, PostgREST passing `text[]` and an EWKT string to the RPC.
- Benchmark (Node, 12 h = 43,200 points, winding route): `driveCells` about 0.28 s, whole `finalizeTrack` about 0.3 s; Supabase Edge limit is 2 s CPU per
  request (docs, checked 2026-11-12), so there is about 4x margin before gunzip/JSON; hosted CPU may be slower than this PC.
- **One drive tests both (if PS runs the server steps BEFORE tonight's drive):** one `db push` applies BOTH new migrations in order (3.10 + 3.3, expect 95 tests),
  one deploy covers both. With the build that is already installed, tonight's drive covers F18 fully plus the database half of F19 (`explored_cells` rows, `drives.new_cells`
  filled); the old app ignores the extra `newCells` field. The "New cells" TILE needs the next build.

## Session 17 (2026-11-12, Sonnet executing the Opus plan `docs/superpowers/plans/2026-11-12-blueprint-fog.md`): 3.4 blueprint fog, CODE DONE, uncommitted, phone test F20 pending
- `src/lib/cells.ts`: `createCellTracker()` (incremental, same rules); `driveCells` = sort + tracker (output unchanged, tested). Edge copy synced:
  **deploy finalize-drive AFTER committing 3.4** so repo and server match.
- `src/lib/fog.ts`: `fogFeature` (box minus explored cells, islands back as fog, cells crossing the box edge dropped), `exploredEdges`,
  `unexploredGrid` (hex outlines of unexplored cells near the centre), `exploredAreaKm2`, `boxAround`, `needsRecentre`, `FOG`, `WORLD_BOX`.
- `src/lib/map-style.ts`: `standardStyleJSON(mode, c, { threeD: { clip } }?)`: Standard import, night/day preset, token colours; 3D only with a clip layer.
- `src/lib/paging.ts` `fetchAllPages` (PostgREST 1000-row cap); `src/lib/format.ts` `formatCount`.
- `src/features/map/explored.ts`: `useExploredCells()` = server `explored_cells` (cached per owner in SQLite `explored_cache`) + local finished drives
  not counted/rejected (guest: all guest drives); local drive cells cached in `session_cells` / `session_cells_done`. Counted pre-3.3 drives: NOT filled in.
- `src/features/map/FogLayers.tsx` (fog fill, hex grid from zoom 13, explored edge; all slot `middle`).
- Screens: HUD (Standard, fog box around the car, live holes from `useLiveDrive().liveCells`, "+N new cells" estimate pill), Pre-drive (fog),
  Map tab `(tabs)/world.tsx` (card, recenter, 3D toggle with clip). `RecenterGlyph` moved to `src/components/`.
- Deleted: spike `src/app/dev/`, `src/features/dev/`, `src/features/map/map-style.ts` (`MAP_STYLE`).
- Results: typecheck clean, eslint clean, npm test 254/254 (after the review fixes).
- Opus review fixes: (C1) an explored area inside an unexplored island is now a hole of that island (was an invalid nested hole); one shared
  `fogShapes` pass; (I1) HUD only re-walks explored cells near the box (`cellsNearBox`), `FogLayers` is `memo` and takes a grid CELL, so the fog
  JSON is not re-sent every second; (I2) Map tab remembers the camera (`restCamera` from `onMapIdle`) so the 3D toggle no longer jumps to Bangkok;
  (I3) counted drives WITH server cells (`stats.newCells` set) keep their local cells, so new holes show at once and offline.
- Deferred minors (review): paging during an account switch can damage the old owner's cache until the next refresh (no leak); `fetchAllPages`
  assumes server max-rows >= 1000; first open computes old local drives' cells on the JS thread (one-time freeze for big guest histories);
  double load on Map tab mount (focus + mount); `+40` magic offset for the pill; pill briefly over-counts before cells load; no HUD fog before the
  first GPS point; **Opus/PDPA question:** `explored_cache` / `session_cells` stay on the phone after sign-out (never shown to another account).
- **PS run order:** (1) commit 3.4, (2) `npx supabase db push --remote`, (3) `npx supabase test db --remote` (expect 95),
  (4) `npx supabase functions deploy finalize-drive --use-api`, (5) EAS preview build, (6) drive: F18, F19, F20.
- Untested on a device: LocationPuck and no-slot route layer on top of a Standard `styleJSON` map; the clip polygon as a world box with many holes;
  fog look (opacity 0.82, grid 0.5) in both themes. Tuning values live in `FOG` (src/lib/fog.ts).
- Later: server back-fill of cells for drives counted before 3.3; This week filter + Districts (3.8); square grid if PS prefers it.

## Spike 3.0 (map style), IN PROGRESS (2026-11-12), screen committed in 5b636df
- Built (Sonnet): throwaway `src/app/dev/map-style.tsx` (route `mapsprint://dev/map-style`, not linked from the UI) + `src/features/dev/map-style-spike.ts` (fake fog, grids, JS building pick, height stats). Delete both after the decision. typecheck/eslint clean, npm test 206/206. Needs a new preview APK to run.
- Answered from code and docs: `@rnmapbox/maps` 10.3.16 already pins Maps SDK 11.33 and supports Standard (`StyleImport`, `slot`), so NO upgrade and NO native change. Slots: bottom = above land/water, middle = above roads and behind 3D buildings, top = above POI labels, behind place labels. `show3dBuildings` is global on/off only; `within` cannot filter polygon buildings. A `clip` layer (SDK 11.6+, experimental) can remove 3D buildings inside a polygon, but rnmapbox has no component for it, so the spike uses a hand-written `styleJSON` that imports Standard. Mobile billing is per MAU (25,000 free); no separate Standard/3D charge on the pricing pages.
- Finding: the rnmapbox `FillExtrusionLayer` component has NO `slot` prop in 10.3.16 (other layers do), so an own 3D layer on Standard must be declared inside the style JSON to sit under the clip layer.
- PS on the phone (adb deep link, see plan file): fog look (Q2), 3D only in explored cells per mode (Q3), Count buildings in Bangkok vs Pathum Thani (Q4), Orbit FPS + heat 10 min (Q5), light presets on Onyx/Pearl (Q6). Then an Opus session writes the comparison table + recommendation here and ticks plan.md 3.0.
- Untested on a device: whether Standard imports inside `styleJSON`, whether the clip layer removes the buildings, whether `belowLayerID: 'road-label'` works on Classic.
- **Phone results, round 1 (PS, 2026-11-12; 10 screenshots in `TestResult/`, not committed):**
  - Standard inside `styleJSON` loads fine; light presets and Tuned colours work.
  - CLIP LOOKS LIKE IT WORKS:
    - With Standard JSON + "Explored only: clip" (night), 3D buildings stand only inside the yellow hexes and the rest is dark and flat.
    - Standard URL (no clip) shows 3D everywhere.
    - Waiting for PS to confirm by eye.
  - Building data:
    - Bangkok (Sathorn): 12,874 buildings loaded, 12,164 extruded, 100% with a height.
    - Pathum Thani: 4,413 loaded, 3,884 extruded, 100% with a height.
    - "100%" probably means the tiles carry estimated heights where no real value exists.
  - Own 3D layer:
    - On Classic it shows everywhere and draws above the fog (expected: no clip, no slot).
    - On Standard JSON it sits under the fog (slot middle).
  - FPS showed 0: SPIKE BUG.
    - rnmapbox Android only emits `DidFinishRenderingFrameFully` (`RNMBXMapView.setupEvents`), never `DidFinishRenderingFrame`.
    - Fixed in `src/app/dev/map-style.tsx` (now counts the "fully" event). Uncommitted, so it needs the next build.
  - Fog look: dark fog with labels readable on Standard night; the square grid is too faint to see at 0.3 opacity. Not yet the design-08/17 blueprint look (tuning for 3.4).
  - PS by eye: Orbit smooth on both Classic and Standard 3D, phone fine after 3-5 min (room at about 24 °C; NOT tested in the car yet,
    where the phone sits on the AC vent at 24 °C). No exact FPS: decided not worth a rebuild now; measure when 3.9 exists.

### Spike 3.0 result (2026-11-12): use Mapbox STANDARD
| | Classic (dark-v11 / light-v11, today) | Standard |
|---|---|---|
| Upgrade / native build | none | none (rnmapbox 10.3.16 = SDK 11.33) |
| Fog layer order | `belowLayerID` guesses on layer names | slots: fog in `middle` = above roads, under 3D and labels |
| Labels with fog | ok | ok (POI and place labels stay on top) |
| 3D only in explored cells (3.9) | no: own 3D shows everywhere, over the fog | YES with a `clip` layer (style JSON) |
| Building data (Bangkok / Pathum Thani) | same streets-v8 data: 12.2k / 3.9k extruded, all with a height | same |
| Smoothness / heat (3-5 min, room) | smooth, cool | smooth, cool |
| Onyx / Pearl look | close already | night / day + "Tuned" colours: close; needs tuning |
| Cost | per MAU | per MAU, no extra for 3D |

**Recommendation: Standard.** It is the only option where 3D in explored cells works, and the fog sits cleanly between roads and labels.

**How 3.4 builds on it:**
- Replace `MAP_STYLE` with one style builder, `src/features/map/map-style.ts`: `standardStyleJSON(mode, { clip })` imports
  `mapbox://styles/mapbox/standard`.
  - Onyx = `lightPreset: night`, Pearl = `day`, `show3dBuildings: false` on live screens, plus token colour overrides.
- Fog = `ShapeSource` (world box with explored-cell holes from `cellsToMultiPolygon`) + `FillLayer slot="middle"`, the grid as a
  `LineLayer` in the same slot.
- The live HUD stays flat 2D (no 3D buildings: live 3D is premium U1.5).

**How 3.9 builds on it:**
- The replay style JSON adds the `unexplored` geojson source and a `clip` layer (`clip-layer-types: ['model']`, slot `top`).
- Standard's 3D buildings are on, so they show only in explored cells.

**Caveats:**
- `clip` is marked EXPERIMENTAL by Mapbox: re-check after each @rnmapbox/maps or SDK upgrade.
- rnmapbox has no ClipLayer, and its `FillExtrusionLayer` has no `slot`: anything 3D of our own goes in the style JSON.
- Not tested: updating the clip source live through `<ShapeSource id="unexplored" existing>` (the spike rebuilt the style instead).
- Heat in the car (sun, vent mount) is untested. The replay is short and on demand, so the risk is low. Check it in 3.9, and before
  premium live 3D (U1.5).

**Cleanup:**
- Delete `src/app/dev/` + `src/features/dev/` when 3.4 starts (`h3-js` stays).
- `TestResult/` is local only (screenshots); delete or git-ignore it.

## Session 18 (2026-11-13, Sonnet): dark-mode fog contrast, CODE DONE, uncommitted, JS only (needs a new EAS build, no OTA)
PS feedback: in Onyx the explored area was almost invisible (night base + near-black fog), worst at city zoom. Pearl untouched. PS chose B "Dusk reveal", A as fallback.
- `src/lib/fog.ts`: `FOG.styles` per theme/look (`FogStyle`: fog opacity, optional explored fill, grid, edge, glow; colours are token NAMES, resolved in `FogLayers`), `fogStyleFor(mode, look)`, `zoomWidth` (stops -> Mapbox interpolate). `fogShapes` now also returns `explored` (polygons, for A's tint). `FOG.opacity` is gone.
  - Light (Pearl) and the old "night" look = the original values exactly (0.82, grid muted 0.5, edge primary 1.5 @0.8, no glow); tested.
  - B dusk: fog `c.bg` 0.90, solid `c.primary` edge opacity 1, width 3.4 px at zoom 9 -> 2.4 px from zoom 15; glow under it (same shape, 12 -> 9 px, blur 4, opacity 0.35); grid `c.gold` 0.3.
  - A night+tint: fog 0.82, explored cells filled `c.primary` 0.09 (slot middle, under the edge), same edge, glow, grid as B.
- `src/lib/map-style.ts`: `standardStyleJSON(mode, c, { look, threeD })`; dark = `dusk` for B, `night` for A and old; light always `day`. The existing token colour overrides ("Tuned") are unchanged and apply to both presets. How dusk looks with them is UNSEEN (labels readable? any purple/blue cast?).
- `FogLayers` takes a `look` prop; glow is its own `ShapeSource` (children of a ShapeSource must be elements) drawn before the edge. Memo kept; no per-second fog JSON re-send (inputs unchanged); HUD still uses `cellsNearBox`.
- **TEMPORARY switch, remove after PS decides:** Settings > Preferences > "Map style (test, temporary)": Dusk (B, default) / Night+tint (A) / Night (old). Files: `src/lib/map-look.ts` (+ `tests/map-look.test.mts`), `getMapLook`/`setMapLook` in `prefs.ts`, `src/features/map/use-map-look.ts` (re-reads on focus so the Map tab follows Settings), `look` plumbing in `world.tsx`, `hud.tsx`, `pre-drive.tsx`, the row in `settings/index.tsx`. Every spot is commented TEMPORARY.
- Results: typecheck clean, eslint clean, npm test 263/263 (8 new in map-look.test.mts, 1 changed in map-style.test.mts). Not committed.
- NOT checked on phone. To check (new EAS build, then same spot each time): Dusk / Night+tint / Night, each zoomed in (street, ~15-16) and zoomed out to city level (~10-11), on the Map tab; also HUD and Pre-drive; day and night driving. Look at: can you see the explored area at city zoom, is the yellow edge clean (not fat zoomed in), labels readable on dusk, no purple cast, hex grid visible but quiet, glow not muddy, Pearl looks exactly as before, HUD stays smooth. Switching the setting then opening the Map tab should change it at once.
- Risks: `lineWidth` interpolate expression + `lineBlur` + the clip/3D path are untested on a device; the explored fill is a second big polygon layer (watch HUD smoothness with option A).

## Session 19 (2026-11-13, Sonnet): 3.1 XP + 3.2 levels, APP HALF DONE, server half HANDED TO OPUS (uncommitted)
Plan (approved by PS): ~/.claude/plans/bro-now-that-we-shiny-ullman.md. Rules are in plan.md 3.1.
- DONE (steps 1, 2, 5, 6; test-first): `src/lib/xp.ts` (`XP` constants, `bangkokDay`, `computeDriveXp`, `fingerprintInput`; added to `SHARED_FILES`, `npm run sync:edge` run),
  `src/lib/levels.ts` (`xpToNext`, `levelForXp`, `levelProgress`, `litSegments`; checkpoints 0->1, 100->2, 383->3, 903->4 for pgTAP),
  `ServerStats` + `parseFinalizeResponse` keep optional `xp` (`DriveXpStats`), `level`, `totalXp`; `rejectReasonText('duplicate')`,
  `fetchProfile` also selects `level, total_xp` (`CachedProfile` optional fields), tokens `ledLow/Mid/High`, `LevelBar`, `XpCard` (recap, above the tiles, only when the
  server sent `xp`), Profile level card (refreshes on focus). testlist F21 added. Own addition: the first-drive bonus needs a drive of >= 1 km (`firstDriveMinM`).
- Results: typecheck clean, eslint clean, npm test 282/282 (incl. edge-lib-sync).
- **OPUS TO DO (security-sensitive, CLAUDE.md): plan steps 3 + 4.**
  - Migration: `xp_events.day`, unique `(drive_id, source)` and partial unique `(user_id, day)` where `source='first_drive'`, `drive_fingerprints` (survives drive delete, cascades with the account),
    `private.level_for_xp`, `known_cell_count(uuid, text[])` (service_role only), BEFORE INSERT trigger capping open `uploading` drives at 20, re-create `finalize_counted_drive`
    with the fingerprint + XP params (one transaction: drive, cells, fingerprint, xp_events, drives.xp_earned, profiles.total_xp/level; returns jsonb); pgTAP ~15 tests, update `plan(95)`.
  - finalize-drive: fingerprint = SHA-256 of `fingerprintInput(cleanRoute)` (needs the cleaned route or the fingerprint text on the `ok` outcome of `finalizeTrack`, then `npm run sync:edge`);
    `known_cell_count`, today's distance XP + first-of-day from `xp_events` by `bangkokDay(startMs)`; `computeDriveXp`; map the duplicate error to
    `reject('duplicate')` (add `duplicate` to `RejectReason` in finalize.ts and `REASONS` in index.ts); response `stats.xp`, `stats.level`, `stats.totalXp` (shape = `DriveXpStats`); rebuild
    them on the already-decided path from `xp_events` + `profiles`.
  - RUN ORDER for PS afterwards: commit, `db push --remote`, `test db --remote`, `functions deploy finalize-drive --use-api` RIGHT AFTER the push (the old function calls the dropped signature), EAS build, F21.
- Until the server half exists the app shows no XP card, and the Profile card shows Level 1 / 0 XP (profiles defaults).

## Session 20 (2026-11-13, Opus): 3.1/3.2 SERVER HALF, code done (uncommitted). pgTAP NOT RUN (no Docker daemon here)
- Migration `supabase/migrations/20261113120000_xp_levels.sql`:
  - `xp_events.day` (Bangkok day of the DRIVE start; default + backfill), unique `(drive_id, source)` (non-null drive), partial unique `(user_id, day) where source='first_drive'`.
  - `drive_fingerprints (user_id, hash sha256 hex, drive_id set null, PK (user_id, hash))`: RLS on, no anon/authenticated grants. Outlives a deleted drive, cascades with the account.
  - `private.level_for_xp(bigint)` (same checkpoints as levels.ts), `public.drive_xp_context(uid, started_at, cells)` -> `{known_cells, distance_xp_today, first_drive_taken}` (service_role only).
  - Gate (b): trigger `drives_limit_open_uploads` (SECURITY INVOKER, excludes the row itself so the app's retry still gets 23505; 21st `uploading` row -> SQLSTATE `PT429` = HTTP 429 via PostgREST, which the app's `classifyFailure` treats as transient, so the drive waits, never lost).
  - `finalize_counted_drive` DROPPED and re-created with `p_fingerprint, p_xp_distance, p_xp_per_new_cell, p_xp_first_drive`, returns jsonb
    `{new_cells, xp_new_cells, xp_first_drive, xp_total, total_xp, level}`. Fingerprint clash -> `MSDUP` (whole transaction rolls back). New-cell XP = exact `v_new * per_cell`
    (always matches the tile). First-drive bonus `on conflict do nothing` (never fails a drive). Negative XP -> 22023.
- pgTAP `supabase/tests/rls_test.sql`: plan 95 -> **115**. 3.3 calls moved to the new signature; new XP section [20] (totals, no 2nd bonus same day, context, duplicate refused + rolled back,
  negative XP, level checkpoints, fingerprint outlives drive, app can't call context / read fingerprints, 20th upload ok / 21st PT429 / a retried existing row at the limit still gets 23505, account delete removes fingerprints).
- `src/lib/finalize.ts`: `RejectReason` + `'duplicate'`; `ok` outcome has `fingerprint` = `fingerprintInput(cleanRoute)` (whole cleaned route, not zone-trimmed, no times). 2 tests.
- `finalize-drive/index.ts`: `drive_xp_context` -> `computeDriveXp` -> SHA-256 -> RPC; `MSDUP` -> reject `duplicate`; flags get `xpCapped`/`xpTooOld` (so retries can rebuild them); response
  `stats.xp/level/totalXp`; already-decided path rebuilds them from `xp_events` + `profiles` (`{}` when `xp_earned` is null = counted before XP). Type-checked with tsc + a Deno shim
  (only a pre-existing DOM-typing nit in `gunzipCapped`, which runs fine on Deno).
- Results: typecheck clean, eslint clean, npm test 284/284 (edge-lib-sync included). `database.types.ts` NOT regenerated (app doesn't call the new functions).
- Accepted/known: two drives of one user finalized at the same instant can both read the same known cells / today's distance XP (uploads are sequential, so rare); the 20-upload
  limit is soft under a concurrent insert race; a fingerprint is beaten by editing one point (then it is just a farm of known roads at 5 XP/km, capped 1,500/day).
  PDPA: `drive_fingerprints` is a one-way hash of the route, kept after a drive is deleted (anti-farming), deleted with the account: **mention in the privacy policy (5.2)**.
- **PS RUN ORDER:** (1) **MANDATORY:** start Docker Desktop, `npx supabase test db` locally (expect 115; this SQL has never run anywhere yet); (2) commit; (3) `npx supabase db push --remote`;
  (4) `npx supabase functions deploy finalize-drive --use-api` IMMEDIATELY after (the old deployed function calls the dropped signature: uploads fail with 503 and retry until it is deployed);
  (5) `npx supabase test db --remote` (expect 115); (6) EAS preview build; (7) testlist F21 (plus the map-look checks from Session 18).
- **DONE by PS (2026-11-13):** db push --remote, functions deploy (finalize-drive v5), test db --remote **115 PASS**. Claude checked the cloud read-only (MCP): migration
  applied, one `finalize_counted_drive` with the new signature, level checkpoints 1,1,2,2,3,3,4, app blocked from the new functions/table, trigger present, 0 stuck uploads.

## Session 20b (2026-11-13, Opus): small extras for the same build (JS only, uncommitted)
- Recap level-up: `levelUp(totalXp, earned)` in `src/lib/levels.ts` (test-first); `XpCard` shows the design's up arrow in the Level pill and "Level up! You reached level N."
  (or "Level up! 3 → 5") only when the drive crossed a level.
- Saving screen (09): third step "XP and level" (`SavingView.steps.xp`, done with the others when counted; tests updated); subtitle "adding up your XP" like the design.
  Badges are not mentioned (3.6).
- `src/features/sync/database.types.ts` regenerated from the CLOUD (`npx supabase gen types typescript --project-id gwcutbwcmxcwpgndaphi > src/features/sync/database.types.ts`,
  works without Docker): now has `drive_fingerprints`, `xp_events.day`, `drive_xp_context`, new `finalize_counted_drive`. Cleaner formatting, so the diff is large.
- Results: typecheck clean, eslint clean, npm test 285/285.

## Next step
**Decision (PS, 2026-11-12):** do NOT start the closed test yet. Build the Phase 3 core loop first (order in plan.md Phase 3:
3.0 -> 3.3 -> 3.4 -> 3.1/3.2 -> 3.6), then account deletion + privacy policy, then 2.6. PS meanwhile starts the Play developer
account verification and collects tester Gmails. 1.9 (trip-meter drives) continues on every drive. **3.10 is coded (Session 15 above):
PS runs its steps + F18. 3.0 DONE (Standard, see "Spike 3.0 result"). Next: 3.3 hex cells: CODE DONE (Session 16): PS runs its steps + F19. 3.4 fog: CODE DONE (Session 17): PS commits, runs the server steps, builds, tests F20. Then 3.1 XP + 3.2 levels.**

**State (2026-11-12, PS report via Claude chat):** PS ran `npx supabase db push --remote` (private-by-default migration),
`npx supabase test db --remote`, `npx supabase functions deploy finalize-drive --use-api`, built and installed the new preview APK, and ran
testlist F13-F17: "everything seems in order" (no failures reported; exact pgTAP count and per-test details not reported). So: the Finish /
foreground-service fix (Session 13) works on the phone, travel modes, upload queue, finalize-drive, Saving screen and server-number recap all
work. 2.3 and 2.4 ticked in plan.md. Still open: 1.9 (2 of 10 trip-meter drives done), 2.5 backup, 2.6 Play Console + closed test, the Phase 3
gates listed in plan.md 2.4. The older "State (2026-11-09)" text below is history.

**State (2026-11-09):** Phase 1 is tested on the phone except 1.9 and 1.12. 2.1 is done (cloud DB has all migrations incl. avatars,
47/47 pgTAP on the cloud). 2.2 is coded and committed; PS added the 3 `EXPO_PUBLIC_*` vars on expo.dev and is building the preview APK
(Google sign-in, image picker, svg: native rebuild). PS will come back with the results of `testlist.md` section F.
1. **PS: confirm the Email provider is disabled** in the Supabase dashboard (Authentication > Providers > Email). Then Claude probes the
   CLOUD signup endpoint (`POST /auth/v1/signup` with the publishable key; expect `email_provider_disabled`). Never probe before it is
   disabled: an open endpoint would create a junk user.
2. **PS: install the APK over the old one** (do not uninstall: keeps the Phase 1 drives) and run `testlist.md` section F.
   Likely first failures: Google "developer error" (code 10) = SHA-1 / package / client ID mismatch (SHA-1 5D:49:C5:...:6A:31 must
   belong to the EAS keystore that signed the build; do NOT let EAS generate a new keystore); "Google sign-in needs the latest version"
   = the old APK is still installed; Supabase rejecting the token = nonce (pass one, or turn on "Skip nonce check").
3. Then, in order of value: **1.9 the 10-drive field test** (PS notes app km vs car trip meter for each drive; Phase 1 gate: within 2%),
   then 1.12 (remove the spike screens, after the first real drive passes), then **2.3 upload** (gzipped raw track to Storage + drive
   row, offline queue; guests' drives upload only after they sign in; `drive_private` and `avatars/<uid>/` rules already exist) and
   **2.4 `finalize-drive`** (Edge Function: recompute stats, clean, Douglas-Peucker 5 m, privacy-zone trimming, anti-cheat; writes
   with the service role). 2.3/2.4 are security-sensitive: Opus session.
4. Open choice still with PS: none blocking.
Reminders: Google Auth Platform is in Testing (only PS's Gmail can sign in; add testers or publish before 2.6). The Google Client
secret lives only in the Supabase dashboard; `client_secret_*.json` in the repo folder is git-ignored but should be moved out of the
folder (and optionally rotated). Email sign-up stays off until a domain + email service + confirmation code exist (plan 5.2).

Things learned in the spikes that Phase 1 must include (also added to plan.md as 1.10 and 1.11):
- Gap log: record every gap > 3 s (time + position) so tunnels/viaducts can be told apart from throttling.
- "Finish this drive?" prompt: PS forgot to press Stop in run #6 and it recorded for 88 min. Prompt (notification + in-app) after being stopped for a while after a drive.
- Interpolate across GPS gaps for hex cells (gridPathCells) so fog of war and distance don't break under bridges.
- Remove the spike screens (map, gps, h3) when the real screens replace them.

## Open questions (not blocking Phase 0)
- Final app name (Mapsprint looks clear; user to check WIPO, Thai DIP, domain).
- Data retention for raw GPS tracks (suggested 12 months).
- Plan doc (Claude Docs artifact) still says "Cartrava" and says background location +
  declaration video are needed; that changed — foreground service only.
