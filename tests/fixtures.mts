// Shared sample drives for the live-stats tests (not a test file itself).
import type { GpsPoint } from '../src/lib/geo.ts';

const START_TS = 1_700_000_000_000;
const DEG_PER_METRE = 1 / 111_195;

/** One point per second heading north. `segments` is [km/h, seconds] pairs. */
export function trip(segments: [number, number][], accuracy = 5): GpsPoint[] {
  const pts: GpsPoint[] = [];
  let lat = 13.75;
  let ts = START_TS;
  pts.push({ ts, lat, lng: 100.5, speed: segments[0][0] / 3.6, accuracy, heading: 0 });
  for (const [kmh, seconds] of segments) {
    const ms = kmh / 3.6;
    for (let s = 0; s < seconds; s++) {
      ts += 1000;
      lat += ms * DEG_PER_METRE;
      pts.push({ ts, lat, lng: 100.5, speed: ms, accuracy, heading: 0 });
    }
  }
  return pts;
}

const CITY: [number, number][] = [
  [0, 10],
  [30, 40],
  [0, 20],
  [60, 60],
  [40, 30],
];

/** Stop-and-go city drive, clean GPS. */
export const cleanCity = (): GpsPoint[] => trip(CITY);

/** Same drive with some 40 m accuracy points, a null-speed point and a null-accuracy point. */
export const noisyCity = (): GpsPoint[] =>
  trip(CITY).map((p, i) => {
    if (i % 7 === 3) return { ...p, accuracy: 40 };
    if (i === 20) return { ...p, speed: null };
    if (i === 50) return { ...p, accuracy: null };
    return p;
  });

/** One teleport at point 25 and a 12 s GPS gap after point 60. */
export const teleportAndGap = (): GpsPoint[] =>
  trip([[50, 100]]).map((p, i) => {
    let q = p;
    if (i === 25) q = { ...q, lat: q.lat + 0.05 };
    if (i > 60) q = { ...q, ts: q.ts + 12_000 };
    return q;
  });
