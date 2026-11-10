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
