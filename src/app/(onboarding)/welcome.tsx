// Screen 01 Welcome (design/screens/*/01-welcome.png, design/source/ScrWelcome.dc.html).
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/Button';
import { MailIcon } from '@/components/icons';
import { APP_NAME, EMAIL_AUTH_ENABLED } from '@/constants/app';
import { useAuth } from '@/features/auth/auth-provider';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const ROUTE = 'M30 460 L80 460 L80 380 L200 380 L200 260 L310 260 L310 140';

/** Blueprint grid + a route clearing the map (scaled from the design's 390 x 560 art). */
function WelcomeArt({ width }: { width: number }) {
  const { c, mode } = useTheme();
  const height = (width / 390) * 560;
  return (
    <Svg width={width} height={height} viewBox="0 0 390 560" style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern id={`grid-${mode}`} width={22} height={22} patternUnits="userSpaceOnUse">
          <Path d="M22 0 H0 V22" fill="none" stroke={c.muted} strokeWidth={0.6} opacity={0.25} />
        </Pattern>
        <LinearGradient id={`fade-${mode}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.55" stopColor={c.bg} stopOpacity={0} />
          <Stop offset="1" stopColor={c.bg} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="390" height="560" fill={`url(#grid-${mode})`} />
      <Path
        d="M0 140 H390 M0 260 H390 M0 380 H390 M80 0 V560 M200 0 V560 M310 0 V560"
        fill="none"
        stroke={c.muted}
        strokeWidth={1}
        opacity={0.5}
      />
      <Path d="M0 330 L390 120" fill="none" stroke={c.muted} strokeWidth={1.4} strokeDasharray="6 4" opacity={0.7} />
      <Path d={ROUTE} fill="none" stroke={c.explored} strokeWidth={64} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={ROUTE} fill="none" stroke={c.primaryText} strokeOpacity={0.2} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={ROUTE} fill="none" stroke={c.primaryText} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="310" cy="140" r="28" fill={c.primaryText} fillOpacity={0.16} />
      <Path d="M310 122 L323 153 L310 145 L297 153 Z" fill={c.primaryText} stroke={c.bg} strokeWidth={2.5} strokeLinejoin="round" />
      <Rect x="0" y="0" width="390" height="560" fill={`url(#fade-${mode})`} />
    </Svg>
  );
}

export default function WelcomeScreen() {
  const { c, type, fonts } = useTheme();
  const { width } = useWindowDimensions();
  const { userId, signInWithGoogle, continueAsGuest } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After sign-in the guard waits for the profile; keep the buttons locked until it moves on.
  const locked = busy || userId != null;

  // The onboarding guard moves on by itself once signed in or once "guest" is chosen.
  const onGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <WelcomeArt width={width} />
      <SafeAreaView style={styles.fill} edges={['bottom']}>
        <View style={styles.bottom}>
          <Text style={[type.wordmark, { color: c.gold, fontSize: 22, lineHeight: 28 }]}>
            {APP_NAME.toUpperCase()}
          </Text>
          <Text accessibilityRole="header" style={{ color: c.text, fontFamily: fonts.headingBold, fontSize: 40, lineHeight: 46 }}>
            Every drive clears the map.
          </Text>
          <Text style={[type.body, { color: c.muted, fontSize: 17, lineHeight: 25 }]}>
            Track your drives, explore new roads and level up with friends.
          </Text>

          <View style={styles.actions}>
            <Button label={busy ? 'Signing in…' : 'Continue with Google'} onPress={onGoogle} disabled={locked} />
            {EMAIL_AUTH_ENABLED && (
              <Button
                label="Sign up with email"
                variant="secondary"
                leading={(col) => <MailIcon color={col} />}
                onPress={() => router.push({ pathname: '/sign-in', params: { tab: 'signup' } })}
              />
            )}
            {error ? <Text style={[type.caption, { color: c.danger }]}>{error}</Text> : null}
            {EMAIL_AUTH_ENABLED && (
              <Button
                label="Already have an account? Log in"
                variant="ghost"
                onPress={() => router.push({ pathname: '/sign-in', params: { tab: 'login' } })}
              />
            )}
            <Button label="Continue as guest" variant="ghost" onPress={continueAsGuest} disabled={locked} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.md },
  actions: { gap: space.md, marginTop: space.lg },
});
