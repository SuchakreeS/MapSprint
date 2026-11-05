// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GAP_MIN_S, findGaps } from '../src/lib/gaps.ts';
import { summarize } from '../src/lib/live-stats.ts';
import { teleportAndGap, trip } from './fixtures.mts';

test('gaps are logged above 3 seconds', () => {
  assert.equal(GAP_MIN_S, 3);
});

test('a steady one-per-second track has no gaps', () => {
  assert.deepEqual(findGaps(trip([[40, 60]])), []);
});

test('a 12 s hole is one gap with its time, length and positions', () => {
  const pts = trip([[40, 60]]);
  const shifted = pts.map((p, i) => (i > 30 ? { ...p, ts: p.ts + 11_000 } : p)); // 1 s step becomes 12 s
  const gaps = findGaps(shifted);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].startTs, pts[30].ts);
  assert.equal(gaps[0].endTs, shifted[31].ts);
  assert.equal(gaps[0].durationS, 12);
  assert.equal(gaps[0].lat, pts[30].lat);
  assert.equal(gaps[0].lng, pts[30].lng);
  assert.equal(gaps[0].endLat, pts[31].lat);
});

test('exactly 3 s is not a gap, 3.5 s is', () => {
  const base = trip([[40, 10]]);
  const exact = base.map((p, i) => (i > 5 ? { ...p, ts: p.ts + 2_000 } : p)); // 1 s step becomes 3 s
  assert.deepEqual(findGaps(exact), []);
  const over = base.map((p, i) => (i > 5 ? { ...p, ts: p.ts + 2_500 } : p));
  assert.equal(findGaps(over).length, 1);
});

test('several gaps come back in time order, input order does not matter', () => {
  const pts = trip([[40, 100]]).map((p, i) => ({ ...p, ts: p.ts + (i > 20 ? 5_000 : 0) + (i > 60 ? 9_000 : 0) }));
  const shuffled = [...pts].reverse();
  const gaps = findGaps(shuffled);
  assert.deepEqual(gaps.map((g) => g.durationS), [6, 10]);
  assert.ok(gaps[0].startTs < gaps[1].startTs);
});

test('the quiet stretch of a manual pause is not a gap', () => {
  const pts = trip([[40, 120]]);
  const kept = [...pts.slice(0, 31), ...pts.slice(90)];
  const events = [
    { ts: pts[30].ts + 500, type: 'pause' as const },
    { ts: pts[90].ts - 500, type: 'resume' as const },
  ];
  assert.equal(findGaps(kept).length, 1); // without the events it looks like a gap
  assert.deepEqual(findGaps(kept, events), []);
});

test('a real gap outside the pause is still reported', () => {
  const pts = trip([[40, 200]]);
  const withHole = pts.map((p, i) => (i > 150 ? { ...p, ts: p.ts + 7_000 } : p));
  const kept = [...withHole.slice(0, 31), ...withHole.slice(90)];
  const events = [
    { ts: pts[30].ts + 500, type: 'pause' as const },
    { ts: pts[90].ts - 500, type: 'resume' as const },
  ];
  const gaps = findGaps(kept, events);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].durationS, 8);
});

test('a pause that was never resumed hides the gap after it', () => {
  const pts = trip([[40, 60]]);
  const kept = pts.slice(0, 31);
  const afterwards = pts.slice(50).map((p) => ({ ...p }));
  assert.deepEqual(findGaps([...kept, ...afterwards], [{ ts: pts[30].ts + 500, type: 'pause' }]), []);
});

test('the longest gap equals the engine rawMaxGapS', () => {
  const pts = teleportAndGap(); // has a 13 s gap
  const longest = Math.max(...findGaps(pts).map((g) => g.durationS));
  assert.equal(longest, summarize(pts).rawMaxGapS);
});

test('empty and single-point tracks have no gaps', () => {
  assert.deepEqual(findGaps([]), []);
  assert.deepEqual(findGaps(trip([[40, 0]])), []);
});
