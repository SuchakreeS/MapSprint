# Driving HUD (plan.md task 1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (PS chose inline). Steps use checkbox (`- [ ]`) syntax. **PS commits manually: never run `git commit`; at the end of each task say "ready to commit" with a suggested message.**

**Goal:** Build the live driving screen (design 08): speed gauge, moving avg / distance / time, Mapbox follow map with the drive's route line, Pause, and a safe "Hold to finish".

**Architecture:** The background task already writes GPS points to SQLite once a second. The HUD starts recording on mount, then polls SQLite for new points every second and feeds them to one pure incremental stats engine (`src/lib/live-stats.ts`) that **replaces the maths inside `summarize()`** so there is a single implementation of the cleaning rules. The screen is dumb: it renders a snapshot. Safety rules (lock above 10 km/h, 800 ms hold) live in pure helpers plus one small component.

**Tech Stack:** Expo SDK 58, @rnmapbox/maps (MapView, Camera, LocationPuck, ShapeSource, LineLayer), expo-keep-awake, expo-sqlite, node:test.

**Spec:** `design/screens/{dark,light}/08-driving-hud.png`, `design/source/Hud2.dc.html`, `design/README.md` (warnings 3 and 4), CLAUDE.md (safety), plan.md 1.5.

## Global Constraints

- Colours only from `src/theme` (`c.primary` is the route/gauge colour in both modes). No hex in components. Metric units only.
- Never reward or rank speed. Controls lock above 10 km/h. "Hold to finish" needs an 800 ms press.
- No new native library in this task (no react-native-svg, no expo-battery). Gauge is drawn with Views.
- Level/XP card, district chip and "new cells" chip from the design are **left out** (fake data must not ship; they arrive with Phase 3).
- Done = `npm run typecheck`, `npx eslint .`, `npm test` clean. Delete `.expo/types/router.d.ts` and start Metro once if typed routes look stale.
- Do not edit `android/` or `ios/`. Update `handoff.md` and tick `plan.md` at the end.

## Review Focus

1. First GPS fix has `speed` null or -1: the gauge shows 0 and the number shows `--`, never `NaN` or a negative.
2. A GPS gap (tunnel) while the HUD is open: time keeps counting, distance does not jump, no crash.
3. App killed or left, then reopened mid-drive: pressing Record goes back to the HUD of the **same session** (route, distance and time rebuilt from SQLite), not to pre-drive and not a second session.
4. "Hold to finish": releasing early resets the fill and does nothing; finishing fires exactly once; a failed `stopRecording()` keeps the user on the HUD with an error, it does not silently lose the drive.
5. Locked state (speed > 10 km/h): Pause and Hold to finish ignore touches and show why; unknown speed does **not** lock (so a user with no GPS can still finish).

## File structure

- Create `src/lib/live-stats.ts`, `src/lib/hud.ts`, `src/lib/route-line.ts`; modify `src/lib/geo.ts` (summarize delegates), `src/lib/format.ts`.
- Create tests `tests/live-stats.test.mts`, `tests/hud.test.mts`, `tests/route-line.test.mts`; extend `tests/format.test.mts`; register in `package.json`.
- Modify `src/features/recording/db.ts` (`getPointsSince`), create `src/features/recording/use-live-drive.ts`.
- Create `src/components/SpeedGauge.tsx`, `HudStat.tsx`, `HoldToFinishButton.tsx`; modify `src/theme/tokens.ts`, `src/app/record/hud.tsx`, `src/app/record/_layout.tsx`, `src/components/RecordTabButton.tsx`.

---

### Task 1 (1.5a): Pure logic, test first

**Files:** `src/lib/live-stats.ts`, `src/lib/hud.ts`, `src/lib/route-line.ts`, `src/lib/geo.ts`, `src/lib/format.ts`, tests above.

**Interfaces (produces):**
- `createLiveStats(): { push(p: GpsPoint): void; snapshot(): DriveSummary }` — points must be pushed in ascending `ts`. Same cleaning rules as today (accuracy > 25 m dropped, > 250 km/h teleport dropped, no distance below 3 km/h, EMA alpha 0.3). `snapshot().lastKmh` is the smoothed speed.
- `summarize(points)` keeps its signature and result; it sorts, pushes each into `createLiveStats()`, returns `snapshot()`.
- `CONTROL_LOCK_KMH = 10`; `controlsLocked(kmh: number | null): boolean` is `kmh != null && kmh > 10`.
- `GAUGE_MAX_KMH = 160`, `REDLINE_START = 0.85`; `gaugeFraction(kmh: number | null): number` clamped 0..1, null/negative/NaN = 0.
- `appendRoutePoint(coords: [number, number][], p: GpsPoint, minStepM = 5): [number, number][]` — `[lng, lat]`, appends only if at least `minStepM` from the last coordinate (always keeps the first); returns the same array.
- `formatKmh1(kmh: number | null | undefined): string` — one decimal (`40.8`), `--` when unknown/negative/NaN.

