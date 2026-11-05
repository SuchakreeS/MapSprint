// Small local preferences (expo-sqlite key-value store, survives app restarts).
import Storage from 'expo-sqlite/kv-store';

const SOUND = 'pref.sound';
const BATTERY_TIP_HIDDEN = 'pref.batteryTipHidden';

export const getSoundOn = (): boolean => Storage.getItemSync(SOUND) !== '0';
export const setSoundOn = (on: boolean) => Storage.setItemSync(SOUND, on ? '1' : '0');

export const isBatteryTipHidden = (): boolean => Storage.getItemSync(BATTERY_TIP_HIDDEN) === '1';
export const hideBatteryTip = () => Storage.setItemSync(BATTERY_TIP_HIDDEN, '1');
