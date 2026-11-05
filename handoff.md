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

## Next step
1) PS checks 1.5b on the Samsung and commits. 2) Do 1.5c: `HoldToFinishButton` (800 ms), speed lock above 10 km/h, keep-awake, block back button / swipe, finish -> `stopRecording()` -> `/record/saving`, and Record button returns to the HUD when a drive is already recording. Then tick 1.5 in plan.md. Pause stays disabled until 1.6.
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
