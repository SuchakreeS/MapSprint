// Explored H3 cells of a drive (plan 3.3). Pure, no React Native imports: the same file runs in the finalize-drive Edge Function
// (copied by `npm run sync:edge`; Deno resolves 'h3-js' through supabase/functions/finalize-drive/deno.json).
//
// Rules:
//  - Same cleaning as the drive stats: accuracy <= 25 m, no teleports (implied speed from the last accepted point > 250 km/h).
//  - Only MOVING points explore: chip speed (or, without one, the implied speed) >= 3 km/h. A parked phone's GPS drift explores nothing.
//  - Between two moving points that are in different cells and at most 2 km apart (straight line), the cells on the path between
//    them are filled in (a dropout in a tunnel). Farther apart: only the two points' own cells, so a GPS jump earns no free cells.
//  - Privacy zones do NOT trim cells: explored cells are owner-only, unlike the public route.
import { gridPathCells, latLngToCell } from 'h3-js';

import { CLEANING, haversineMeters, msToKmh, type GpsPoint } from './geo.ts';

/** H3 resolution 9: average edge about 200 m, area about 0.105 km2. */
export const CELL_RES = 9;

export const CELLS = {
  maxGapFillM: 2000,
  /** Beyond this the drive is refused as "too long" (a real 12 h drive stays far below). */
  maxCellsPerDrive: 20_000,
} as const;

/** Adds a drive's cells one point at a time (the live HUD), with exactly the rules of `driveCells`. */
export interface CellTracker {
  /** Feed points in time order. Returns the cells this point added (gap fill included), in no particular order. */
  add(p: GpsPoint): string[];
  readonly size: number;
  has(cell: string): boolean;
}

export function createCellTracker(): CellTracker {
  const cells = new Set<string>();
  let lastAccepted: GpsPoint | null = null;
  let lastMoving: GpsPoint | null = null;
  let lastMovingCell: string | null = null;

  const put = (c: string, added: string[]) => {
    if (cells.has(c)) return;
    cells.add(c);
    added.push(c);
  };

  return {
    add(p) {
      const added: string[] = [];
      if (p.accuracy == null || p.accuracy > CLEANING.maxAccuracyM) return added;

      let impliedKmh: number | null = null;
      if (lastAccepted) {
        const dt = (p.ts - lastAccepted.ts) / 1000;
        if (dt <= 0) return added;
        impliedKmh = msToKmh(haversineMeters(lastAccepted, p) / dt);
        if (impliedKmh > CLEANING.maxPlausibleKmh) return added; // teleport
      }
      lastAccepted = p;

      const kmh = p.speed != null && p.speed >= 0 ? msToKmh(p.speed) : impliedKmh;
      if (kmh == null || kmh < CLEANING.stoppedBelowKmh) return added; // parked or drifting

      const cell = latLngToCell(p.lat, p.lng, CELL_RES);
      put(cell, added);
      if (lastMoving && lastMovingCell && cell !== lastMovingCell && haversineMeters(lastMoving, p) <= CELLS.maxGapFillM) {
        try {
          for (const c of gridPathCells(lastMovingCell, cell)) put(c, added);
        } catch {
          // H3 cannot always draw a path (near a pentagon): the two cells themselves are already in.
        }
      }
      lastMoving = p;
      lastMovingCell = cell;
      return added;
    },
    get size() {
      return cells.size;
    },
    has: (c) => cells.has(c),
  };
}

/** The unique cells a drive explored, sorted ascending. Input order does not matter. */
export function driveCells(input: GpsPoint[]): string[] {
  const tracker = createCellTracker();
  const all: string[] = [];
  for (const p of [...input].sort((a, b) => a.ts - b.ts)) all.push(...tracker.add(p));
  return all.sort();
}
