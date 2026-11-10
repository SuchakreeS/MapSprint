// The server-side rules of finalize-drive (2.4), pure part. Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cleanRoute,
  finalizeTrack,
  parseZoneCenter,
  routeToEwkt,
  simplifyMeters,
  trimToPrivacyZones,
  TIMES_TOLERANCE_MS,
  type Zone,
} from '../src/lib/finalize.ts';
import { haversineMeters, type GpsPoint } from '../src/lib/geo.ts';
import { buildTrackPayload, TRACK_LIMITS, type TrackPayload } from '../src/lib/track-format.ts';

const LAT0 = 13.75;
const LNG0 = 100.5;
const M_PER_DEG_LAT = 111_195;
const T0 = Date.UTC(2026, 10, 10, 1, 0, 0);

/** A straight drive north at `speedMs`, one point a second, starting at (LAT0, LNG0). */
function straightDrive(seconds: number, speedMs = 10, over: Partial<GpsPoint> = {}): GpsPoint[] {
  return Array.from({ length: seconds + 1 }, (_, i) => ({
    ts: T0 + i * 1000,
    lat: LAT0 + (i * speedMs) / M_PER_DEG_LAT,
    lng: LNG0,
    speed: speedMs,
    accuracy: 5,
    heading: 0,
    ...over,
  }));
}

const payloadOf = (points: GpsPoint[], over: Partial<Parameters<typeof buildTrackPayload>[0]> = {}): TrackPayload =>
  JSON.parse(
    JSON.stringify(
      buildTrackPayload({
        startedAt: points[0]?.ts ?? T0,
        endedAt: points[points.length - 1]?.ts ?? T0,
        mode: 'car',
        autoPauseMs: 300_000,
        points,
        pauses: [],
        ...over,
      }),
    ),
  );

const rowOf = (points: GpsPoint[]) => ({ startedAtMs: points[0].ts, endedAtMs: points[points.length - 1].ts });

// ---------------------------------------------------------------- zone centres from the database
test('parseZoneCenter reads GeoJSON and EWKB hex (PostgREST may send either), refuses anything else', () => {
  assert.deepEqual(parseZoneCenter({ type: 'Point', coordinates: [100.5, 13.75] }), { lng: 100.5, lat: 13.75 });
  // SRID=4326;POINT(100.5 13.75) as little-endian EWKB hex: byte order, type (point + SRID flag), SRID, x, y
  const ewkb = Buffer.alloc(25);
  ewkb.writeUInt8(1, 0);
  ewkb.writeUInt32LE(0x20000001, 1);
  ewkb.writeUInt32LE(4326, 5);
  ewkb.writeDoubleLE(100.5, 9);
  ewkb.writeDoubleLE(13.75, 17);
  assert.deepEqual(parseZoneCenter(ewkb.toString('hex')), { lng: 100.5, lat: 13.75 });
  assert.equal(parseZoneCenter('not a point'), null);
  assert.equal(parseZoneCenter(null), null);
  assert.equal(parseZoneCenter({ type: 'Point', coordinates: [200, 13.75] }), null); // longitude out of range
  assert.equal(parseZoneCenter({ type: 'LineString', coordinates: [[0, 0]] }), null);
});

// ---------------------------------------------------------------- privacy zone trimming
const HOME: Zone = { lat: LAT0, lng: LNG0, radiusM: 300 };
const line = (n: number, stepM: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => [LNG0, LAT0 + (i * stepM) / M_PER_DEG_LAT] as [number, number]);

test('trimToPrivacyZones hides the start inside a zone: the first kept point is the first one outside', () => {
  const coords = line(100, 10); // 0..990 m north of home, 10 m apart
  const out = trimToPrivacyZones(coords, [HOME]);
  assert.ok(haversineMeters({ lat: out[0][1], lng: out[0][0] }, { lat: LAT0, lng: LNG0 }) > 300);
  assert.equal(out.length, 100 - 31); // points 0..30 (0..300 m) are inside or on the edge
  assert.deepEqual(out[out.length - 1], coords[99]);
});

test('trimToPrivacyZones hides the end too, and a pass through a zone in the middle is not cut', () => {
  const there = line(100, 10);
  const back = [...there].reverse();
  const roundTrip = [...there, ...back]; // leaves home, turns, returns home
  const out = trimToPrivacyZones(roundTrip, [HOME]);
  assert.ok(out.length < roundTrip.length);
  for (const end of [out[0], out[out.length - 1]]) {
    assert.ok(haversineMeters({ lat: end[1], lng: end[0] }, { lat: LAT0, lng: LNG0 }) > 300);
  }
  // A zone in the middle of the drive (not at either end) cuts nothing.
  const mid: Zone = { lat: LAT0 + 500 / M_PER_DEG_LAT, lng: LNG0, radiusM: 100 };
  assert.equal(trimToPrivacyZones(there, [mid]).length, there.length);
});

