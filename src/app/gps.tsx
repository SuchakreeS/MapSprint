import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getActiveSessionId, getPoints, listSessions, type SessionRow } from '@/features/recording/db';
import { isRecording, startRecording, stopRecording } from '@/features/recording/recorder';
import { summarize, type DriveSummary } from '@/lib/geo';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Spike passes when a 30 min screen-off recording has no gap above this. */
const MAX_GAP_PASS_S = 5;

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

export default function GpsSpike() {
  const { c } = useTheme();
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<DriveSummary | null>(null);
  const [past, setPast] = useState<(SessionRow & { s: DriveSummary })[]>([]);

  const refresh = useCallback(async () => {
    setRecording(await isRecording());
    const id = getActiveSessionId();
    setLive(id != null ? summarize(getPoints(id)) : null);
    setPast(
      listSessions(5)
        .filter((r) => r.ended_at != null)
        .map((r) => ({ ...r, s: summarize(getPoints(r.id)) })),
    );
  }, []);

  useEffect(() => {
    // Poll the local DB once a second; the background task writes the points.
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh]);

  const toggle = async () => {
    setBusy(true);
    try {
      if (recording) await stopRecording();
      else await startRecording();
      await refresh();
    } catch (e) {
      Alert.alert('Could not change recording', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.h, { color: c.text }]}>How to run this test</Text>
        <Text style={[styles.p, { color: c.muted }]}>
          1. Set battery to Unrestricted (below).{'\n'}2. Tap Start, check the notification shows.{'\n'}3. Lock the
          phone and drive or walk for 30 min.{'\n'}4. Unlock, tap Stop. PASS if “max gap” is {MAX_GAP_PASS_S} s or less.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.gold }]}>
        <Text style={[styles.h, { color: c.text }]}>Samsung battery setting</Text>
        <Text style={[styles.p, { color: c.muted }]}>
          App info → Battery → choose “Unrestricted”. Otherwise Samsung may pause GPS when the screen is off.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => Linking.openSettings()}
          style={[styles.secondary, { backgroundColor: c.surface2, borderColor: c.line }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Open app settings</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.h, { color: c.text }]}>{recording ? 'Recording…' : 'Not recording'}</Text>
        <View style={styles.grid}>
          <Stat label="POINTS" value={live ? String(live.rawPoints) : '–'} c={c} />
          <Stat label="SPEED km/h" value={live?.lastKmh != null ? live.lastKmh.toFixed(0) : '–'} c={c} />
          <Stat label="DISTANCE km" value={live ? (live.distanceM / 1000).toFixed(2) : '–'} c={c} />
          <Stat label="MOVING AVG" value={live ? live.avgMovingKmh.toFixed(1) : '–'} c={c} />
          <Stat label="TIME" value={live ? fmtTime(live.elapsedS) : '–'} c={c} />
          <Stat
            label="MAX GAP s"
            value={live ? live.rawMaxGapS.toFixed(0) : '–'}
            c={c}
            color={live && live.rawMaxGapS > MAX_GAP_PASS_S ? c.danger : undefined}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={toggle}
          style={[styles.primary, { backgroundColor: c.primary, opacity: busy ? 0.5 : 1 }]}>
          <Text style={{ color: c.onPrimary, fontWeight: '800', fontSize: 17 }}>
            {recording ? 'Stop recording' : 'Start recording'}
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.h, { color: c.text }]}>Past test runs</Text>
      {past.length === 0 && <Text style={{ color: c.muted }}>None yet.</Text>}
      {past.map((r) => {
        const pass = r.s.elapsedS >= 1800 && r.s.rawMaxGapS <= MAX_GAP_PASS_S;
        return (
          <View key={r.id} style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Text style={{ color: pass ? c.success : c.muted, fontWeight: '800', width: 52 }}>
              {pass ? 'PASS' : r.s.elapsedS < 1800 ? 'SHORT' : 'FAIL'}
            </Text>
            <Text style={{ color: c.text, flex: 1 }}>
              #{r.id} · {fmtTime(r.s.elapsedS)} · {r.s.rawPoints} pts · max gap {r.s.rawMaxGapS.toFixed(0)} s ·{' '}
              {(r.s.distanceM / 1000).toFixed(2)} km
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function Stat({ label, value, c, color }: { label: string; value: string; c: { muted: string; text: string }; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>{label}</Text>
      <Text style={{ color: color ?? c.text, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  h: { fontSize: 17, fontWeight: '700' },
  p: { fontSize: 14, lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  stat: { width: '33.33%', gap: 2 },
  primary: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  secondary: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
