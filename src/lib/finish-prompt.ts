// When to ask "Finish this drive?" (plan.md 1.11): the driver forgot to press Finish and the
// drive has been sitting stopped for a long time (spike run #6 recorded 88 min at the office).
// Pure, no React Native imports so it runs in Node tests too.
import type { PauseState } from './live-stats.ts';

/** Auto-paused means stopped; the pause starts when the stop began, so this is total time stopped. */
export const STOP_PROMPT_AUTO_MS = 15 * 60_000;
/** A manual pause is deliberate, so wait longer before asking. */
export const STOP_PROMPT_MANUAL_MS = 30 * 60_000;
/** After "Keep recording", do not ask again for this long. */
export const PROMPT_SNOOZE_MS = 15 * 60_000;

/** Milliseconds since the pause began, 0 if not paused. */
export function stoppedForMs(pause: PauseState | null, nowMs: number): number {
  return pause ? Math.max(0, nowMs - pause.since) : 0;
}

export function shouldPromptFinish(
  pause: PauseState | null,
  nowMs: number,
  dismissedAtMs: number | null,
): boolean {
  if (!pause) return false;
  const limit = pause.kind === 'auto' ? STOP_PROMPT_AUTO_MS : STOP_PROMPT_MANUAL_MS;
  if (stoppedForMs(pause, nowMs) < limit) return false;
  return dismissedAtMs == null || nowMs - dismissedAtMs >= PROMPT_SNOOZE_MS;
}

/**
 * For the locked-phone reminder: there are no live stats in the background task, so work out "stopped since" from
 * stored data. A manual pause keeps its own start; otherwise the stop began at the last point that was moving
 * (or at the start of the drive if it never moved).
 */
export function reminderPauseState(input: {
  manualSince: number | null;
  lastMovingTs: number | null;
  sessionStartMs: number;
}): PauseState {
  if (input.manualSince != null) return { kind: 'manual', since: input.manualSince };
  return { kind: 'auto', since: input.lastMovingTs ?? input.sessionStartMs };
}
