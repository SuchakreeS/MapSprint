// The picture card you can save or share (plan 3.6): hiding the start and finish of the route. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { haversineMeters } from '../src/lib/geo.ts';
import { SHARE_HIDE_ENDS_M, trimRouteEnds } from '../src/lib/share-card.ts';
import type { RouteCoord } from '../src/lib/route-line.ts';

const M_PER_DEG_LAT = 111_195;
/** A straight route north, `points` points, `lengthM` long. [lng, lat]. */
function line(lengthM: number, points: number): RouteCoord[] {
  return Array.from({ length: points }, (_, i) => [100.5, 13.75 + (lengthM * (i / (points - 1))) / M_PER_DEG_LAT] as RouteCoord);
}
const metresFrom = (a: RouteCoord, b: RouteCoord) => haversineMeters({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });

test('the default is 300 m off each end', () => {
  assert.equal(SHARE_HIDE_ENDS_M, 300);
});

test('a long route loses 300 m at the start and at the finish', () => {
  const route = line(2000, 201); // a point every 10 m
  const out = trimRouteEnds(route, 300);
  assert.ok(out.length > 100);
  assert.ok(metresFrom(route[0], out[0]) >= 300 - 1e-6, 'start is at least 300 m in');
  assert.ok(metresFrom(out[out.length - 1], route[route.length - 1]) >= 300 - 1e-6, 'finish is at least 300 m before the end');
  assert.ok(metresFrom(route[0], out[0]) < 320, 'but not much more than 300 m');
  assert.ok(metresFrom(out[out.length - 1], route[route.length - 1]) < 320);
});

test('the kept points are in order and are points of the original route', () => {
  const route = line(2000, 201);
  const out = trimRouteEnds(route, 300);
  const idx = out.map((p) => route.indexOf(p));
  assert.ok(idx.every((i) => i >= 0));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});

test('a route shorter than twice the trim shows no route at all (nothing to hide behind)', () => {
  assert.deepEqual(trimRouteEnds(line(500, 51), 300), []);
  assert.deepEqual(trimRouteEnds(line(599, 60), 300), []);
});

test('zero trim keeps the whole route; tiny or empty input is handled', () => {
  const route = line(1000, 11);
  assert.deepEqual(trimRouteEnds(route, 0), route);
  assert.deepEqual(trimRouteEnds([], 300), []);
  assert.deepEqual(trimRouteEnds([[100.5, 13.75]], 300), []);
  assert.deepEqual(trimRouteEnds(route, Number.NaN), route); // a bad number must never throw
});

test('a route with fewer than two points left after the trim is empty', () => {
  // 700 m route, points only every 350 m: after trimming 300 m each side only the middle point (350 m) is left.
  assert.deepEqual(trimRouteEnds(line(700, 3), 300), []);
});

test('a jittery or looping start (parked, car park ramp) is still hidden: the first kept point is >= 300 m from the start in a straight line', () => {
  // 600 m of path circling within 40 m of the door, then 2 km straight north.
  const start: RouteCoord = [100.5, 13.75];
  const loop: RouteCoord[] = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * 2 * Math.PI * 4; // four laps
    return [start[0] + (40 / 108_000) * Math.cos(a), start[1] + (40 / M_PER_DEG_LAT) * Math.sin(a)] as RouteCoord;
  });
  const away = line(2000, 201).map(([lng, lat]) => [lng, lat] as RouteCoord);
  const route = [start, ...loop, ...away];
  const out = trimRouteEnds(route, 300);
  assert.ok(out.length >= 2);
  assert.ok(metresFrom(start, out[0]) >= 300 - 1e-6, `first kept point is ${metresFrom(start, out[0]).toFixed(0)} m from the door`);
  for (const p of out) assert.ok(metresFrom(start, p) >= 300 - 1e-6, 'no kept point is near the start');
});

test('a jittery finish is hidden the same way', () => {
  const route = line(2000, 201);
  const end = route[route.length - 1];
  const jitter: RouteCoord[] = Array.from({ length: 40 }, (_, i) => [end[0] + (i % 2 ? 1 : -1) * 0.0002, end[1] + (i % 3) * 0.0001] as RouteCoord);
  const out = trimRouteEnds([...route, ...jitter, end], 300);
  assert.ok(out.length >= 2);
  for (const p of out) assert.ok(metresFrom(p, end) >= 300 - 1e-6, 'no kept point is near the finish');
});
