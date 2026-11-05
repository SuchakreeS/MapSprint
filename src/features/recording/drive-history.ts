// Reads finished drives back from SQLite for the history list and the recap.
import { CLEANING, type DriveSummary } from '@/lib/geo';
import { summarize, type PauseEvent } from '@/lib/live-stats';
import { simplifyToMax } from '@/lib/route-art';
import { appendRoutePoint, type RouteCoord } from '@/lib/route-line';

import {
  getActiveSessionId,
  getPauseEventsSince,
  getPoints,
  getSession,
  listSessions,
} from './db';

/** Enough to draw a recognisable route picture, light enough to draw many of them. */
const MAX_ROUTE_POINTS = 80;

export interface DriveItem {
  id: number;
  startedAt: number;
  endedAt: number;
  summary: DriveSummary;
  /** Thinned and simplified `[lng, lat]` route for drawing. */
  route: RouteCoord[];
}

/** A finished drive, or null if it does not exist or has not ended yet. */
export function loadDrive(id: number): DriveItem | null {
  const session = getSession(id);
  if (!session || session.ended_at == null) return null;

  const points = getPoints(id);
  const events: PauseEvent[] = getPauseEventsSince(id, 0).map(({ ts, type }) => ({ ts, type }));

  const coords: RouteCoord[] = [];
  for (const p of points) {
    if (p.accuracy != null && p.accuracy <= CLEANING.maxAccuracyM) appendRoutePoint(coords, p);
  }

  return {
    id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    summary: summarize(points, events),
    route: simplifyToMax(coords, MAX_ROUTE_POINTS),
  };
}

/** Finished drives with a usable track, newest first. */
export function loadDrives(limit = 100): DriveItem[] {
  const active = getActiveSessionId();
  const drives: DriveItem[] = [];
  for (const row of listSessions(limit)) {
    if (row.ended_at == null || row.id === active || row.points < 2) continue;
    const drive = loadDrive(row.id);
    if (drive && drive.summary.acceptedPoints >= 2) drives.push(drive);
  }
  return drives;
}
