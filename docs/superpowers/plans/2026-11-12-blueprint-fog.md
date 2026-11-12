# 3.4 Blueprint Fog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:executing-plans (PS runs Sonnet, medium effort, in this
> session). Steps use checkbox (`- [ ]`) syntax. **Don't commit:** PS commits.

**Goal:** the fog of war goes on the real maps. Explored H3 cells are holes in a dark (Onyx) or pale (Pearl) fog on
Mapbox Standard. It shows on the Map tab (new, core of screen 17), the live HUD (cells open up as you drive) and
Pre-drive. The Map tab also gets a 3D toggle: 3D buildings only inside explored cells.

**Architecture:**
- Pure geometry and style builders live in `src/lib` and are tested with TDD.
- `src/features/map/` holds:
  - the explored-cells store: the server cells, cached in SQLite, plus the cells of local drives that are not counted yet
  - a shared `<FogLayers>` component
- The cell rule stays in `src/lib/cells.ts`. It gets an incremental tracker so the HUD can add cells live, using the same
  rule as the server.

**Tech:**
- @rnmapbox/maps 10.3.16 (Maps SDK 11.33): `styleJSON` that imports Standard, and `slot` on Fill/Line layers
- h3-js 4.5.0: `cellsToMultiPolygon`, `cellToBoundary`, `gridDisk`, `cellArea`, `cellToLatLng`
- expo-sqlite, supabase-js

**Spec:** plan.md 3.4. handoff.md "Spike 3.0 result" (Standard, fog in slot `middle`, clip layer for 3D). Designs 17 and 08
(`design/screens/*/17-explore-map.png`, `08-driving-hud.png`).

## Global Constraints
- No hard-coded colours: every colour comes from `useTheme().c` (tokens.ts). Fog = `c.bg`, grid = `c.muted`,
  explored edge = `c.primary`.
- Live screens (HUD, Pre-drive) are flat: `show3dBuildings: false`, `pitchEnabled={false}`. 3D is ONLY on the Map tab, behind a
  toggle, and never while recording.
- Never upgrade packages. Check rnmapbox prop names in `node_modules/@rnmapbox/maps/src` before using them (AGENTS.md).
- Explored cells are owner-only. Read `explored_cells` with an explicit `.eq('user_id', uid)` as well as RLS, cache them
  per owner, and never show another account's cache.
- `src/lib/cells.ts` is a shared server file. After changing it, run `npm run sync:edge`. `edge-lib-sync` must stay green.
- Metric only (km²).
- Verify with `npm run typecheck`, `npx eslint .` and `npm test`. Add new test files to the `test` script in `package.json`.

## Decisions (Opus calls; PS judges them on the phone tonight)
1. **Grid = H3 hex outlines** of the UNEXPLORED cells around the camera, drawn only from zoom 13. Design 17 shows square
   graph paper. Hexes are the real game cells, show what you can still claim, and naturally stay out of the explored holes.
   If PS wants squares, that's a later swap.
2. **Road outlines** = Standard's own roads showing through the fog. The fog sits in slot `middle` (above roads, under labels)
   at opacity `FOG.opacity` 0.82. No extra road layer.
