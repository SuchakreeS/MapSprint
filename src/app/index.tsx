import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const SPIKES = [
  { href: '/map', title: '1 · Mapbox map', body: 'Dark map, your location puck, camera follows you.' },
  { href: '/gps', title: '2 · Background GPS', body: 'Record with the screen off for 30 min. Pass if no gap over 5 s.' },
  { href: '/h3', title: '3 · H3 on Hermes', body: 'Hex cell maths runs on the phone and matches Node results.' },
] as const;

export default function SpikeHub() {
  const { c } = useTheme();
  const hasToken = !!process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={[styles.lead, { color: c.muted }]}>
        All three must pass before Phase 1 (Recorder) starts.
      </Text>
      {!hasToken && (
        <View style={[styles.warn, { borderColor: c.danger }]}>
          <Text style={{ color: c.danger, fontWeight: '700' }}>
            EXPO_PUBLIC_MAPBOX_TOKEN is missing. Add it to .env and restart Metro.
          </Text>
        </View>
      )}
      {SPIKES.map((s) => (
        <Link key={s.href} href={s.href} asChild>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: c.surface, borderColor: c.line, opacity: pressed ? 0.8 : 1 },
            ]}>
            <Text style={[styles.cardTitle, { color: c.text }]}>{s.title}</Text>
            <Text style={[styles.cardBody, { color: c.muted }]}>{s.body}</Text>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md },
  lead: { fontSize: 15, lineHeight: 22 },
  warn: { borderWidth: 1, borderRadius: radius.md, padding: space.md },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.xs, minHeight: 72 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  cardBody: { fontSize: 14, lineHeight: 20 },
});
