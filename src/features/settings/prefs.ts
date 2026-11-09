// Small local preferences (expo-sqlite key-value store, survives app restarts).
import Storage from 'expo-sqlite/kv-store';

import { autoPauseMsFor, parseAutoPauseMin, parseTheme, type AutoPauseMin, type ThemeChoice } from '@/lib/recording-settings';

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

// ---- Settings screens (26 hub, 28 Recording) ----

const THEME = 'pref.theme';
const AUTO_PAUSE_ON = 'pref.autoPause';
const AUTO_PAUSE_MIN = 'pref.autoPauseMin';
const KEEP_AWAKE = 'pref.keepAwake';
const FINISH_REMINDER = 'pref.finishReminder';

export const getTheme = (): ThemeChoice => parseTheme(Storage.getItemSync(THEME));
export const setTheme = (t: ThemeChoice) => Storage.setItemSync(THEME, t);

export const getAutoPauseOn = (): boolean => Storage.getItemSync(AUTO_PAUSE_ON) !== '0';
export const setAutoPauseOn = (on: boolean) => Storage.setItemSync(AUTO_PAUSE_ON, on ? '1' : '0');
export const getAutoPauseMin = (): AutoPauseMin => parseAutoPauseMin(Storage.getItemSync(AUTO_PAUSE_MIN));
export const setAutoPauseMin = (m: AutoPauseMin) => Storage.setItemSync(AUTO_PAUSE_MIN, String(m));
/** The auto-pause threshold in ms for live stats and the recap (Infinity when auto-pause is off). */
export const getAutoPauseMs = (): number => autoPauseMsFor(getAutoPauseOn(), getAutoPauseMin());

export const getKeepAwakeOn = (): boolean => Storage.getItemSync(KEEP_AWAKE) !== '0';
export const setKeepAwakeOn = (on: boolean) => Storage.setItemSync(KEEP_AWAKE, on ? '1' : '0');

/** Locked-phone "Finish this drive?" notification (default on). */
export const getFinishReminderOn = (): boolean => Storage.getItemSync(FINISH_REMINDER) !== '0';
export const setFinishReminderOn = (on: boolean) => Storage.setItemSync(FINISH_REMINDER, on ? '1' : '0');
