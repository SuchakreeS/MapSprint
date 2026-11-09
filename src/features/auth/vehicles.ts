// The signed-in user's cars + which one is selected for the next drive (pre-drive screen).
// Cars live in Supabase (public.vehicles). The last list is cached on the phone so the picker works offline.
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import {
  getCachedVehicles,
  getSelectedVehicleId,
  setCachedVehicles,
  setSelectedVehicleId,
} from '@/features/settings/prefs';
import { supabase } from '@/features/sync/supabase';
import { pickSelected, type Car } from '@/lib/vehicles';

export const CAR_COLUMNS = 'id, nickname, make, model, colour';

function readCache(userId: string | null): Car[] {
  if (!userId) return [];
  try {
    const raw = getCachedVehicles(userId);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Car[]) : [];
  } catch {
    return [];
  }
}

/** null when offline / failed. .eq(user_id): the table is readable by every signed-in user (friends see garages). */
async function fetchCars(userId: string): Promise<Car[] | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(CAR_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return error || !data ? null : data;
}

export function useVehicles() {
  const { userId } = useAuth();
  const [cars, setCars] = useState<Car[]>(() => readCache(userId));
  const [savedId, setSavedId] = useState<string | null>(() => (userId ? getSelectedVehicleId(userId) : null));
  // A different account signed in: start from that account's cache (derive during render, not in an effect).
  const [forUser, setForUser] = useState(userId);
  if (forUser !== userId) {
    setForUser(userId);
    setCars(readCache(userId));
    setSavedId(userId ? getSelectedVehicleId(userId) : null);
  }

  const selected = pickSelected(cars, savedId);

  const select = useCallback(
    (id: string) => {
      if (!userId) return;
      setSelectedVehicleId(userId, id);
      setSavedId(id);
    },
    [userId],
  );

  /** Take a fresh list: update state + cache, and store the car that will really be used (never a deleted one). */
  const apply = useCallback(
    (uid: string, data: Car[], selectId?: string) => {
      setCars(data);
      setCachedVehicles(uid, JSON.stringify(data));
      const chosen = pickSelected(data, selectId ?? getSelectedVehicleId(uid));
      setSelectedVehicleId(uid, chosen?.id ?? null);
      setSavedId(chosen?.id ?? null);
    },
    [],
  );

  /** Re-read the list. Offline or failed: keep the cached list. Pass `selectId` to select a car just added. */
  const refresh = useCallback(
    async (selectId?: string) => {
      if (!userId) return;
      const data = await fetchCars(userId);
      if (data) apply(userId, data, selectId);
    },
    [userId, apply],
  );

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void fetchCars(userId).then((data) => {
      if (alive && data) apply(userId, data);
    });
    return () => {
      alive = false;
    };
  }, [userId, apply]);

  return { signedIn: !!userId, cars, selected, select, refresh };
}
