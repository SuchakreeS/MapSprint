// Screen 29 Account and data (design/screens/*/29-account-data.png).
// Google-only for now, so Email/Password "Change" rows are not shown (EMAIL_AUTH_ENABLED is false).
// Download my data and Delete my account need Edge Functions (plan 2.6 gate, Opus session): shown disabled.
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Divider, SectionLabel, SettingsGroup, SettingsPage, SettingsRow } from '@/components/SettingsRow';
import { useAuth } from '@/features/auth/auth-provider';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function AccountScreen() {
  const { c, type } = useTheme();
  const { email, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut(); // the onboarding guard returns to Welcome
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPage title="Account and data">
      <SectionLabel>Sign-in</SectionLabel>
      <SettingsGroup>
        <SettingsRow title="Email" caption={email ?? undefined} />
        <Divider />
        <SettingsRow title="Google account" value="Connected" valueColor={c.success} />
      </SettingsGroup>
      <Button label={busy ? 'Signing out…' : 'Sign out'} variant="secondary" onPress={onSignOut} disabled={busy} />
      {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}

      <SectionLabel>Your data</SectionLabel>
      <SettingsGroup>
        <SettingsRow
          title="Download my data"
          caption="A copy of your profile, drives and GPS tracks. Coming soon."
          disabled
          onPress={() => undefined}
        />
      </SettingsGroup>

      <View style={[styles.danger, { borderColor: c.danger }]}>
        <Text style={[type.heading, { color: c.danger }]}>Delete account and data</Text>
        <Text style={[type.small, { color: c.muted }]}>
          Permanently deletes your profile, every drive and GPS track, your map and badges. Coming soon.
        </Text>
        <Button label="Delete my account" variant="danger" disabled onPress={() => undefined} />
      </View>
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  danger: { borderWidth: 1.5, borderRadius: radius.lg, padding: space.lg, gap: space.md, marginTop: space.md },
});
