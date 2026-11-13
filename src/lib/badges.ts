// Badge catalogue and progress text (plan 3.6, design 22). Pure, no React Native imports.
// The server decides who unlocks what (private.award_badges in supabase/migrations/20261113130000_badges.sql): this file only
// names and describes them. Codes and XP must match the `badges` table (pinned in tests/badges.test.mts).
import { formatCount } from './format.ts';
import { bangkokDay } from './xp.ts';

export interface BadgeInfo {
  code: string;
  name: string;
  /** The rule, as on the design. */
  rule: string;
  /** Short mark shown on the tile (the design uses text marks). */
  mark: string;
  /** One-time XP the server pays when it unlocks (never capped). */
  xp: number;
  /** False = cannot be earned yet (needs smooth score 3.5 or district maps 3.8): shown as "Coming soon". */
  available: boolean;
}

export const BADGES: readonly BadgeInfo[] = [
  { code: 'first_gear', name: 'First Gear', rule: 'Record your first drive', mark: '1', xp: 50, available: true },
  { code: 'century', name: 'Century', rule: '100 km total', mark: '100', xp: 100, available: true },
  { code: 'cartographer_1', name: 'Cartographer I', rule: '100 cells explored', mark: 'C1', xp: 100, available: true },
  { code: 'cartographer_2', name: 'Cartographer II', rule: '1,000 cells explored', mark: 'C2', xp: 300, available: true },
  { code: 'cartographer_3', name: 'Cartographer III', rule: '10,000 cells explored', mark: 'C3', xp: 1000, available: true },
  { code: 'district_hunter', name: 'District Hunter', rule: 'Explore 50% of any district', mark: 'DH', xp: 200, available: false },
  { code: 'zen_driver', name: 'Zen Driver', rule: 'Smooth score 90+ on a 20 km+ drive', mark: 'ZD', xp: 150, available: false },
  { code: 'weekend_explorer', name: 'Weekend Explorer', rule: '20 new cells on a Saturday or Sunday', mark: 'WE', xp: 100, available: true },
  { code: 'province_collector', name: 'Province Collector', rule: 'Drive in all 4 launch provinces', mark: 'PC', xp: 300, available: false },
  { code: 'streak_7', name: 'Streak 7', rule: 'Drive 7 days in a row', mark: '7', xp: 200, available: true },
];

export const badgeByCode = (code: string): BadgeInfo | undefined => BADGES.find((b) => b.code === code);

/** How many of the known badges are in `codes` (duplicates and unknown codes ignored). */
export function unlockedCount(codes: readonly string[]): number {
  return new Set(codes.filter((c) => badgeByCode(c))).size;
}

export interface BadgeTotals {
  /** Explored cells. */
  cells: number;
  /** Total distance of counted drives, metres. */
  distanceM: number;
  /** Current streak in days (see currentStreak). */
  streakDays: number;
}

export type BadgeProgress = { kind: 'progress'; text: string; fraction: number } | { kind: 'soon' };

const CELL_TARGET: Record<string, number> = { cartographer_1: 100, cartographer_2: 1000, cartographer_3: 10_000 };
const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** The meter under a locked badge. Badges that cannot be earned yet say so. */
export function badgeProgress(code: string, t: BadgeTotals): BadgeProgress {
  const info = badgeByCode(code);
  if (!info || !info.available) return { kind: 'soon' };
  const cellTarget = CELL_TARGET[code];
  if (cellTarget) {
    return { kind: 'progress', text: `${formatCount(Math.min(t.cells, cellTarget))} / ${formatCount(cellTarget)} cells`, fraction: clamp01(t.cells / cellTarget) };
  }
  if (code === 'century') {
    return { kind: 'progress', text: `${Math.min(100, Math.floor(t.distanceM / 1000))} / 100 km`, fraction: clamp01(t.distanceM / 100_000) };
  }
  if (code === 'streak_7') {
    return { kind: 'progress', text: `${Math.min(7, t.streakDays)} / 7 days`, fraction: clamp01(t.streakDays / 7) };
  }
  if (code === 'weekend_explorer') return { kind: 'progress', text: '20 new cells on one weekend drive', fraction: 0 };
  return { kind: 'progress', text: info.rule, fraction: 0 }; // first_gear
}

const DAY_MS = 86_400_000;
const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

/**
 * Days in a row with at least one drive, counted back from today. `days` are Bangkok calendar days (YYYY-MM-DD, see bangkokDay in
 * xp.ts), any order, repeats fine. A last drive yesterday still counts (the streak is alive until today ends).
 */
export function currentStreak(days: readonly string[], today: string): number {
  const set = new Set(days.map(dayNumber).filter(Number.isFinite));
  let d = dayNumber(today);
  if (!set.has(d)) d -= 1;
  let n = 0;
  while (set.has(d)) {
    n += 1;
    d -= 1;
  }
  return n;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Nov": the Bangkok date a badge was unlocked ("Unlocked 14 Nov"). Empty for an unreadable time. */
export function formatBadgeDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const [, m, d] = bangkokDay(t).split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}
