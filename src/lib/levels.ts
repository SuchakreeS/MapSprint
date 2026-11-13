// Levels (plan 3.2): going from level L to L+1 costs round(100 * L^1.5) XP. Pure. The server stores the level
// (private.level_for_xp in SQL has the same checkpoints, pinned in pgTAP); the app uses this to draw progress.

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level: number): number => Math.round(100 * Math.pow(level, 1.5));

/** Level for a total XP: 0 is level 1, 100 is level 2, 383 is level 3, 903 is level 4. */
export function levelForXp(totalXp: number): number {
  let xp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;
  let level = 1;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  return level;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  intoLevel: number;
  /** XP the current level needs in total. */
  needed: number;
  /** 0..1 */
  fraction: number;
}

export function levelProgress(totalXp: number): LevelProgress {
  let xp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;
  let level = 1;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  const needed = xpToNext(level);
  return { level, intoLevel: xp, needed, fraction: xp / needed };
}

/** The level bar is 12 LED segments (design 08, 10, 20). A full bar only appears at the level-up. */
export const LED_SEGMENTS = 12;

export function litSegments(fraction: number): number {
  if (!Number.isFinite(fraction) || fraction <= 0) return 0;
  return Math.min(LED_SEGMENTS, Math.floor(fraction * LED_SEGMENTS));
}
