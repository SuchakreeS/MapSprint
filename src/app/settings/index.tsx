// Screen 26 Settings (design/screens/*/26-settings.png). Not built yet (no URLs / backend): Notifications,
// Help and feedback, Terms of Service, Privacy Policy (plan 5.2).
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Text } from 'react-native';

import { Divider, Segmented, SectionLabel, SettingsGroup, SettingsPage, SettingsRow } from '@/components/SettingsRow';
import { APP_NAME } from '@/constants/app';
import { useAuth } from '@/features/auth/auth-provider';
import { chooseTheme } from '@/features/settings/appearance';
import { getMapLook, getTheme, setMapLook } from '@/features/settings/prefs';
import type { MapLook } from '@/lib/map-look';
import type { ThemeChoice } from '@/lib/recording-settings';
import { useTheme } from '@/theme/use-theme';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
] as const;

// TEMPORARY map style test (src/lib/map-look.ts)
const MAP_LOOK_OPTIONS = [
  { value: 'dusk', label: 'Dusk' },
  { value: 'night-tint', label: 'Night+tint' },
  { value: 'night', label: 'Night' },
] as const;

export default function SettingsScreen() {
  const { c, type } = useTheme();
  const { guest, userId } = useAuth();
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme);
  const [mapLook, setMapLookState] = useState<MapLook>(getMapLook);
  const signedIn = !!userId && !guest;

  return (
    <SettingsPage title="Settings">
      {signedIn && (
        <>
          <SectionLabel>Account</SectionLabel>
          <SettingsGroup>
            <SettingsRow
              title="Account and data"
              caption="Sign-in, download or delete"
              onPress={() => router.push('/settings/account')}
            />
          </SettingsGroup>
        </>
      )}

      <SectionLabel>Preferences</SectionLabel>
      <SettingsGroup>
        {signedIn && (
          <>
            <SettingsRow title="Privacy" onPress={() => router.push('/settings/privacy')} />
            <Divider />
          </>
        )}
        <SettingsRow title="Recording" onPress={() => router.push('/settings/recording')} />
        <Divider />
        <Segmented
          label="Appearance"
          options={THEME_OPTIONS}
          value={theme}
          onChange={(v) => {
            setThemeState(v);
            chooseTheme(v);
          }}
        />
        <Divider />
        {/* TEMPORARY (2026-11-13): compare the dark map looks, then remove (src/lib/map-look.ts). */}
        <Segmented
          label="Map style (test, temporary)"
          options={MAP_LOOK_OPTIONS}
          value={mapLook}
          onChange={(v) => {
            setMapLookState(v);
            setMapLook(v);
          }}
        />
      </SettingsGroup>
      <Text style={[type.caption, { color: c.muted }]}>
        Dark mode only. Dusk = new look (B), Night + tint = fallback (A), Night = the old look. Applies to the Map tab, Pre-drive
        and the HUD. This row will be removed once one look is chosen.
      </Text>

      <Text style={[type.caption, { color: c.muted, marginTop: 12 }]}>
        {APP_NAME} {Constants.expoConfig?.version ?? ''}
      </Text>
    </SettingsPage>
  );
}
