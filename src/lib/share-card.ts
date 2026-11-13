// The picture card you can save or share (plan 3.6). Pure, no React Native imports.
// Privacy zones do not exist yet (Phase 4), so the picture hides where the drive started and finished by default:
// the first and last 300 m of the route are cut off, because those are usually home and work.
import { haversineMeters } from './geo.ts';
import type { RouteCoord } from './route-line.ts';

export const SHARE_HIDE_ENDS_M = 300;

/**
 * The route without its first and last `meters` (measured along the route). Points are kept or dropped, never moved.
 * A route shorter than twice the trim gives [], and so does one with fewer than two points left: the card then shows the
 * numbers without a route, never a route that leads straight to someone's door. A bad `meters` (NaN, negative) trims nothing.
 */
export function trimRouteEnds(coords: RouteCoord[], meters: number): RouteCoord[] {
  const trim = Number.isFinite(meters) && meters > 0 ? meters : 0;
  if (trim === 0) return coords;
  if (coords.length < 2) return [];

  // Distance along the route at every point.
  const along: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    along.push(along[i - 1] + haversineMeters({ lat: coords[i - 1][1], lng: coords[i - 1][0] }, { lat: coords[i][1], lng: coords[i][0] }));
  }
  const total = along[along.length - 1];
  if (total < 2 * trim) return [];

  const kept = coords.filter((_, i) => along[i] >= trim && total - along[i] >= trim);
  return kept.length >= 2 ? kept : [];
}
