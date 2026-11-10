import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GpsCheckCard } from '@/components/GpsCheckCard';
import { RouteArt } from '@/components/RouteArt';
import { Segmented } from '@/components/SettingsRow';
import { getCurrentOwner, getUpload, setSessionMode } from '@/features/recording/db';
import { loadDrive } from '@/features/recording/drive-history';
import { getSelectedVehicleId, readCachedCars } from '@/features/settings/prefs';
import { supabase } from '@/features/sync/supabase';
import { formatDateTimeRange } from '@/lib/drive-format';
import { formatDistanceKm, formatDuration, formatKmh1 } from '@/lib/format';
import { kindForMode, TRAVEL_MODE_LABEL, TRAVEL_MODES, vehicleForMode, type TravelMode } from '@/lib/travel-mode';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MODE_OPTIONS = TRAVEL_MODES.map((m) => ({ value: m, label: TRAVEL_MODE_LABEL[m] }));

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
  const owner = getCurrentOwner();
  // Signed in and counted: the numbers below are the SERVER's final ones (what XP and rankings use), not the phone's estimate.
  const [upload] = useState(() => (id ? getUpload(Number(id)) : null));
  const server = upload?.state === 'counted' ? upload.stats : null;
  const [mode, setMode] = useState<TravelMode>(drive?.mode ?? 'car');
  const [modeBusy, setModeBusy] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  // Opened from the history list: go back to it. Right after a drive: go to the app.
  const done = () => (from === 'history' ? router.back() : router.replace('/'));

  /** Correct how the drive was travelled. Mode and vehicle change together (the server only accepts a valid pair). */
  const changeMode = async (m: TravelMode) => {
    if (!drive || !upload || !owner || m === mode || modeBusy) return;
    setModeBusy(true);
    setModeError(null);
    const kind = kindForMode(m);
    const vehicleId = kind ? (vehicleForMode(readCachedCars(owner), m, getSelectedVehicleId(owner, kind))?.id ?? null) : null;
    const { data, error } = await supabase
      .from('drives')
      .update({ mode: m, vehicle_id: vehicleId })
      .eq('id', upload.driveUuid)
      .select('id');
    setModeBusy(false);
    if (error || !data || data.length === 0) {
      setModeError('Could not change it. Check your connection and try again.');
      return;
    }
    setSessionMode(drive.id, m, vehicleId);
    setMode(m);
  };

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
          <Text style={[type.small, { color: c.muted }]}>
            {formatDateTimeRange(drive.startedAt, drive.endedAt, server?.elapsedS ?? s.elapsedS)}
          </Text>
        </View>

        <View style={[styles.map, { backgroundColor: c.bg, borderColor: c.line }]}>
          <RouteArt coords={drive.route} height={176} thickness={4} glow markers grid="fine" padding={16} />
        </View>

        <View style={styles.row}>
          <Tile label="Distance" value={formatDistanceKm(server?.distanceM ?? s.distanceM)} unit="km" />
          <Tile label="Moving time" value={formatDuration(server?.movingS ?? s.movingS)} />
        </View>
        <View style={styles.row}>
          <Tile label="Moving avg" value={formatKmh1(server?.avgMovingKmh ?? s.avgMovingKmh)} unit="km/h" />
          <Tile label="Overall avg" value={formatKmh1(server?.avgOverallKmh ?? s.avgOverallKmh)} unit="km/h" />
        </View>

        {server ? (
          <View style={[styles.modeCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Segmented label="Travelled by" options={MODE_OPTIONS} value={mode} onChange={changeMode} />
            {modeError ? <Text style={[type.caption, styles.modeError, { color: c.danger }]}>{modeError}</Text> : null}
          </View>
        ) : owner ? (
          <Text style={[type.caption, { color: c.muted }]}>
            Saved on this phone. These numbers are the phone&apos;s estimate: the drive is not counted yet.
          </Text>
        ) : null}

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
  modeCard: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  modeError: { paddingHorizontal: space.lg, paddingBottom: space.md },
  tile: { flex: 1, padding: 14, borderRadius: radius.md, borderWidth: 1, gap: 6 },
});
