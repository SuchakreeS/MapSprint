// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { GpsPoint } from '../src/lib/geo.ts';
import { AUTO_PAUSE_MS, createLiveStats, summarize } from '../src/lib/live-stats.ts';
import { trip } from './fixtures.mts';

function feed(stats: ReturnType<typeof createLiveStats>, pts: GpsPoint[]) {
  for (const p of pts) stats.push(p);
}

test('auto-pause waits 5 minutes', () => {
  assert.equal(AUTO_PAUSE_MS, 300_000);
});

test('a 5+ minute stop mid-drive is paused: no idle time, no jump in distance', () => {
  const stats = createLiveStats();
  feed(stats, trip([[40, 60], [0, 400], [40, 60]]));
  const s = stats.snapshot();
  assert.equal(s.elapsedS, 119);
  assert.equal(s.movingS, 119);
  assert.ok(Math.abs(s.distanceM - 1322.2) < 1, `distance ${s.distanceM}`);
  assert.equal(stats.pauseState(), null);
});

test('a 200 s stop is not long enough to pause', () => {
  const stats = createLiveStats();
  feed(stats, trip([[40, 60], [0, 200], [40, 60]]));
  assert.equal(stats.snapshot().elapsedS, 320);
});

test('autoPauseMs Infinity turns auto-pause off', () => {
  const stats = createLiveStats({ autoPauseMs: Infinity });
  feed(stats, trip([[40, 60], [0, 400], [40, 60]]));
  assert.equal(stats.snapshot().elapsedS, 520);
});

test('auto-paused state reports when the stop began', () => {
  const pts = trip([[40, 60], [0, 400]]);
  const stats = createLiveStats();
  feed(stats, pts.slice(0, 361)); // up to t=360, the moment 5 min of stop is reached
  assert.deepEqual(stats.pauseState(), { kind: 'auto', since: pts[60].ts });
});

test('manual pause and resume with no points in between: no time, no distance across the gap', () => {
  const pts = trip([[40, 120]]);
  const stats = createLiveStats();
  feed(stats, pts.slice(0, 31));
  stats.pause(pts[30].ts);
  stats.resume(pts[90].ts);
  feed(stats, pts.slice(90));
  const s = stats.snapshot();
  assert.equal(s.elapsedS, 60);
  assert.ok(Math.abs(s.distanceM - 666.7) < 1, `distance ${s.distanceM}`);
});

test('points that arrive during a manual pause change nothing', () => {
  const pts = trip([[40, 60]]);
  const stats = createLiveStats();
  feed(stats, pts.slice(0, 11));
  stats.pause(pts[10].ts);
  const before = stats.snapshot();
  feed(stats, pts.slice(11, 21));
  const after = stats.snapshot();
  assert.equal(after.distanceM, before.distanceM);
  assert.equal(after.elapsedS, before.elapsedS);
  assert.equal(after.acceptedPoints, before.acceptedPoints);
});

test('pauseState is manual while manually paused, null after resume', () => {
  const pts = trip([[40, 20]]);
  const stats = createLiveStats();
  feed(stats, pts.slice(0, 11));
  stats.pause(pts[10].ts);
  assert.deepEqual(stats.pauseState(), { kind: 'manual', since: pts[10].ts });
  stats.resume(pts[15].ts);
  assert.equal(stats.pauseState(), null);
});

test('pausing twice or resuming while running is harmless', () => {
  const pts = trip([[40, 30]]);
  const stats = createLiveStats();
  feed(stats, pts.slice(0, 11));
  stats.resume(pts[10].ts); // not paused: ignored
  const before = stats.snapshot();
  assert.deepEqual(before, summarize(pts.slice(0, 11)));
  stats.pause(pts[10].ts);
  stats.pause(pts[10].ts + 5000); // already paused: keeps the first pause time
  assert.deepEqual(stats.pauseState(), { kind: 'manual', since: pts[10].ts });
});

test('manual resume works while auto-paused and starts a new baseline', () => {
  const pts = trip([[40, 60], [0, 400], [0, 10]]);
  const stats = createLiveStats();
  feed(stats, pts.slice(0, 401));
  assert.equal(stats.pauseState()?.kind, 'auto');
  assert.equal(stats.snapshot().elapsedS, 60);
  stats.resume(pts[400].ts);
  assert.equal(stats.pauseState(), null);
  feed(stats, pts.slice(401, 411)); // 10 stopped points: first is the baseline, then 9 s
  assert.equal(stats.snapshot().elapsedS, 69);
  assert.equal(stats.pauseState(), null); // 10 s of stop does not re-pause
});

test('elapsedAt keeps counting to now while running (GPS lost) and freezes while paused', () => {
  const pts = trip([[40, 60]]);
  const lastTs = pts[pts.length - 1].ts;
  const stats = createLiveStats();
  feed(stats, pts);
  assert.equal(stats.elapsedAt(lastTs + 30_000), 90);
  stats.pause(lastTs + 1000);
  assert.equal(stats.elapsedAt(lastTs + 999_000), 61);
});

test('elapsedAt is 0 before any point', () => {
  assert.equal(createLiveStats().elapsedAt(Date.now()), 0);
});

test('summarize with pause events equals feeding the same sequence to the engine', () => {
  const pts = trip([[40, 120]]);
  const kept = [...pts.slice(0, 31), ...pts.slice(90)];
  const events = [
    { ts: pts[30].ts + 500, type: 'pause' as const },
    { ts: pts[90].ts - 500, type: 'resume' as const },
  ];

  const stats = createLiveStats();
  feed(stats, pts.slice(0, 31));
  stats.pause(events[0].ts);
  stats.resume(events[1].ts);
  feed(stats, pts.slice(90));

  assert.deepEqual(summarize(kept, events), stats.snapshot());
});

test('the gap left by a manual pause is not reported as a GPS gap', () => {
  const pts = trip([[40, 120]]);
  const stats = createLiveStats();
  feed(stats, pts.slice(0, 31));
  stats.pause(pts[30].ts);
  stats.resume(pts[90].ts);
  feed(stats, pts.slice(90));
  assert.equal(stats.snapshot().rawMaxGapS, 1);
});
