// What to do when the recorder's two pieces of state disagree. Pure, no React Native imports (runs in Node tests).
// - updatesRunning: expo-location's task "mapsprint-location" is registered (GPS updates + foreground service).
// - activeSessionId: the drive open in SQLite (kv 'active_session').
// They can drift apart when Android kills and restarts the app during a drive, or after a failed stop.

export interface RecorderState {
  updatesRunning: boolean;
  activeSessionId: number | null;
}

export type StartPlan =
  | { kind: 'reuse'; sessionId: number } // drive running normally: just show it
  | { kind: 'resume'; sessionId: number } // drive open but GPS stopped: restart GPS for the same drive (gap shows in the gap log)
  | { kind: 'new' }; // no drive open: start one

/** Called when the HUD opens (Start drive, or the "Drive in progress" pill). Never opens a second drive over an open one. */
export function planStart(s: RecorderState): StartPlan {
  if (s.activeSessionId == null) return { kind: 'new' };
  return s.updatesRunning
    ? { kind: 'reuse', sessionId: s.activeSessionId }
    : { kind: 'resume', sessionId: s.activeSessionId };
}

export type LaunchCleanup = 'none' | 'stop-orphan';

/**
 * App launch. GPS running with no open drive stores nothing and only drains the battery: stop it.
 * A drive left open is NOT restarted here (no surprise GPS at launch): the pill on the tabs leads back to the HUD.
 */
export function planLaunchCleanup(s: RecorderState): LaunchCleanup {
  return s.updatesRunning && s.activeSessionId == null ? 'stop-orphan' : 'none';
}
