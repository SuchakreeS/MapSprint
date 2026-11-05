import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useLocationPermission } from '@/features/permissions/use-location-permission';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const REASONS = [
  'Only used while you record. Never in the background.',
  'Recording shows a notification, so you always know when it is on.',
  'Your exact start and end stay private (privacy zones come later).',
];

export default function LocationScreen() {
  const { c, type } = useTheme();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { state, request, openSettings } = useLocationPermission();

  const done = () => router.replace(next === 'record' ? '/record/pre-drive' : '/');

  const onAllow = async () => {
    if ((await request()) === 'granted') done();
  };

  const blocked = state === 'blocked';
  const granted = state === 'granted';

  return (
    <SafeAreaView style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={styles.top}>
        <Text style={[type.label, { color: c.gold }]}>LOCATION</Text>
        <Text style={[type.title, { color: c.text }]}>
          {blocked ? 'Location is turned off' : 'Let Mapsprint see where you drive'}
        </Text>
        <Text style={[type.body, { color: c.muted }]}>
          {blocked
            ? 'Android will not ask again. Open settings, tap Permissions > Location and choose "Allow only while using the app".'
            : 'We need your location to draw your route and uncover the map as you go.'}
        </Text>
        {!blocked && (
          <Card style={styles.card}>
            {REASONS.map((r) => (
              <Text key={r} style={[type.body, { color: c.text }]}>
                {'•  '}
                {r}
              </Text>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.actions}>
        {granted ? (
          <Button label="Continue" onPress={done} />
        ) : blocked ? (
          <Button label="Open settings" onPress={openSettings} />
        ) : (
          <Button label="Allow location" onPress={onAllow} disabled={state === null} />
        )}
        {!granted && <Button label="Not now" variant="secondary" onPress={() => router.replace('/')} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: space.lg, justifyContent: 'space-between' },
  top: { gap: space.md, paddingTop: space.xxl },
  card: { gap: space.md },
  actions: { gap: space.md },
});
