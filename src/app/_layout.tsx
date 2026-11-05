import Mapbox from '@rnmapbox/maps';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '@/theme/use-theme';

// Public token (starts with pk.). Set EXPO_PUBLIC_MAPBOX_TOKEN in .env
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

export default function RootLayout() {
  const { mode, c } = useTheme();
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
        <Stack.Screen name="index" options={{ title: 'Phase 0 · Spikes' }} />
        <Stack.Screen name="map" options={{ title: 'Spike 1 · Mapbox' }} />
        <Stack.Screen name="gps" options={{ title: 'Spike 2 · Background GPS' }} />
        <Stack.Screen name="h3" options={{ title: 'Spike 3 · H3 on Hermes' }} />
      </Stack>
    </>
  );
}
