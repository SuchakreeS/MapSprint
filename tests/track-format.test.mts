// Wire format of the uploaded raw track (design 2026-11-10, "Wire format v1"). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildTrackPayload,
  parseTrackPayload,
  payloadToPoints,
  TRACK_LIMITS,
  trackLimitProblem,
  TRACK_VERSION,
} from '../src/lib/track-format.ts';
import type { GpsPoint } from '../src/lib/geo.ts';

const P = (ts: number, over: Partial<GpsPoint> = {}): GpsPoint => ({
  ts,
  lat: 13.7563123456,
  lng: 100.5018123456,
  speed: 12.3456,
  accuracy: 4.26,
  heading: 91.234,
  ...over,
});

const base = (points: GpsPoint[]) => ({
  startedAt: 1000,
  endedAt: 9000,
  mode: 'motorbike' as const,
  autoPauseMs: 300_000,
  points,
  pauses: [{ ts: 5000, type: 'pause' as const }, { ts: 6000, type: 'resume' as const }],
});

test('build then parse gives the same drive back (columnar, version 1)', () => {
  const payload = buildTrackPayload(base([P(1000), P(2000, { speed: null, accuracy: null, heading: null })]));
  assert.equal(payload.v, TRACK_VERSION);
  assert.equal(payload.mode, 'motorbike');
  const parsed = parseTrackPayload(JSON.parse(JSON.stringify(payload)));
  assert.ok(parsed);
  const back = payloadToPoints(parsed);
  assert.equal(back.length, 2);
  assert.equal(back[0].ts, 1000);
  assert.equal(back[1].speed, null);
  assert.deepEqual(parsed.pauses, [{ ts: 5000, type: 'pause' }, { ts: 6000, type: 'resume' }]);
});

test('points are sorted by time and numbers are rounded to keep the file small', () => {
  const payload = buildTrackPayload(base([P(3000), P(1000), P(2000)]));
  assert.deepEqual(payload.points.ts, [1000, 2000, 3000]);
  assert.equal(payload.points.lat[0], 13.756312); // 6 decimals = about 0.1 m
  assert.equal(payload.points.speed[0], 12.35);
  assert.equal(payload.points.accuracy[0], 4.3);
  assert.equal(payload.points.heading[0], 91.2);
});

test('auto-pause off is stored as null (JSON cannot hold Infinity)', () => {
  const payload = buildTrackPayload({ ...base([P(1000)]), autoPauseMs: Infinity });
  assert.equal(payload.autoPauseMs, null);
});

test('parseTrackPayload refuses anything that is not a well-formed version 1 track', () => {
  const good = JSON.parse(JSON.stringify(buildTrackPayload(base([P(1000), P(2000)]))));
  assert.ok(parseTrackPayload(good));
  assert.equal(parseTrackPayload(null), null);
  assert.equal(parseTrackPayload({ ...good, v: 2 }), null);
  assert.equal(parseTrackPayload({ ...good, mode: 'plane' }), null);
  assert.equal(parseTrackPayload({ ...good, points: { ...good.points, lat: [1] } }), null); // lengths differ
  assert.equal(parseTrackPayload({ ...good, points: { ...good.points, ts: ['x', 2000] } }), null);
  assert.equal(parseTrackPayload({ ...good, pauses: [{ ts: 1, type: 'stop' }] }), null);
});

test('parseTrackPayload refuses a track with an absurd number of points before looping over it', () => {
  const huge = new Array(TRACK_LIMITS.maxPoints * 3).fill(1);
  const bomb = { v: 1, mode: 'car', startedAt: 1, endedAt: 2, autoPauseMs: null, points: { ts: huge, lat: huge, lng: huge, speed: huge, accuracy: huge, heading: huge }, pauses: [] };
  assert.equal(parseTrackPayload(bomb), null);
});

test('trackLimitProblem: ok for a normal drive, refuses too many points or a drive over 12 hours', () => {
  assert.equal(trackLimitProblem(base([P(1000), P(2000)])), null);
  const many = Array.from({ length: TRACK_LIMITS.maxPoints + 1 }, (_, i) => P(1000 + i));
  assert.equal(trackLimitProblem(base(many)), 'too_long');
  assert.equal(trackLimitProblem({ ...base([P(1000), P(2000)]), startedAt: 0, endedAt: TRACK_LIMITS.maxDurationMs + 1 }), 'too_long');
});
