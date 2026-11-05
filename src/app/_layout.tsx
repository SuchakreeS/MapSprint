import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAppFonts } from '@/theme/fonts';
import { useTheme } from '@/theme/use-theme';

// Public token (starts with pk.). Set EXPO_PUBLIC_MAPBOX_TOKEN in .env
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { mode, c } = useTheme();
  const { ready } = useAppFonts();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTintColor: c.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen name="record" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="history" options={{ headerShown: false }} />
        <Stack.Screen name="dev" options={{ title: 'Phase 0 · Spikes' }} />
        <Stack.Screen name="map" options={{ title: 'Spike 1 · Mapbox' }} />
        <Stack.Screen name="gps" options={{ title: 'Spike 2 · Background GPS' }} />
        <Stack.Screen name="h3" options={{ title: 'Spike 3 · H3 on Hermes' }} />
        <Stack.Screen name="kit" options={{ title: 'UI kit preview' }} />
      </Stack>
    </>
  );
}