test('trimToPrivacyZones: no zones changes nothing; a drive entirely inside a zone leaves nothing', () => {
  const coords = line(20, 10);
  assert.deepEqual(trimToPrivacyZones(coords, []), coords);
  assert.deepEqual(trimToPrivacyZones(coords, [HOME]), []);
});

test('trimToPrivacyZones uses every zone (home and work)', () => {
  const work: Zone = { lat: LAT0 + 990 / M_PER_DEG_LAT, lng: LNG0, radiusM: 200 };
  const out = trimToPrivacyZones(line(100, 10), [HOME, work]);
  const first = out[0];
  const last = out[out.length - 1];
  assert.ok(haversineMeters({ lat: first[1], lng: first[0] }, HOME) > 300);
  assert.ok(haversineMeters({ lat: last[1], lng: last[0] }, work) > 200);
});

// ---------------------------------------------------------------- route cleaning and simplification
test('cleanRoute drops poor-accuracy points and teleports, keeps the rest in time order', () => {
  const pts = straightDrive(20);
  pts[5] = { ...pts[5], accuracy: 80 };
  pts[10] = { ...pts[10], lat: LAT0 + 0.5 }; // 55 km away one second later = teleport
  const out = cleanRoute(pts);
  assert.ok(out.length > 5);
  assert.ok(out.every(([, lat]) => Math.abs(lat - LAT0) < 0.01), 'the teleported point is gone');
  assert.equal(cleanRoute([...pts].reverse()).length, out.length, 'input order does not matter');
});

test('simplifyMeters: a straight line becomes two points, a 3 m wobble is dropped, an 8 m bend is kept (5 m tolerance)', () => {
  const straight = line(200, 5);
  assert.equal(simplifyMeters(straight, 5).length, 2);
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180);
  const wobble3 = line(21, 5).map(([lng, lat], i) => [i === 10 ? lng + 3 / mPerDegLng : lng, lat] as [number, number]);
  assert.equal(simplifyMeters(wobble3, 5).length, 2);
  const bend8 = line(21, 5).map(([lng, lat], i) => [i === 10 ? lng + 8 / mPerDegLng : lng, lat] as [number, number]);
  const kept = simplifyMeters(bend8, 5);
  assert.ok(kept.length > 2, 'a real bend is not flattened');
  assert.ok(kept.some((c) => c === bend8[10]), 'the bend itself is kept');
  assert.deepEqual(kept[0], bend8[0]); // ends are the original coordinates
  assert.deepEqual(kept[kept.length - 1], bend8[20]);
});

test('routeToEwkt writes a PostGIS line, and nothing for fewer than two points', () => {
  assert.equal(routeToEwkt([[100.5, 13.75]]), null);
  assert.equal(routeToEwkt([]), null);
  assert.equal(routeToEwkt([[100.5, 13.75], [100.51, 13.76]]), 'SRID=4326;LINESTRING(100.5 13.75,100.51 13.76)');
});

// ---------------------------------------------------------------- the whole decision
test('a normal drive is counted with plausible numbers and a simplified route', () => {
  const pts = straightDrive(600); // 10 min at 36 km/h = 6 km
  const out = finalizeTrack(payloadOf(pts), rowOf(pts), []);
  assert.equal(out.kind, 'ok');
  if (out.kind !== 'ok') return;
  assert.ok(Math.abs(out.stats.distanceM - 6000) < 60, `distance ${out.stats.distanceM}`);
  assert.ok(Math.abs(out.stats.elapsedS - 600) <= 2);
  assert.ok(out.stats.movingS > 590);
  assert.ok(Math.abs(out.stats.avgMovingKmh - 36) < 1);
  assert.equal(out.rawPoints, 601);
  assert.equal(out.startMs, T0);
  assert.equal(out.endMs, T0 + 600_000);
  assert.ok(out.routeEwkt?.startsWith('SRID=4326;LINESTRING('));
  assert.equal(out.flags.routePoints, 2); // a straight line simplifies to its two ends
});

test('stats use the WHOLE track even when the route is trimmed at home', () => {
  const pts = straightDrive(600);
  const trimmed = finalizeTrack(payloadOf(pts), rowOf(pts), [HOME]);
  const full = finalizeTrack(payloadOf(pts), rowOf(pts), []);
  assert.equal(trimmed.kind, 'ok');
  assert.equal(full.kind, 'ok');
  if (trimmed.kind !== 'ok' || full.kind !== 'ok') return;
  assert.equal(trimmed.stats.distanceM, full.stats.distanceM);
  assert.notEqual(trimmed.routeEwkt, full.routeEwkt);
  assert.ok(Number(trimmed.flags.trimmedStartPoints) > 0);
});

test('a drive entirely inside a privacy zone is still counted, with no public route', () => {
  const pts = straightDrive(60, 3); // 180 m, all within 300 m of home
  const out = finalizeTrack(payloadOf(pts), rowOf(pts), [HOME]);
  assert.equal(out.kind, 'ok');
  if (out.kind !== 'ok') return;
  assert.equal(out.routeEwkt, null);
});

