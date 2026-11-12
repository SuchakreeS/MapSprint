// Private top speed (plan 3.10): the highest speed HELD for >= 3 s, never fooled by one GPS spike. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GpsPoint } from '../src/lib/geo.ts';
import { shownTopKmh, TOP_SPEED, topSpeedKmh } from '../src/lib/top-speed.ts';

const M_PER_DEG_LAT = 111_195;

/** One point per second driving north; the position always matches the given speed (km/h). */
function drive(speedsKmh: (number | null)[], over: (i: number) => Partial<GpsPoint> = () => ({})): GpsPoint[] {
  let lat = 13.75;
  return speedsKmh.map((kmh, i) => {
    if (i > 0) lat += ((kmh ?? speedsKmh[i - 1] ?? 0) / 3.6) / M_PER_DEG_LAT;
    return { ts: 1_700_000_000_000 + i * 1000, lat, lng: 100.5, speed: kmh == null ? null : kmh / 3.6, accuracy: 5, heading: 0, ...over(i) };
  });
}
const near = (actual: number | null, expected: number, tol = 0.6) =>
  assert.ok(actual != null && Math.abs(actual - expected) <= tol, `expected ~${expected}, got ${actual}`);
const steady = (kmh: number, n: number) => new Array<number>(n).fill(kmh);

test('a steady 90 km/h drive has a top speed of 90', () => {
  near(topSpeedKmh(drive(steady(90, 30))), 90);
});

test('one 180 km/h speed glitch in a 90 km/h drive still gives about 90', () => {
  const speeds = steady(90, 30);
  speeds[15] = 180;
  near(topSpeedKmh(drive(speeds)), 90);
});

test('a 2 s burst does not count, a speed held for 4 s does', () => {
  const burst = [...steady(90, 10), 130, 130, ...steady(90, 10)];
  near(topSpeedKmh(drive(burst)), 90);
  const held = [...steady(90, 10), 130, 130, 130, 130, 130, ...steady(90, 10)];
  near(topSpeedKmh(drive(held)), 130);
});

test('points with poor accuracy are ignored', () => {
  const speeds = [...steady(90, 10), 200, 200, 200, 200, 200, ...steady(90, 10)];
  near(topSpeedKmh(drive(speeds, (i) => (i >= 10 && i < 15 ? { accuracy: 40 } : {}))), 90);
});

test('a teleport (position jump) is ignored even with a plausible speed', () => {
  const pts = drive(steady(90, 30));
  pts[15] = { ...pts[15], lat: pts[15].lat + 0.05, speed: 150 / 3.6 }; // 5.5 km away in one second
  near(topSpeedKmh(pts), 90);
});

test('chip speeds above the plausible limit are ignored', () => {
  const speeds = [...steady(90, 10), 300, 300, 300, 300, 300, ...steady(90, 10)];
  const pts = drive(speeds, (i) => (i >= 10 && i < 15 ? { speed: 300 / 3.6 } : {}));
  // keep positions at 90 km/h so only the chip speed is absurd
  const positions = drive(steady(90, 25));
  near(topSpeedKmh(pts.map((p, i) => ({ ...p, lat: positions[i].lat }))), 90);
});

test('a GPS gap longer than 5 s breaks the window: silence is not "held"', () => {
  // 120 km/h for 2 s, then 8 s of nothing, then 120 for 2 s, around 60 km/h driving
  const before = drive([...steady(60, 10), 120, 120]);
  const after = drive([120, 120, ...steady(60, 10)]).map((p) => ({ ...p, ts: p.ts + 20_000 }));
  near(topSpeedKmh([...before, ...after]), 60);
  assert.equal(TOP_SPEED.maxGapMs, 5000);
});

test('points without a chip speed end the run', () => {
  const speeds: (number | null)[] = [...steady(60, 10), 120, 120, null, 120, 120, ...steady(60, 10)];
  near(topSpeedKmh(drive(speeds)), 60);
});

test('less than 3 s of usable data gives null', () => {
  assert.equal(topSpeedKmh(drive(steady(90, 3))), null); // 0, 1, 2 s: only 2 s long
  assert.equal(topSpeedKmh([]), null);
  near(topSpeedKmh(drive(steady(90, 4))), 90); // 0..3 s is exactly 3 s
});

test('input order does not matter', () => {
  const pts = drive([...steady(80, 10), 100, 100, 100, 100, ...steady(80, 10)]);
  near(topSpeedKmh([...pts].reverse()), 100);
});

test('the result is rounded to 0.1 km/h', () => {
  const v = topSpeedKmh(drive(steady(91.234, 10)));
  assert.equal(v, 91.2);
});

test('shownTopKmh: counted drives use the server value only, local drives the phone value', () => {
  assert.equal(shownTopKmh({ counted: true, serverTopKmh: 97.4, localTopKmh: 99 }), 97.4);
  assert.equal(shownTopKmh({ counted: true, serverTopKmh: null, localTopKmh: 99 }), null); // old counted drive: none
  assert.equal(shownTopKmh({ counted: true, serverTopKmh: undefined, localTopKmh: 99 }), null);
  assert.equal(shownTopKmh({ counted: false, serverTopKmh: undefined, localTopKmh: 99 }), 99);
  assert.equal(shownTopKmh({ counted: false, serverTopKmh: undefined, localTopKmh: null }), null);
});
