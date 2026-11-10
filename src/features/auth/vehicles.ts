// The signed-in user's garage (cars AND motorbikes) + which one is the default for the chosen travel mode.
// Vehicles live in Supabase (public.vehicles). The last list is cached on the phone so the picker works offline.
// One default per kind: your default car and your default motorbike are remembered separately.
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/features/auth/auth-provider';
import {
  getSelectedVehicleId,
  readCachedCars,
  setCachedVehicles,
  setSelectedVehicleId,
} from '@/features/settings/prefs';
import { supabase } from '@/features/sync/supabase';
import { carsForMode, vehicleForMode, type TravelMode } from '@/lib/travel-mode';
import { normaliseKind, pickSelected, type Car, type VehicleKind } from '@/lib/vehicles';

export const CAR_COLUMNS = 'id, nickname, make, model, colour, kind';
const KINDS: VehicleKind[] = ['car', 'motorbike'];

type SavedIds = Record<VehicleKind, string | null>;

const readSaved = (uid: string | null): SavedIds => ({
  car: uid ? getSelectedVehicleId(uid, 'car') : null,
  motorbike: uid ? getSelectedVehicleId(uid, 'motorbike') : null,
});

/** null when offline / failed. .eq(user_id): the table is readable by every signed-in user (friends see garages). */
async function fetchCars(userId: string): Promise<Car[] | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select(CAR_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return error || !data ? null : data.map((v) => ({ ...v, kind: normaliseKind(v.kind) }));
}

/** `mode` decides which vehicles `modeCars` / `selected` refer to (Other has none). `cars` is the whole garage. */
export function useVehicles(mode: TravelMode = 'car') {
  const { userId } = useAuth();
  const [cars, setCars] = useState<Car[]>(() => readCachedCars(userId));
  const [savedIds, setSavedIds] = useState<SavedIds>(() => readSaved(userId));
  // A different account signed in: start from that account's cache (derive during render, not in an effect).
  const [forUser, setForUser] = useState(userId);
  if (forUser !== userId) {
    setForUser(userId);
    setCars(readCachedCars(userId));
    setSavedIds(readSaved(userId));
  }

  const selectedByKind: Record<VehicleKind, Car | null> = {
    car: vehicleForMode(cars, 'car', savedIds.car),
    motorbike: vehicleForMode(cars, 'motorbike', savedIds.motorbike),
  };
  const selected = vehicleForMode(cars, mode, mode === 'other' ? null : savedIds[mode]);

  /** Make this vehicle the default of its own kind. */
  const select = useCallback(
    (id: string) => {
      if (!userId) return;
      const car = cars.find((c) => c.id === id);
      if (!car) return;
      setSelectedVehicleId(userId, car.kind, id);
      setSavedIds((prev) => ({ ...prev, [car.kind]: id }));
    },
    [userId, cars],
  );

  /** Take a fresh list: update state + cache, and store the vehicle that will really be used per kind (never a deleted one). */
  const apply = useCallback((uid: string, data: Car[], selectId?: string) => {
    setCars(data);
    setCachedVehicles(uid, JSON.stringify(data));
    const next: SavedIds = { car: null, motorbike: null };
    for (const kind of KINDS) {
      const ofKind = data.filter((c) => c.kind === kind);
      const justAdded = selectId != null && ofKind.some((c) => c.id === selectId) ? selectId : getSelectedVehicleId(uid, kind);
      const chosen = pickSelected(ofKind, justAdded);
      setSelectedVehicleId(uid, kind, chosen?.id ?? null);
      next[kind] = chosen?.id ?? null;
    }
    setSavedIds(next);
  }, []);

  /** Re-read the list. Offline or failed: keep the cached list. Pass `selectId` to select a vehicle just added. */
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

  return { signedIn: !!userId, cars, modeCars: carsForMode(cars, mode), selected, selectedByKind, select, refresh };
}