3. **Which cells count as explored on the phone:**
   - Signed in: the server `explored_cells`, plus the cells of this owner's finished local drives whose upload is NOT
     `counted` or `rejected` (waiting to upload).
   - Guest: the cells of all finished guest drives.
   - Counted drives from before the 3.3 deploy have no server cells, and we do NOT fill them in from local points (the map
     would disagree with the server's "new cells"). A server back-fill is a separate, later task.
   - Expect a nearly empty map until new drives are counted.
4. **The HUD "+N new cells" pill** (design 08, top right): the current drive's cells that are not in the explored set yet.
   It's a live estimate; the recap tile is the server's number. Because of decision 3, it can show more than the recap.
5. **The Map tab (screen 17), core only:**
   - full-screen map with fog and the puck
   - top card: "CELLS EXPLORED n" and "AREA x km²"
   - recenter button
   - 3D toggle
   - NOT the All time / This week toggle and NOT the Districts sheet: both are 3.8.
6. **The Map tab 3D toggle (PS asked where 3D is):**
   - On: pitch 60, Standard `show3dBuildings: true`, plus a `clip` layer (`clip-layer-types: ['model']`, slot `top`) whose
     source is the fog polygon inside the style JSON. Buildings stand only in explored cells.
   - The style JSON is rebuilt when the cell set changes, which is the method the spike proved.
   - Do NOT update the clip through `<ShapeSource existing>` (untested).
   - Off: flat, same fog as the other screens.
7. **Fog box:**
   - Map tab: near-world box (lng −179.9..179.9, lat −85..85) with all holes.
   - HUD and Pre-drive: a box of ±0.15° around the car, re-centred when the car passes the inner half. Only cells inside the
     box are used.
8. **Cleanup:** delete the spike `src/app/dev/` and `src/features/dev/`, and remove `MAP_STYLE` once nothing uses it.

## Review Focus (each line has its test in the owning task)
1. An explored ring around an unexplored island: the island must be fog again, not a hole (Task 2).
2. A hole that crosses the edge of the HUD box must not make an invalid polygon: drop cells whose boundary is not fully
   inside the box (Task 2).
3. More than 1000 server cells: PostgREST caps a response at 1000 rows, so page until a short page (Task 4).
4. Switching accounts on one phone: the old owner's cached cells never appear (Task 4).
5. `driveCells` output stays exactly the same after the tracker refactor, because the server deploys this file (Task 1).

---

### Task 0: PS commits 3.3 first (before Sonnet starts)
Two commits, as suggested in the last message:
1. `docs: spike 3.0 result (Mapbox Standard); fix spike FPS counter`
2. `feat(cells): explored H3 cells saved atomically with the counted drive (3.3)`

That leaves a clean diff for 3.4.

### Task 1: Incremental cell tracker (`src/lib/cells.ts`, TDD)
**Files:** modify `src/lib/cells.ts` and `tests/cells.test.mts`, then run `npm run sync:edge`.

**Produces:**
```ts
export interface CellTracker {
  /** Feed points in time order. Returns the cells this point added (gap fill included), in no particular order. */
  add(p: GpsPoint): string[];
  readonly size: number;
  has(cell: string): boolean;
}
export function createCellTracker(): CellTracker;
// driveCells(input) stays: sort by ts, feed a fresh tracker, return the sorted unique cells.
```
- [ ] Write the tests first:
  - `tracker fed the sorted points gives the same set as driveCells`: use the 600 s straight drive, the gap drive and the
    teleport drive from the existing tests.
  - `add returns only cells not seen before`: feed the same point twice; the second call returns `[]`.
  - `add returns gap-fill cells too`: the 1.5 km gap test's midpoint cell is in the return of the first point after the gap.
- [ ] Run `npm test`: the new tests fail.
- [ ] Move the loop body of `driveCells` into the tracker. Its state is `lastAccepted`, `lastMoving`, `lastMovingCell` and the
  set. A point with `ts <=` the last accepted point's ts is ignored, as today.
- [ ] Run `npm test`: all green, including the 7 old cells tests unchanged.
- [ ] Run `npm run sync:edge` (copy into `supabase/functions/finalize-drive/lib/`), then `npm test` again: `edge-lib-sync` is green.

### Task 2: Fog geometry (`src/lib/fog.ts`, TDD)
**Files:** create `src/lib/fog.ts` and `tests/fog.test.mts`, and add `fog` to the `test` script.

Pure, imports only `h3-js`. Coordinates are `[lng, lat]`. Outer rings are counter-clockwise and holes clockwise (reuse the
spike's `signedArea` / `ccw` / `cw` idea).

**Produces:**
```ts
export type LngLat = [number, number];
export interface Box { west: number; south: number; east: number; north: number }
export const FOG = { opacity: 0.82, hudBoxHalfDeg: 0.15, gridRadius: 8, gridMinZoom: 13 } as const;
export const WORLD_BOX: Box; // west -179.9, south -85, east 179.9, north 85
export function boxAround(lat: number, lng: number, halfDeg: number): Box;
/** True when (lat,lng) is outside the inner half of the box, i.e. time to re-centre. */
export function needsRecentre(box: Box, lat: number, lng: number): boolean;
/** Fog = the box minus the explored cells. Cells not fully inside the box are left out. Unexplored islands inside
 *  explored rings come back as extra fog polygons. Returns a MultiPolygon feature. */
export function fogFeature(cells: Iterable<string>, box: Box): GeoJSON.Feature<GeoJSON.MultiPolygon>;
/** Outer edges of the explored area (LineStrings), for the yellow edge. */
export function exploredEdges(cells: Iterable<string>, box: Box): GeoJSON.FeatureCollection<GeoJSON.LineString>;
/** Hex outlines of the cells within `radius` of the cell at (lat,lng) that are NOT explored. */
export function unexploredGrid(lat: number, lng: number, radius: number, explored: { has(c: string): boolean }): GeoJSON.FeatureCollection<GeoJSON.LineString>;
/** Sum of h3 cellArea(c, 'km2'), rounded to 0.1. */
export function exploredAreaKm2(cells: Iterable<string>): number;
```
- [ ] Write the tests first (Bangkok, 13.75 / 100.5, res 9):
  - No cells: one polygon, the box, counter-clockwise.
  - 3 neighbouring cells: one polygon with 1 hole. The hole is clockwise and contains the cells' centres.
  - **Island:** the ring `gridRingUnsafe(c, 1)` (6 cells) without the centre `c` gives the box with 1 hole plus 1 extra fog
    polygon that contains `cellToLatLng(c)`.
  - **Box edge:** a cell straddling `boxAround(...)`'s east edge is left out, and every hole vertex lies inside the box.
  - Cells far outside the box are ignored.
  - `needsRecentre`: false at the centre, true at 0.6 × halfDeg off the centre.
  - `unexploredGrid`: radius 2 gives 19 features minus the explored ones, and each LineString is closed (first point = last).
  - `exploredAreaKm2` of 10 cells is between 0.9 and 1.2.
  - `exploredEdges` of 3 neighbours gives 1 closed line.
- [ ] Run `npm test`: the new tests fail.
- [ ] Implement:
  - Use `cellsToMultiPolygon(cells, true)`. Each polygon's ring 0 becomes a clockwise hole in the box polygon, and rings 1+
    (islands) each become a new counter-clockwise fog polygon.
  - Filter cells by "all `cellToBoundary` vertices inside the box" before merging.
- [ ] Run `npm test`: green.

### Task 3: Style builder (`src/lib/map-style.ts`, TDD) and removing `MAP_STYLE`
**Files:** create `src/lib/map-style.ts` and `tests/map-style.test.mts`, and add `map-style` to the test script. Delete
`src/features/map/map-style.ts` at the end of Task 6, once nothing imports it.

**Produces:**
```ts
export interface StyleColors { bg: string; surface: string; surface2: string; gold: string } // passed from the theme's c
export function standardStyleJSON(
  mode: 'dark' | 'light',
  colors: StyleColors,
  opts?: { threeD?: { clip: GeoJSON.Feature } },
): string;
```
- `imports: [{ id: 'basemap', url: 'mapbox://styles/mapbox/standard', config }]`.
- The config:
  - `lightPreset`: `night` for dark, `day` for light
  - `show3dBuildings`, `show3dObjects`, `show3dLandmarks`, `show3dFacades`: `!!opts?.threeD`
  - `show3dTrees: false`
  - the spike's "Tuned" colours: `colorLand: surface`, `colorRoads: surface2`, `colorMotorways: gold`, `colorWater: bg`,
    `colorBuildings: surface2`, `colorGreenspaces: surface`
- With `threeD`: `sources.unexplored = { type: 'geojson', data: clip }` and a layer
  `{ id: 'clip-unexplored', type: 'clip', source: 'unexplored', slot: 'top', layout: { 'clip-layer-types': ['model'] } }`.
  Without it: no sources and `layers: []`.
- [ ] Tests:
  - dark gives `night` and light gives `day`
  - no 3D: all `show3d*` false and no clip layer
  - 3D: `show3dBuildings` true and the clip layer present with source `unexplored`
  - the colours come from the argument
- [ ] Implement, then run the tests: green.

### Task 4: Explored-cells store (`src/features/map/explored.ts`)
**Files:** create `src/features/map/explored.ts`, and modify `src/features/recording/db.ts` (new tables and helpers).

**db.ts additions** (inside `getDb()`'s `CREATE TABLE IF NOT EXISTS` block):
```sql
CREATE TABLE IF NOT EXISTS explored_cache (owner TEXT NOT NULL, h3 TEXT NOT NULL, PRIMARY KEY (owner, h3));
CREATE TABLE IF NOT EXISTS session_cells (session_id INTEGER NOT NULL, h3 TEXT NOT NULL, PRIMARY KEY (session_id, h3));
CREATE TABLE IF NOT EXISTS session_cells_done (session_id INTEGER PRIMARY KEY);
```
Helpers:
- `replaceExploredCache(owner, cells[])`: one transaction (`withTransactionSync`) that deletes the owner's rows, then inserts.
- `getExploredCache(owner): string[]`
- `listLocalExploreSessions(owner: string | null): number[]`:
  - finished sessions (`ended_at IS NOT NULL`) of that owner (`IS NULL` for a guest)
  - for an owner: drop sessions whose upload state is `counted` or `rejected`
- `getSessionCells(id): string[] | null`: null when the session is not in `session_cells_done`
- `saveSessionCells(id, cells)`: one transaction, which also inserts the `done` row

**explored.ts:**
```ts
/** Union of the owner's explored cells as the phone knows them (see plan decision 3). Computes and caches local drives' cells on first use. */
export function loadExploredCells(owner: string | null): Set<string>;
/** Signed in only: pages explored_cells (h3_index, ordered by h3_index, .range() in 1000s until a short page), filtered
 *  .eq('user_id', owner), then replaceExploredCache. Throws on network error (callers keep the cached set). */
export async function refreshServerCells(owner: string): Promise<void>;
/** React hook: { cells: Set<string>, refresh(): void }. Loads from SQLite at once, then refreshServerCells in the background
 *  (signed in), then reloads. Re-runs when the owner changes (current owner from getCurrentOwner / useAuth). */
export function useExploredCells(): { cells: Set<string>; refresh: () => void };
```
- Local drive cells: `driveCells(getPoints(id))`. They're computed only when `getSessionCells` is null, then saved.
- Owner switch: the hook keys everything by the owner id. Sign-out loads the guest set (`owner = null`) and never reads
  another owner's `explored_cache` rows.
- [ ] Check the supabase-js range API and the `explored_cells` types in `src/features/sync/database.types.ts`.
- [ ] Unit-test the paging helper. Keep the paging loop pure so it can be tested:
  `fetchAllPages(fetchPage: (from: number, to: number) => Promise<string[]>, pageSize = 1000)`, which goes in
  `src/lib/paging.ts` and `tests/paging.test.mts`.
  - 2500 rows give 3 calls with ranges 0-999, 1000-1999 and 2000-2999.
  - 1000 exactly gives 2 calls, the second one empty.
  - 0 rows gives 1 call.
- [ ] typecheck and eslint.

### Task 5: `<FogLayers>` component (`src/features/map/FogLayers.tsx`)
**Consumes:** `fogFeature`, `exploredEdges`, `unexploredGrid`, `FOG`.

**Props:** `{ cells: Set<string>; box: Box; gridCenter: { lat: number; lng: number } | null }`.

Renders three `ShapeSource`s, each in `slot="middle"`:
- `FillLayer` `fog-fill`: `fillColor: c.bg`, `fillOpacity: FOG.opacity`
- `LineLayer` `fog-grid`: `minZoomLevel: FOG.gridMinZoom`, `lineColor: c.muted`, `lineOpacity: 0.5`, `lineWidth: 0.7`
- `LineLayer` `explored-edge`: `lineColor: c.primary`, `lineWidth: 1.5`, `lineOpacity: 0.8`

Memoise each GeoJSON with `useMemo` on its inputs. The grid uses `gridCenter`'s cell as the memo key, so it rebuilds only
when the centre cell changes. `gridCenter` null means no grid.

- [ ] Check in `node_modules/@rnmapbox/maps/src/components/FillLayer.tsx` and `LineLayer.tsx` that `slot` and `minZoomLevel`
  exist. They are confirmed for `MapView` `onMapIdle(state)`, with `state.properties.center`, `.zoom` and `.bounds`.
- [ ] typecheck.

### Task 6: Screens
**Files:** modify `src/app/record/hud.tsx`, `src/app/record/pre-drive.tsx`, `src/features/recording/use-live-drive.ts` and
`src/app/(tabs)/world.tsx`. Delete `src/app/dev/`, `src/features/dev/` and `src/features/map/map-style.ts`.

- **All maps:** `styleJSON={useMemo(() => standardStyleJSON(mode, c), [mode, c])}` instead of `styleURL`, plus `key={mode}` on
  `MapView` so a theme change reloads the style.
- **use-live-drive.ts:**
  - Keep a `createCellTracker()` for the session and feed it every new point in `tick`.
  - Expose `liveCells: string[]` (a new array only when the tracker grew) and `lastPos: { lat: number; lng: number } | null`.
- **HUD:**
  - `const { cells } = useExploredCells()`. The shown set is `cells ∪ liveCells`, built with `useMemo`.
  - `box` lives in state: set it with `boxAround(lastPos, FOG.hudBoxHalfDeg)` when it's null or `needsRecentre`.
  - `<FogLayers cells={shown} box={box} gridCenter={lastPos} />` goes inside `MapView` BEFORE the route `ShapeSource`. The route
    layers have no slot, so they draw on top. Check that on the phone.
  - The pill "+N new cells" sits top right, at the same `top` as the lock pill but `right: space.lg`, with `c.overlayPill`.
    - N = `liveCells` not in `cells`.
    - Hidden at 0, and hidden while the lock pill shows if they would overlap. Lock pill is centred and this one is right, so
      check at 390 pt.
    - Text: `+{N} new cells`: N in `c.primaryText`, the rest in `c.text`, `type.caption` and `fonts.bodyBold`.
    - `accessibilityLabel`: "N new cells this drive (estimate)".
- **Pre-drive:**
  - `useExploredCells()`, and the box around the last known position. Use `Location.getLastKnownPositionAsync`; it's already
    used by the old spike code.
  - FogLayers without a grid is fine: `gridCenter` = that position.
- **Map tab (`world.tsx`)**, replacing the Placeholder:
  - Full-screen `MapView` with the Standard style, `Camera` with `followUserLocation` until the user pans (same pattern as the
    HUD's `onUserTrackingModeChange`), and `defaultSettings` centred on Bangkok (13.7563, 100.5018) at zoom 11 when there is
    no location.
  - `LocationPuck`, and `FogLayers` with `WORLD_BOX`.
  - `gridCenter` comes from `onMapIdle(state)`'s `state.properties.center` (`[lng, lat]`).
  - **Top card** (design 17): `c.surface` and `c.line` border, `radius.lg`.
    - `CELLS EXPLORED` label and the count in the numbers font (`fonts` Rajdhani, as on the recap tiles), using `toLocaleString`
      style grouping like the HUD formatting helpers.
    - On the right, `AREA` and `exploredAreaKm2` with a "km²" unit.
  - **Recenter button:** a copy of the HUD's, sitting above the tab bar.
  - **3D toggle:** a 48 pt button above the recenter button, labelled "3D" / "2D", with `accessibilityLabel`
    "Show 3D buildings" / "Hide 3D buildings".
    - On: `styleJSON = standardStyleJSON(mode, c, { threeD: { clip: fogFeature(cells, WORLD_BOX) } })`, the `MapView` key
      includes `cells.size`, and the Camera gets `pitch={60}`.
    - Off: pitch 0.
    - The fog `FillLayer` stays in both modes.
  - `useFocusEffect(refresh)`, so returning from a recap reloads the cells.
  - Empty state: 0 cells, so the card shows 0 and "Drive to clear the fog" in `type.caption` `c.muted` under the numbers.
- [ ] Delete the spike files and `MAP_STYLE`, then grep for `MAP_STYLE` and `features/dev`: no hits.
- [ ] Run `npm run typecheck`, `npx eslint .` and `npm test`: all green.

### Task 7: Docs and hand-off
- **testlist.md F20 (Map and fog), tonight:**
  - (a) The Map tab shows fog, the puck and the card, and the numbers match the holes.
  - (b) Expected: drives counted BEFORE the 3.3 deploy show no holes. Only drives counted after the deploy, plus
    waiting/guest drives, do.
  - (c) HUD: cells open up behind the car while driving, the route draws above the fog and the puck shows. The pill counts
    up, and it may show MORE than the recap's "New cells" (it's an estimate).
  - (d) After the drive, the Map tab (on focus) shows the new holes.
  - (e) 3D toggle: buildings only inside explored cells, flat elsewhere.
  - (f) Onyx (night) and Pearl (day) both look right. Hex grid vs square: PS's call.
  - (g) Pre-drive shows fog.
  - (h) The phone stays cool on the HUD for the whole drive.
- **handoff.md:** a new session section with files touched, test results and PS's run order (below).
- **plan.md:** 3.4 notes "code done, tick after F20".

**PS run order tonight** (deploy AFTER this lands, because `cells.ts` changed; same behaviour, but the repo and the server
copy should match):
1. Commit 3.3 (Task 0), then let Sonnet build 3.4, then commit 3.4.
2. `npx supabase db push --remote`
3. `npx supabase test db --remote` (expect 95)
4. `npx supabase functions deploy finalize-drive --use-api`
5. EAS preview build: `eas build --profile preview -p android`. JS only, but carries everything since the last APK.
6. Drive: F18, F19, F20.
