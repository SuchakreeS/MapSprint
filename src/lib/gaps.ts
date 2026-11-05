// GPS gap log: every stretch where no point arrived for more than 3 s, with where and when.
// Lets a tunnel or viaduct (GPS blocked) be told apart from Android throttling the app.
// Derived from the stored points, so it replays identically and needs no extra table.
// Pure, no React Native imports so it runs in Node tests too.
import type { GpsPoint } from './geo.ts';
import type { PauseEvent } from './live-stats.ts';

/** Gaps longer than this are logged (plan.md 1.10). */
export const GAP_MIN_S = 3;

export interface GpsGap {
  /** Timestamp (ms) of the last point before the gap. */
  startTs: number;
  /** Timestamp (ms) of the first point after the gap. */
  endTs: number;
  durationS: number;
  /** Position of the last point before the gap. */
  lat: number;
  lng: number;
  /** Position of the first point after the gap. */
  endLat: number;
  endLng: number;
}

/** `[pauseTs, resumeTs]` intervals; a pause never resumed runs to Infinity. */
function pauseIntervals(events: PauseEvent[]): [number, number][] {
  const intervals: [number, number][] = [];
  let open: number | null = null;
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    if (e.type === 'pause' && open == null) open = e.ts;
    else if (e.type === 'resume' && open != null) {
      intervals.push([open, e.ts]);
      open = null;
    }
  }
  if (open != null) intervals.push([open, Infinity]);
  return intervals;
}

/**
 * Gaps between consecutive points (any order in, time order out). A gap that overlaps a manual
 * pause is not a GPS problem (nothing is stored while paused) and is left out.
 */
export function findGaps(input: GpsPoint[], pauses: PauseEvent[] = [], minGapS = GAP_MIN_S): GpsGap[] {
  const points = [...input].sort((a, b) => a.ts - b.ts);
  const paused = pauseIntervals(pauses);
  const gaps: GpsGap[] = [];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const durationS = (cur.ts - prev.ts) / 1000;
    if (durationS <= minGapS) continue;
    if (paused.some(([from, to]) => from < cur.ts && to > prev.ts)) continue;
    gaps.push({
      startTs: prev.ts,
      endTs: cur.ts,
      durationS,
      lat: prev.lat,
      lng: prev.lng,
      endLat: cur.lat,
      endLng: cur.lng,
    });
  }
  return gaps;
}
