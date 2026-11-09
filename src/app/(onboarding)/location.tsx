import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { APP_NAME } from '@/constants/app';
import { useAuth } from '@/features/auth/auth-provider';
import { useLocationPermission } from '@/features/permissions/use-location-permission';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const REASONS = [
  { title: 'Speed and distance', body: 'Measured from GPS while a drive is running.' },
  { title: 'A map that fills in as you drive', body: 'New roads unlock and earn you XP.' },
  { title: 'Home and work stay hidden', body: 'Privacy zones hide the start and end of your drives.' },
];

// DRAFT wording: needs the privacy / PDPA review by an Opus session (see handoff.md).
const SUBTITLE =
  'Android will ask for your location. Choose “While using the app”. Recording keeps going with the screen off, and a notification shows while it does.';
const DISCLOSURE = `${APP_NAME} collects location data only while a drive is recording, between Start and Finish, even if your screen is off or another app is open. A notification stays on the whole time. Location is never used for ads.`;

export default function LocationScreen() {
  const { c, type, fonts } = useTheme();
  const { next, step, of } = useLocalSearchParams<{ next?: string; step?: string; of?: string }>();
  const { state, request, openSettings } = useLocationPermission();
  const { markLocationDone } = useAuth();

  // During onboarding, '/' hands over to the onboarding guard, which opens the next step (or the app).
  const done = () => {
    markLocationDone();
    router.replace(next === 'record' ? '/record/pre-drive' : '/');
  };
  const notNow = () => {
    markLocationDone();
    router.replace('/');
  };

  const onContinue = async () => {
    if ((await request()) === 'granted') done();
  };

  const blocked = state === 'blocked';
  const granted = state === 'granted';

  // Progress bar only when the onboarding flow passes ?step=3&of=5.
  const stepNo = Number(step);
  const stepTotal = Number(of) || 5;
  const showProgress = Number.isInteger(stepNo) && stepNo > 0;

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        {showProgress && (
          <View style={styles.progress}>
            <Text style={{ color: c.muted, fontFamily: fonts.bodyBold, fontSize: 13 }}>
              Step {stepNo} of {stepTotal}
            </Text>
            <View style={styles.bars}>
              {Array.from({ length: stepTotal }, (_, i) => (
                <View
                  key={i}
                  style={[styles.bar, { backgroundColor: i < stepNo ? c.primary : c.line }]}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.ring, styles.ringOuter, { borderColor: c.gold }]} />
          <View style={[styles.ring, styles.ringInner, { borderColor: c.gold }]} />
          <View style={[styles.core, { backgroundColor: c.accentFill }]}>
            <View style={[styles.coreDot, { backgroundColor: c.onAccent }]} />
          </View>
        </View>

        <View style={styles.block}>
          <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
            {blocked ? 'Location is turned off' : 'Turn on location to record your drives'}
          </Text>
          <Text style={[type.body, styles.lead, { color: c.muted }]}>
            {blocked
              ? 'Android will not ask again. Open settings, tap Permissions > Location and choose “Allow only while using the app”.'
              : SUBTITLE}
          </Text>
        </View>

        {!blocked && (
          <View style={styles.reasons}>
            {REASONS.map((r) => (
              <View key={r.title} style={styles.reason}>
                {/* Gold dot stands in for the icon until the icon library is decided. */}
                <View style={[styles.tile, { backgroundColor: c.surface2 }]}>
                  <View style={[styles.tileDot, { backgroundColor: c.gold }]} />
                </View>
                <View style={styles.reasonText}>
                  <Text style={[type.bodyStrong, { color: c.text }]}>{r.title}</Text>
                  <Text style={[type.small, styles.reasonBody, { color: c.muted }]}>{r.body}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <Text
          style={[
            type.caption,
            styles.notice,
            { color: c.muted, backgroundColor: c.surface, borderColor: c.line },
          ]}>
          {DISCLOSURE}
        </Text>

        <View style={styles.actions}>
          {granted ? (
            <Button label="Continue" onPress={done} />
          ) : blocked ? (
            <Button label="Open settings" onPress={openSettings} />
          ) : (
            <Button label="Continue" onPress={onContinue} disabled={state === null} />
          )}
          {!granted && <Button label="Not now" variant="ghost" onPress={notNow} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wrap: { flexGrow: 1, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, gap: 20 },
  progress: { gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  art: { height: 150, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5, borderRadius: 999 },
  ringOuter: { width: 132, height: 132, opacity: 0.25 },
  ringInner: { width: 88, height: 88, opacity: 0.45 },
  core: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  coreDot: { width: 7, height: 7, borderRadius: 4 },
  block: { gap: 8 },
  lead: { lineHeight: 22.5 },
  reasons: { gap: 14 },
  reason: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tile: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tileDot: { width: 10, height: 10, borderRadius: 5 },
  reasonText: { flex: 1, gap: 2 },
  reasonBody: { lineHeight: 20 },
  notice: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.notice,
    borderWidth: 1,
    overflow: 'hidden',
    lineHeight: 19.5,
  },
  actions: { gap: 8, marginTop: 'auto' },
});
