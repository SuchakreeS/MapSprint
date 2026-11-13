// The app's one map style (plan 3.4, decision in handoff "Spike 3.0 result"): Mapbox Standard imported into a style JSON.
// Onyx (dark) = dusk light preset (night for the temporary test looks, see map-look.ts), Pearl (light) = day, base colours tuned from the theme tokens (passed in, never hard-coded).
// 3D buildings only with `threeD` (Map tab toggle): a `clip` layer removes them wherever the clip polygon (the fog) lies,
// so they stand only in explored cells. rnmapbox has no ClipLayer component, hence the JSON.

import { DEFAULT_MAP_LOOK, lightPresetFor, type MapLook } from './map-look.ts';

export interface StyleColors {
  bg: string;
  surface: string;
  surface2: string;
  gold: string;
}

const STANDARD_URL = 'mapbox://styles/mapbox/standard';

export function standardStyleJSON(
  mode: 'dark' | 'light',
  colors: StyleColors,
  opts?: { threeD?: { clip: GeoJSON.Feature }; look?: MapLook },
): string {
  const threeD = opts?.threeD;
  const on = !!threeD;
  const config = {
    // Dark: "dusk" (option B, default) lifts the base map so the explored area shows under the fog; "night" for A and the old look.
    // The token colours below keep either one neutral grey (no strong blue or purple cast). Light is always day.
    lightPreset: lightPresetFor(mode, opts?.look ?? DEFAULT_MAP_LOOK),
    show3dBuildings: on,
    show3dObjects: on,
    show3dLandmarks: on,
    show3dFacades: on,
    show3dTrees: false,
    colorLand: colors.surface,
    colorRoads: colors.surface2,
    colorMotorways: colors.gold,
    colorWater: colors.bg,
    colorBuildings: colors.surface2,
    colorGreenspaces: colors.surface,
  };
  return JSON.stringify({
    version: 8,
    name: 'mapsprint-standard',
    imports: [{ id: 'basemap', url: STANDARD_URL, config }],
    sources: threeD ? { unexplored: { type: 'geojson', data: threeD.clip } } : {},
    layers: threeD
      ? [{ id: 'clip-unexplored', type: 'clip', source: 'unexplored', slot: 'top', layout: { 'clip-layer-types': ['model'] } }]
      : [],
  });
}
