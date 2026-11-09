import { useCallback, useEffect, useRef, useState } from 'react';

import { getAutoPauseMs } from '@/features/settings/prefs';
import type { DriveSummary } from '@/lib/geo';
import { currentSpeedKmh } from '@/lib/hud';
import { applyEvent, createLiveStats, type PauseState } from '@/lib/live-stats';
import { appendRoutePoint, type RouteCoord } from '@/lib/route-line';

import { getPauseEventsSince, getPointsSince, getSessionStartedAt } from './db';
import { pauseRecording, resumeRecording, startRecording } from './recorder';

const POLL_MS = 1000;

interface LiveState {
  /** False until recording has started and the first read is done. */
  ready: boolean;
  error: string | null;
  /** Active drive time in seconds: runs on while GPS is quiet, frozen while paused. */
  elapsedS: number;
  snapshot: DriveSummary | null;
  /** Smoothed speed, or null when unknown, older than 10 s, or paused (see currentSpeedKmh). */
  speedKmh: number | null;
  /** Manual or automatic pause, or null while the drive is running. */
  paused: PauseState | null;
  /** Clock reading (ms) of the last update, so screens need not read the clock while rendering. */
  nowMs: number;
  /** Thinned route as `[lng, lat]`. A new array only when points were added. */
  route: RouteCoord[];
}

export interface LiveDrive extends LiveState {
  pause(): void;
  /** Ends a manual pause or an auto-pause. */
  resume(): void;
}

const INITIAL: LiveState = {
  ready: false,
  error: null,
  elapsedS: 0,
  snapshot: null,
  speedKmh: null,
  paused: null,
  nowMs: 0,
  route: [],
};

/**
 * Starts recording (or resumes the active session) and follows it: the background task writes
 * points to SQLite, this reads the new ones every second and feeds them, together with the
 * pause events, to the live stats engine. Unmounting stops the polling only, never the recording.
 */
export function useLiveDrive(): LiveDrive {
  const [live, setLive] = useState<LiveState>(INITIAL);
  const tickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    startRecording()
      .then((sessionId) => {
        if (!alive) return;
        const startedAt = getSessionStartedAt(sessionId) ?? Date.now();
        const stats = createLiveStats({ autoPauseMs: getAutoPauseMs() });
        const coords: RouteCoord[] = [];
        let lastTs = 0;
        let lastEventId = 0;

        const tick = () => {
          const points = getPointsSince(sessionId, lastTs);
          const events = getPauseEventsSince(sessionId, lastEventId);
          let e = 0;
          for (const p of points) {
            // An event goes before a point with the same timestamp (same rule as summarize).
            while (e < events.length && events[e].ts <= p.ts) applyEvent(stats, events[e++]);
            stats.push(p);
            appendRoutePoint(coords, p);
            lastTs = p.ts;
          }
          while (e < events.length) applyEvent(stats, events[e++]);
          if (events.length) lastEventId = events[events.length - 1].id;

          const now = Date.now();
          const snapshot = stats.snapshot();
          const paused = stats.pauseState();
          setLive((prev) => ({
            ready: true,
            error: null,
            // Before the first GPS point the engine has no time yet: fall back to the wall clock.
            elapsedS: Math.floor(
              snapshot.acceptedPoints > 0 ? stats.elapsedAt(now) : Math.max(0, (now - startedAt) / 1000),
            ),
            snapshot,
            speedKmh: paused ? null : currentSpeedKmh(snapshot.lastKmh, stats.lastAcceptedTs(), now),
            paused,
            nowMs: now,
            route: points.length ? [...coords] : prev.route,
          }));
        };

        tickRef.current = tick;
        tick();
        timer = setInterval(tick, POLL_MS);
      })
      .catch((e: unknown) => {
        if (alive) setLive({ ...INITIAL, error: e instanceof Error ? e.message : 'Could not start recording.' });
      });

    return () => {
      alive = false;
      tickRef.current = null;
      if (timer) clearInterval(timer);
    };
  }, []);

  const pause = useCallback(() => {
    pauseRecording();
    tickRef.current?.();
  }, []);

  const resume = useCallback(() => {
    resumeRecording();
    tickRef.current?.();
  }, []);

  return { ...live, pause, resume };
}
