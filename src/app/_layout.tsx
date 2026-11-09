import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { OnboardingGuard } from '@/features/auth/onboarding-guard';
import { useAppFonts } from '@/theme/fonts';
import { useTheme } from '@/theme/use-theme';

// Public token (starts with pk.). Set EXPO_PUBLIC_MAPBOX_TOKEN in .env
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootStack />
    </AuthProvider>
  );
}

function RootStack() {
  const { mode, c } = useTheme();
  const { ready: fontsReady } = useAppFonts();
  const { ready: authReady } = useAuth();
  // Only the FIRST load gates the UI. Later auth changes (sign-in, sign-out) must not unmount the navigator.
  const [started, setStarted] = useState(false);
  if (fontsReady && authReady && !started) setStarted(true); // latch during render (React "derived state" pattern)

  useEffect(() => {
    if (started) SplashScreen.hideAsync();
  }, [started]);

  if (!started) return null;

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
        <Stack.Screen name="garage" options={{ headerShown: false }} />
        <Stack.Screen name="garage-car" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="battery-guide" options={{ headerShown: false }} />
        <Stack.Screen name="dev" options={{ title: 'Phase 0 · Spikes' }} />
        <Stack.Screen name="map" options={{ title: 'Spike 1 · Mapbox' }} />
        <Stack.Screen name="gps" options={{ title: 'Spike 2 · Background GPS' }} />
        <Stack.Screen name="h3" options={{ title: 'Spike 3 · H3 on Hermes' }} />
        <Stack.Screen name="kit" options={{ title: 'UI kit preview' }} />
      </Stack>
      <OnboardingGuard />
    </>
  );
}
