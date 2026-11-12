// Blueprint fog geometry (plan 3.4). Pure: only h3-js. Coordinates are GeoJSON [lng, lat].
// The fog is a box minus the explored H3 cells. Outer rings are counter-clockwise, holes clockwise (GeoJSON right-hand rule).
import { cellArea, cellsToMultiPolygon, cellToBoundary, gridDisk, latLngToCell } from 'h3-js';

import { CELL_RES } from './cells.ts';

export type LngLat = [number, number];
export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

export const FOG = {
  /** Fog fill opacity: roads stay faintly visible underneath (the "road outlines"). */
  opacity: 0.82,
  /** HUD / Pre-drive: fog box of +- this many degrees (about 16 km) around the car. */
  hudBoxHalfDeg: 0.15,
  /** Hex grid: cells within this many steps of the centre cell. */
  gridRadius: 8,
  /** The hex grid is only drawn from this zoom (below it the hexes are too dense). */
  gridMinZoom: 13,
} as const;

/** Near-world box for the Map tab, so zooming out never shows a fog edge. */
export const WORLD_BOX: Box = { west: -179.9, south: -85, east: 179.9, north: 85 };

export function boxAround(lat: number, lng: number, halfDeg: number): Box {
  return { west: lng - halfDeg, south: lat - halfDeg, east: lng + halfDeg, north: lat + halfDeg };
}

/** True when (lat, lng) left the inner half of the box: time to re-centre it. */
export function needsRecentre(b: Box, lat: number, lng: number): boolean {
  const halfLng = (b.east - b.west) / 2;
  const halfLat = (b.north - b.south) / 2;
  const cLng = b.west + halfLng;
  const cLat = b.south + halfLat;
  return Math.abs(lng - cLng) > halfLng / 2 || Math.abs(lat - cLat) > halfLat / 2;
}

function signedArea(ring: LngLat[]): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a / 2;
}
const ccw = (ring: LngLat[]): LngLat[] => (signedArea(ring) >= 0 ? ring : [...ring].reverse());
const cw = (ring: LngLat[]): LngLat[] => (signedArea(ring) <= 0 ? ring : [...ring].reverse());

function boxRing(b: Box): LngLat[] {
  return [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
}

const inBox = (b: Box, [lng, lat]: number[]) => lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;

/** Cells whose whole boundary lies inside the box (a hole poking out of its polygon would be invalid). */
function cellsInside(cells: Iterable<string>, b: Box): string[] {
  const out: string[] = [];
  for (const c of cells) if (cellToBoundary(c, true).every((v) => inBox(b, v))) out.push(c);
  return out;
}

/** Merged explored areas: each polygon is [outer ring, ...unexplored islands]. */
function exploredPolygons(cells: Iterable<string>, b: Box): LngLat[][][] {
  const inside = cellsInside(cells, b);
  if (inside.length === 0) return [];
  return cellsToMultiPolygon(inside, true) as LngLat[][][];
}

/** Fog = the box minus the explored cells. Unexplored islands inside explored rings come back as extra fog polygons. */
export function fogFeature(cells: Iterable<string>, b: Box): GeoJSON.Feature<GeoJSON.MultiPolygon> {
  const polys = exploredPolygons(cells, b);
  const main: LngLat[][] = [ccw(boxRing(b))];
  const islands: LngLat[][][] = [];
  for (const [outer, ...inner] of polys) {
    main.push(cw(outer));
    for (const island of inner) islands.push([ccw(island)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: [main, ...islands] } };
}

/** Edges of the explored area (outer rings and island rings), for the yellow edge line. */
export function exploredEdges(cells: Iterable<string>, b: Box): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const poly of exploredPolygons(cells, b)) {
    for (const ring of poly) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } });
  }
  return { type: 'FeatureCollection', features };
}

/** Hex outlines of the cells within `radius` of the cell at (lat, lng) that are NOT explored. */
export function unexploredGrid(
  lat: number,
  lng: number,
  radius: number,
  explored: { has(c: string): boolean },
): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const c of gridDisk(latLngToCell(lat, lng, CELL_RES), radius)) {
    if (explored.has(c)) continue;
    const ring = cellToBoundary(c, true);
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [...ring, ring[0]] } });
  }
  return { type: 'FeatureCollection', features };
}

/** Explored area in km2, rounded to 0.1. */
export function exploredAreaKm2(cells: Iterable<string>): number {
  let sum = 0;
  for (const c of cells) sum += cellArea(c, 'km2');
  return Math.round(sum * 10) / 10;
}
