import { useColorScheme } from 'react-native';

import { fonts, palettes, type, type Mode, type Palette } from './tokens';

export function useTheme() {
  const scheme = useColorScheme();
  const mode: Mode = scheme === 'light' ? 'light' : 'dark';
  const c: Palette = palettes[mode];
  return { mode, c, fonts, type };
}
