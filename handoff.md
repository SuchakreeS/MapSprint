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

## Next step
Start plan.md Phase 1 (Recorder). Start with 1.1 fonts + UI kit, then 1.2 routes, then the HUD.
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
