// Blueprint fog geometry (plan 3.4). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cellToBoundary, cellToLatLng, gridDisk, gridRingUnsafe, latLngToCell } from 'h3-js';

import {
  boxAround,
  exploredAreaKm2,
  exploredEdges,
  fogFeature,
  needsRecentre,
  unexploredGrid,
  type Box,
  type LngLat,
} from '../src/lib/fog.ts';

const LAT = 13.75;
const LNG = 100.5;
const C0 = latLngToCell(LAT, LNG, 9);

function signedArea(ring: LngLat[]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}
/** Ray casting point-in-ring. */
function inRing(pt: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inBox = (p: LngLat, b: Box) => p[0] >= b.west && p[0] <= b.east && p[1] >= b.south && p[1] <= b.north;
const centre = (c: string): LngLat => {
  const [lat, lng] = cellToLatLng(c);
  return [lng, lat];
};
const box = boxAround(LAT, LNG, 0.15);

test('no cells: the fog is just the box, counter-clockwise', () => {
  const f = fogFeature([], box);
  assert.equal(f.geometry.coordinates.length, 1);
  const [outer, ...holes] = f.geometry.coordinates[0] as LngLat[][];
  assert.equal(holes.length, 0);
  assert.ok(signedArea(outer) > 0);
});

test('3 neighbouring cells: one clockwise hole containing their centres', () => {
  const cells = gridDisk(C0, 1).slice(0, 3);
  const f = fogFeature(cells, box);
  assert.equal(f.geometry.coordinates.length, 1);
  const [outer, ...holes] = f.geometry.coordinates[0] as LngLat[][];
  assert.ok(signedArea(outer) > 0);
  assert.equal(holes.length, 1);
  assert.ok(signedArea(holes[0]) < 0);
  for (const c of cells) assert.ok(inRing(centre(c), holes[0]), `${c} centre in the hole`);
});

test('an unexplored island inside an explored ring comes back as fog', () => {
  const ring = gridRingUnsafe(C0, 1);
  const f = fogFeature(ring, box);
  assert.equal(f.geometry.coordinates.length, 2, 'box + island');
  const [boxPoly, island] = f.geometry.coordinates as LngLat[][][];
  assert.equal(boxPoly.length, 2, 'box with one hole');
  assert.ok(signedArea(island[0]) > 0);
  assert.ok(inRing(centre(C0), island[0]));
});

test('a cell straddling the box edge is left out; every hole vertex stays inside the box', () => {
  const small: Box = boxAround(LAT, LNG, 0.01);
  const edge = latLngToCell(LAT, small.east, 9);
  const inner = C0;
  const f = fogFeature([edge, inner], small);
  const holes = (f.geometry.coordinates[0] as LngLat[][]).slice(1);
  assert.equal(holes.length, 1);
  for (const h of holes) for (const v of h) assert.ok(inBox(v, small));
  assert.ok(!inRing(centre(edge), holes[0]));
});

test('cells far outside the box are ignored', () => {
  const far = latLngToCell(LAT + 1, LNG, 9);
  const f = fogFeature([far], box);
  assert.equal((f.geometry.coordinates[0] as LngLat[][]).length, 1);
});

test('needsRecentre: false at the centre, true past the inner half', () => {
  assert.equal(needsRecentre(box, LAT, LNG), false);
  assert.equal(needsRecentre(box, LAT + 0.15 * 0.6, LNG), true);
  assert.equal(needsRecentre(box, LAT, LNG - 0.15 * 0.6), true);
});

test('unexploredGrid: radius 2 minus explored cells, closed lines', () => {
  const explored = new Set(gridDisk(C0, 1).slice(0, 3));
  const g = unexploredGrid(LAT, LNG, 2, explored);
  assert.equal(g.features.length, 19 - 3);
  for (const f of g.features) {
    const cs = f.geometry.coordinates;
    assert.deepEqual(cs[0], cs[cs.length - 1]);
  }
});

test('exploredAreaKm2 of 10 cells near Bangkok is about 1.3 km2', () => {
  // Res-9 cells average 0.105 km2 worldwide but are larger near the equator (about 0.13 km2 at 13.75 N).
  const a = exploredAreaKm2(gridDisk(C0, 2).slice(0, 10));
  assert.ok(a >= 1.0 && a <= 1.4, String(a));
  assert.equal(Math.round(a * 10) / 10, a);
});

test('exploredEdges of 3 neighbours is one closed line', () => {
  const fc = exploredEdges(gridDisk(C0, 1).slice(0, 3), box);
  assert.equal(fc.features.length, 1);
  const cs = fc.features[0].geometry.coordinates;
  assert.deepEqual(cs[0], cs[cs.length - 1]);
});

test('hole vertices match the cell boundaries (lng, lat order)', () => {
  const f = fogFeature([C0], box);
  const hole = (f.geometry.coordinates[0] as LngLat[][])[1];
  const b = cellToBoundary(C0, true);
  for (const v of b) assert.ok(hole.some((h) => Math.abs(h[0] - v[0]) < 1e-9 && Math.abs(h[1] - v[1]) < 1e-9));
});
