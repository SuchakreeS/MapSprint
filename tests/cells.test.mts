// Explored H3 cells of a drive (plan 3.3). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { gridDistance, latLngToCell } from 'h3-js';

import { CELL_RES, CELLS, createCellTracker, driveCells } from '../src/lib/cells.ts';
import type { GpsPoint } from '../src/lib/geo.ts';

const LAT0 = 13.75;
const LNG0 = 100.5;
const M_PER_DEG_LAT = 111_195;
const T0 = Date.UTC(2026, 10, 10, 1, 0, 0);

/** One point a second driving north; the position always matches the speed. */
function straight(seconds: number, speedMs = 10, startTs = T0, lat0 = LAT0, over: Partial<GpsPoint> = {}): GpsPoint[] {
  return Array.from({ length: seconds + 1 }, (_, i) => ({
    ts: startTs + i * 1000,
    lat: lat0 + (i * speedMs) / M_PER_DEG_LAT,
    lng: LNG0,
    speed: speedMs,
    accuracy: 5,
    heading: 0,
    ...over,
  }));
}
const cellOf = (p: { lat: number; lng: number }) => latLngToCell(p.lat, p.lng, CELL_RES);

test('a 6 km straight drive gives a connected line of cells from start to end', () => {
  const pts = straight(600);
  const cells = driveCells(pts);
  assert.ok(cells.includes(cellOf(pts[0])));
  assert.ok(cells.includes(cellOf(pts[pts.length - 1])));
  assert.ok(cells.length >= 15 && cells.length <= 60, `${cells.length} cells`);
  for (const a of cells) {
    assert.ok(cells.some((b) => b !== a && gridDistance(a, b) === 1), `${a} is not connected to the line`);
  }
});

test('parked GPS drift explores nothing', () => {
  const pts: GpsPoint[] = Array.from({ length: 300 }, (_, i) => ({
    ts: T0 + i * 1000,
    lat: LAT0 + (i % 2 === 0 ? 0.0004 : -0.0004),
    lng: LNG0,
    speed: 0,
    accuracy: 8,
    heading: null,
  }));
  assert.deepEqual(driveCells(pts), []);
});

test('a gap of 1.5 km is filled, a gap of 3 km is not', () => {
  for (const [gapM, filled] of [[1500, true], [3000, false]] as const) {
    const first = straight(60);
    const end = first[first.length - 1];
    const secondStartLat = end.lat + gapM / M_PER_DEG_LAT;
    const second = straight(60, 10, T0 + 120_000, secondStartLat);
    const mid = { lat: end.lat + gapM / 2 / M_PER_DEG_LAT, lng: LNG0 };
    const cells = driveCells([...first, ...second]);
    assert.equal(cells.includes(cellOf(mid)), filled, `gap ${gapM} m: midpoint cell`);
  }
});

test('teleports and poor-accuracy points are ignored', () => {
  const pts = straight(120);
  const bad: GpsPoint[] = [
    { ts: T0 + 30_500, lat: LAT0 + 0.5, lng: LNG0, speed: 10, accuracy: 5, heading: null }, // 55 km away in half a second
    ...Array.from({ length: 5 }, (_, i): GpsPoint => ({ ts: T0 + 60_100 + i * 100, lat: LAT0 + 0.0054, lng: LNG0 + 0.05, speed: 10, accuracy: 40, heading: null })),
  ];
  const cells = driveCells([...pts, ...bad]);
  assert.ok(!cells.includes(latLngToCell(LAT0 + 0.5, LNG0, CELL_RES)));
  assert.ok(!cells.includes(latLngToCell(LAT0 + 0.0054, LNG0 + 0.05, CELL_RES)));
  assert.deepEqual(cells, driveCells(pts));
});

test('output is sorted and unique, whatever the input order', () => {
  const pts = straight(300);
  const cells = driveCells(pts);
  assert.deepEqual(driveCells([...pts].reverse()), cells);
  assert.deepEqual(cells, [...new Set(cells)].sort());
});

test('points without a chip speed use the implied speed', () => {
  assert.deepEqual(driveCells(straight(600, 10, T0, LAT0, { speed: null })), driveCells(straight(600)));
});

function gapDrive(gapM: number): GpsPoint[] {
  const first = straight(60);
  const end = first[first.length - 1];
  return [...first, ...straight(60, 10, T0 + 120_000, end.lat + gapM / M_PER_DEG_LAT)];
}
function teleportDrive(): GpsPoint[] {
  return [
    ...straight(120),
    { ts: T0 + 30_500, lat: LAT0 + 0.5, lng: LNG0, speed: 10, accuracy: 5, heading: null },
  ].sort((a, b) => a.ts - b.ts);
}

test('tracker fed the sorted points gives the same set as driveCells', () => {
  for (const pts of [straight(600), gapDrive(1500), gapDrive(3000), teleportDrive()]) {
    const t = createCellTracker();
    const added: string[] = [];
    for (const p of pts) added.push(...t.add(p));
    const want = driveCells(pts);
    assert.deepEqual([...new Set(added)].sort(), want);
    assert.equal(added.length, want.length, 'every cell reported once');
    assert.equal(t.size, want.length);
    for (const c of want) assert.ok(t.has(c));
  }
});

test('add returns only cells not seen before', () => {
  const t = createCellTracker();
  const [a, b] = straight(1);
  assert.ok(t.add(a).length === 0 || t.size > 0);
  t.add(b);
  const again = { ...b, ts: b.ts + 1000 }; // same place, still "moving" chip speed
  assert.deepEqual(t.add(again), []);
});

test('add returns gap-fill cells too', () => {
  const pts = gapDrive(1500);
  const firstAfterGap = pts.findIndex((p) => p.ts >= T0 + 120_000);
  const t = createCellTracker();
  for (const p of pts.slice(0, firstAfterGap)) t.add(p);
  const end = pts[firstAfterGap - 1];
  const mid = cellOf({ lat: end.lat + 750 / M_PER_DEG_LAT, lng: LNG0 });
  assert.ok(t.add(pts[firstAfterGap]).includes(mid));
});

test('cell limits', () => {
  assert.equal(CELLS.maxGapFillM, 2000);
  assert.equal(CELLS.maxCellsPerDrive, 20_000);
  assert.equal(CELL_RES, 9);
});
