import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import { Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani';
import { Sora_600SemiBold, Sora_700Bold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';

// Keys must match the family names in tokens.ts `fonts`.
const fontMap = {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Sora_600SemiBold,
  Sora_700Bold,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
  Michroma_400Regular,
};

/** `ready` is true once fonts loaded OR failed, so a bad font never blocks the app. */
export function useAppFonts(): { ready: boolean } {
  const [loaded, error] = useFonts(fontMap);
  return { ready: loaded || error != null };
}
