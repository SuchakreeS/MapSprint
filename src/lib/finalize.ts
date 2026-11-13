// The server-side decisions of finalize-drive (2.4): validate the uploaded track, clean it, recompute the stats with the SAME
// rules as the phone, hide the start/end of the public route inside privacy zones, simplify the route.
// Pure, no React Native or Deno imports: it runs in Node tests, and a copy of this file (kept identical by
// scripts/sync-edge-lib.mjs + tests/edge-lib-sync.test.mts) runs inside the Edge Function.
// Never trust the phone: every number that counts is computed here from the raw points.
import { CELLS, driveCells } from './cells.ts';
import { CLEANING, haversineMeters, msToKmh, type GpsPoint } from './geo.ts';
import { summarize } from './live-stats.ts';
import { simplifyRoute } from './route-art.ts';
import type { RouteCoord } from './route-line.ts';
import { topSpeedKmh } from './top-speed.ts';
import { payloadToPoints, TRACK_LIMITS, type TrackPayload } from './track-format.ts';
import type { ServerStats } from './upload-queue.ts';
import { fingerprintInput } from './xp.ts';

/** Why a drive is not counted. Keys match REJECT_TEXT in upload-queue.ts (what the app shows). */
export type RejectReason =
  | 'overlap'
  | 'times_mismatch'
  | 'unreadable'
  | 'too_long'
  | 'too_few_points'
  | 'invalid'
  /** The same route was already counted for this account (plan 3.1 gate a: no XP farming by delete + upload again). */
  | 'duplicate';

/** The row's start/end may differ from the track's first/last point by at most this much. */
export const TIMES_TOLERANCE_MS = 120_000;
/** Auto-pause choices the app offers (Settings > Recording); anything else from the phone is ignored. */
const AUTO_PAUSE_CHOICES_MS = [120_000, 300_000, 600_000];
const DEFAULT_AUTO_PAUSE_MS = 300_000;
const ROUTE_TOLERANCE_M = 5;
/** Douglas-Peucker is quadratic in the worst case: above this many route points the line is thinned first (bounded work). */
const MAX_DP_POINTS = 8000;
/** No drive can start before the app existed (poison dates would also make the server write fail and the phone retry forever). */
export const MIN_VALID_TS = Date.UTC(2024, 0, 1);
/** A little clock drift is fine; more means a made-up date. */
export const MAX_FUTURE_MS = 5 * 60_000;
const ROUTE_MIN_STEP_M = 5;

export interface Zone {
  lat: number;
  lng: number;
  radiusM: number;
}

export interface RowTimes {
  startedAtMs: number;
  endedAtMs: number;
}

export type FinalizeOutcome =
  | { kind: 'rejected'; reason: RejectReason }
  | {
      kind: 'ok';
      /** Rounded exactly as stored in `drives` and as returned to the app. */
      stats: ServerStats;
      /** Top speed held for >= 3 s (plan 3.10), or null. Owner-only (drive_private.top_kmh): never ranked, rewarded or shared. */
      topKmh: number | null;
      /** H3 res-9 cells explored (plan 3.3), sorted and unique. NOT trimmed by privacy zones: owner-only (explored_cells). */
      cells: string[];
      rawPoints: number;
      /** First / last point time: written to drives.started_at / ended_at. */
      startMs: number;
      endMs: number;
      /** EWKT LineString of the trimmed, simplified route, or null when nothing public is left. */
      routeEwkt: string | null;
      /**
       * Text to hash (SHA-256 in the Edge Function) for the duplicate check: the WHOLE cleaned route (not zone-trimmed), rounded,
       * without times (xp.ts fingerprintInput). Null for a route too short to be a fingerprint. Never stored as text.
       */
      fingerprint: string | null;
      /** Counters and booleans only: stored as JSON in drive_private.flags (owner-only). */
      flags: Record<string, number | boolean>;
    };

const rejected = (reason: RejectReason): FinalizeOutcome => ({ kind: 'rejected', reason });
const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};
const validLat = (n: number) => n >= -90 && n <= 90;
const validLng = (n: number) => n >= -180 && n <= 180;

// ---------------------------------------------------------------- privacy zones

/**
 * A zone centre as PostgREST returns a `geography(Point)`: GeoJSON, or EWKB hex. Anything else is null (the caller must then
 * FAIL, never skip the zone: publishing an untrimmed route would leak a home address).
 */
