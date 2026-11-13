// Small per-phone onboarding flags (expo-sqlite key-value store, survives restarts).
import Storage from 'expo-sqlite/kv-store';

const GUEST = 'auth.guest';
const LOCATION_DONE = 'onboarding.locationDone';
const carKey = (userId: string) => `onboarding.carDone.${userId}`;
const profileKey = (userId: string) => `auth.profileCache.${userId}`;

export const isGuestChosen = (): boolean => Storage.getItemSync(GUEST) === '1';
export const setGuestChosen = (on: boolean) =>
  on ? Storage.setItemSync(GUEST, '1') : Storage.removeItemSync(GUEST);

export const isLocationStepDone = (): boolean => Storage.getItemSync(LOCATION_DONE) === '1';
export const setLocationStepDone = () => Storage.setItemSync(LOCATION_DONE, '1');

export const isCarStepDone = (userId: string): boolean => Storage.getItemSync(carKey(userId)) === '1';
export const setCarStepDone = (userId: string) => Storage.setItemSync(carKey(userId), '1');

export interface CachedProfile {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  /** Server-owned (plan 3.1 / 3.2). Missing in caches written before XP existed. */
  level?: number;
  total_xp?: number;
}

/** Last profile seen from the server, so the app opens offline without bouncing to onboarding. */
export function readProfileCache(userId: string): CachedProfile | null {
  const raw = Storage.getItemSync(profileKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedProfile;
  } catch {
    return null;
  }
}

export const writeProfileCache = (userId: string, p: CachedProfile) =>
  Storage.setItemSync(profileKey(userId), JSON.stringify(p));
