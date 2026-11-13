// Mapbox Standard style JSON builder (plan 3.4). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { standardStyleJSON } from '../src/lib/map-style.ts';

const COLORS = { bg: '#000001', surface: '#000002', surface2: '#000003', gold: '#000004' };
const CLIP: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } };
const parse = (s: string) => JSON.parse(s);

test('dark is dusk by default, light is day, both import Standard', () => {
  for (const [mode, preset] of [['dark', 'dusk'], ['light', 'day']] as const) {
    const s = parse(standardStyleJSON(mode, COLORS));
    assert.equal(s.version, 8);
    assert.equal(s.imports[0].url, 'mapbox://styles/mapbox/standard');
    assert.equal(s.imports[0].config.lightPreset, preset);
  }
});

test('map look: dark is night for the test looks A and old, light stays day for every look', () => {
  const preset = (mode: 'dark' | 'light', look: 'dusk' | 'night-tint' | 'night') =>
    parse(standardStyleJSON(mode, COLORS, { look })).imports[0].config.lightPreset;
  assert.equal(preset('dark', 'dusk'), 'dusk');
  assert.equal(preset('dark', 'night-tint'), 'night');
  assert.equal(preset('dark', 'night'), 'night');
  for (const look of ['dusk', 'night-tint', 'night'] as const) assert.equal(preset('light', look), 'day');
});

test('flat by default: no 3D and no clip layer', () => {
  const s = parse(standardStyleJSON('dark', COLORS));
  const cfg = s.imports[0].config;
  for (const k of ['show3dBuildings', 'show3dObjects', 'show3dLandmarks', 'show3dFacades', 'show3dTrees']) assert.equal(cfg[k], false, k);
  assert.deepEqual(s.layers, []);
  assert.deepEqual(s.sources, {});
});

test('3D: buildings on and a clip layer on the unexplored source', () => {
  const s = parse(standardStyleJSON('light', COLORS, { threeD: { clip: CLIP } }));
  const cfg = s.imports[0].config;
  assert.equal(cfg.show3dBuildings, true);
  assert.equal(cfg.show3dTrees, false);
  assert.deepEqual(s.sources.unexplored, { type: 'geojson', data: CLIP });
  assert.deepEqual(s.layers, [
    { id: 'clip-unexplored', type: 'clip', source: 'unexplored', slot: 'top', layout: { 'clip-layer-types': ['model'] } },
  ]);
});

test('colours come from the theme', () => {
  const cfg = parse(standardStyleJSON('dark', COLORS)).imports[0].config;
  assert.equal(cfg.colorLand, COLORS.surface);
  assert.equal(cfg.colorRoads, COLORS.surface2);
  assert.equal(cfg.colorMotorways, COLORS.gold);
  assert.equal(cfg.colorWater, COLORS.bg);
  assert.equal(cfg.colorBuildings, COLORS.surface2);
  assert.equal(cfg.colorGreenspaces, COLORS.surface);
});
