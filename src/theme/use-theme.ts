import { useColorScheme } from 'react-native';

import { palettes, type Mode, type Palette } from './tokens';

export function useTheme(): { mode: Mode; c: Palette } {
  const scheme = useColorScheme();
  const mode: Mode = scheme === 'light' ? 'light' : 'dark';
  return { mode, c: palettes[mode] };
}
