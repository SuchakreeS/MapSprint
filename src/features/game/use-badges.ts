// The signed-in account's badges and the totals behind the progress bars (plan 3.6, design 22).
// Cached per account in the kv store so the screens work offline. Guests have no badges (nothing is read for them).
// `user_badges` is readable by every signed-in user (by design), so every query here filters on the account's own id.
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/features/sync/supabase';
import { currentStreak, type BadgeTotals } from '@/lib/badges';
import { fetchAllPages } from '@/lib/paging';
import { bangkokDay } from '@/lib/xp';

export interface BadgeData {
  /** badge code -> when it was unlocked (ISO). */
  unlocked: Record<string, string>;
  cells: number;
  distanceM: number;
  /** Distinct Bangkok days with a counted drive (for the streak, worked out when read). */
  days: string[];
}

const cacheKey = (uid: string) => `badges.cache.${uid}`;

export function readBadgeCache(uid: string): BadgeData | null {
  try {
    const raw = Storage.getItemSync(cacheKey(uid));
    return raw ? (JSON.parse(raw) as BadgeData) : null;
  } catch {
    return null;
  }
}

/** Reads everything from the server. Throws when offline. */
export async function fetchBadgeData(uid: string): Promise<BadgeData> {
  const [badges, cells, drives] = await Promise.all([
    supabase.from('user_badges').select('unlocked_at, badges(code)').eq('user_id', uid),
    supabase.from('explored_cells').select('*', { count: 'exact', head: true }).eq('user_id', uid),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from('drives')
        .select('distance_m, started_at')
        .eq('user_id', uid)
        .eq('status', 'processed')
        .order('started_at')
        .range(from, to);
      if (error) throw error;
      return data ?? [];
    }),
  ]);
  if (badges.error) throw badges.error;
  if (cells.error) throw cells.error;

  const unlocked: Record<string, string> = {};
  for (const row of badges.data ?? []) {
    const b = row.badges as unknown; // one embedded badge (accept an array too)
    const code = (Array.isArray(b) ? b[0] : b) as { code?: unknown } | null | undefined;
    if (typeof code?.code === 'string') unlocked[code.code] = row.unlocked_at;
  }
  const days = new Set<string>();
  let distanceM = 0;
  for (const d of drives) {
    distanceM += d.distance_m ?? 0;
    const t = Date.parse(d.started_at);
    if (Number.isFinite(t)) days.add(bangkokDay(t));
  }
  return { unlocked, cells: cells.count ?? 0, distanceM, days: [...days] };
}

/** The numbers the progress bars use, for "today" (Bangkok). */
export function totalsOf(data: BadgeData, nowMs: number): BadgeTotals {
  return { cells: data.cells, distanceM: data.distanceM, streakDays: currentStreak(data.days, bangkokDay(nowMs)) };
}

/**
 * Badges of the signed-in account: the cached copy at once, then the server's. Null for guests and before the first read.
 * `refresh()` reads again (e.g. when a screen gets focus after a drive was counted).
 */
export function useBadges(): { data: BadgeData | null; refresh: () => void } {
  const { userId, guest } = useAuth();
  const [state, setState] = useState<{ owner: string; data: BadgeData } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!userId || guest) return;
    let alive = true;
    const owner = userId;
    // Deferred so the screen paints first (same pattern as useExploredCells).
    const timer = setTimeout(() => {
      const cached = readBadgeCache(owner);
      if (cached && alive) setState({ owner, data: cached });
      fetchBadgeData(owner)
        .then((data) => {
          try {
            Storage.setItemSync(cacheKey(owner), JSON.stringify(data));
          } catch {
            // cache is a convenience only
          }
          if (alive) setState({ owner, data });
        })
        .catch(() => {
          // Offline or server error: keep the cached copy.
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [userId, guest, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { data: state && state.owner === userId && !guest ? state.data : null, refresh };
}
