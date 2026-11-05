// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DriveSummary } from '../src/lib/geo.ts';
import { summarize } from '../src/lib/live-stats.ts';
import { cleanCity, noisyCity, teleportAndGap } from './fixtures.mts';

// Characterization: these numbers were captured from summarize() BEFORE it was refactored
// onto the live engine. If one changes, the distance maths changed.
function assertSummary(actual: DriveSummary, expected: DriveSummary) {
  for (const key of Object.keys(expected) as (keyof DriveSummary)[]) {
    const a = actual[key];
    const e = expected[key];
    if (a === null || e === null || Number.isInteger(e)) assert.equal(a, e, key);
    else assert.ok(Math.abs((a as number) - (e as number)) < 1e-9, `${key}: ${a} vs ${e}`);
  }
}

test('characterization: clean stop-and-go city drive', () => {
  assertSummary(summarize(cleanCity()), {
    rawPoints: 161,
    acceptedPoints: 161,
    rejectedAccuracy: 0,
    rejectedTeleport: 0,
    distanceM: 1666.665567161419,
    movingS: 130,
    elapsedS: 160,
    avgMovingKmh: 46.15381570600853,
    avgOverallKmh: 37.49997526113193,
    maxKmh: 59.99999996953084,
    lastKmh: 40.00045078680512,
    rawMaxGapS: 1,
  });
});

test('characterization: noisy accuracy, null speed and null accuracy points', () => {
  assertSummary(summarize(noisyCity()), {
    rawPoints: 161,
    acceptedPoints: 137,
    rejectedAccuracy: 24,
    rejectedTeleport: 0,
    distanceM: 1658.3322393256913,
    movingS: 130,
    elapsedS: 160,
    avgMovingKmh: 45.92304662748068,
    avgOverallKmh: 37.31247538482805,
    maxKmh: 59.99999924552326,
    lastKmh: 40.001877495996695,
    rawMaxGapS: 1,
  });
});

test('characterization: teleport rejected and a 12 s gap', () => {
  assertSummary(summarize(teleportAndGap()), {
    rawPoints: 101,
    acceptedPoints: 100,
    rejectedAccuracy: 0,
    rejectedTeleport: 1,
    distanceM: 1388.887972627935,
    movingS: 112,
    elapsedS: 112,
    avgMovingKmh: 44.64282769161219,
    avgOverallKmh: 44.64282769161219,
    maxKmh: 50,
    lastKmh: 50,
    rawMaxGapS: 13,
  });
});

// The live engine must match summarize() at every prefix of a drive.
import { createLiveStats } from '../src/lib/live-stats.ts';

for (const [name, build] of Object.entries({ cleanCity, noisyCity, teleportAndGap })) {
  test(`live stats after N pushes equals summarize of the first N points (${name})`, () => {
    const pts = build();
    for (const n of [1, 10, pts.length]) {
      const live = createLiveStats();
      for (const p of pts.slice(0, n)) live.push(p);
      assert.deepEqual(live.snapshot(), summarize(pts.slice(0, n)), `n=${n}`);
    }
  });
}

test('live stats with no points is an empty summary', () => {
  assert.deepEqual(createLiveStats().snapshot(), summarize([]));
});

test('live stats can be read between pushes without changing the result', () => {
  const pts = cleanCity();
  const live = createLiveStats();
  for (const p of pts) {
    live.push(p);
    live.snapshot();
  }
  assert.deepEqual(live.snapshot(), summarize(pts));
});

test('lastAcceptedTs is null before any point', () => {
  assert.equal(createLiveStats().lastAcceptedTs(), null);
});

test('lastAcceptedTs is the ts of the last ACCEPTED point, not the last pushed', () => {
  const pts = cleanCity();
  const live = createLiveStats();
  for (const p of pts.slice(0, 10)) live.push(p);
  const accepted = pts[9].ts;
  live.push({ ...pts[10], accuracy: 80 }); // rejected for accuracy
  assert.equal(live.lastAcceptedTs(), accepted);
  live.push({ ...pts[11], lat: pts[11].lat + 0.05 }); // rejected as a teleport
  assert.equal(live.lastAcceptedTs(), accepted);
});
