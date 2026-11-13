import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { LevelBar } from '@/components/LevelBar';
import { useAuth } from '@/features/auth/auth-provider';
import { useAvatarUrl } from '@/features/auth/avatar-photo';
import { formatCount } from '@/lib/format';
import { levelProgress } from '@/lib/levels';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function ProfileTab() {
  const { c, type, fonts } = useTheme();
  const { guest, profile, email, signInWithGoogle, signOut, refreshProfile } = useAuth();
  const photoUri = useAvatarUrl(profile?.avatar_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A drive may have just been counted: read level and XP again whenever the tab is shown (offline: keep what we have).
  useFocusEffect(
    useCallback(() => {
      if (!guest) refreshProfile().catch(() => undefined);
    }, [guest, refreshProfile]),
  );
  const progress = !guest && profile?.total_xp != null ? levelProgress(profile.total_xp) : null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <Header title="Profile" />

        {guest ? (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={[type.heading, { color: c.text }]}>You are driving as a guest</Text>
            <Text style={[type.body, { color: c.muted }]}>
              Make an account to sync your drives, earn badges and see friends. Your guest drives come with you.
            </Text>
            <Button
              label={busy ? 'Signing in…' : 'Create account with Google'}
              onPress={() => run(signInWithGoogle)}
              disabled={busy}
            />
          </View>
        ) : (
          <View style={styles.account}>
            <Avatar displayName={profile?.display_name} username={profile?.username} photoUri={photoUri} size={88} />
            <View style={styles.names}>
              <Text style={[type.heading, { color: c.text }]}>{profile?.display_name || profile?.username || 'Driver'}</Text>
              {profile?.username ? <Text style={[type.body, { color: c.muted }]}>@{profile.username}</Text> : null}
              {email ? <Text style={[type.caption, { color: c.muted }]}>{email}</Text> : null}
            </View>
          </View>
        )}

        {progress ? (
          <View
            accessible
            accessibilityLabel={`Level ${progress.level}, ${progress.intoLevel} of ${progress.needed} XP`}
            style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={styles.levelRow}>
              <View style={[styles.pill, { backgroundColor: c.accentFill }]}>
                <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 14 }}>{`Level ${progress.level}`}</Text>
              </View>
              <Text style={[type.caption, { color: c.muted }]}>
                {`${formatCount(progress.intoLevel)} / ${formatCount(progress.needed)} XP`}
              </Text>
            </View>
            <LevelBar fraction={progress.fraction} />
          </View>
        ) : null}

        {!guest && <Button label="Edit profile" variant="secondary" onPress={() => router.push('/edit-profile')} />}
        <Button label="Drive history" variant="secondary" onPress={() => router.push('/history')} />
        {!guest && <Button label="Garage" variant="secondary" onPress={() => router.push('/garage')} />}
        <Button label="Settings" variant="secondary" onPress={() => router.push('/settings')} />

        {!guest && (
          <Button label={busy ? 'Signing out…' : 'Sign out'} variant="ghost" onPress={() => run(signOut)} disabled={busy} />
        )}
        {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.lg, gap: space.md },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.xl, gap: space.md },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { height: 28, paddingHorizontal: 12, borderRadius: 14, justifyContent: 'center' },
  names: { flex: 1, gap: space.xs },
});
