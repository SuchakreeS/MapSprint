// Screen 27 Privacy (design/screens/*/27-privacy-settings.png).
// Real now: Private account (profiles.is_private) and Share max speed (profiles.share_max_speed): both columns have
// update grants and RLS tests. Not built yet, shown as "Coming soon": Default drive visibility (needs a new column),
// Privacy zones (Phase 4, before the Feed), Blocked people (no table yet).
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { Divider, SettingsGroup, SettingsPage, SettingsRow, SwitchRow } from '@/components/SettingsRow';
import { Switch } from '@/components/Switch';
import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/features/sync/supabase';
import { useTheme } from '@/theme/use-theme';

interface Flags {
  is_private: boolean;
  share_max_speed: boolean;
}

export default function PrivacySettingsScreen() {
  const { c, type } = useTheme();
  const { userId } = useAuth();
  /** null until the server answered (or it could not). */
  const [flags, setFlags] = useState<Flags | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    supabase
      .from('profiles')
      .select('is_private, share_max_speed')
      .eq('id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err || !data) setLoadFailed(true);
        else setFlags(data);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const change = async (patch: Partial<Flags>) => {
    if (!userId || !flags) return;
    const before = flags;
    setError(null);
    setFlags({ ...flags, ...patch }); // optimistic
    const { error: err } = await supabase.from('profiles').update(patch).eq('id', userId);
    if (err) {
      setFlags(before);
      setError('Could not save. Check your connection and try again.');
    }
  };

  const disabled = flags == null;

  return (
    <SettingsPage title="Privacy">
      <SettingsGroup>
        <SwitchRow>
          <Switch
            label="Private account"
            caption="New followers need your approval to see your drives."
            value={flags?.is_private ?? false}
            disabled={disabled}
            onValueChange={(v) => change({ is_private: v })}
          />
        </SwitchRow>
        <Divider />
        <SwitchRow>
          <Switch
            label="Share max speed"
            caption="Off by default. Max speed is never ranked or scored."
            value={flags?.share_max_speed ?? false}
            disabled={disabled}
            onValueChange={(v) => change({ share_max_speed: v })}
          />
        </SwitchRow>
      </SettingsGroup>

      {loadFailed ? (
        <Text style={[type.caption, { color: c.muted }]}>Connect to the internet to change these settings.</Text>
      ) : null}
      {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}

      <SettingsGroup>
        <SettingsRow title="Default drive visibility" caption="Coming soon" disabled onPress={() => undefined} />
        <Divider />
        <SettingsRow title="Privacy zones" caption="Coming soon" disabled onPress={() => undefined} />
        <Divider />
        <SettingsRow title="Blocked people" caption="Coming soon" disabled onPress={() => undefined} />
      </SettingsGroup>
    </SettingsPage>
  );
}