- [ ] **Step 1: Characterization tests** in `tests/live-stats.test.mts`: build 3 drives (clean 60 km/h, mixed with accuracy 40 m rejects, one teleport) and assert `summarize(...)` fields (`distanceM`, `acceptedPoints`, `rejectedAccuracy`, `rejectedTeleport`, `movingS`, `rawMaxGapS`, `lastKmh`) against values computed from the **current** `summarize`. Run `npm test`: PASS (these pin today's behaviour).
- [ ] **Step 2: Write failing tests:** (a) for each drive, after pushing the first N points one by one, `createLiveStats().snapshot()` deep-equals `summarize(first N)` for N in {1, 10, all}; (b) `controlsLocked(10) === false`, `(10.1) === true`, `(null) === false`, `(0) === false`; (c) `gaugeFraction(64) === 0.4`, `(200) === 1`, `(-1) === 0`, `(null) === 0`; (d) `appendRoutePoint` skips a point 2 m away, keeps one 6 m away, keeps the first; (e) `formatKmh1(40.84) === '40.8'`, `(null) === '--'`, `(-1) === '--'`. Run: FAIL (modules missing).
- [ ] **Step 3: Implement** `live-stats.ts` by moving the loop body of `summarize` into `push`, then make `summarize` delegate. Implement `hud.ts`, `route-line.ts`, `formatKmh1`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass, including the 3 characterization tests unchanged (proves the refactor kept the numbers).
- [ ] **Step 5: Report** "ready to commit": `feat(lib): live stats engine, HUD helpers and route thinning`.

---

### Task 2 (1.5b): HUD screen with live data

**Files:** `src/features/recording/db.ts`, `use-live-drive.ts`, `src/components/SpeedGauge.tsx`, `HudStat.tsx`, `src/theme/tokens.ts`, `src/app/record/hud.tsx`.

**Interfaces:**
- Consumes: `startRecording(): Promise<number>`, `createLiveStats`, `appendRoutePoint`, `getActiveSessionId`.
- Produces:
  - `getPointsSince(sessionId: number, afterTs: number): GpsPoint[]` (ascending, `ts > afterTs`).
  - `useLiveDrive(): { ready: boolean; error: string | null; sessionId: number | null; startedAt: number | null; snapshot: DriveSummary | null; route: [number, number][] }` — on mount calls `startRecording()` (it returns the active session if one exists, so reopening resumes), loads all existing points, then polls every 1000 ms. Unmount stops polling but **does not** stop recording.
  - `SpeedGauge({ kmh: number | null })` — 240×164 arc (270° like the design), fill = `gaugeFraction`, red band from `REDLINE_START`, big number (`formatSpeedKmh`) and `KM/H`. Arc drawn with ~48 small rotated Views behind one component boundary so it can be swapped for SVG later.
  - `HudStat({ label, value, unit? })` — Rajdhani 26 value, Manrope 12 bold label with letter-spacing, centred; three in a row with 1 px dividers.
- Tokens: `type.hudNumber` becomes 84/84 (design), new `type.hudStat` 26/28 `fonts.displayBold`.

- [ ] **Step 1:** Add `getPointsSince`; tokens. Typecheck.
- [ ] **Step 2:** Implement `useLiveDrive`. Elapsed time shown = `Date.now() - startedAt` (pause comes in 1.6).
- [ ] **Step 3:** Build `SpeedGauge` and `HudStat`; add a temporary gauge test strip to `src/app/kit.tsx` (0, 64, 140, 200 km/h, null) to eyeball it, removed with the kit in 1.12.
- [ ] **Step 4:** Build `hud.tsx`: Mapbox `MapView` (top ~62%) with `Camera followUserLocation followZoomLevel={16}`, `LocationPuck` with course bearing, route `ShapeSource` + two `LineLayer`s (18% wide casing + 5 px line, `c.primary`), recenter button (48×48, radius 16, drawn crosshair) that re-enables follow; bottom sheet 382 high (radius 28, handle, gauge, stats row, buttons row). Pause (surface2) and Hold to finish are visible but **inert placeholders** here.
- [ ] **Step 5:** Verify typecheck, eslint, tests. Phone check (PS): numbers move while walking, route line draws, dark and light match design 08.
- [ ] **Step 6: Report** "ready to commit": `feat(record): driving HUD layout with live speed, stats and route`.

---

### Task 3 (1.5c): Safety controls and flow

**Files:** `src/components/HoldToFinishButton.tsx`, `src/app/record/hud.tsx`, `src/app/record/_layout.tsx`, `src/components/RecordTabButton.tsx`.

**Interfaces:**
- Produces `HoldToFinishButton({ onFinish: () => void; locked: boolean; label?: string })` — primary button, 60 high, radius 18, flag glyph (drawn with Views). `onPressIn` runs an `Animated.timing` fill 0→100% in **800 ms**; `onPressOut` before it ends resets to 0 and does nothing; completion fires `onFinish` once. When `locked`: ignores touches, dimmed, caption "Locked while moving". Accessibility: role button, hint "Press and hold for one second", plus an `activate` accessibility action that finishes immediately (matches the design's keyboard path) but still respects `locked`.
- HUD uses `controlsLocked(snapshot.lastKmh)` for both Pause and Hold to finish.

- [ ] **Step 1:** Implement `HoldToFinishButton`; wire into the HUD.
- [ ] **Step 2:** Finish flow: `onFinish` → `await stopRecording()` → `router.replace('/record/saving')`. On error show a `ConfirmDialog`-style message and stay (Review Focus 4).
- [ ] **Step 3:** `useKeepAwake()` while the HUD is mounted; block the Android back button and swipe-back on the HUD (`BackHandler` returns true, `gestureEnabled: false` on that screen in `record/_layout.tsx`).
- [ ] **Step 4:** Pause button: disabled style, caption/hint "Coming soon"; real pause is task 1.6 (auto-pause + manual pause in the recorder).
- [ ] **Step 5:** `RecordTabButton`: if `isRecording()` is true, push `/record/hud` instead of the permission/pre-drive route (Review Focus 3).
- [ ] **Step 6:** Verify typecheck, eslint, tests. Phone check (PS): hold 800 ms finishes, early release does nothing, walking fast enough (> 10 km/h) locks both buttons, screen stays on, back button does nothing, kill app mid-drive then Record returns to the same drive.
- [ ] **Step 7:** Update `handoff.md`, tick 1.5 in `plan.md`. **Report** "ready to commit": `feat(record): hold-to-finish, speed lock, keep-awake and resume`.
