// Blueprint fog geometry (plan 3.4). Pure: only h3-js. Coordinates are GeoJSON [lng, lat].
// The fog is a box minus the explored H3 cells. Outer rings are counter-clockwise, holes clockwise (GeoJSON right-hand rule).
import { cellArea, cellsToMultiPolygon, cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from 'h3-js';

import { CELL_RES } from './cells.ts';

export type LngLat = [number, number];
export interface Box {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** A width in px, or [zoom, px] stops that Mapbox interpolates between (so a line stays visible zoomed out, not fat zoomed in). */
export type Width = number | readonly (readonly [number, number])[];
/** Colours are token NAMES (resolved against the theme palette in FogLayers), never hex. */
type ColourToken = 'primary' | 'gold' | 'muted';

export interface FogStyle {
  /** Fog fill opacity (the fog colour is always `c.bg`): roads stay faintly visible underneath (the "road outlines"). */
  opacity: number;
  /** Hex outlines of the unexplored cells. */
  grid: { color: ColourToken; opacity: number; width: number };
  /** Line around the explored area. */
  edge: { color: ColourToken; width: Width; opacity: number };
  /** Soft glow under the edge (same shape, wider and blurred). null = none. */
  glow: { color: ColourToken; width: Width; blur: number; opacity: number } | null;
}

// Light (Pearl): the original look. It must stay exactly like this.
const FOG_STYLE_LIGHT: FogStyle = {
  opacity: 0.82,
  grid: { color: 'muted', opacity: 0.5, width: 0.7 },
  edge: { color: 'primary', width: 1.5, opacity: 0.8 },
  glow: null,
};

// Dark (Onyx), PS decision 2026-11-13 after testing three looks on the phone: the original night map, fog and grid, but the
// explored edge from the "Dusk" test: a solid yellow line over a soft glow. The explored area was almost invisible under the
// near-black fog, worst at city level (zoom 10-11), so both widths are larger zoomed out and settle at 2.4 / 9 px from zoom 15.
const DARK_EDGE: FogStyle['edge'] = {
  color: 'primary',
  opacity: 1,
  width: [
    [9, 3.4],
    [11, 3],
    [13, 2.6],
    [15, 2.4],
    [18, 2.4],
  ],
};
const DARK_GLOW: NonNullable<FogStyle['glow']> = {
  color: 'primary',
  blur: 4,
  opacity: 0.35,
  width: [
    [9, 12],
    [11, 11],
    [13, 10],
    [15, 9],
    [18, 9],
  ],
};

export const FOG = {
  /** Per theme. */
  styles: {
    light: FOG_STYLE_LIGHT,
    dark: { ...FOG_STYLE_LIGHT, edge: DARK_EDGE, glow: DARK_GLOW } satisfies FogStyle,
  },
  /** HUD / Pre-drive: fog box of +- this many degrees (about 16 km) around the car. */
  hudBoxHalfDeg: 0.15,
  /** Hex grid: cells within this many steps of the centre cell. */
  gridRadius: 8,
  /** The hex grid is only drawn from this zoom (below it the hexes are too dense). */
  gridMinZoom: 13,
} as const;

/** The fog look for a theme. */
export function fogStyleFor(mode: 'dark' | 'light'): FogStyle {
  return FOG.styles[mode];
}

/** A Mapbox line-width value: a number as is, stops as a zoom interpolation. */
export function zoomWidth(w: Width): number | (string | number | (string | number)[])[] {
  if (typeof w === 'number') return w;
  return ['interpolate', ['linear'], ['zoom'], ...w.flat()];
}

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

const inBox = (b: Box, [lng, lat]: number[]) => lng > b.west && lng < b.east && lat > b.south && lat < b.north;

/**
 * Cells whose whole boundary lies strictly inside the box (a hole poking out of its polygon would be invalid).
 * The cheap centre check runs first, so cells far away (the rest of the account's history) cost almost nothing.
 */
function cellsInside(cells: Iterable<string>, b: Box): string[] {
  const out: string[] = [];
  for (const c of cells) {
    const [lat, lng] = cellToLatLng(c);
    if (!inBox(b, [lng, lat])) continue;
    if (cellToBoundary(c, true).every((v) => inBox(b, v))) out.push(c);
  }
  return out;
}

/** Ray-casting point-in-ring. */
function inRing([x, y]: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface FogShapes {
  fog: GeoJSON.Feature<GeoJSON.MultiPolygon>;
  edges: GeoJSON.FeatureCollection<GeoJSON.LineString>;
}

/**
 * Fog and explored edges from ONE pass over the cells (the expensive part is cellsToMultiPolygon).
 * Fog = the box minus the explored areas. An unexplored island inside an explored ring is fog again, and an explored area
 * inside such an island is a hole of that island (h3 returns every explored area as its own flat polygon, at any depth).
 */
export function fogShapes(cells: Iterable<string>, b: Box): FogShapes {
  const inside = cellsInside(cells, b);
  const polys = inside.length ? (cellsToMultiPolygon(inside, true) as LngLat[][][]) : [];

  const islands: { ring: LngLat[]; area: number; holes: LngLat[][] }[] = [];
  for (const [, ...inner] of polys) {
    for (const island of inner) {
      const ring = ccw(island);
      islands.push({ ring, area: signedArea(ring), holes: [] });
    }
  }
  const main: LngLat[][] = [ccw(boxRing(b))];
  const edges: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const poly of polys) {
    const outer = poly[0];
    // The smallest island that contains this area (if any) gets it as a hole; otherwise it is a hole of the box.
    let host: (typeof islands)[number] | null = null;
    for (const isl of islands) {
      if (inRing(outer[0], isl.ring) && (!host || isl.area < host.area)) host = isl;
    }
    (host ? host.holes : main).push(cw(outer));
    for (const ring of poly) edges.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } });
  }
  return {
    fog: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [main, ...islands.map((i) => [i.ring, ...i.holes])] },
    },
    edges: { type: 'FeatureCollection', features: edges },
  };
}

/** Fog = the box minus the explored cells (see fogShapes). */
export function fogFeature(cells: Iterable<string>, b: Box): GeoJSON.Feature<GeoJSON.MultiPolygon> {
  return fogShapes(cells, b).fog;
}

/** Edges of the explored area (outer rings and island rings), for the yellow edge line. */
export function exploredEdges(cells: Iterable<string>, b: Box): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return fogShapes(cells, b).edges;
}

/** The cells (cheaply) near the box: centre inside. For narrowing a big set before merging in live cells. */
export function cellsNearBox(cells: Iterable<string>, b: Box): string[] {
  const out: string[] = [];
  for (const c of cells) {
    const [lat, lng] = cellToLatLng(c);
    if (inBox(b, [lng, lat])) out.push(c);
  }
  return out;
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
