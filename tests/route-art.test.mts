// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { fitRoute, simplifyToMax, simplifyRoute } from '../src/lib/route-art.ts';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

test('an empty route fits to nothing', () => {
  assert.deepEqual(fitRoute([], 100, 100, 8), []);
});

test('a single point (or all points identical) sits in the centre', () => {
  assert.deepEqual(fitRoute([[100.5, 13.75]], 100, 60, 8), [{ x: 50, y: 30 }]);
  const same = fitRoute([[100.5, 13.75], [100.5, 13.75]], 100, 60, 8);
  assert.deepEqual(same, [{ x: 50, y: 30 }, { x: 50, y: 30 }]);
});

test('north is up: a larger latitude has a smaller y', () => {
  const [south, north] = fitRoute([[100.5, 13.75], [100.5, 13.76]], 100, 100, 8);
  assert.ok(south.y > north.y);
});

test('the route keeps its aspect ratio and is centred inside the padding', () => {
  // At latitude 0, 0.02 deg wide x 0.01 deg tall is exactly 2:1.
  const pts = fitRoute([[0, 0], [0.02, 0], [0.02, 0.01]], 200, 200, 10);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  assert.ok(near(Math.min(...xs), 10) && near(Math.max(...xs), 190), `x ${xs}`);
  assert.ok(near(Math.min(...ys), 55) && near(Math.max(...ys), 145), `y ${ys}`);
});

test('a wide route in a tall box is not stretched (height scales with width)', () => {
  const pts = fitRoute([[0, 0], [0.04, 0.01]], 100, 400, 0);
  const w = Math.abs(pts[1].x - pts[0].x);
  const h = Math.abs(pts[1].y - pts[0].y);
  assert.ok(near(w / h, 4, 1e-6), `ratio ${w / h}`);
});

test('simplifyRoute drops points on a straight line and keeps the ends', () => {
  const out = simplifyRoute([[0, 0], [1, 0], [2, 0], [3, 0]], 0.1);
  assert.deepEqual(out, [[0, 0], [3, 0]]);
});

test('simplifyRoute keeps a corner', () => {
  const out = simplifyRoute([[0, 0], [1, 0], [1, 1]], 0.1);
  assert.deepEqual(out, [[0, 0], [1, 0], [1, 1]]);
});

test('simplifyRoute leaves 0, 1 or 2 points alone', () => {
  assert.deepEqual(simplifyRoute([], 1), []);
  assert.deepEqual(simplifyRoute([[1, 2]], 1), [[1, 2]]);
  assert.deepEqual(simplifyRoute([[1, 2], [3, 4]], 1), [[1, 2], [3, 4]]);
});

test('simplifyToMax gets a 300-point wiggle down to at most 40 points, ends kept', () => {
  const wiggle: [number, number][] = Array.from({ length: 300 }, (_, i) => [i * 0.0001, Math.sin(i / 5) * 0.001]);
  const out = simplifyToMax(wiggle, 40);
  assert.ok(out.length <= 40, `got ${out.length}`);
  assert.ok(out.length >= 2);
  assert.deepEqual(out[0], wiggle[0]);
  assert.deepEqual(out[out.length - 1], wiggle[wiggle.length - 1]);
});

test('simplifyToMax leaves a short route unchanged', () => {
  const r: [number, number][] = [[0, 0], [1, 1], [2, 0]];
  assert.deepEqual(simplifyToMax(r, 40), r);
});
