// Private top speed of a drive (plan 3.10). Visible ONLY to the owner (recap + History): never ranked, rewarded, shared or
// shown live. Pure, no React Native imports: the same rule runs on the phone and in the finalize-drive Edge Function
// (copied by `npm run sync:edge`).
//
// Rule: the highest speed HELD for at least 3 s, so one GPS glitch can never count.
//  - Points are cleaned like the drive stats (src/lib/live-stats.ts): accuracy worse than 25 m is dropped, and so is a
//    teleport (a jump from the last accepted point that implies more than 250 km/h).
//  - Speed is the chip's own (Doppler) speed, not the smoothed one: it is the most accurate GPS speed, and smoothing would
//    both lag a real peak and smear a glitch over several points. The 3 s window below is the spike filter.
//  - For every point, look at the shortest stretch that lasts >= 3 s starting there; that stretch's speed is its SLOWEST
//    point. Top speed = the fastest such stretch. A glitch shorter than 3 s is always beaten by a normal point in its stretch.
//  - A stretch may not cross a GPS gap over 5 s, a point without a chip speed, or a chip speed above 250 km/h: unknown speed
//    is not "held".
import { CLEANING, haversineMeters, msToKmh, type GpsPoint } from './geo.ts';

export const TOP_SPEED = {
  /** How long a speed must be held to count. */
  holdMs: 3000,
  /** A longer silence between two points breaks the stretch. */
  maxGapMs: 5000,
} as const;

interface Sample {
  ts: number;
  kmh: number;
}

/** Runs of usable speed samples; a run never crosses a gap, an unknown speed or an impossible speed. */
function usableRuns(input: GpsPoint[]): Sample[][] {
  const points = [...input].sort((a, b) => a.ts - b.ts);
  const runs: Sample[][] = [];
  let run: Sample[] = [];
  let last: GpsPoint | null = null;
  const endRun = () => {
    if (run.length > 0) runs.push(run);
    run = [];
  };
  for (const p of points) {
    if (p.accuracy == null || p.accuracy > CLEANING.maxAccuracyM) continue;
    if (last) {
      const dt = (p.ts - last.ts) / 1000;
      if (dt <= 0) continue;
      if (msToKmh(haversineMeters(last, p) / dt) > CLEANING.maxPlausibleKmh) continue; // teleport
      if (p.ts - last.ts > TOP_SPEED.maxGapMs) endRun();
    }
    last = p;
    const kmh = p.speed != null && p.speed >= 0 ? msToKmh(p.speed) : null;
    if (kmh == null || kmh > CLEANING.maxPlausibleKmh) {
      endRun();
      continue;
    }
    run.push({ ts: p.ts, kmh });
  }
  endRun();
  return runs;
}

/** Fastest speed held for >= 3 s within one run: max over windows of the window's minimum (sliding-window minimum, O(n)). */
function heldMax(s: Sample[]): number | null {
  const n = s.length;
  const dq: number[] = []; // indices with increasing speeds; the front is the window minimum
  let head = 0;
  let pushed = 0;
  let j = 0;
  let best: number | null = null;
  for (let i = 0; i < n; i++) {
    if (j < i) j = i;
    while (j < n && s[j].ts - s[i].ts < TOP_SPEED.holdMs) j++;
    if (j >= n) break; // no stretch of 3 s starts here (or later)
    while (pushed <= j) {
      while (dq.length > head && s[dq[dq.length - 1]].kmh >= s[pushed].kmh) dq.pop();
      dq.push(pushed++);
    }
    while (dq[head] < i) head++;
    const min = s[dq[head]].kmh;
    if (best == null || min > best) best = min;
  }
  return best;
}

/** The drive's top speed in km/h (rounded to 0.1), or null when no usable 3 s stretch exists. */
export function topSpeedKmh(points: GpsPoint[]): number | null {
  let best: number | null = null;
  for (const run of usableRuns(points)) {
    const v = heldMax(run);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best == null ? null : Math.round(best * 10) / 10;
}

/**
 * The top speed to show the owner. A drive the server counted shows the SERVER's value only (the source of truth; drives
 * counted before 3.10 have none and show nothing). A drive only on this phone shows the phone's value.
 */
export function shownTopKmh(input: {
  counted: boolean;
  serverTopKmh: number | null | undefined;
  localTopKmh: number | null;
}): number | null {
  if (input.counted) {
    return typeof input.serverTopKmh === 'number' && Number.isFinite(input.serverTopKmh) ? input.serverTopKmh : null;
  }
  return input.localTopKmh;
}
