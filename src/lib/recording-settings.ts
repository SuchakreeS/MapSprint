// Pure rules behind the Recording and Appearance settings (screens 28 and 26).

/** "Auto-pause after stopped for" choices (design 28). */
export const AUTO_PAUSE_CHOICES_MIN = [2, 5, 10] as const;
export type AutoPauseMin = (typeof AUTO_PAUSE_CHOICES_MIN)[number];
export const DEFAULT_AUTO_PAUSE_MIN: AutoPauseMin = 5;

export function parseAutoPauseMin(raw: string | null): AutoPauseMin {
  const n = Number(raw);
  return (AUTO_PAUSE_CHOICES_MIN as readonly number[]).includes(n) ? (n as AutoPauseMin) : DEFAULT_AUTO_PAUSE_MIN;
}

/** Stopped this long and the drive auto-pauses. Off = never (Infinity never compares true). */
export function autoPauseMsFor(enabled: boolean, minutes: AutoPauseMin): number {
  return enabled ? minutes * 60_000 : Infinity;
}

export type ThemeChoice = 'dark' | 'light' | 'system';

export function parseTheme(raw: string | null): ThemeChoice {
  return raw === 'dark' || raw === 'light' ? raw : 'system';
}
