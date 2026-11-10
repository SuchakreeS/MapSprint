// Keeps the map route line light: a 3-hour drive has ~10,000 points, the map needs far fewer.
// Pure, no React Native imports.
import { haversineMeters, type GpsPoint } from './geo.ts';

/** `[lng, lat]`, the order GeoJSON and Mapbox expect. */
export type RouteCoord = [number, number];

/**
 * Appends `p` only if it is at least `minStepM` from the last KEPT coordinate (the first
 * point is always kept). Mutates and returns `coords` so callers can reuse one array.
 */
export function appendRoutePoint(coords: RouteCoord[], p: GpsPoint, minStepM = 5): RouteCoord[] {
  const prev = coords[coords.length - 1];
  if (!prev || haversineMeters({ lat: prev[1], lng: prev[0] }, p) >= minStepM) {
    coords.push([p.lng, p.lat]);
  }
  return coords;
}
