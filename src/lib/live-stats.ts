// Incremental drive stats. One implementation of the cleaning rules, used both live
// (the HUD pushes one point at a time) and for finished drives (`summarize`).
// Pure, no React Native imports so it runs in Node tests too.
import {
  CLEANING,
  haversineMeters,
  msToKmh,
  type DriveSummary,
  type GpsPoint,
} from './geo.ts';

export interface LiveStats {
  /** Points must arrive in ascending `ts`. */
  push(p: GpsPoint): void;
  snapshot(): DriveSummary;
  /** Timestamp (ms) of the last point that passed the cleaning rules, or null. */
  lastAcceptedTs(): number | null;
}

/**
 * Rules: drop points with accuracy worse than 25 m, drop teleports that imply
 * > 250 km/h, and add no distance while stopped (< 3 km/h).
 */
export function createLiveStats(): LiveStats {
  let rawPoints = 0;
  let lastRawTs: number | null = null;
  let rawMaxGapS = 0;

  let first: GpsPoint | null = null;
  let last: GpsPoint | null = null;
  let accepted = 0;
  let rejectedAccuracy = 0;
  let rejectedTeleport = 0;
  let distanceM = 0;
  let movingS = 0;
  let ema: number | null = null;
  let maxKmh = 0;

  return {
    push(p) {
      rawPoints++;
      if (lastRawTs != null) rawMaxGapS = Math.max(rawMaxGapS, (p.ts - lastRawTs) / 1000);
      lastRawTs = p.ts;

      if (p.accuracy == null || p.accuracy > CLEANING.maxAccuracyM) {
        rejectedAccuracy++;
        return;
      }
      if (last) {
        const dt = (p.ts - last.ts) / 1000;
        if (dt <= 0) return;
        const d = haversineMeters(last, p);
        const impliedKmh = msToKmh(d / dt);
        if (impliedKmh > CLEANING.maxPlausibleKmh) {
          rejectedTeleport++;
          return;
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
    },

    lastAcceptedTs() {
      return last ? last.ts : null;
    },

    snapshot() {
      const elapsedS = first && last ? (last.ts - first.ts) / 1000 : 0;
      const km = distanceM / 1000;
      return {
        rawPoints,
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
    },
  };
}

/** Cleans raw points (any order) and computes drive stats. */
export function summarize(input: GpsPoint[]): DriveSummary {
  const stats = createLiveStats();
  for (const p of [...input].sort((a, b) => a.ts - b.ts)) stats.push(p);
  return stats.snapshot();
}
