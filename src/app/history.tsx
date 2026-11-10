import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Header } from '@/components/Header';
import { RouteArt } from '@/components/RouteArt';
import { getCurrentOwner, listUploads, type UploadRecord } from '@/features/recording/db';
import { loadDrives, type DriveItem } from '@/features/recording/drive-history';
import { retryUploadsNow } from '@/features/sync/upload-runner';
import { driveTitle, formatDriveCount, formatDriveDay, groupByMonth } from '@/lib/drive-format';
import { formatDistanceKm, formatDuration } from '@/lib/format';
import { historyStatus, rejectReasonText } from '@/lib/upload-queue';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function DriveRow({ drive, upload, signedIn }: { drive: DriveItem; upload: UploadRecord | undefined; signedIn: boolean }) {
  const { c, type, fonts } = useTheme();
  const s = drive.summary;
  // Guests have no upload status: their drives only live on this phone until they make an account.
  const status = signedIn ? historyStatus(upload) : null;
  const open = () => router.push({ pathname: '/record/recap', params: { id: String(drive.id), from: 'history' } });
  const onPress = () => {
    if (!status || status.tone === 'good') return open();
    if (status.tone === 'muted') {
      // Waiting or uploading: the recap opens once the drive is counted (PS decision).
      Alert.alert('Not counted yet', "This drive is safe on your phone. It uploads by itself when you're back online and gets counted.", [
        { text: 'OK', style: 'cancel' },
        { text: 'View on this phone', onPress: open },
      ]);
    } else {
      Alert.alert("Couldn't count this drive", rejectReasonText(upload?.reason), [
        { text: 'OK', style: 'cancel' },
        { text: 'View on this phone', onPress: open },
      ]);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${driveTitle(drive.startedAt)}, ${formatDriveDay(drive.startedAt)}, ${formatDistanceKm(s.distanceM, 1)} kilometres`}
      onPress={onPress}
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
        {status ? (
          <Text style={[type.caption, { color: status.tone === 'good' ? c.success : status.tone === 'bad' ? c.danger : c.muted }]}>
            {status.label}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: c.primaryText, fontFamily: fonts.bodyBold, fontSize: 14 }}>{formatDuration(s.elapsedS)}</Text>
    </Pressable>
  );
}

export default function HistoryScreen() {
  const { c, type } = useTheme();
  const [drives, setDrives] = useState(() => loadDrives());
  const groups = useMemo(() => groupByMonth(drives), [drives]);
  const owner = getCurrentOwner();
  const signedIn = owner != null;
  const [uploads, setUploads] = useState<UploadRecord[]>(() => (owner ? listUploads(owner) : []));
  const [refreshing, setRefreshing] = useState(false);
  const byId = useMemo(() => new Map(uploads.map((u) => [u.sessionId, u])), [uploads]);

  // Statuses change by themselves while the queue works: re-read them every few seconds while this screen is open.
  useEffect(() => {
    if (!owner) return;
    const timer = setInterval(() => setUploads(listUploads(owner)), 3000);
    return () => clearInterval(timer);
  }, [owner]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await retryUploadsNow();
    setDrives(loadDrives());
    setUploads(owner ? listUploads(owner) : []);
    setRefreshing(false);
  }, [owner]);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.header}>
        <Header title="Drive history" onBack={() => router.back()} />
      </View>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={signedIn ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
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
                <DriveRow key={d.id} drive={d} upload={byId.get(d.id)} signedIn={signedIn} />
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
