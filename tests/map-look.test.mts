// TEMPORARY map style switch (src/lib/map-look.ts) and the per-theme fog style. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fogStyleFor, zoomWidth } from '../src/lib/fog.ts';
import { DEFAULT_MAP_LOOK, lightPresetFor, MAP_LOOKS, parseMapLook } from '../src/lib/map-look.ts';

test('default look is dusk (B); unknown or missing values fall back to it', () => {
  assert.equal(DEFAULT_MAP_LOOK, 'dusk');
  assert.equal(parseMapLook(null), 'dusk');
  assert.equal(parseMapLook('nonsense'), 'dusk');
  for (const l of MAP_LOOKS) assert.equal(parseMapLook(l), l);
});

test('light preset: Pearl is always day, Onyx is dusk only for option B', () => {
  for (const l of MAP_LOOKS) assert.equal(lightPresetFor('light', l), 'day');
  assert.equal(lightPresetFor('dark', 'dusk'), 'dusk');
  assert.equal(lightPresetFor('dark', 'night-tint'), 'night');
  assert.equal(lightPresetFor('dark', 'night'), 'night');
});

test('light mode fog is exactly the old look for every setting', () => {
  for (const l of MAP_LOOKS) {
    const s = fogStyleFor('light', l);
    assert.equal(s.opacity, 0.82);
    assert.equal(s.exploredFill, null);
    assert.equal(s.glow, null);
    assert.deepEqual(s.grid, { color: 'muted', opacity: 0.5, width: 0.7 });
    assert.deepEqual(s.edge, { color: 'primary', width: 1.5, opacity: 0.8 });
  }
});

test('"night" in dark is the old look too', () => {
  assert.deepEqual(fogStyleFor('dark', 'night'), fogStyleFor('light', 'night'));
});

test('B dusk (dark): fog 0.90, solid primary edge with a glow underneath, gold grid at 0.3, no explored fill', () => {
  const s = fogStyleFor('dark', 'dusk');
  assert.equal(s.opacity, 0.9);
  assert.equal(s.exploredFill, null);
  assert.equal(s.edge.color, 'primary');
  assert.equal(s.edge.opacity, 1);
  assert.deepEqual(s.grid, { color: 'gold', opacity: 0.3, width: 0.7 });
  assert.ok(s.glow);
  assert.equal(s.glow.color, 'primary');
  assert.equal(s.glow.blur, 4);
  assert.equal(s.glow.opacity, 0.35);
});

test('A night + tint (dark): fog 0.82, explored cells filled with primary at 0.09, same edge, glow and grid as B', () => {
  const a = fogStyleFor('dark', 'night-tint');
  const b = fogStyleFor('dark', 'dusk');
  assert.equal(a.opacity, 0.82);
  assert.deepEqual(a.exploredFill, { color: 'primary', opacity: 0.09 });
  assert.deepEqual(a.edge, b.edge);
  assert.deepEqual(a.glow, b.glow);
  assert.deepEqual(a.grid, b.grid);
});

test('edge and glow widths scale with zoom: wider zoomed out, about 2.4 / 9 px at street zoom, never fat zoomed in', () => {
  const { edge, glow } = fogStyleFor('dark', 'dusk');
  assert.ok(Array.isArray(edge.width) && glow && Array.isArray(glow.width));
  for (const stops of [edge.width, glow.width]) {
    const zooms = stops.map(([z]) => z);
    assert.deepEqual(zooms, [...zooms].sort((x, y) => x - y), 'zoom stops ascend');
    const atCity = stops.find(([z]) => z >= 10 && z <= 11) ?? stops[0];
    const atStreet = stops[stops.length - 1];
    assert.ok(atCity[1] >= atStreet[1], 'not thinner zoomed out');
    assert.ok(stops.every(([, w]) => w <= stops[0][1]), 'never fatter than at the smallest zoom');
  }
  assert.equal(edge.width[edge.width.length - 1][1], 2.4);
  assert.equal(glow.width[glow.width.length - 1][1], 9);
});

test('zoomWidth: a plain number stays a number, stops become a Mapbox interpolate expression', () => {
  assert.equal(zoomWidth(1.5), 1.5);
  assert.deepEqual(
    zoomWidth([
      [10, 3],
      [16, 2],
    ]),
    ['interpolate', ['linear'], ['zoom'], 10, 3, 16, 2],
  );
});
