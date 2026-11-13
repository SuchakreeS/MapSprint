// XP card on the drive recap (design 10): "+N XP", level pill, 12-LED bar, breakdown. Server numbers only (counted drives).
// The smooth bonus row stays hidden until 3.5; no fake data. A drive that crossed a level shows the up arrow (design) and a line.
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { formatCount } from '@/lib/format';
import { levelProgress, levelUp } from '@/lib/levels';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import type { DriveXpStats } from '@/lib/upload-queue';

import { LevelBar } from './LevelBar';

function Row({ label, value }: { label: string; value: string }) {
  const { c, type, fonts } = useTheme();
  return (
    <View style={styles.line}>
      <Text style={[type.small, { color: c.muted }]}>{label}</Text>
      <Text style={[type.small, { color: c.text, fontFamily: fonts.bodyBold }]}>{value}</Text>
    </View>
  );
}

export function XpCard({ xp, totalXp }: { xp: DriveXpStats; totalXp: number | undefined }) {
  const { c, type, fonts } = useTheme();
  const progress = totalXp != null ? levelProgress(totalXp) : null;
  const up = totalXp != null ? levelUp(totalXp, xp.total) : null;
  return (
    <View
      accessible
      accessibilityLabel={`${xp.total} XP earned${up ? `, level up to ${up.to}` : progress ? `, level ${progress.level}` : ''}`}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={styles.head}>
        <View style={styles.big}>
          <Text style={{ color: c.primaryText, fontFamily: fonts.displayBold, fontSize: 48, lineHeight: 52 }}>{`+${formatCount(xp.total)}`}</Text>
          <Text style={[type.heading, { color: c.text }]}> XP</Text>
        </View>
        {progress ? (
          <View style={[styles.pill, { backgroundColor: c.accentFill }]}>
            {up ? (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c.onAccent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 19V5" />
                <Path d="M5 12l7-7 7 7" />
              </Svg>
            ) : null}
            <Text style={{ color: c.onAccent, fontFamily: fonts.bodyBold, fontSize: 14 }}>{`Level ${progress.level}`}</Text>
          </View>
        ) : null}
      </View>
      {up ? (
        <Text style={[type.small, { color: c.text, fontFamily: fonts.bodyBold }]}>
          {up.to - up.from > 1 ? `Level up! ${up.from} → ${up.to}` : `Level up! You reached level ${up.to}.`}
        </Text>
      ) : null}
      {progress ? (
        <View style={styles.bar}>
          <LevelBar fraction={progress.fraction} />
          <View style={styles.line}>
            <Text style={[type.caption, { color: c.muted }]}>{`Level ${progress.level}`}</Text>
            <Text style={[type.caption, { color: c.muted }]}>
              {`${formatCount(progress.intoLevel)} / ${formatCount(progress.needed)} XP`}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={[styles.divider, { backgroundColor: c.line }]} />
      <View>
        <Row label="Distance" value={`+${formatCount(xp.distance)}`} />
        <Row label="New cells" value={`+${formatCount(xp.newCells)}`} />
        {xp.firstDrive > 0 ? <Row label="First drive today" value={`+${formatCount(xp.firstDrive)}`} /> : null}
        {xp.badges != null && xp.badges > 0 ? <Row label="Badges" value={`+${formatCount(xp.badges)}`} /> : null}
      </View>
      {xp.capped ? <Text style={[type.caption, { color: c.muted }]}>Daily distance XP limit reached.</Text> : null}
      {xp.tooOld ? <Text style={[type.caption, { color: c.muted }]}>Drives older than 60 days earn no XP.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.lg, borderRadius: radius.lg, borderWidth: 1, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  big: { flexDirection: 'row', alignItems: 'baseline' },
  pill: { height: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bar: { gap: space.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  divider: { height: 1 },
});
