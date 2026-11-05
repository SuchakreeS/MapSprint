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

/** Stopped (under 3 km/h) for this long and the drive auto-pauses. */
export const AUTO_PAUSE_MS = 300_000;

export interface PauseEvent {
  ts: number;
  type: 'pause' | 'resume';
}

export interface PauseState {
  kind: 'manual' | 'auto';
  /** Manual: when Pause was pressed. Auto: when the stop began (idle time is not counted). */
  since: number;
}

export interface LiveStats {
  /** Points must arrive in ascending `ts`. */
  push(p: GpsPoint): void;
  snapshot(): DriveSummary;
  /** Timestamp (ms) of the last point that passed the cleaning rules, or null. */
  lastAcceptedTs(): number | null;
  /** Manual pause. Points pushed while manually paused are counted as raw but otherwise ignored. */
  pause(ts: number): void;
  /** Manual resume (also ends an auto-pause). The next accepted point is a fresh baseline. */
  resume(ts: number): void;
  pauseState(): PauseState | null;
  /** Active drive time in seconds as of `nowMs`: runs on while GPS is quiet, frozen while paused. */
  elapsedAt(nowMs: number): number;
}

/**
 * Rules: drop points with accuracy worse than 25 m, drop teleports that imply
 * > 250 km/h, and add no distance while stopped (< 3 km/h). Stopped for `autoPauseMs`
 * pauses the drive (idle time not counted) until the first moving point.
 */
export function createLiveStats(options: { autoPauseMs?: number } = {}): LiveStats {
  const autoPauseMs = options.autoPauseMs ?? AUTO_PAUSE_MS;

  let rawPoints = 0;
  let lastRawTs: number | null = null;
  let prevRaw: GpsPoint | null = null;
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

  let activeMs = 0;
  let lastMovingTs: number | null = null;
  let paused: PauseState | null = null;
  /** True after a resume: the next accepted point is a baseline, no distance or time across the gap. */
  let rebase = false;
  /** Time that running time is measured from: last accepted point, or the resume time. */
  let anchorTs: number | null = null;

  return {
    push(p) {
      rawPoints++;
      if (lastRawTs != null) rawMaxGapS = Math.max(rawMaxGapS, (p.ts - lastRawTs) / 1000);
      lastRawTs = p.ts;
      const prev = prevRaw;
      prevRaw = p;

      if (paused?.kind === 'manual') return;

      if (p.accuracy == null || p.accuracy > CLEANING.maxAccuracyM) {
        rejectedAccuracy++;
        return;
      }

      if (paused?.kind === 'auto') {
        // Stay paused until the car moves again.
        const kmh =
          p.speed != null && p.speed >= 0
            ? msToKmh(p.speed)
            : prev && p.ts > prev.ts
              ? msToKmh(haversineMeters(prev, p) / ((p.ts - prev.ts) / 1000))
              : 0;
        if (kmh < CLEANING.stoppedBelowKmh) return;
        paused = null;
        rebase = true;
      }

      if (last && !rebase) {
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
          lastMovingTs = p.ts;
        }
        activeMs += dt * 1000;
        ema = ema == null ? kmh : CLEANING.emaAlpha * kmh + (1 - CLEANING.emaAlpha) * ema;
        maxKmh = Math.max(maxKmh, ema);
      } else {
        if (!first) first = p;
        rebase = false;
        const kmh = p.speed != null && p.speed >= 0 ? msToKmh(p.speed) : 0;
        ema = kmh;
        lastMovingTs = p.ts;
      }
      last = p;
      anchorTs = p.ts;
      accepted++;

      if (lastMovingTs != null && p.ts - lastMovingTs >= autoPauseMs) {
        activeMs -= p.ts - lastMovingTs; // the idle stretch was added point by point; take it back
        paused = { kind: 'auto', since: lastMovingTs };
      }
    },

    pause(ts) {
      if (paused) {
        if (paused.kind === 'auto') paused = { kind: 'manual', since: paused.since };
        return;
      }
      if (anchorTs != null) activeMs += Math.max(0, ts - anchorTs);
      paused = { kind: 'manual', since: ts };
    },

    resume(ts) {
      if (!paused) return;
      paused = null;
      rebase = true;
      lastMovingTs = ts;
      anchorTs = ts;
      lastRawTs = null; // the quiet stretch of a manual pause is not a GPS gap
    },

    pauseState() {
      return paused ? { ...paused } : null;
    },

    elapsedAt(nowMs) {
      if (paused || anchorTs == null) return activeMs / 1000;
      return (activeMs + Math.max(0, nowMs - anchorTs)) / 1000;
    },

    lastAcceptedTs() {
      return last ? last.ts : null;
    },

    snapshot() {
      const elapsedS = activeMs / 1000;
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

/**
 * Cleans raw points (any order) and computes drive stats. Manual pause/resume events are
 * merged in by time (an event goes before a point with the same timestamp).
 */
export function summarize(input: GpsPoint[], pauses: PauseEvent[] = []): DriveSummary {
  const stats = createLiveStats();
  const points = [...input].sort((a, b) => a.ts - b.ts);
  const events = [...pauses].sort((a, b) => a.ts - b.ts);
  let e = 0;
  for (const p of points) {
    while (e < events.length && events[e].ts <= p.ts) applyEvent(stats, events[e++]);
    stats.push(p);
  }
  while (e < events.length) applyEvent(stats, events[e++]);
  return stats.snapshot();
}

export function applyEvent(stats: LiveStats, ev: PauseEvent): void {
  if (ev.type === 'pause') stats.pause(ev.ts);
  else stats.resume(ev.ts);
}
