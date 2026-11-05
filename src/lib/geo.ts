// Pure GPS maths. No React Native imports here so it runs in Node tests too.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GpsPoint extends LatLng {
  /** Unix time in ms */
  ts: number;
  /** Metres per second from the GPS chip, or null if unknown */
  speed: number | null;
  /** Horizontal accuracy radius in metres, or null if unknown */
  accuracy: number | null;
  heading: number | null;
}

/** Tunable cleaning rules (see plan: Speed & GPS tracking). */
export const CLEANING = {
  maxAccuracyM: 25,
  maxPlausibleKmh: 250,
  stoppedBelowKmh: 3,
  emaAlpha: 0.3,
} as const;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export const msToKmh = (ms: number) => ms * 3.6;

/** Great-circle distance between two points in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface DriveSummary {
  rawPoints: number;
  acceptedPoints: number;
  rejectedAccuracy: number;
  rejectedTeleport: number;
  distanceM: number;
  movingS: number;
  elapsedS: number;
  avgMovingKmh: number;
  avgOverallKmh: number;
  maxKmh: number;
  lastKmh: number | null;
  /** Largest time gap between any two raw points. Big gaps mean Android throttled us. */
  rawMaxGapS: number;
}

/**
 * Cleans raw points and computes drive stats.
 * Rules: drop points with accuracy worse than 25 m, drop teleports that imply
 * > 250 km/h, and add no distance while stopped (< 3 km/h).
 */
export function summarize(input: GpsPoint[]): DriveSummary {
  const points = [...input].sort((a, b) => a.ts - b.ts);
  let rawMaxGapS = 0;
  for (let i = 1; i < points.length; i++) {
    rawMaxGapS = Math.max(rawMaxGapS, (points[i].ts - points[i - 1].ts) / 1000);
  }

  let last: GpsPoint | null = null;
  let first: GpsPoint | null = null;
  let accepted = 0;
  let rejectedAccuracy = 0;
  let rejectedTeleport = 0;
  let distanceM = 0;
  let movingS = 0;
  let ema: number | null = null;
  let maxKmh = 0;

  for (const p of points) {
    if (p.accuracy == null || p.accuracy > CLEANING.maxAccuracyM) {
      rejectedAccuracy++;
      continue;
    }
    if (last) {
      const dt = (p.ts - last.ts) / 1000;
      if (dt <= 0) continue;
      const d = haversineMeters(last, p);
      const impliedKmh = msToKmh(d / dt);
      if (impliedKmh > CLEANING.maxPlausibleKmh) {
        rejectedTeleport++;
        continue;
      }
      const kmh = p.speed != null && p.speed >= 0 ? msToKmh(p.speed) : impliedKmh;
      if (kmh >= CLEANING.stoppedBelowKmh) {
        distanceM += d;
        movingS += dt;
      }
      ema = ema == null ? kmh : CLEANING.emaAlpha * kmh + (1 - CLEANING.emaAlpha) * ema;
      maxKmh = Math.max(maxKmh, ema);
    } else {
      first = p;
      const kmh = p.speed != null && p.speed >= 0 ? msToKmh(p.speed) : 0;
      ema = kmh;
    }
    last = p;
    accepted++;
  }

  const elapsedS = first && last ? (last.ts - first.ts) / 1000 : 0;
  const km = distanceM / 1000;
  return {
    rawPoints: points.length,
    acceptedPoints: accepted,
    rejectedAccuracy,
    rejectedTeleport,
    distanceM,
    movingS,
    elapsedS,
    avgMovingKmh: movingS > 0 ? km / (movingS / 3600) : 0,
    avgOverallKmh: elapsedS > 0 ? km / (elapsedS / 3600) : 0,
    maxKmh,
    lastKmh: ema,
    rawMaxGapS,
  };
}
