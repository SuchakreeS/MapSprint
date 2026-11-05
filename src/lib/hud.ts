// Pure helpers for the driving HUD. No React Native imports.

/** Controls (Pause, Hold to finish) lock above this speed. Safety rule, see CLAUDE.md. */
export const CONTROL_LOCK_KMH = 10;

/** Speed that fills the gauge completely. */
export const GAUGE_MAX_KMH = 160;

/** The red band on the gauge starts at this fraction of the arc. */
export const REDLINE_START = 0.85;

/** Unknown speed does not lock, so a phone with no GPS can still finish a drive. */
export function controlsLocked(kmh: number | null): boolean {
  return kmh != null && kmh > CONTROL_LOCK_KMH;
}

/** 0..1 fill of the speed gauge. Unknown, negative or NaN speed is 0. */
export function gaugeFraction(kmh: number | null): number {
  if (kmh == null || !Number.isFinite(kmh) || kmh <= 0) return 0;
  return Math.min(1, kmh / GAUGE_MAX_KMH);
}
