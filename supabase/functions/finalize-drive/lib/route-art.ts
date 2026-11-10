// Turns a recorded route into drawing points for the small route pictures (history rows,
// recap). Pure, no React Native imports so it runs in Node tests too.
import type { RouteCoord } from './route-line.ts';

export interface Pt {
  x: number;
  y: number;
}

/**
 * Fits `[lng, lat]` coordinates into a `width` x `height` box with `padding` on every side.
 * Keeps the true aspect ratio (longitude is shrunk by cos(latitude)), centres the route, and
 * puts north at the top. A single point, or all-identical points, sit in the centre.
 */
export function fitRoute(coords: RouteCoord[], width: number, height: number, padding: number): Pt[] {
  if (!coords.length) return [];

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const w = (maxLng - minLng) * k;
  const h = maxLat - minLat;
  if (w === 0 && h === 0) return coords.map(() => ({ x: width / 2, y: height / 2 }));

  const availW = width - 2 * padding;
  const availH = height - 2 * padding;
  const scale = Math.min(w > 0 ? availW / w : Infinity, h > 0 ? availH / h : Infinity);
  const ox = (width - w * scale) / 2;
  const oy = (height - h * scale) / 2;

  return coords.map(([lng, lat]) => ({
    x: ox + (lng - minLng) * k * scale,
    y: oy + (maxLat - lat) * scale,
  }));
}

function perpendicularDistance(p: RouteCoord, a: RouteCoord, b: RouteCoord): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Douglas-Peucker: drops points closer than `tolerance` (in degrees) to the line they sit on. */
export function simplifyRoute(coords: RouteCoord[], tolerance: number): RouteCoord[] {
  if (coords.length <= 2) return [...coords];
  const keep = new Array<boolean>(coords.length).fill(false);
  keep[0] = true;
  keep[coords.length - 1] = true;

  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    let worst = -1;
    let worstDist = tolerance;
    for (let i = from + 1; i < to; i++) {
      const d = perpendicularDistance(coords[i], coords[from], coords[to]);
      if (d > worstDist) {
        worst = i;
        worstDist = d;
      }
    }
    if (worst !== -1) {
      keep[worst] = true;
      stack.push([from, worst], [worst, to]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

/** Simplifies until there are at most `maxPoints` points (ends are always kept). */
export function simplifyToMax(coords: RouteCoord[], maxPoints: number): RouteCoord[] {
  if (coords.length <= maxPoints) return coords;

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const diagonal = Math.hypot(maxLng - minLng, maxLat - minLat);

  let tolerance = diagonal / 2000;
  let out = simplifyRoute(coords, tolerance);
  for (let i = 0; i < 80 && out.length > maxPoints; i++) {
    tolerance *= 1.4;
    out = simplifyRoute(coords, tolerance);
  }
  return out;
}
