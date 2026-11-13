import Mapbox from '@rnmapbox/maps';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { AuthProvider, useAuth } from '@/features/auth/auth-provider';
import { OnboardingGuard } from '@/features/auth/onboarding-guard';
import { REMINDER_KIND } from '@/features/recording/finish-reminder';
import { cleanUpRecorderOnLaunch } from '@/features/recording/recorder';
import { COUNTED_KIND } from '@/features/sync/counted-notification';
import { useUploadTrigger } from '@/features/sync/use-upload-trigger';
import { applySavedTheme } from '@/features/settings/appearance';
import { useAppFonts } from '@/theme/fonts';
import { useTheme } from '@/theme/use-theme';

// Public token (starts with pk.). Set EXPO_PUBLIC_MAPBOX_TOKEN in .env
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? null);

SplashScreen.preventAutoHideAsync();

// Dark / Light / System from Settings, applied before the first render so there is no flash of the wrong theme.
applySavedTheme();

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
  useUploadTrigger();
  // Only the FIRST load gates the UI. Later auth changes (sign-in, sign-out) must not unmount the navigator.
  const [started, setStarted] = useState(false);
  if (fontsReady && authReady && !started) setStarted(true); // latch during render (React "derived state" pattern)

  useEffect(() => {
    if (!started) return;
    SplashScreen.hideAsync();
    // GPS left running with no open drive (earlier stop failed): switch it off. Once the UI is up, so the app is in front.
    void cleanUpRecorderOnLaunch();
  }, [started]);

  // Tapping a notification: "Finish this drive?" opens the HUD (it shows its own finish dialog); "Your drive is counted" opens the recap.
  // Only after the navigator exists (started), so a tap that cold-starts the app is handled too.
  useEffect(() => {
    if (!started) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const data = r?.notification.request.content.data;
      if (data?.kind === REMINDER_KIND) router.push('/record/hud');
      // "Your drive is counted": open that drive's recap.
      if (data?.kind === COUNTED_KIND && typeof data.sessionId === 'number') {
        router.push({ pathname: '/record/recap', params: { id: String(data.sessionId) } });
      }
    };
    open(Notifications.getLastNotificationResponse());
    Notifications.clearLastNotificationResponse();
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      open(r);
      Notifications.clearLastNotificationResponse();
    });
    return () => sub.remove();
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
        <Stack.Screen name="badges" options={{ headerShown: false }} />
        <Stack.Screen name="garage" options={{ headerShown: false }} />
        <Stack.Screen name="garage-car" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="battery-guide" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
      </Stack>
      <OnboardingGuard />
    </>
  );
}
