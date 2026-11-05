import { useEffect, useState } from 'react';

import type { DriveSummary } from '@/lib/geo';
import { currentSpeedKmh } from '@/lib/hud';
import { createLiveStats } from '@/lib/live-stats';
import { appendRoutePoint, type RouteCoord } from '@/lib/route-line';

import { getPointsSince, getSessionStartedAt } from './db';
import { startRecording } from './recorder';

const POLL_MS = 1000;

export interface LiveDrive {
  /** False until recording has started and the first read is done. */
  ready: boolean;
  error: string | null;
  /** Seconds since the drive started (wall clock; pause arrives in task 1.6). */
  elapsedS: number;
  snapshot: DriveSummary | null;
  /** Smoothed speed, or null when unknown or older than 10 s (see currentSpeedKmh). */
  speedKmh: number | null;
  /** Thinned route as `[lng, lat]`. A new array only when points were added. */
  route: RouteCoord[];
}

const INITIAL: LiveDrive = {
  ready: false,
  error: null,
  elapsedS: 0,
  snapshot: null,
  speedKmh: null,
  route: [],
};

/**
 * Starts recording (or resumes the active session) and follows it: the background task writes
 * points to SQLite, this reads the new ones every second. Unmounting stops the polling only,
 * never the recording.
 */
export function useLiveDrive(): LiveDrive {
  const [live, setLive] = useState<LiveDrive>(INITIAL);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    startRecording()
      .then((sessionId) => {
        if (!alive) return;
        const startedAt = getSessionStartedAt(sessionId) ?? Date.now();
        const stats = createLiveStats();
        const coords: RouteCoord[] = [];
        let lastTs = 0;

        const tick = () => {
          const fresh = getPointsSince(sessionId, lastTs);
          for (const p of fresh) {
            stats.push(p);
            appendRoutePoint(coords, p);
            lastTs = p.ts;
          }
          const snapshot = stats.snapshot();
          setLive((prev) => ({
            ready: true,
            error: null,
            elapsedS: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
            snapshot,
            speedKmh: currentSpeedKmh(snapshot.lastKmh, stats.lastAcceptedTs(), Date.now()),
            route: fresh.length ? [...coords] : prev.route,
          }));
        };

        tick();
        timer = setInterval(tick, POLL_MS);
      })
      .catch((e: unknown) => {
        if (alive) setLive({ ...INITIAL, error: e instanceof Error ? e.message : 'Could not start recording.' });
      });

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return live;
}
