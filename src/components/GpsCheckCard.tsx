import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { formatClockTime } from '@/lib/drive-format';
import { GAP_MIN_S, type GpsGap } from '@/lib/gaps';
import type { DriveSummary } from '@/lib/geo';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MAX_LISTED = 5;

function Row({ label, value }: { label: string; value: string }) {
  const { c, type, fonts } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[type.small, { color: c.muted }]}>{label}</Text>
      <Text style={[type.small, { color: c.text, fontFamily: fonts.bodyBold }]}>{value}</Text>
    </View>
  );
}

/**
 * GPS quality of one drive, for the field tests (plan.md 1.9/1.10): how many points were used,
 * the longest silence, and where and when the gaps were. Helps tell a tunnel from throttling.
 */
export function GpsCheckCard({ summary, gaps }: { summary: DriveSummary; gaps: GpsGap[] }) {
  const { c, type } = useTheme();
  const longest = [...gaps].sort((a, b) => b.durationS - a.durationS).slice(0, MAX_LISTED);

  return (
    <Card style={styles.card}>
      <Text style={[type.label, { color: c.muted }]}>GPS CHECK</Text>
      <Row label="Points used" value={`${summary.acceptedPoints} of ${summary.rawPoints}`} />
      <Row label="Longest gap" value={`${Math.round(summary.rawMaxGapS)} s`} />
      <Row label={`Gaps over ${GAP_MIN_S} s`} value={String(gaps.length)} />
      {longest.map((g) => (
        <View key={g.startTs} style={styles.gap}>
          <Text style={[type.caption, { color: c.text }]}>
            {formatClockTime(g.startTs)} · {Math.round(g.durationS)} s
          </Text>
          <Text style={[type.caption, { color: c.muted }]}>
            {g.lat.toFixed(4)}, {g.lng.toFixed(4)}
          </Text>
        </View>
      ))}
      {gaps.length > MAX_LISTED && (
        <Text style={[type.caption, { color: c.muted }]}>+ {gaps.length - MAX_LISTED} shorter gaps</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  gap: { flexDirection: 'row', justifyContent: 'space-between' },
});
