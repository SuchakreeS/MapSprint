// Screen 02 Sign up / Log in (design 02, ScrSignIn.dc.html). Built but OFF: EMAIL_AUTH_ENABLED is false until
// email confirmation codes exist (see src/constants/app.ts). With the flag off this route sends you to Welcome.
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { BackIcon, EyeIcon } from '@/components/icons';
import { TextField } from '@/components/TextField';
import { APP_NAME, EMAIL_AUTH_ENABLED } from '@/constants/app';
import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/features/sync/supabase';
import { passwordProblem } from '@/lib/password';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Tab = 'signup' | 'login';

const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

export default function SignInScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const { c, type } = useTheme();
  const { signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<Tab>(params.tab === 'login' ? 'login' : 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!EMAIL_AUTH_ENABLED) return <Redirect href="/welcome" />;

  const pwProblem = tab === 'signup' && password.length > 0 ? passwordProblem(password) : null;
  const canSubmit = /\S+@\S+\.\S+/.test(email.trim()) && password.length > 0 && !pwProblem && !busy;

  const run = async (fn: () => Promise<void>) => {
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

  const onSubmit = () =>
    run(async () => {
      const creds = { email: email.trim(), password };
      const { error: err } =
        tab === 'signup' ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
      if (err) throw new Error(tab === 'signup' ? 'Could not create the account. Try a different email.' : 'Wrong email or password.');
    });

  const onGoogle = () =>
    run(async () => {
      await signInWithGoogle();
    });

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
            <BackIcon color={c.text} />
          </Pressable>
          <Text style={[type.wordmark, { color: c.gold, fontSize: 18, lineHeight: 24 }]}>{APP_NAME.toUpperCase()}</Text>
          <View style={styles.back} />
        </View>

        <View style={[styles.tabs, { backgroundColor: c.surface2 }]} accessibilityRole="tablist">
          {(['signup', 'login'] as const).map((t) => (
            <Pressable
              key={t}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && { backgroundColor: c.bg }]}>
              <Text style={[type.button, { color: tab === t ? c.text : c.muted }]}>
                {t === 'signup' ? 'Sign up' : 'Log in'}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text accessibilityRole="header" style={[type.headline, { color: c.text }]}>
          {tab === 'signup' ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text style={[type.body, { color: c.muted }]}>Your drives, map and badges sync across your phones.</Text>

        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
          hint={tab === 'signup' ? PASSWORD_HINT : undefined}
          status={pwProblem ? 'error' : 'normal'}
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={show ? 'Hide password' : 'Show password'}
              onPress={() => setShow((s) => !s)}
              hitSlop={12}>
              <EyeIcon color={c.muted} />
            </Pressable>
          }
        />

        <View style={styles.actions}>
          {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
          <Button label={tab === 'signup' ? 'Create account' : 'Log in'} onPress={onSubmit} disabled={!canSubmit} />
          <View style={styles.or}>
            <View style={[styles.rule, { backgroundColor: c.line }]} />
            <Text style={[type.caption, { color: c.muted }]}>or</Text>
            <View style={[styles.rule, { backgroundColor: c.line }]} />
          </View>
          <Button label="Continue with Google" variant="secondary" onPress={onGoogle} disabled={busy} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { padding: space.xl, gap: space.lg, flexGrow: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 44, height: 44, justifyContent: 'center' },
  tabs: { flexDirection: 'row', borderRadius: radius.lg, padding: space.xs },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: space.md, marginTop: 'auto' },
  or: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: 1 },
});
