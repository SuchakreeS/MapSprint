// THROWAWAY (plan 3.0 map style spike). Delete together with src/app/dev/map-style.tsx.
// Geometry for the fake fog: a big box with the "explored" H3 res-9 cells cut out as holes, plus grids.
import { cellsToMultiPolygon, cellToBoundary, gridDisk, latLngToCell } from 'h3-js';

export type Pos = [number, number]; // [lng, lat]
type Ring = Pos[];
export type FC = GeoJSON.FeatureCollection;

export const PLACES = {
  bangkok: { label: 'Bangkok (Sathorn)', lat: 13.7246, lng: 100.5293 },
  pathum: { label: 'Pathum Thani', lat: 14.0208, lng: 100.525 },
} as const;

const EMPTY: FC = { type: 'FeatureCollection', features: [] };
export const emptyFc = (): FC => EMPTY;

/** GeoJSON winding: outer ring counter-clockwise (positive area), holes clockwise. */
function signedArea(ring: Ring): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}
const ccw = (ring: Ring): Ring => (signedArea(ring) >= 0 ? ring : [...ring].reverse());
const cw = (ring: Ring): Ring => (signedArea(ring) <= 0 ? ring : [...ring].reverse());

/** The centre cell plus two neighbours (3 fake explored cells). */
export function exploredCells(lat: number, lng: number): string[] {
  const centre = latLngToCell(lat, lng, 9);
  return gridDisk(centre, 1).slice(0, 3);
}

/** Outer loops of the explored area (adjacent cells merge into one loop). */
export function exploredLoops(cells: string[]): Ring[] {
  return cellsToMultiPolygon(cells, true).map((poly) => poly[0] as Ring);
}

function box(lat: number, lng: number, halfDeg: number): Ring {
  return [
    [lng - halfDeg, lat - halfDeg],
    [lng + halfDeg, lat - halfDeg],
    [lng + halfDeg, lat + halfDeg],
    [lng - halfDeg, lat + halfDeg],
    [lng - halfDeg, lat - halfDeg],
  ];
}

/** Dark fill over everything (about +-22 km) with the explored loops as holes. Also used as the clip polygon. */
export function fogFc(lat: number, lng: number, cells: string[]): FC {
  const holes = exploredLoops(cells).map(cw);
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ccw(box(lat, lng, 0.2)), ...holes] } }],
  };
}

/** Outline of the explored area. */
export function exploredOutlineFc(cells: string[]): FC {
  return {
    type: 'FeatureCollection',
    features: exploredLoops(cells).map((loop) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: loop },
    })),
  };
}

/** Graph-paper lines about every 200 m, within +-3.3 km of the point. */
export function squareGridFc(lat: number, lng: number): FC {
  const dLat = 200 / 111_320;
  const dLng = 200 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const n = 16;
  const features: GeoJSON.Feature[] = [];
  for (let i = -n; i <= n; i++) {
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lng - n * dLng, lat + i * dLat], [lng + n * dLng, lat + i * dLat]] } });
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[lng + i * dLng, lat - n * dLat], [lng + i * dLng, lat + n * dLat]] } });
  }
  return { type: 'FeatureCollection', features };
}

/** H3 res-9 hexagon outlines around the point (the real cell grid). */
export function hexGridFc(lat: number, lng: number): FC {
  const centre = latLngToCell(lat, lng, 9);
  return {
    type: 'FeatureCollection',
    features: gridDisk(centre, 10).map((cell) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [...cellToBoundary(cell, true), cellToBoundary(cell, true)[0]] },
    })),
  };
}

function centroid(geom: GeoJSON.Geometry): Pos | null {
  const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.type === 'MultiPolygon' ? geom.coordinates[0]?.[0] : null;
  if (!ring || ring.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

/** Keep only the buildings whose centre lies inside an explored cell (the "JS pick" way). Drops tile-border duplicates by id. */
export function pickBuildingsInCells(buildings: FC, cells: string[]): FC {
  const set = new Set(cells);
  const seen = new Set<string>();
  const features = buildings.features.filter((f) => {
    const c = centroid(f.geometry);
    if (!c) return false;
    if (!set.has(latLngToCell(c[1], c[0], 9))) return false;
    const key = `${f.id ?? ''}:${c[0].toFixed(6)}:${c[1].toFixed(6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { type: 'FeatureCollection', features };
}

export interface BuildingStats {
  total: number;
  extruded: number;
  withHeight: number;
  heightPct: number;
}

/** How many loaded buildings are extruded and carry a real height (coverage check, question 4). */
export function buildingStats(buildings: FC): BuildingStats {
  let extruded = 0;
  let withHeight = 0;
  for (const f of buildings.features) {
    const p = f.properties ?? {};
    const isExtruded = p.extrude === 'true' || p.extrude === true;
    if (isExtruded) {
      extruded++;
      if (typeof p.height === 'number' && p.height > 0) withHeight++;
    }
  }
  return { total: buildings.features.length, extruded, withHeight, heightPct: extruded ? Math.round((withHeight / extruded) * 100) : 0 };
}
