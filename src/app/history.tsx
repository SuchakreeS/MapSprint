import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { RouteArt } from '@/components/RouteArt';
import { loadDrives, type DriveItem } from '@/features/recording/drive-history';
import { driveTitle, formatDriveCount, formatDriveDay, groupByMonth } from '@/lib/drive-format';
import { formatDistanceKm, formatDuration } from '@/lib/format';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function DriveRow({ drive }: { drive: DriveItem }) {
  const { c, type, fonts } = useTheme();
  const s = drive.summary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${driveTitle(drive.startedAt)}, ${formatDriveDay(drive.startedAt)}, ${formatDistanceKm(s.distanceM, 1)} kilometres`}
      onPress={() => router.push({ pathname: '/record/recap', params: { id: String(drive.id), from: 'history' } })}
      style={({ pressed }) => [styles.row, { borderBottomColor: c.line, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.thumb, { backgroundColor: c.surface, borderColor: c.line }]}>
        <RouteArt coords={drive.route} width={54} height={54} thickness={3} padding={9} grid="cross" />
      </View>
      <View style={styles.text}>
        <Text style={[type.bodyStrong, { color: c.text }]} numberOfLines={1}>
          {driveTitle(drive.startedAt)}
        </Text>
        <Text style={[type.caption, { color: c.muted }]}>
          {formatDriveDay(drive.startedAt)} · {formatDistanceKm(s.distanceM, 1)} km
        </Text>
      </View>
      <Text style={{ color: c.primaryText, fontFamily: fonts.bodyBold, fontSize: 14 }}>{formatDuration(s.elapsedS)}</Text>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const { c, type } = useTheme();
  const [drives] = useState(() => loadDrives());
  const groups = useMemo(() => groupByMonth(drives), [drives]);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Header title="Drive history" onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {groups.length === 0 ? (
          <Text style={[type.body, { color: c.muted }]}>
            No drives yet. Tap Record to start your first one.
          </Text>
        ) : (
          groups.map((g) => (
            <View key={g.label} style={styles.group}>
              <View style={styles.month}>
                <Text style={[type.label, { color: c.muted }]}>{g.label}</Text>
                <Text style={[type.label, { color: c.muted }]}>{formatDriveCount(g.items.length)}</Text>
              </View>
              {g.items.map((d) => (
                <DriveRow key={d.id} drive={d} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: space.sm },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, paddingTop: space.sm, gap: 14 },
  group: { gap: 4 },
  month: { paddingVertical: space.sm, flexDirection: 'row', justifyContent: 'space-between' },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.sm, borderWidth: 1, overflow: 'hidden' },
  text: { flex: 1, gap: 3 },
});
