// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { haversineMeters, summarize, type GpsPoint } from '../src/lib/geo.ts';

test('haversine: 1 degree of latitude is about 111.2 km', () => {
  const d = haversineMeters({ lat: 13.0, lng: 100.5 }, { lat: 14.0, lng: 100.5 });
  assert.ok(Math.abs(d - 111_195) < 50, `got ${d}`);
});

// Build a straight drive north at a constant speed, one point per second.
function drive(kmh: number, seconds: number, accuracy = 5): GpsPoint[] {
  const metresPerSec = kmh / 3.6;
  const degPerMetre = 1 / 111_195;
  return Array.from({ length: seconds + 1 }, (_, i) => ({
    ts: 1_700_000_000_000 + i * 1000,
    lat: 13.75 + i * metresPerSec * degPerMetre,
    lng: 100.5,
    speed: metresPerSec,
    accuracy,
    heading: 0,
  }));
}

test('constant 60 km/h for 60 s gives about 1 km and 60 km/h averages', () => {
  const s = summarize(drive(60, 60));
  assert.ok(Math.abs(s.distanceM - 1000) < 5, `distance ${s.distanceM}`);
  assert.ok(Math.abs(s.avgMovingKmh - 60) < 0.5, `moving avg ${s.avgMovingKmh}`);
  assert.ok(Math.abs(s.avgOverallKmh - 60) < 0.5, `overall avg ${s.avgOverallKmh}`);
  assert.equal(s.rawMaxGapS, 1);
});

test('points with poor accuracy are rejected', () => {
  const s = summarize(drive(60, 10, 40));
  assert.equal(s.acceptedPoints, 0);
  assert.equal(s.rejectedAccuracy, 11);
});

test('a teleport above 250 km/h is rejected', () => {
  const pts = drive(50, 10);
  pts[5] = { ...pts[5], lat: pts[5].lat + 0.05 };
  const s = summarize(pts);
  assert.equal(s.rejectedTeleport, 1);
});

test('stopped at a red light adds no distance and no moving time', () => {
  const pts = drive(0, 120).map((p) => ({ ...p, speed: 0 }));
  const s = summarize(pts);
  assert.equal(s.distanceM, 0);
  assert.equal(s.movingS, 0);
  assert.equal(s.elapsedS, 120);
});

test('a 30 s gap is reported as raw max gap', () => {
  const pts = drive(40, 60);
  for (let i = 30; i < pts.length; i++) pts[i] = { ...pts[i], ts: pts[i].ts + 30_000 };
  assert.equal(summarize(pts).rawMaxGapS, 31);
});
