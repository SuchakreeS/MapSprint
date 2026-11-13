// The picture card you can save or share (plan 3.6). Pure, no React Native imports.
// Privacy zones do not exist yet (Phase 4), so the picture hides where the drive started and finished by default:
// nothing within 300 m of the start or the finish is drawn, because those are usually home and work.
import { haversineMeters } from './geo.ts';
import type { RouteCoord } from './route-line.ts';

export const SHARE_HIDE_ENDS_M = 300;

/**
 * The route without its start and finish: a point is kept only when it is at least `meters` from the start AND from the finish,
 * both along the route and in a straight line. The straight-line rule matters: GPS jitter while parked, a car park ramp or a
 * winding exit can use up 300 m of path while staying next to the door (code review 2026-11-13). Points are kept or dropped,
 * never moved.
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

  const first = { lat: coords[0][1], lng: coords[0][0] };
  const last = { lat: coords[coords.length - 1][1], lng: coords[coords.length - 1][0] };
  const kept = coords.filter((p, i) => {
    if (along[i] < trim || total - along[i] < trim) return false;
    const here = { lat: p[1], lng: p[0] };
    return haversineMeters(first, here) >= trim && haversineMeters(last, here) >= trim;
  });
  return kept.length >= 2 ? kept : [];
}
