import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GpsCheckCard } from '@/components/GpsCheckCard';
import { RouteArt } from '@/components/RouteArt';
import { loadDrive } from '@/features/recording/drive-history';
import { formatDateTimeRange } from '@/lib/drive-format';
import { formatDistanceKm, formatDuration, formatKmh1 } from '@/lib/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const { c, type, fonts } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${value}${unit ? ` ${unit}` : ''}`}
      style={[styles.tile, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[type.label, { color: c.muted }]}>{label.toUpperCase()}</Text>
      <Text style={[type.statTile, { color: c.text }]}>
        {value}
        {unit ? (
          <Text style={[type.caption, { color: c.muted, fontFamily: fonts.bodyMedium }]}>{` ${unit}`}</Text>
        ) : null}
      </Text>
    </View>
  );
}

export default function RecapScreen() {
  const { c, type, fonts } = useTheme();
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const [drive] = useState(() => (id ? loadDrive(Number(id)) : null));

  // Opened from the history list: go back to it. Right after a drive: go to the app.
  const done = () => (from === 'history' ? router.back() : router.replace('/'));

  if (!drive) {
    return (
      <SafeAreaView style={[styles.fill, styles.missing, { backgroundColor: c.bg }]}>
        <Text style={[type.heading, { color: c.text }]}>Drive not found</Text>
        <Text style={[type.body, { color: c.muted }]}>This drive is not on the phone any more.</Text>
        <Button label="Done" onPress={done} />
      </SafeAreaView>
    );
  }

  const s = drive.summary;
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={done}
            style={[styles.done, { backgroundColor: c.surface2, borderColor: c.line }]}>
            <Text style={{ color: c.text, fontFamily: fonts.bodyBold, fontSize: 15 }}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.head}>
          <Text accessibilityRole="header" style={[type.headline, { color: c.text }]}>
            Drive complete
          </Text>
          <Text style={[type.small, { color: c.muted }]}>{formatDateTimeRange(drive.startedAt, drive.endedAt)}</Text>
        </View>

        <View style={[styles.map, { backgroundColor: c.bg, borderColor: c.line }]}>
          <RouteArt coords={drive.route} height={176} thickness={4} glow markers grid="fine" padding={16} />
        </View>

        <View style={styles.row}>
          <Tile label="Distance" value={formatDistanceKm(s.distanceM)} unit="km" />
          <Tile label="Moving time" value={formatDuration(s.movingS)} />
        </View>
        <View style={styles.row}>
          <Tile label="Moving avg" value={formatKmh1(s.avgMovingKmh)} unit="km/h" />
          <Tile label="Overall avg" value={formatKmh1(s.avgOverallKmh)} unit="km/h" />
        </View>

        {/* Field-test aid (plan 1.9 / 1.10); decide later whether it moves behind a debug switch. */}
        <GpsCheckCard summary={s} gaps={drive.gaps} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { padding: space.xl, gap: space.md, justifyContent: 'center' },
  wrap: { padding: space.lg, gap: space.lg },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  done: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { gap: 6 },
  map: { height: 176, borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: 14, borderRadius: radius.md, borderWidth: 1, gap: 6 },
});