test('start and end times that do not match the track are rejected', () => {
  const pts = straightDrive(600);
  const row = rowOf(pts);
  assert.deepEqual(finalizeTrack(payloadOf(pts), { ...row, startedAtMs: row.startedAtMs - TIMES_TOLERANCE_MS - 1000 }, []), {
    kind: 'rejected',
    reason: 'times_mismatch',
  });
  assert.deepEqual(finalizeTrack(payloadOf(pts), { ...row, endedAtMs: row.endedAtMs + TIMES_TOLERANCE_MS + 1000 }, []), {
    kind: 'rejected',
    reason: 'times_mismatch',
  });
  // within the tolerance is fine
  assert.equal(finalizeTrack(payloadOf(pts), { ...row, endedAtMs: row.endedAtMs + 60_000 }, []).kind, 'ok');
});

test('an unreadable row time (NaN) is a mismatch, never a free pass', () => {
  const pts = straightDrive(600);
  assert.deepEqual(finalizeTrack(payloadOf(pts), { startedAtMs: NaN, endedAtMs: pts[600].ts }, []), {
    kind: 'rejected',
    reason: 'times_mismatch',
  });
  assert.deepEqual(finalizeTrack(payloadOf(pts), { startedAtMs: pts[0].ts, endedAtMs: Infinity }, []), {
    kind: 'rejected',
    reason: 'times_mismatch',
  });
});

test('too few good points, or poor accuracy throughout, is rejected', () => {
  const two = straightDrive(1);
  assert.equal(finalizeTrack(payloadOf(two), rowOf(two), []).kind, 'ok'); // 2 good points are enough to count
  const one = straightDrive(0);
  assert.deepEqual(finalizeTrack(payloadOf(one), rowOf(one), []), { kind: 'rejected', reason: 'too_few_points' });
  const bad = straightDrive(100, 10, { accuracy: 90 });
  assert.deepEqual(finalizeTrack(payloadOf(bad), rowOf(bad), []), { kind: 'rejected', reason: 'too_few_points' });
});

test('limits: more than 60 000 points or more than 12 hours is rejected as too long', () => {
  const many = straightDrive(TRACK_LIMITS.maxPoints + 5, 1);
  assert.deepEqual(finalizeTrack(payloadOf(many), rowOf(many), []), { kind: 'rejected', reason: 'too_long' });
  const long = [straightDrive(1)[0], { ...straightDrive(1)[1], ts: T0 + TRACK_LIMITS.maxDurationMs + 1000 }];
  assert.deepEqual(finalizeTrack(payloadOf(long), rowOf(long), []), { kind: 'rejected', reason: 'too_long' });
});

test('impossible coordinates make the track unreadable', () => {
  const pts = straightDrive(60);
  pts[3] = { ...pts[3], lat: 95 };
  assert.deepEqual(finalizeTrack(payloadOf(pts), rowOf(pts), []), { kind: 'rejected', reason: 'unreadable' });
  const pts2 = straightDrive(60);
  pts2[3] = { ...pts2[3], lng: -181 };
  assert.deepEqual(finalizeTrack(payloadOf(pts2), rowOf(pts2), []), { kind: 'rejected', reason: 'unreadable' });
});

test('a teleport is dropped from the stats and counted in the flags, the drive still counts', () => {
  const pts = straightDrive(600);
  pts[300] = { ...pts[300], lat: LAT0 + 0.9 }; // 100 km away for one second
  const out = finalizeTrack(payloadOf(pts), rowOf(pts), []);
  assert.equal(out.kind, 'ok');
  if (out.kind !== 'ok') return;
  assert.ok(out.stats.distanceM < 6200, `teleport must not add distance (${out.stats.distanceM})`);
  assert.ok(Number(out.flags.rejectedTeleport) >= 1);
});

test('the auto-pause value from the phone is only trusted when it is one of the choices', () => {
  const pts = straightDrive(600);
  const weird = finalizeTrack(payloadOf(pts, { autoPauseMs: 1 }), rowOf(pts), []);
  const normal = finalizeTrack(payloadOf(pts, { autoPauseMs: 300_000 }), rowOf(pts), []);
  assert.equal(weird.kind, 'ok');
  assert.equal(normal.kind, 'ok');
  if (weird.kind !== 'ok' || normal.kind !== 'ok') return;
  assert.equal(weird.stats.movingS, normal.stats.movingS); // 1 ms would pause on every point, so it falls back to 5 min
});

test('flags carry only counters and booleans (they are stored as JSON next to the drive)', () => {
  const pts = straightDrive(120);
  const out = finalizeTrack(payloadOf(pts), rowOf(pts), []);
  assert.equal(out.kind, 'ok');
  if (out.kind !== 'ok') return;
  for (const v of Object.values(out.flags)) assert.ok(typeof v === 'number' || typeof v === 'boolean');
});