export function parseZoneCenter(raw: unknown): { lat: number; lng: number } | null {
  if (typeof raw === 'object' && raw !== null) {
    const g = raw as { type?: unknown; coordinates?: unknown };
    if (g.type !== 'Point' || !Array.isArray(g.coordinates) || g.coordinates.length < 2) return null;
    const [lng, lat] = g.coordinates as unknown[];
    return typeof lng === 'number' && typeof lat === 'number' && validLng(lng) && validLat(lat) ? { lat, lng } : null;
  }
  if (typeof raw !== 'string' || !/^([0-9a-fA-F]{2})+$/.test(raw)) return null;
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  const view = new DataView(bytes.buffer);
  if (bytes.length < 21) return null;
  const little = bytes[0] === 1;
  const type = view.getUint32(1, little);
  const hasSrid = (type & 0x20000000) !== 0;
  if ((type & 0xffff) !== 1 || (type & 0xc0000000) !== 0) return null; // a plain 2D point only
  const at = hasSrid ? 9 : 5;
  if (bytes.length < at + 16) return null;
  const lng = view.getFloat64(at, little);
  const lat = view.getFloat64(at + 8, little);
  return Number.isFinite(lng) && Number.isFinite(lat) && validLng(lng) && validLat(lat) ? { lat, lng } : null;
}

const insideAny = (c: RouteCoord, zones: Zone[]) =>
  zones.some((z) => haversineMeters({ lat: c[1], lng: c[0] }, z) <= z.radiusM);

/** Indices [start, end] to keep (inclusive); start > end means nothing is left. */
function trimRange(coords: RouteCoord[], zones: Zone[]): { start: number; end: number } {
  if (zones.length === 0) return { start: 0, end: coords.length - 1 };
  let start = 0;
  while (start < coords.length && insideAny(coords[start], zones)) start++;
  let end = coords.length - 1;
  while (end >= start && insideAny(coords[end], zones)) end--;
  return { start, end };
}

/**
 * Hides where the drive starts and ends: drops the leading run of points inside a zone and the trailing run.
 * A pass through a zone in the middle is not cut (a line cannot have holes).
 */
export function trimToPrivacyZones(coords: RouteCoord[], zones: Zone[]): RouteCoord[] {
  const { start, end } = trimRange(coords, zones);
  return start > end ? [] : coords.slice(start, end + 1);
}

// ---------------------------------------------------------------- route

/** Points for the public route: accurate enough, no teleports, at least 5 m apart. `[lng, lat]`, in time order. */
export function cleanRoute(input: GpsPoint[]): RouteCoord[] {
  const points = [...input].sort((a, b) => a.ts - b.ts);
  const out: RouteCoord[] = [];
  let last: GpsPoint | null = null;
  for (const p of points) {
    if (p.accuracy == null || p.accuracy > CLEANING.maxAccuracyM) continue;
    if (last) {
      const dt = (p.ts - last.ts) / 1000;
      if (dt <= 0) continue;
      const d = haversineMeters(last, p);
      if (msToKmh(d / dt) > CLEANING.maxPlausibleKmh) continue;
      if (d < ROUTE_MIN_STEP_M) continue;
    }
    out.push([p.lng, p.lat]);
    last = p;
  }
  return out;
}

/** Douglas-Peucker with the tolerance in metres (the coordinates are projected to a local flat map first). */
export function simplifyMeters(coords: RouteCoord[], toleranceM: number): RouteCoord[] {
  if (coords.length <= 2) return [...coords];
  if (coords.length > MAX_DP_POINTS) {
    const stride = Math.ceil(coords.length / MAX_DP_POINTS);
    const last = coords.length - 1;
    coords = coords.filter((_, i) => i % stride === 0 || i === last);
  }
  const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const lng0 = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const mPerDegLat = 111_195;
  const mPerDegLng = mPerDegLat * Math.cos((lat0 * Math.PI) / 180);
  const original = new Map<RouteCoord, RouteCoord>();
  const flat = coords.map((c): RouteCoord => {
    const p: RouteCoord = [(c[0] - lng0) * mPerDegLng, (c[1] - lat0) * mPerDegLat];
    original.set(p, c);
    return p;
  });
  return simplifyRoute(flat, toleranceM).map((p) => original.get(p) as RouteCoord);
}

const num = (n: number) => String(round(n, 6));

