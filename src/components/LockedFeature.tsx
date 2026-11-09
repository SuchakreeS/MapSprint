import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { useAuth } from '@/features/auth/auth-provider';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

interface Props {
  title: string;
  /** What an account unlocks here, one short sentence. */
  pitch: string;
}

/** Shown to guests where an account is needed (Feed, Ranks; later badges and the 3D replay). */
export function LockedFeature({ title, pitch }: Props) {
  const { c, type } = useTheme();
  const { userId, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle(); // onboarding guard then opens the profile step
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]}>
      <Header title={title} />
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[type.heading, { color: c.text }]}>Make an account to unlock this</Text>
        <Text style={[type.body, { color: c.muted }]}>{pitch}</Text>
        <Text style={[type.caption, { color: c.muted }]}>
          Drives you recorded as a guest come with you into your account.
        </Text>
        <Button label={busy ? 'Signing in…' : 'Continue with Google'} onPress={onSignIn} disabled={busy || userId != null} />
        {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.lg, gap: space.md },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.xl, gap: space.md },
});
