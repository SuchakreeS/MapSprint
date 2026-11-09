// Small local preferences (expo-sqlite key-value store, survives app restarts).
import Storage from 'expo-sqlite/kv-store';

const SOUND = 'pref.sound';
const BATTERY_TIP_HIDDEN = 'pref.batteryTipHidden';

export const getSoundOn = (): boolean => Storage.getItemSync(SOUND) !== '0';
export const setSoundOn = (on: boolean) => Storage.setItemSync(SOUND, on ? '1' : '0');

export const isBatteryTipHidden = (): boolean => Storage.getItemSync(BATTERY_TIP_HIDDEN) === '1';
export const hideBatteryTip = () => Storage.setItemSync(BATTERY_TIP_HIDDEN, '1');

// Car picker (pre-drive). Per account, so signing in as someone else never shows or stamps another person's car.
const vehicleKey = (uid: string) => `pref.vehicle.${uid}`;
const vehiclesKey = (uid: string) => `pref.vehicles.${uid}`;

export const getSelectedVehicleId = (uid: string): string | null => Storage.getItemSync(vehicleKey(uid));
export const setSelectedVehicleId = (uid: string, id: string | null) =>
  id == null ? Storage.removeItemSync(vehicleKey(uid)) : Storage.setItemSync(vehicleKey(uid), id);

/** Last list fetched from Supabase, so the picker works offline. JSON of Car[]. */
export const getCachedVehicles = (uid: string): string | null => Storage.getItemSync(vehiclesKey(uid));
export const setCachedVehicles = (uid: string, json: string) => Storage.setItemSync(vehiclesKey(uid), json);
