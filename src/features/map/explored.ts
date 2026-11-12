// Explored H3 cells as the phone knows them (plan 3.4, decision 3):
//  - signed in: the server's explored_cells (cached per account in SQLite, so the map works offline)
//    + the cells of this account's finished local drives that are waiting to upload, or counted with server cells
//      (so a just-counted drive's holes show at once, also offline; see listLocalExploreSessions);
//  - guest: the cells of all finished guest drives.
// Counted drives from before the 3.3 deploy have no server cells and are NOT filled in from local points:
// the map would then disagree with the server's "new cells". A server back-fill is a later task.
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import {
  getExploredCache,
  getPoints,
  getSessionCells,
  listLocalExploreSessions,
  replaceExploredCache,
  saveSessionCells,
} from '@/features/recording/db';
import { supabase } from '@/features/sync/supabase';
import { driveCells } from '@/lib/cells';
import { fetchAllPages } from '@/lib/paging';

/** Union of the owner's explored cells. Computes and caches local drives' cells on first use. */
export function loadExploredCells(owner: string | null): Set<string> {
  const set = new Set<string>(owner ? getExploredCache(owner) : []);
  for (const id of listLocalExploreSessions(owner)) {
    let cells = getSessionCells(id);
    if (cells == null) {
      cells = driveCells(getPoints(id));
      saveSessionCells(id, cells);
    }
    for (const c of cells) set.add(c);
  }
  return set;
}

/** Reads the account's explored_cells from the server (all pages) into the local cache. Throws when offline. */
export async function refreshServerCells(owner: string): Promise<void> {
  const cells = await fetchAllPages(async (from, to) => {
    const { data, error } = await supabase
      .from('explored_cells')
      .select('h3_index')
      .eq('user_id', owner) // RLS also limits it to the owner
      .order('h3_index')
      .range(from, to);
    if (error) throw error;
    return (data ?? []).map((r) => r.h3_index);
  });
  replaceExploredCache(owner, cells);
}

const EMPTY = new Set<string>();

/**
 * The explored cells of whoever is signed in (or the guest). Loads from the phone at once, then (signed in) refreshes from
 * the server in the background and reloads. `refresh()` does it again (e.g. when the Map tab gets focus).
 * Keyed by account: another account's cells are never returned.
 */
export function useExploredCells(): { cells: Set<string>; refresh: () => void } {
  const { userId } = useAuth();
  const [state, setState] = useState<{ owner: string | null; cells: Set<string> } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const owner = userId;
    const load = () => {
      if (alive) setState({ owner, cells: loadExploredCells(owner) });
    };
    // Deferred so the screen paints first (the first load may compute cells for many local drives).
    const timer = setTimeout(() => {
      load();
      if (owner) {
        refreshServerCells(owner)
          .then(load)
          .catch(() => {
            // Offline or server error: keep the cached cells.
          });
      }
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [userId, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { cells: state && state.owner === userId ? state.cells : EMPTY, refresh };
}
