import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { useAuth } from '@/features/auth/auth-provider';
import { useAvatarUrl } from '@/features/auth/avatar-photo';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function ProfileTab() {
  const { c, type } = useTheme();
  const { guest, profile, email, signInWithGoogle, signOut } = useAuth();
  const photoUri = useAvatarUrl(profile?.avatar_url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  names: { flex: 1, gap: space.xs },
});
