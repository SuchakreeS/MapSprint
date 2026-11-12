// Reads finished drives back from SQLite for the history list and the recap.
import { getAutoPauseMs } from '@/features/settings/prefs';
import { visibleTo } from '@/lib/drive-owner';
import { CLEANING, type DriveSummary } from '@/lib/geo';
import { isJunkDrive } from '@/lib/drive-format';
import { findGaps, type GpsGap } from '@/lib/gaps';
import { summarize, type PauseEvent } from '@/lib/live-stats';
import { simplifyToMax } from '@/lib/route-art';
import { appendRoutePoint, type RouteCoord } from '@/lib/route-line';
import { topSpeedKmh } from '@/lib/top-speed';
import type { TravelMode } from '@/lib/travel-mode';

import {
  getActiveSessionId,
  getCurrentOwner,
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
  /** Car picked on the pre-drive screen (public.vehicles id), or null. */
  vehicleId: string | null;
  /** How the drive was travelled (picked on the pre-drive screen). */
  mode: TravelMode;
  summary: DriveSummary;
  /** Every stretch with no GPS point for more than 3 s (manual pauses excluded). */
  gaps: GpsGap[];
  /** Thinned and simplified `[lng, lat]` route for drawing. */
  route: RouteCoord[];
  /**
   * Private top speed worked out on this phone (3.10), or null (drive recorded before 3.10, or no 3 s stretch). Owner-only:
   * never uploaded (the server recomputes it from the raw track). Show it through `shownTopKmh`.
   */
  topKmh: number | null;
}

/** A finished drive, or null if it does not exist, has not ended yet, or belongs to another account. */
export function loadDrive(id: number): DriveItem | null {
  const session = getSession(id);
  if (!session || session.ended_at == null) return null;
  if (!visibleTo(session.owner_id, getCurrentOwner())) return null;

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
    vehicleId: session.vehicle_id,
    mode: session.mode,
    summary: summarize(points, events, getAutoPauseMs()),
    gaps: findGaps(points, events),
    route: simplifyToMax(coords, MAX_ROUTE_POINTS),
    topKmh: session.has_top_speed ? topSpeedKmh(points) : null,
  };
}

/** Finished drives with a usable track, newest first. */
export function loadDrives(limit = 100): DriveItem[] {
  const active = getActiveSessionId();
  const owner = getCurrentOwner();
  const drives: DriveItem[] = [];
  for (const row of listSessions(limit)) {
    if (row.ended_at == null || row.id === active || row.points < 2) continue;
    if (!visibleTo(row.owner_id, owner)) continue;
    const drive = loadDrive(row.id);
    if (drive && drive.summary.acceptedPoints >= 2 && !isJunkDrive(drive.summary.distanceM)) drives.push(drive);
  }
  return drives;
}
