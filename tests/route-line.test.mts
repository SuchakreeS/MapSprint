// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GpsPoint } from '../src/lib/geo.ts';
import { appendRoutePoint } from '../src/lib/route-line.ts';

const DEG_PER_METRE = 1 / 111_195;
const at = (metresNorth: number): GpsPoint => ({
  ts: 0,
  lat: 13.75 + metresNorth * DEG_PER_METRE,
  lng: 100.5,
  speed: null,
  accuracy: 5,
  heading: null,
});

test('the first point is always kept, as [lng, lat]', () => {
  const coords = appendRoutePoint([], at(0));
  assert.equal(coords.length, 1);
  assert.deepEqual(coords[0], [100.5, 13.75]);
});

test('a point closer than 5 m to the last kept one is skipped', () => {
  const coords = appendRoutePoint(appendRoutePoint([], at(0)), at(2));
  assert.equal(coords.length, 1);
});

test('a point 6 m from the last kept one is kept', () => {
  const coords = appendRoutePoint(appendRoutePoint([], at(0)), at(6));
  assert.equal(coords.length, 2);
});

test('distance is measured from the last kept point, not the last seen one', () => {
  let coords = appendRoutePoint([], at(0));
  for (const m of [2, 4, 6]) coords = appendRoutePoint(coords, at(m));
  assert.equal(coords.length, 2);
});
