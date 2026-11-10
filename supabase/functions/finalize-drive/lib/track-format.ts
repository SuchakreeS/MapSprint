// Wire format of the raw track the phone uploads (design 2026-11-10, "Wire format v1").
// JSON, columnar (one array per field: much smaller than one object per point), then gzipped by the caller.
// Pure, no React Native imports: the same file shape is read by the finalize-drive Edge Function (2.4).
import type { GpsPoint } from './geo.ts';
import { TRAVEL_MODES, type TravelMode } from './travel-mode.ts';

export const TRACK_VERSION = 1;

/** Beyond these the drive is not counted ("too long to count"), checked on the phone and again on the server. */
export const TRACK_LIMITS = {
  maxPoints: 60_000,
  maxDurationMs: 12 * 3_600_000,
  maxBytes: 5 * 1024 * 1024,
} as const;

export interface TrackPause {
  ts: number;
  type: 'pause' | 'resume';
}

export interface TrackInput {
  startedAt: number;
  endedAt: number;
  mode: TravelMode;
  /** Auto-pause threshold used for the drive; Infinity = auto-pause was off. */
  autoPauseMs: number;
  points: GpsPoint[];
  pauses: TrackPause[];
}

export interface TrackPayload {
  v: typeof TRACK_VERSION;
  mode: TravelMode;
  startedAt: number;
  endedAt: number;
  /** null = auto-pause off. */
  autoPauseMs: number | null;
  points: {
    ts: number[];
    lat: number[];
    lng: number[];
    speed: (number | null)[];
    accuracy: (number | null)[];
    heading: (number | null)[];
  };
  pauses: TrackPause[];
}

const round = (n: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
};
const roundOrNull = (n: number | null, decimals: number) => (n == null ? null : round(n, decimals));

export function buildTrackPayload(input: TrackInput): TrackPayload {
  const points = [...input.points].sort((a, b) => a.ts - b.ts);
  return {
    v: TRACK_VERSION,
    mode: input.mode,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    autoPauseMs: Number.isFinite(input.autoPauseMs) ? input.autoPauseMs : null,
    points: {
      ts: points.map((p) => p.ts),
      lat: points.map((p) => round(p.lat, 6)), // about 0.1 m
      lng: points.map((p) => round(p.lng, 6)),
      speed: points.map((p) => roundOrNull(p.speed, 2)),
      accuracy: points.map((p) => roundOrNull(p.accuracy, 1)),
      heading: points.map((p) => roundOrNull(p.heading, 1)),
    },
    pauses: input.pauses.map((e) => ({ ts: e.ts, type: e.type })),
  };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isNumOrNull = (x: unknown): x is number | null => x === null || isNum(x);
const allOf = (arr: unknown, test: (x: unknown) => boolean): arr is unknown[] => Array.isArray(arr) && arr.every(test);

/** The payload if `json` is a well-formed version 1 track, else null. Never throws. */
export function parseTrackPayload(json: unknown): TrackPayload | null {
  if (typeof json !== 'object' || json === null) return null;
  const o = json as Record<string, unknown>;
  if (o.v !== TRACK_VERSION) return null;
  if (!(TRAVEL_MODES as readonly string[]).includes(o.mode as string)) return null;
  if (!isNum(o.startedAt) || !isNum(o.endedAt)) return null;
  if (!isNumOrNull(o.autoPauseMs)) return null;
  const p = o.points as Record<string, unknown> | undefined;
  if (typeof p !== 'object' || p === null) return null;
  // Refuse an absurd size before looping over it (a decompression bomb of tiny numbers). Up to 2x the limit still gets a proper
  // 'too_long' answer from the server.
  if (Array.isArray(p.ts) && p.ts.length > TRACK_LIMITS.maxPoints * 2) return null;
  if (!allOf(p.ts, isNum) || !allOf(p.lat, isNum) || !allOf(p.lng, isNum)) return null;
  if (!allOf(p.speed, isNumOrNull) || !allOf(p.accuracy, isNumOrNull) || !allOf(p.heading, isNumOrNull)) return null;
  const n = p.ts.length;
  if ([p.lat, p.lng, p.speed, p.accuracy, p.heading].some((a) => (a as unknown[]).length !== n)) return null;
  const pauses = o.pauses;
  if (!Array.isArray(pauses)) return null;
  for (const e of pauses) {
    if (typeof e !== 'object' || e === null) return null;
    const ev = e as Record<string, unknown>;
    if (!isNum(ev.ts) || (ev.type !== 'pause' && ev.type !== 'resume')) return null;
  }
  return json as TrackPayload;
}

export function payloadToPoints(p: TrackPayload): GpsPoint[] {
  return p.points.ts.map((ts, i) => ({
    ts,
    lat: p.points.lat[i],
    lng: p.points.lng[i],
    speed: p.points.speed[i],
    accuracy: p.points.accuracy[i],
    heading: p.points.heading[i],
  }));
}

/** 'too_long' when the drive is beyond what the server counts, else null. (The file size is checked after gzip by the caller.) */
export function trackLimitProblem(input: Pick<TrackInput, 'startedAt' | 'endedAt' | 'points'>): 'too_long' | null {
  if (input.points.length > TRACK_LIMITS.maxPoints) return 'too_long';
  if (input.endedAt - input.startedAt > TRACK_LIMITS.maxDurationMs) return 'too_long';
  return null;
}
