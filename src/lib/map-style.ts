// The app's one map style (plan 3.4, decision in handoff "Spike 3.0 result"): Mapbox Standard imported into a style JSON.
// Onyx (dark) = night light preset, Pearl (light) = day, base colours tuned from the theme tokens (passed in, never hard-coded).
// 3D buildings only with `threeD` (Map tab toggle): a `clip` layer removes them wherever the clip polygon (the fog) lies,
// so they stand only in explored cells. rnmapbox has no ClipLayer component, hence the JSON.

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
  opts?: { threeD?: { clip: GeoJSON.Feature } },
): string {
  const threeD = opts?.threeD;
  const on = !!threeD;
  const config = {
    lightPreset: mode === 'dark' ? 'night' : 'day',
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
