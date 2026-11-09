// Appearance setting (design 26): Dark / Light / System. Sets React Native's colour scheme override, which
// useTheme() (useColorScheme) follows everywhere, including the map style and status bar.
import { Appearance } from 'react-native';

import type { ThemeChoice } from '@/lib/recording-settings';

import { getTheme, setTheme } from './prefs';

/** `system` (RN 0.88: 'auto') removes the override so the phone's own setting decides. */
export function applyTheme(choice: ThemeChoice): void {
  Appearance.setColorScheme(choice === 'system' ? 'auto' : choice);
}

/** Call once at startup, before the first screen renders. */
export function applySavedTheme(): void {
  applyTheme(getTheme());
}

export function chooseTheme(choice: ThemeChoice): void {
  setTheme(choice);
  applyTheme(choice);
}