/** PostGIS EWKT for `drives.route`, or null with fewer than two points (a line needs two). */
export function routeToEwkt(coords: RouteCoord[]): string | null {
  if (coords.length < 2) return null;
  return `SRID=4326;LINESTRING(${coords.map(([lng, lat]) => `${num(lng)} ${num(lat)}`).join(',')})`;
}

// ---------------------------------------------------------------- the decision

/**
 * Everything finalize-drive decides from the uploaded track. Overlap with other drives needs the database: the caller checks it
 * with the returned start/end (and the DB exclusion constraint backs it up).
 */
export function finalizeTrack(payload: TrackPayload, row: RowTimes, zones: Zone[], nowMs: number = Date.now()): FinalizeOutcome {
  const n = payload.points.ts.length;
  if (n > TRACK_LIMITS.maxPoints) return rejected('too_long'); // before any heavy work
  for (let i = 0; i < n; i++) {
    if (!validLat(payload.points.lat[i]) || !validLng(payload.points.lng[i]) || !(payload.points.ts[i] > 0)) {
      return rejected('unreadable');
    }
  }
  if (n < 2) return rejected('too_few_points');

  let startMs = Infinity;
  let endMs = -Infinity;
  for (const ts of payload.points.ts) {
    if (ts < startMs) startMs = ts;
    if (ts > endMs) endMs = ts;
  }
  if (startMs < MIN_VALID_TS || endMs > nowMs + MAX_FUTURE_MS) return rejected('invalid');
  if (endMs - startMs > TRACK_LIMITS.maxDurationMs) return rejected('too_long');
  if (endMs <= startMs) return rejected('too_few_points');
  // NaN compares false with everything, so an unreadable row time must be refused explicitly, not slip through the check.
  if (!Number.isFinite(row.startedAtMs) || !Number.isFinite(row.endedAtMs)) return rejected('times_mismatch');
  if (Math.abs(row.startedAtMs - startMs) > TIMES_TOLERANCE_MS || Math.abs(row.endedAtMs - endMs) > TIMES_TOLERANCE_MS) {
    return rejected('times_mismatch');
  }

  const points = payloadToPoints(payload);
  const autoPauseMs =
    payload.autoPauseMs == null
      ? Infinity // the driver turned auto-pause off
      : AUTO_PAUSE_CHOICES_MS.includes(payload.autoPauseMs)
        ? payload.autoPauseMs
        : DEFAULT_AUTO_PAUSE_MS;
  // Pause events from the phone are only believed inside the track: a made-up pause far outside it would inflate the time.
  const pauses = payload.pauses.filter((e) => e.ts >= startMs && e.ts <= endMs);
  const s = summarize(points, pauses, autoPauseMs);
  const durationS = Math.round((endMs - startMs) / 1000);
  if (s.acceptedPoints < 2) return rejected('too_few_points');

  const cells = driveCells(points);
  if (cells.length > CELLS.maxCellsPerDrive) return rejected('too_long');

  const clean = cleanRoute(points);
  const { start, end } = trimRange(clean, zones);
  const trimmed = start > end ? [] : clean.slice(start, end + 1);
  const route = simplifyMeters(trimmed, ROUTE_TOLERANCE_M);

  return {
    kind: 'ok',
    stats: {
      distanceM: round(s.distanceM, 1),
      movingS: Math.min(Math.round(s.movingS), durationS), // time can never exceed the track's own length
      elapsedS: Math.min(Math.round(s.elapsedS), durationS),
      avgMovingKmh: round(s.avgMovingKmh, 2),
      avgOverallKmh: round(s.avgOverallKmh, 2),
    },
    topKmh: topSpeedKmh(points),
    cells,
    rawPoints: s.rawPoints,
    startMs,
    endMs,
    routeEwkt: routeToEwkt(route),
    fingerprint: fingerprintInput(clean),
    flags: {
      rawPoints: s.rawPoints,
      acceptedPoints: s.acceptedPoints,
      rejectedAccuracy: s.rejectedAccuracy,
      rejectedTeleport: s.rejectedTeleport,
      rawMaxGapS: round(s.rawMaxGapS, 1),
      maxKmhOver250: s.maxKmh > CLEANING.maxPlausibleKmh,
      routePointsBeforeTrim: clean.length,
      trimmedStartPoints: start > end ? clean.length : start,
      trimmedEndPoints: start > end ? 0 : clean.length - 1 - end,
      routePoints: route.length,
    },
  };
}
